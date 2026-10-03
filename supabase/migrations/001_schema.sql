-- ==============================================================================
-- FreeBids (freebids.lol) database schema.
--
-- A free board of websites and X profiles. A flag's rank is the number of
-- visits that arrived through its referral link (/f/<slug>) in the last 7 days;
-- only verified flags are ranked. A visitor counts at most once per flag every
-- 3 hours, and so does one IP address.
--
-- The Sponsored strip runs on prepaid ad credit that the operator adds from the
-- admin console. Each unique viewer and each click-through drains the credit
-- once per sponsor per day. Money is stored in micro-dollars
-- (1 USD = 1,000,000). Sponsorship never affects rank.
--
-- Safe to run on a fresh project or on a database created by the earlier
-- migrations: obsolete objects are dropped and everything else is IF NOT EXISTS
-- or CREATE OR REPLACE. Only the server talks to the database (service role).
-- ==============================================================================

-- ---------------------------------------------------------------------------
-- Objects from earlier versions (paid claims, conquests, Stripe checkout)
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.fulfill_claim(UUID, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.fulfill_claim(UUID, TEXT);
DROP FUNCTION IF EXISTS public.refund_claim(TEXT);
DROP FUNCTION IF EXISTS public.flag_rank(UUID);
-- Its output column was renamed (visitors_7d -> visits_7d), which CREATE OR REPLACE cannot do.
DROP FUNCTION IF EXISTS public.board_week();
DROP TABLE IF EXISTS public.conquests, public.claims, public.processed_stripe_events CASCADE;
DROP INDEX IF EXISTS public.idx_flags_board;
DROP INDEX IF EXISTS public.idx_flags_sponsored;
ALTER TABLE IF EXISTS public.flags
    DROP COLUMN IF EXISTS total_cents,
    DROP COLUMN IF EXISTS claim_count,
    DROP COLUMN IF EXISTS ranked_at,
    DROP COLUMN IF EXISTS sponsored_until;

-- Visits used to be deduplicated per calendar day (a "day" column with unique keys).
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'flag_visits' AND column_name = 'day'
    ) THEN
        DROP TABLE public.flag_visits;
    END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    -- Normalized identity: "x:handle", "example.com", or "github.com/owner/repo" for platform links.
    target_key TEXT UNIQUE NOT NULL,
    target_kind TEXT NOT NULL CHECK (target_kind IN ('website', 'x')),
    url TEXT NOT NULL,
    name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
    tagline TEXT CHECK (tagline IS NULL OR char_length(tagline) <= 90),
    category TEXT NOT NULL,
    color TEXT NOT NULL CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
    logo_url TEXT,
    clicks BIGINT NOT NULL DEFAULT 0,
    hidden BOOLEAN NOT NULL DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    verify_token TEXT,
    owner_email TEXT,
    ad_balance_micros BIGINT NOT NULL DEFAULT 0 CHECK (ad_balance_micros >= 0),
    ad_funded_micros BIGINT NOT NULL DEFAULT 0,
    ad_spent_micros BIGINT NOT NULL DEFAULT 0,
    ad_views BIGINT NOT NULL DEFAULT 0,
    ad_clicks BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flags_ranked ON public.flags (created_at) WHERE hidden = FALSE AND verified_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_flags_ad_balance ON public.flags (ad_balance_micros DESC) WHERE ad_balance_micros > 0;

