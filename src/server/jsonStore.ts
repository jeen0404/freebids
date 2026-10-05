import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { AdEventKind, compareBoard, FlagPatch, FlagRecord, FlagStore, isSponsored, NewFlag, RANK_WINDOW_DAYS, utcDay, VISIT_WINDOW_HOURS } from './store.js';

interface VisitRow {
  flagId: string;
  visitorId: string;
  ipHash: string;
  at: number;
}

interface AdEventRow {
  flagId: string;
  kind: AdEventKind;
  visitorId: string;
  ipHash: string;
  day: string;
}

interface JsonData {
  flags: FlagRecord[];
  visits: VisitRow[];
  adEvents: AdEventRow[];
  visitors: string[];
  /** Visitor ids seen on `today.day` (UTC). */
  today: { day: string; ids: string[] };
}

const DB_FILE = path.resolve(process.cwd(), 'freebids_db.json');
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/** Local development ledger. Production uses Supabase. */
export class JsonStore implements FlagStore {
  private data: JsonData;

  constructor() {
    this.data = { flags: [], visits: [], adEvents: [], visitors: [], today: { day: utcDay(), ids: [] } };
    if (fs.existsSync(DB_FILE)) {
      try {
        const saved = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        for (const key of Object.keys(this.data) as (keyof JsonData)[]) {
          if (Array.isArray(saved[key]) || (key === 'today' && saved.today?.day)) (this.data as any)[key] = saved[key];
        }
        for (const f of this.data.flags) f.unclaimed = Boolean(f.unclaimed);
      } catch (err: any) {
        console.warn('[json-store] could not read ledger, starting empty:', err.message);
      }
    }
  }

