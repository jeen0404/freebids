import type { TargetKind, VisitDay } from '../types/index.js';

export interface FlagRecord {
  id: string;
  slug: string;
  targetKey: string;
  targetKind: TargetKind;
  url: string;
  name: string;
  tagline: string | null;
  category: string;
  color: string;
  logoUrl: string | null;
  clicks: number;
  hidden: boolean;
  verifiedAt: string | null;
  verifyToken: string | null;
  ownerEmail: string | null;
  /** Prepaid Sponsored-strip credit and its lifetime totals, in micro-dollars. */
  adBalanceMicros: number;
  adFundedMicros: number;
  adSpentMicros: number;
  adViews: number;
  adClicks: number;
  /** Counted referral visits in the last 7 days. Filled by listFlags; 0 elsewhere. */
  visits7d: number;
  createdAt: string;
}

export interface NewFlag {
  slug: string;
  targetKey: string;
  targetKind: TargetKind;
  url: string;
  name: string;
  tagline: string | null;
  category: string;
  color: string;
  logoUrl: string | null;
  ownerEmail: string | null;
  verifyToken: string;
}

export type FlagPatch = Partial<Pick<FlagRecord, 'name' | 'tagline' | 'category' | 'color' | 'hidden'>>;

export type AdEventKind = 'view' | 'click';

export interface FlagStore {
  /** Ranked flags in board order: verified and not hidden. `includeHidden` returns every flag. */
  listFlags(opts?: { includeHidden?: boolean }): Promise<FlagRecord[]>;
  getFlagByKey(targetKey: string): Promise<FlagRecord | null>;
  getFlagBySlug(slug: string): Promise<FlagRecord | null>;
  /** Inserts an unverified flag. A taken slug gets a short suffix. */
  createFlag(input: NewFlag): Promise<FlagRecord>;
  updateFlag(id: string, patch: FlagPatch): Promise<FlagRecord | null>;
  setVerified(id: string, verified: boolean): Promise<FlagRecord | null>;

  /** Returns true when the visit counted; false when this visitor or IP already counted for the flag within VISIT_WINDOW_HOURS. */
  /** With `dedupe` false every visit counts (see isStrictVisitCounting). */
  recordFlagVisit(flagId: string, visitorId: string, ipHash: string, dedupe?: boolean): Promise<boolean>;
  visitDays(flagId: string, days?: number): Promise<VisitDay[]>;

  /** Charges each listed sponsor once per visitor and per IP per day. Returns how many were charged. */
  chargeAd(flagIds: string[], kind: AdEventKind, visitorId: string, ipHash: string, costMicros: number): Promise<number>;
  /** Adds credit (negative removes it, never below zero). Returns the new balance. */
  fundAd(flagId: string, micros: number): Promise<number>;
  recordClick(flagId: string): Promise<void>;
  recordVisit(visitorId: string): Promise<void>;
  getVisitorCount(): Promise<number>;
  /** Unique visitors since 00:00 UTC. */
  getVisitorsToday(): Promise<number>;
}

export { RANK_WINDOW_DAYS, VISIT_WINDOW_HOURS } from '../utils/rules.js';

export function compareBoard(a: FlagRecord, b: FlagRecord): number {
  return b.visits7d - a.visits7d || a.createdAt.localeCompare(b.createdAt);
}

export function isSponsored(rec: Pick<FlagRecord, 'adBalanceMicros' | 'verifiedAt' | 'hidden'>): boolean {
  return rec.adBalanceMicros > 0 && Boolean(rec.verifiedAt) && !rec.hidden;
}

/** UTC calendar day, "YYYY-MM-DD". */
export function utcDay(ms = Date.now()): string {
  return new Date(ms).toISOString().slice(0, 10);
}
