export type TargetKind = 'website' | 'x';

/** A flag as shown on the board. */
export interface FlagView {
  id: string;
  slug: string;
  /** 0 when the flag is not ranked (unverified or hidden). */
  rank: number;
  targetKind: TargetKind;
  /** "example.com" or "@handle" */
  label: string;
  name: string;
  tagline: string | null;
  category: string;
  color: string;
  logoUrl: string | null;
  /** Counted visits referred through /f/<slug> in the last 7 days. */
  visits7d: number;
  clicks: number;
  verified: boolean;
  /** Has ad credit, so it shows in the Sponsored strip. Never affects rank. */
  sponsored: boolean;
  createdAt: string;
}

export interface BoardStats {
  flags: number;
  weeklyVisits: number;
  clicks: number;
  visitors: number;
  /** Unique visitors since 00:00 UTC. */
  visitorsToday: number;
  online: number;
}

export interface BoardSnapshot {
  flags: FlagView[];
  sponsored: FlagView[];
  stats: BoardStats;
  generatedAt: string;
}

export interface TargetLookup {
  targetKey: string;
  targetKind: TargetKind;
  url: string;
  label: string;
  suggestedName: string;
  logoUrl: string | null;
  existing: FlagView | null;
  /** Set while the existing flag is unverified, so its owner can pick verification back up. */
  verifyToken: string | null;
}

export interface ListingRequest {
  target: string;
  name?: string;
  tagline?: string;
  category?: string;
  color?: string;
  email?: string;
}

export interface ListingResult {
  flag: FlagView;
  /** Only returned while the flag is unverified. */
  verifyToken: string | null;
}

export interface VerifyResult {
  verified: boolean;
  /** True when ownership is checked by a moderator (X profiles and pages we cannot fetch). */
  manual: boolean;
  message: string;
  flag: FlagView;
}

export interface AdminFlag extends FlagView {
  hidden: boolean;
  url: string;
  adBalanceMicros: number;
  adFundedMicros: number;
  adSpentMicros: number;
  adViews: number;
  adClicks: number;
}

export interface VisitDay {
  day: string;
  visits: number;
}
