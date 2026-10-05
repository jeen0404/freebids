import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AdEventKind, compareBoard, FlagPatch, FlagRecord, FlagStore, NewFlag, utcDay } from './store.js';

const FLAG_COLUMNS =
  'id, slug, target_key, target_kind, url, name, tagline, category, color, logo_url, clicks, hidden, verified_at, verify_token, owner_email, unclaimed, ad_balance_micros, ad_funded_micros, ad_spent_micros, ad_views, ad_clicks, created_at';
const BOARD_LIMIT = 2000;

function toFlag(r: any, visits7d = 0): FlagRecord {
  return {
    id: r.id,
    slug: r.slug,
    targetKey: r.target_key,
    targetKind: r.target_kind,
    url: r.url,
    name: r.name,
    tagline: r.tagline,
    category: r.category,
    color: r.color,
    logoUrl: r.logo_url,
    clicks: Number(r.clicks),
    hidden: r.hidden,
    verifiedAt: r.verified_at,
    verifyToken: r.verify_token,
    ownerEmail: r.owner_email,
    unclaimed: Boolean(r.unclaimed),
    adBalanceMicros: Number(r.ad_balance_micros || 0),
    adFundedMicros: Number(r.ad_funded_micros || 0),
    adSpentMicros: Number(r.ad_spent_micros || 0),
    adViews: Number(r.ad_views || 0),
    adClicks: Number(r.ad_clicks || 0),
    visits7d,
    createdAt: r.created_at,
  };
}

function check<T>(res: { data: T; error: any }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export class SupabaseStore implements FlagStore {
  constructor(private db: SupabaseClient) {}

  async listFlags(opts: { includeHidden?: boolean } = {}) {
    let q = this.db.from('flags').select(FLAG_COLUMNS);
    if (!opts.includeHidden) q = q.eq('hidden', false).not('verified_at', 'is', null);
    const [rows, week] = await Promise.all([
      q.order('created_at', { ascending: true }).limit(BOARD_LIMIT).then(check),
      this.db.rpc('board_week').then(check),
    ]);
    const visits = new Map<string, number>(((week as any[]) || []).map((w) => [w.flag_id, Number(w.visits_7d)]));
    return ((rows as any[]) || []).map((r) => toFlag(r, visits.get(r.id) ?? 0)).sort(compareBoard);
  }

  async listUnclaimed(limit: number) {
    const rows = check(
      await this.db
        .from('flags')
        .select(FLAG_COLUMNS)
        .eq('unclaimed', true)
        .eq('hidden', false)
        .is('verified_at', null)
        .order('created_at', { ascending: false })
        .limit(limit)
    );
    return ((rows as any[]) || []).map((r) => toFlag(r));
  }

  async getFlagByKey(targetKey: string) {
    const row = check(await this.db.from('flags').select(FLAG_COLUMNS).eq('target_key', targetKey).maybeSingle());
    return row ? toFlag(row) : null;
  }

  async getFlagBySlug(slug: string) {
    const row = check(await this.db.from('flags').select(FLAG_COLUMNS).eq('slug', slug).maybeSingle());
    return row ? toFlag(row) : null;
  }

  async createFlag(input: NewFlag) {
    const taken = check(await this.db.from('flags').select('id').eq('slug', input.slug).maybeSingle());
    const slug = taken ? `${input.slug}-${crypto.createHash('md5').update(input.targetKey).digest('hex').slice(0, 5)}` : input.slug;
    const row = check(
      await this.db
        .from('flags')
        .insert({
          slug,
          target_key: input.targetKey,
          target_kind: input.targetKind,
          url: input.url,
          name: input.name,
          tagline: input.tagline,
          category: input.category,
          color: input.color,
          logo_url: input.logoUrl,
          owner_email: input.ownerEmail,
          verify_token: input.verifyToken,
          unclaimed: Boolean(input.unclaimed),
        })
        .select(FLAG_COLUMNS)
        .single()
    );
    return toFlag(row);
  }

  async updateFlag(id: string, patch: FlagPatch) {
    const row = check(
      await this.db
        .from('flags')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select(FLAG_COLUMNS)
        .maybeSingle()
    );
    return row ? toFlag(row) : null;
  }

  async setVerified(id: string, verified: boolean) {
    const now = new Date().toISOString();
    const row = check(
      await this.db
        .from('flags')
        .update(verified ? { verified_at: now, unclaimed: false, updated_at: now } : { verified_at: null, updated_at: now })
        .eq('id', id)
        .select(FLAG_COLUMNS)
        .maybeSingle()
    );
    return row ? toFlag(row) : null;
  }

  async recordFlagVisit(flagId: string, visitorId: string, ipHash: string, dedupe = true) {
    if (!dedupe) {
      check(await this.db.from('flag_visits').insert({ flag_id: flagId, visitor_id: visitorId, ip_hash: ipHash }));
      return true;
    }
    const counted = check(await this.db.rpc('record_flag_visit', { p_flag_id: flagId, p_visitor_id: visitorId, p_ip_hash: ipHash }));
    return Boolean(counted);
  }

  async visitDays(flagId: string, days = 14) {
    const rows: any[] = check(await this.db.rpc('flag_visit_days', { p_flag_id: flagId, p_days: days })) || [];
    return rows.map((r) => ({ day: String(r.day), visits: Number(r.visits) }));
  }

  async chargeAd(flagIds: string[], kind: AdEventKind, visitorId: string, ipHash: string, costMicros: number) {
    if (!flagIds.length) return 0;
    const charged = check(
      await this.db.rpc('charge_ad', {
        p_flag_ids: flagIds,
        p_kind: kind,
        p_visitor_id: visitorId,
        p_ip_hash: ipHash,
        p_cost_micros: costMicros,
      })
    );
    return Number(charged || 0);
  }

  async fundAd(flagId: string, micros: number) {
    return Number(check(await this.db.rpc('fund_ad', { p_flag_id: flagId, p_micros: micros })));
  }

  async recordClick(flagId: string) {
    check(await this.db.rpc('record_flag_click', { p_flag_id: flagId }));
  }

  async recordVisit(visitorId: string) {
    check(await this.db.rpc('record_site_visit', { p_visitor_id: visitorId }));
  }

  async getVisitorCount() {
    const row: any = check(await this.db.from('site_counters').select('visitors').eq('id', 'global').maybeSingle());
    return Number(row?.visitors || 0);
  }

  async getVisitorsToday() {
    const { count, error } = await this.db
      .from('site_daily_visitors')
      .select('visitor_id', { count: 'exact', head: true })
      .eq('day', utcDay());
    if (error) {
      console.warn('[visitors-today]', error.message);
      return 0;
    }
    return count || 0;
  }
}
