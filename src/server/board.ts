import type { BoardSnapshot, FlagView } from '../types/index.js';
import { store } from './getStore.js';
import { onlineCount } from './presence.js';
import { FlagRecord, isSponsored } from './store.js';

const BOARD_TTL_MS = 30_000;
const UNCLAIMED_LIMIT = 60;

interface Board {
  records: FlagRecord[];
  views: FlagView[];
  unclaimed: FlagView[];
  visitors: number;
  visitorsToday: number;
  at: number;
}

let cached: Board | null = null;
let inflight: Promise<Board> | null = null;

export function invalidateBoard() {
  cached = null;
}

function labelFor(rec: Pick<FlagRecord, 'targetKind' | 'url'>): string {
  if (rec.targetKind === 'x') return `@${rec.url.split('/').pop()}`;
  return rec.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
}

function toFlagView(rec: FlagRecord, rank: number, visits7d = rec.visits7d): FlagView {
  return {
    id: rec.id,
    slug: rec.slug,
    rank,
    targetKind: rec.targetKind,
    label: labelFor(rec),
    name: rec.name,
    tagline: rec.tagline,
    category: rec.category,
    color: rec.color,
    logoUrl: rec.logoUrl,
    visits7d,
    clicks: rec.clicks,
    verified: Boolean(rec.verifiedAt),
    unclaimed: rec.unclaimed && !rec.verifiedAt,
    sponsored: isSponsored(rec),
    createdAt: rec.createdAt,
  };
}

export async function getBoard(): Promise<Board> {
  if (cached && Date.now() - cached.at < BOARD_TTL_MS) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    const [records, unclaimed, visitors, visitorsToday] = await Promise.all([
      store.listFlags(),
      store.listUnclaimed(UNCLAIMED_LIMIT),
      store.getVisitorCount(),
      store.getVisitorsToday(),
    ]);
    const board: Board = {
      records,
      views: records.map((r, i) => toFlagView(r, i + 1)),
      unclaimed: unclaimed.map((r) => toFlagView(r, 0, 0)),
      visitors,
      visitorsToday,
      at: Date.now(),
    };
    cached = board;
    return board;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

/** Ranked flags come from the cached board; only unranked or hidden ones cost a query. */
export async function findFlagBySlug(slug: string): Promise<FlagRecord | null> {
  const board = await getBoard();
  return board.records.find((r) => r.slug === slug) || (await store.getFlagBySlug(slug));
}

/** A flag as the board sees it: ranked flags carry their live rank and weekly visitors. */
export function viewOf(board: Board, rec: FlagRecord): FlagView {
  const live = board.views.find((v) => v.id === rec.id);
  return toFlagView(rec, live?.rank ?? 0, live?.visits7d ?? 0);
}

/** Every flag with ad credit, biggest budget first. There is no slot cap; the strip scrolls. */
export function activeSponsors(board: Board): FlagRecord[] {
  return board.records.filter((r) => isSponsored(r)).sort((a, b) => b.adBalanceMicros - a.adBalanceMicros);
}

export async function getSnapshot(): Promise<BoardSnapshot> {
  const board = await getBoard();
  const now = Date.now();
  const online = Math.max(1, onlineCount());
  const byId = new Map(board.views.map((v) => [v.id, v]));
  return {
    flags: board.views,
    sponsored: activeSponsors(board).map((r) => byId.get(r.id)!),
    unclaimed: board.unclaimed,
    stats: {
      flags: board.views.length,
      weeklyVisits: board.views.reduce((sum, f) => sum + f.visits7d, 0),
      clicks: board.views.reduce((sum, f) => sum + f.clicks, 0),
      visitors: Math.max(online, board.visitors),
      visitorsToday: Math.max(online, board.visitorsToday),
      online,
    },
    generatedAt: new Date(now).toISOString(),
  };
}
