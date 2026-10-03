import type { FlagView } from '../types';

export const BOARD_PAGE_SIZE = 50;
/** Rank counts referred visits over this many days. */
export const RANK_WINDOW_DAYS = 7;
/** A visitor (and an IP address) counts at most once per flag in this many hours. */
export const VISIT_WINDOW_HOURS = 3;
export const MAX_LISTINGS_PER_IP_PER_DAY = 3;

/** Sponsored strip pricing, drained from prepaid credit. Each charge is once per sponsor per visitor per day. */
export const AD_VIEW_USD = 0.002;
export const AD_CLICK_USD = 0.1;
export const AD_BUDGETS_USD = [10, 25, 50, 100] as const;
export const MICROS_PER_USD = 1_000_000;
export const AD_VIEW_MICROS = Math.round(AD_VIEW_USD * MICROS_PER_USD);
export const AD_CLICK_MICROS = Math.round(AD_CLICK_USD * MICROS_PER_USD);

export function formatAdUsd(micros: number): string {
  const usd = micros / MICROS_PER_USD;
  return `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: usd > 0 && usd < 1 ? 3 : 2 })}`;
}

export const CATEGORY_GROUPS = [
  { label: 'Software', items: ['AI', 'SaaS', 'Dev tools', 'No-code', 'Productivity', 'Design', 'Security', 'Data & analytics', 'Cloud & hosting', 'Open source', 'Browser extension', 'Mobile app', 'API'] },
  { label: 'Business', items: ['Marketing', 'Sales', 'SEO', 'HR & hiring', 'Customer support', 'Legal', 'Agency', 'Consulting', 'Freelance'] },
  { label: 'Money', items: ['Finance', 'Fintech', 'Crypto', 'Web3', 'Investing', 'Real estate', 'Insurance'] },
  { label: 'Commerce', items: ['E-commerce', 'Marketplace', 'Fashion', 'Beauty', 'Food & drink', 'Travel', 'Home & living'] },
  { label: 'People & media', items: ['Creator', 'Newsletter', 'Podcast', 'YouTube', 'Blog', 'Community', 'Social', 'News & media', 'Personal brand'] },
  { label: 'Life', items: ['Games', 'Education', 'Health & fitness', 'Music', 'Sports', 'Events', 'Non-profit', 'Jobs', 'Hardware', 'Automotive'] },
  { label: 'Other', items: ['Other'] },
] as const;

export const CATEGORIES: readonly string[] = CATEGORY_GROUPS.flatMap((g) => g.items);

export const FLAG_COLORS = [
  '#E11D48',
  '#F59E0B',
  '#16A34A',
  '#0EA5E9',
  '#2563EB',
  '#7C3AED',
  '#DB2777',
  '#111111',
  '#0F766E',
  '#EA580C',
] as const;

export function defaultColorFor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return FLAG_COLORS[Math.abs(hash) % FLAG_COLORS.length];
}

export function formatCount(n: number, opts: { compact?: boolean } = {}): string {
  if (opts.compact && n >= 10_000) {
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  }
  return n.toLocaleString('en-US');
}

/** Visits a flag still needs to pass the flag at `rank` (0 if it is already there or higher). */
export function visitsToReachRank(board: FlagView[], rank: number, flagId?: string | null): number {
  const current = flagId ? board.find((f) => f.id === flagId) : undefined;
  if (current && current.rank > 0 && current.rank <= rank) return 0;
  const rival = board.filter((f) => f.id !== flagId)[rank - 1];
  if (!rival) return current ? 0 : 1;
  return rival.visits7d - (current?.visits7d ?? 0) + 1;
}

export function referralUrl(slug: string): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return `${origin}/f/${slug}`;
}