  private save() {
    fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2));
  }

  private weeklyCounts(): Map<string, number> {
    const since = Date.now() - RANK_WINDOW_DAYS * DAY_MS;
    const counts = new Map<string, number>();
    for (const v of this.data.visits) {
      if (v.at > since) counts.set(v.flagId, (counts.get(v.flagId) ?? 0) + 1);
    }
    return counts;
  }

  async listFlags(opts: { includeHidden?: boolean } = {}) {
    const counts = this.weeklyCounts();
    return this.data.flags
      .filter((f) => opts.includeHidden || (!f.hidden && f.verifiedAt))
      .map((f) => ({ ...f, visits7d: counts.get(f.id) ?? 0 }))
      .sort(compareBoard);
  }

  async listUnclaimed(limit: number) {
    return this.data.flags
      .filter((f) => f.unclaimed && !f.hidden && !f.verifiedAt)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map((f) => ({ ...f, visits7d: 0 }));
  }

  async getFlagByKey(targetKey: string) {
    const f = this.data.flags.find((x) => x.targetKey === targetKey);
    return f ? { ...f, visits7d: 0 } : null;
  }

  async getFlagBySlug(slug: string) {
    const f = this.data.flags.find((x) => x.slug === slug);
    return f ? { ...f, visits7d: 0 } : null;
  }

  async createFlag(input: NewFlag) {
    if (this.data.flags.some((f) => f.targetKey === input.targetKey)) throw new Error('FLAG_EXISTS');
    const slugTaken = this.data.flags.some((f) => f.slug === input.slug);
    const flag: FlagRecord = {
      id: crypto.randomUUID(),
      slug: slugTaken ? `${input.slug}-${crypto.createHash('md5').update(input.targetKey).digest('hex').slice(0, 5)}` : input.slug,
      targetKey: input.targetKey,
      targetKind: input.targetKind,
      url: input.url,
      name: input.name,
      tagline: input.tagline,
      category: input.category,
      color: input.color,
      logoUrl: input.logoUrl,
      clicks: 0,
      hidden: false,
      verifiedAt: null,
      verifyToken: input.verifyToken,
      ownerEmail: input.ownerEmail,
      unclaimed: Boolean(input.unclaimed),
      adBalanceMicros: 0,
      adFundedMicros: 0,
      adSpentMicros: 0,
      adViews: 0,
      adClicks: 0,
      visits7d: 0,
      createdAt: new Date().toISOString(),
    };
    this.data.flags.push(flag);
    this.save();
    return { ...flag };
  }

  async updateFlag(id: string, patch: FlagPatch) {
    const flag = this.data.flags.find((f) => f.id === id);
    if (!flag) return null;
    Object.assign(flag, patch);
    this.save();
    return { ...flag };
  }

  async setVerified(id: string, verified: boolean) {
    const flag = this.data.flags.find((f) => f.id === id);
    if (!flag) return null;
    flag.verifiedAt = verified ? new Date().toISOString() : null;
    if (verified) flag.unclaimed = false;
    this.save();
    return { ...flag };
  }

  async recordFlagVisit(flagId: string, visitorId: string, ipHash: string, dedupe = true) {
    const now = Date.now();
    const since = now - VISIT_WINDOW_HOURS * HOUR_MS;
    const dup = dedupe && this.data.visits.some((v) => v.flagId === flagId && v.at > since && (v.visitorId === visitorId || v.ipHash === ipHash));
    if (dup) return false;
    this.data.visits = this.data.visits.filter((v) => v.at > now - 8 * DAY_MS);
    this.data.visits.push({ flagId, visitorId, ipHash, at: now });
    this.save();
    return true;
  }

  async visitDays(flagId: string, days = 14) {
    const since = Date.now() - days * DAY_MS;
    const counts = new Map<string, number>();
    for (const v of this.data.visits) {
      if (v.flagId !== flagId || v.at <= since) continue;
      const day = utcDay(v.at);
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    return [...counts].sort((a, b) => b[0].localeCompare(a[0])).map(([day, visits]) => ({ day, visits }));
  }

  async chargeAd(flagIds: string[], kind: AdEventKind, visitorId: string, ipHash: string, costMicros: number) {
    const day = utcDay();
    let charged = 0;
    for (const flag of this.data.flags) {
      if (!flagIds.includes(flag.id) || !isSponsored(flag)) continue;
      const dup = this.data.adEvents.some(
        (e) => e.flagId === flag.id && e.kind === kind && e.day === day && (e.visitorId === visitorId || e.ipHash === ipHash)
      );
      if (dup) continue;
      const cost = Math.min(flag.adBalanceMicros, costMicros);
      this.data.adEvents.push({ flagId: flag.id, kind, visitorId, ipHash, day });
      flag.adBalanceMicros -= cost;
      flag.adSpentMicros += cost;
      if (kind === 'view') flag.adViews += 1;
      else flag.adClicks += 1;
      charged++;
    }
    if (charged) {
      const cutoff = utcDay(Date.now() - 35 * DAY_MS);
      this.data.adEvents = this.data.adEvents.filter((e) => e.day >= cutoff);
      this.save();
    }
    return charged;
  }

  async fundAd(flagId: string, micros: number) {
    const flag = this.data.flags.find((f) => f.id === flagId);
    if (!flag) throw new Error('FLAG_NOT_FOUND');
    const delta = Math.max(micros, -flag.adBalanceMicros);
    flag.adBalanceMicros += delta;
    flag.adFundedMicros += delta;
    this.save();
    return flag.adBalanceMicros;
  }

  async recordClick(flagId: string) {
    const flag = this.data.flags.find((f) => f.id === flagId);
    if (!flag) return;
    flag.clicks += 1;
    this.save();
  }

  async recordVisit(visitorId: string) {
    const day = utcDay();
    if (this.data.today.day !== day) this.data.today = { day, ids: [] };
    if (!this.data.today.ids.includes(visitorId)) this.data.today.ids.push(visitorId);
    if (!this.data.visitors.includes(visitorId)) this.data.visitors.push(visitorId);
    this.save();
  }

  async getVisitorsToday() {
    return this.data.today.day === utcDay() ? this.data.today.ids.length : 0;
  }

  async getVisitorCount() {
    return this.data.visitors.length;
  }
}