-- One row per counted referral visit.
CREATE TABLE IF NOT EXISTS public.flag_visits (
    id BIGSERIAL PRIMARY KEY,
    flag_id UUID NOT NULL REFERENCES public.flags(id) ON DELETE CASCADE,
    visitor_id TEXT NOT NULL,
    ip_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flag_visits_visitor ON public.flag_visits (flag_id, visitor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_flag_visits_ip ON public.flag_visits (flag_id, ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_flag_visits_recent ON public.flag_visits (created_at, flag_id);

-- One row per charged Sponsored-strip view or click.
CREATE TABLE IF NOT EXISTS public.ad_events (
    id BIGSERIAL PRIMARY KEY,
    flag_id UUID NOT NULL REFERENCES public.flags(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('view', 'click')),
    visitor_id TEXT NOT NULL,
    ip_hash TEXT NOT NULL,
    cost_micros BIGINT NOT NULL,
    day DATE NOT NULL DEFAULT (TIMEZONE('utc', NOW()))::DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (flag_id, kind, visitor_id, day),
    UNIQUE (flag_id, kind, ip_hash, day)
);

CREATE INDEX IF NOT EXISTS idx_ad_events_day ON public.ad_events (day, flag_id);

-- Site-wide visitor and page view totals.
CREATE TABLE IF NOT EXISTS public.site_counters (
    id TEXT PRIMARY KEY,
    visitors BIGINT NOT NULL DEFAULT 0,
    page_views BIGINT NOT NULL DEFAULT 0
);
INSERT INTO public.site_counters (id) VALUES ('global') ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.site_visitors (
    visitor_id TEXT PRIMARY KEY,
    first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique visitors per UTC day, for the "visitors today" counter. Rows older than a few days are pruned.
CREATE TABLE IF NOT EXISTS public.site_daily_visitors (
    day DATE NOT NULL DEFAULT (TIMEZONE('utc', NOW()))::DATE,
    visitor_id TEXT NOT NULL,
    PRIMARY KEY (day, visitor_id)
);

-- ---------------------------------------------------------------------------
-- Visits and ranking
-- ---------------------------------------------------------------------------

-- Returns TRUE when the visit counted, FALSE when this visitor or IP already counted
-- for the flag in the last 3 hours (a rolling window).
CREATE OR REPLACE FUNCTION public.record_flag_visit(p_flag_id UUID, p_visitor_id TEXT, p_ip_hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Serializes visits per flag so two concurrent requests cannot both pass the check.
    PERFORM pg_advisory_xact_lock(hashtextextended(p_flag_id::TEXT, 0));

    IF EXISTS (
        SELECT 1 FROM public.flag_visits
        WHERE flag_id = p_flag_id
          AND (visitor_id = p_visitor_id OR ip_hash = p_ip_hash)
          AND created_at > NOW() - INTERVAL '3 hours'
    ) THEN
        RETURN FALSE;
    END IF;

    INSERT INTO public.flag_visits (flag_id, visitor_id, ip_hash) VALUES (p_flag_id, p_visitor_id, p_ip_hash);

    IF random() < 0.01 THEN
        DELETE FROM public.flag_visits WHERE created_at < NOW() - INTERVAL '8 days';
    END IF;

    RETURN TRUE;
END;
$$;

-- Counted visits per ranked flag over the last 7 days (rolling).
CREATE OR REPLACE FUNCTION public.board_week()
RETURNS TABLE (flag_id UUID, visits_7d INTEGER)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT f.id, COUNT(v.id)::INTEGER
    FROM public.flags f
    LEFT JOIN public.flag_visits v
        ON v.flag_id = f.id AND v.created_at > NOW() - INTERVAL '7 days'
    WHERE f.hidden = FALSE AND f.verified_at IS NOT NULL
    GROUP BY f.id;
$$;

-- Visits per day for one flag, for spotting traffic spikes in the admin console.
CREATE OR REPLACE FUNCTION public.flag_visit_days(p_flag_id UUID, p_days INTEGER DEFAULT 14)
RETURNS TABLE (day DATE, visits INTEGER)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT (v.created_at AT TIME ZONE 'utc')::DATE AS day, COUNT(*)::INTEGER
    FROM public.flag_visits v
    WHERE v.flag_id = p_flag_id AND v.created_at > NOW() - make_interval(days => p_days)
    GROUP BY 1
    ORDER BY 1 DESC;
$$;

CREATE OR REPLACE FUNCTION public.record_flag_click(p_flag_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.flags SET clicks = clicks + 1 WHERE id = p_flag_id;
$$;

CREATE OR REPLACE FUNCTION public.record_site_visit(p_visitor_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new INTEGER;
BEGIN
    INSERT INTO public.site_visitors (visitor_id) VALUES (p_visitor_id) ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_new = ROW_COUNT;
    UPDATE public.site_counters
    SET page_views = page_views + 1,
        visitors = visitors + v_new
    WHERE id = 'global';

    INSERT INTO public.site_daily_visitors (visitor_id) VALUES (p_visitor_id) ON CONFLICT DO NOTHING;
    IF random() < 0.01 THEN
        DELETE FROM public.site_daily_visitors WHERE day < (TIMEZONE('utc', NOW()))::DATE - 3;
    END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Sponsored strip (prepaid ad credit)
-- ---------------------------------------------------------------------------

-- Charges each listed flag that still has credit. Returns how many charges were made.
CREATE OR REPLACE FUNCTION public.charge_ad(
    p_flag_ids UUID[],
    p_kind TEXT,
    p_visitor_id TEXT,
    p_ip_hash TEXT,
    p_cost_micros BIGINT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_flag RECORD;
    v_cost BIGINT;
    v_new INTEGER;
    v_charged INTEGER := 0;
BEGIN
    IF p_kind NOT IN ('view', 'click') OR p_cost_micros <= 0 THEN
        RAISE EXCEPTION 'BAD_CHARGE';
    END IF;

    FOR v_flag IN
        SELECT id, ad_balance_micros FROM public.flags
        WHERE id = ANY(p_flag_ids) AND ad_balance_micros > 0 AND hidden = FALSE AND verified_at IS NOT NULL
        FOR UPDATE
    LOOP
        v_cost := LEAST(v_flag.ad_balance_micros, p_cost_micros);
        INSERT INTO public.ad_events (flag_id, kind, visitor_id, ip_hash, cost_micros)
        VALUES (v_flag.id, p_kind, p_visitor_id, p_ip_hash, v_cost)
        ON CONFLICT DO NOTHING;
        GET DIAGNOSTICS v_new = ROW_COUNT;
        IF v_new > 0 THEN
            UPDATE public.flags
            SET ad_balance_micros = ad_balance_micros - v_cost,
                ad_spent_micros = ad_spent_micros + v_cost,
                ad_views = ad_views + CASE WHEN p_kind = 'view' THEN 1 ELSE 0 END,
                ad_clicks = ad_clicks + CASE WHEN p_kind = 'click' THEN 1 ELSE 0 END
            WHERE id = v_flag.id;
            v_charged := v_charged + 1;
        END IF;
    END LOOP;

    IF random() < 0.01 THEN
        DELETE FROM public.ad_events WHERE day < (TIMEZONE('utc', NOW()))::DATE - 35;
    END IF;

    RETURN v_charged;
END;
$$;

-- Adds (or with a negative amount, removes) credit. The balance never goes below zero.
CREATE OR REPLACE FUNCTION public.fund_ad(p_flag_id UUID, p_micros BIGINT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_balance BIGINT;
BEGIN
    UPDATE public.flags
    SET ad_funded_micros = ad_funded_micros + GREATEST(p_micros, -ad_balance_micros),
        ad_balance_micros = GREATEST(0, ad_balance_micros + p_micros),
        updated_at = NOW()
    WHERE id = p_flag_id
    RETURNING ad_balance_micros INTO v_balance;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'FLAG_NOT_FOUND';
    END IF;
    RETURN v_balance;
END;
$$;

-- ---------------------------------------------------------------------------
-- Security: only the server (service role) reads or writes.
-- ---------------------------------------------------------------------------

ALTER TABLE public.flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flag_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_daily_visitors ENABLE ROW LEVEL SECURITY;

REVOKE EXECUTE ON FUNCTION public.record_flag_visit(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.board_week() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.flag_visit_days(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_flag_click(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_site_visit(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.charge_ad(UUID[], TEXT, TEXT, TEXT, BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fund_ad(UUID, BIGINT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.record_flag_visit(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.board_week() TO service_role;
GRANT EXECUTE ON FUNCTION public.flag_visit_days(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_flag_click(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_site_visit(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.charge_ad(UUID[], TEXT, TEXT, TEXT, BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fund_ad(UUID, BIGINT) TO service_role;

NOTIFY pgrst, 'reload schema';
