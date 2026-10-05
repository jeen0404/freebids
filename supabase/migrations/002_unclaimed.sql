-- Unclaimed listings: products the operator added from public launch boards.
-- They show in a separate "not claimed yet" list with no rank and no visit count,
-- and join the ranked board only after their owner verifies ownership.

ALTER TABLE public.flags ADD COLUMN IF NOT EXISTS unclaimed BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_flags_unclaimed ON public.flags (created_at DESC)
    WHERE unclaimed = TRUE AND hidden = FALSE AND verified_at IS NULL;

NOTIFY pgrst, 'reload schema';
