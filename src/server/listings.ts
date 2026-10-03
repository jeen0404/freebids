import crypto from 'node:crypto';
import type { ListingRequest, ListingResult, TargetLookup, VerifyResult } from '../types/index.js';
import { CATEGORIES } from '../utils/rules.js';
import { getBoard, invalidateBoard, viewOf } from './board.js';
import { appBaseUrl } from './config.js';
import { store } from './getStore.js';
import { screenFlagText } from './promotionSafety.js';
import { FlagRecord } from './store.js';
import { normalizeTarget } from './targets.js';

export class ListingError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PAGE_BYTES = 2_000_000;

function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function cleanEmail(value: unknown): string | null {
  const email = clean(value, 200);
  if (email && !EMAIL_RE.test(email)) throw new ListingError('That email address does not look right.');
  return email || null;
}

/** SKIP_LISTING_VERIFICATION=true puts new flags on the board without an ownership check. */
export function isVerificationSkipped(): boolean {
  return process.env.SKIP_LISTING_VERIFICATION === 'true';
}

async function markVerified(flag: FlagRecord): Promise<FlagRecord> {
  const verified = (await store.setVerified(flag.id, true)) || flag;
  invalidateBoard();
  return verified;
}

export async function lookupTarget(raw: unknown): Promise<TargetLookup> {
  const target = await normalizeTarget(raw);
  const existing = await store.getFlagByKey(target.targetKey);
  if (existing?.hidden) throw new ListingError('This listing was taken down by moderators.', 403);
  return {
    targetKey: target.targetKey,
    targetKind: target.targetKind,
    url: target.url,
    label: target.label,
    suggestedName: target.suggestedName,
    logoUrl: target.logoUrl,
    existing: existing ? viewOf(await getBoard(), existing) : null,
    // Safe to show anyone: the token only proves ownership once it is on the flag's own page.
    verifyToken: existing && !existing.verifiedAt && !isVerificationSkipped() ? existing.verifyToken : null,
  };
}

async function listingResult(flag: FlagRecord): Promise<ListingResult> {
  return { flag: viewOf(await getBoard(), flag), verifyToken: flag.verifiedAt ? null : flag.verifyToken };
}

/** Adds a flag for free. It stays off the ranked board until ownership is verified. */
export async function createListing(body: Partial<ListingRequest>): Promise<ListingResult> {
  const target = await normalizeTarget(body.target);
  const existing = await store.getFlagByKey(target.targetKey);
  if (existing?.hidden) throw new ListingError('This listing was taken down by moderators.', 403);
  if (existing?.verifiedAt) throw new ListingError(`${existing.name} is already on the board.`, 409);
  // Only the owner can place the token on the site, so re-adding an unverified flag just returns it.
  if (existing) return listingResult(isVerificationSkipped() ? await markVerified(existing) : existing);

  const name = clean(body.name, 40) || target.suggestedName;
  const tagline = clean(body.tagline, 90);
  const textError = screenFlagText({ name, tagline });
  if (textError) throw new ListingError(textError);

  const flag = await store.createFlag({
    slug: target.slug,
    targetKey: target.targetKey,
    targetKind: target.targetKind,
    url: target.url,
    name,
    tagline: tagline || null,
    category: CATEGORIES.includes(body.category as string) ? (body.category as string) : 'Other',
    color: typeof body.color === 'string' && HEX_RE.test(body.color) ? body.color.toUpperCase() : '#E11D48',
    logoUrl: target.logoUrl,
    ownerEmail: cleanEmail(body.email),
    verifyToken: `fc-${crypto.randomBytes(8).toString('hex')}`,
  });
  return listingResult(isVerificationSkipped() ? await markVerified(flag) : flag);
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(8000),
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; FreeBidsBot/1.0; +https://freebids.lol/rules)', accept: 'text/html,*/*' },
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let html = '';
  let bytes = 0;
  while (bytes < MAX_PAGE_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    html += decoder.decode(value, { stream: true });
  }
  reader.cancel().catch(() => {});
  return html;
}

/** Checks the flag's page for its verify token or its referral link. */
export async function verifyListing(slug: string): Promise<VerifyResult> {
  const flag = await store.getFlagBySlug(slug);
  if (!flag || flag.hidden) throw new ListingError('Flag not found.', 404);
  const board = await getBoard();
  if (flag.verifiedAt) return { verified: true, manual: false, message: 'Already verified.', flag: viewOf(board, flag) };
  if (isVerificationSkipped()) {
    const verified = await markVerified(flag);
    return { verified: true, manual: false, message: 'Verified. Your flag is on the board.', flag: viewOf(await getBoard(), verified) };
  }

  if (flag.targetKind === 'x') {
    return {
      verified: false,
      manual: true,
      message: 'X profiles are checked by a moderator, usually within 24 hours. Keep the code or your link in your bio until then.',
      flag: viewOf(board, flag),
    };
  }

  const referral = `${new URL(appBaseUrl()).host}/f/${flag.slug}`;
  let html: string;
  try {
    html = await fetchPage(flag.url);
  } catch {
    return {
      verified: false,
      manual: false,
      message: `We could not load ${flag.url}. Make sure it is public, then try again.`,
      flag: viewOf(board, flag),
    };
  }
  if (!(flag.verifyToken && html.includes(flag.verifyToken)) && !html.includes(referral)) {
    return {
      verified: false,
      manual: false,
      message: 'We could not find the code or your FreeBids link on that page yet. Deploy the change and try again.',
      flag: viewOf(board, flag),
    };
  }
  const verified = (await store.setVerified(flag.id, true))!;
  invalidateBoard();
  return { verified: true, manual: false, message: 'Verified. Your flag is on the board.', flag: viewOf(await getBoard(), verified) };
}
