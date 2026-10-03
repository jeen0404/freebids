import { NextFunction, Request, Response, Router } from 'express';
import type { AdminFlag } from '../types/index.js';
import { AD_VIEW_MICROS, CATEGORIES, MAX_LISTINGS_PER_IP_PER_DAY, MICROS_PER_USD } from '../utils/rules.js';
import { adminLogin, requireAdmin } from './admin.js';
import { activeSponsors, findFlagBySlug, getBoard, getSnapshot, invalidateBoard, viewOf } from './board.js';
import { ListingError, createListing, lookupTarget, verifyListing } from './listings.js';
import { store, storeMode } from './getStore.js';
import { getLogo, LogoError } from './logos.js';
import { isBot, isValidVisitorId, onlineCount, recordVisitor, touchPresence } from './presence.js';
import { FlagPatch } from './store.js';
import { TargetError } from './targets.js';
import { hashIp, isTurnstileConfigured, verifyTurnstile } from './turnstile.js';

export const apiRouter = Router();

const hits = new Map<string, number[]>();

export function rateLimit(bucket: string, ip: string, limit: number, windowMs = 60_000): boolean {
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 50_000) hits.clear();
  return true;
}

/**
 * Strict counting: referral links only, Turnstile required, one visit per visitor/IP per flag every 3 hours.
 * Off (the early-phase default): every flag page view, refresh and outbound click counts.
 */
export function isStrictVisitCounting(): boolean {
  return process.env.STRICT_VISIT_COUNTING === 'true';
}

export function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/** Lets the CDN absorb read spikes. Only for responses identical for every visitor. */
function edgeCache(seconds: number) {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.set('Cache-Control', `public, max-age=0, s-maxage=${seconds}, stale-while-revalidate=${seconds * 4}`);
    next();
  };
}

function limited(bucket: string, limit: number, windowMs = 60_000) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!rateLimit(bucket, clientIp(req), limit, windowMs)) {
      res.status(429).json({ error: 'Too many requests. Wait a minute and try again.' });
      return;
    }
    next();
  };
}

function wrap(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    handler(req, res).catch((err: any) => {
      if (err instanceof ListingError || err instanceof TargetError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      console.error(err);
      res.status(500).json({ error: 'Something went wrong. Try again.' });
    });
  };
}

apiRouter.get('/health', wrap(async (_req, res) => {
  res.json({ ok: true, store: storeMode, turnstile: isTurnstileConfigured() });
}));

apiRouter.get('/board', edgeCache(30), wrap(async (_req, res) => {
  res.json(await getSnapshot());
}));

apiRouter.get('/flags/:slug', edgeCache(30), wrap(async (req, res) => {
  const record = await findFlagBySlug(String(req.params.slug).toLowerCase());
  if (!record || record.hidden) {
    res.status(404).json({ error: 'Listing not found.' });
    return;
  }
  res.json(viewOf(await getBoard(), record));
}));

apiRouter.get('/logo', limited('logo', 300), async (req, res) => {
  const url = typeof req.query.u === 'string' ? req.query.u : '';
  try {
    const logo = await getLogo(url);
    res.set('Content-Type', logo.contentType);
    res.set('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');
    res.set('X-Content-Type-Options', 'nosniff');
    res.send(logo.body);
  } catch (err: any) {
    res.set('Cache-Control', 'public, max-age=300, s-maxage=3600');
    res.status(err instanceof LogoError ? err.status : 502).json({ error: 'Logo unavailable' });
  }
});

apiRouter.get('/lookup', limited('lookup', 60), wrap(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(await lookupTarget(req.query.target));
}));

apiRouter.post('/listings', limited('listings', MAX_LISTINGS_PER_IP_PER_DAY, 24 * 60 * 60_000), wrap(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(await createListing(req.body || {}));
}));

apiRouter.post('/listings/:slug/verify', limited('verify', 10), wrap(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(await verifyListing(String(req.params.slug).toLowerCase()));
}));

// Counts a flag page view: referral links (/f/<slug>) always, other views only when counting is not strict.
apiRouter.post('/visits', limited('visits', 30), wrap(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const { slug, visitorId, turnstileToken, referral } = req.body || {};
  const strict = isStrictVisitCounting();
  if (typeof slug !== 'string' || !isValidVisitorId(visitorId) || isBot(req.headers['user-agent']) || (strict && referral === false)) {
    res.json({ counted: false });
    return;
  }
  const ip = clientIp(req);
  if (strict && !(await verifyTurnstile(turnstileToken, ip))) {
    res.status(403).json({ counted: false, error: 'Visitor check failed.' });
    return;
  }
  const flag = await findFlagBySlug(slug.toLowerCase());
  if (!flag || flag.hidden || !flag.verifiedAt) {
    res.json({ counted: false });
    return;
  }
  const counted = await store.recordFlagVisit(flag.id, visitorId, hashIp(ip), strict);
  if (counted) invalidateBoard();
  res.json({ counted });
}));

// A visitor saw the Sponsored strip: one view charge per sponsor per visitor per day.
apiRouter.post('/ads/views', limited('ad-views', 20), wrap(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const { visitorId, flagIds } = req.body || {};
  if (!isValidVisitorId(visitorId) || !Array.isArray(flagIds) || isBot(req.headers['user-agent'])) {
    res.json({ charged: 0 });
    return;
  }
  const active = new Set(activeSponsors(await getBoard()).map((r) => r.id));
  const ids = [...new Set(flagIds.filter((id): id is string => typeof id === 'string' && active.has(id)))].slice(0, 200);
  const charged = ids.length ? await store.chargeAd(ids, 'view', visitorId, hashIp(clientIp(req)), AD_VIEW_MICROS) : 0;
  res.json({ charged });
}));

apiRouter.post('/presence', wrap(async (req, res) => {
  const { visitorId, first } = req.body || {};
  res.set('Cache-Control', 'no-store');
  if (!isValidVisitorId(visitorId) || isBot(req.headers['user-agent'])) {
    res.json({ online: Math.max(1, onlineCount()) });
    return;
  }
  if (first && rateLimit('visit', clientIp(req), 30)) await recordVisitor(visitorId, clientIp(req));
  else touchPresence(visitorId);
  res.json({ online: Math.max(1, onlineCount()) });
}));

apiRouter.post('/admin/login', limited('admin-login', 5, 15 * 60_000), wrap(async (req, res) => {
  const token = adminLogin(req.body?.username, req.body?.password);
  if (!token) {
    res.status(401).json({ error: 'Wrong username or password.' });
    return;
  }
  res.json({ token });
}));

apiRouter.get('/admin/flags', requireAdmin, wrap(async (_req, res) => {
  invalidateBoard();
  const [records, board] = await Promise.all([store.listFlags({ includeHidden: true }), getBoard()]);
  const flags: AdminFlag[] = records.map((r) => ({
    ...viewOf(board, r),
    visits7d: r.visits7d,
    hidden: r.hidden,
    url: r.url,
    adBalanceMicros: r.adBalanceMicros,
    adFundedMicros: r.adFundedMicros,
    adSpentMicros: r.adSpentMicros,
    adViews: r.adViews,
    adClicks: r.adClicks,
  }));
  res.json({ flags });
}));

// Adds prepaid Sponsored-strip credit after a manual payment. A negative amount removes credit.
apiRouter.post('/admin/flags/:id/credit', requireAdmin, wrap(async (req, res) => {
  const id = String(req.params.id);
  const usd = Number(req.body?.usd);
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ListingError('Listing not found.', 404);
  if (!Number.isFinite(usd) || usd === 0 || Math.abs(usd) > 10_000) throw new ListingError('Enter an amount between -10000 and 10000 USD.');
  const balance = await store.fundAd(id, Math.round(usd * MICROS_PER_USD));
  invalidateBoard();
  res.json({ balanceMicros: balance });
}));

apiRouter.get('/admin/flags/:id/visits', requireAdmin, wrap(async (req, res) => {
  const id = String(req.params.id);
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    res.status(404).json({ error: 'Listing not found.' });
    return;
  }
  res.json({ days: await store.visitDays(id, 14) });
}));

apiRouter.patch('/admin/flags/:id', requireAdmin, wrap(async (req, res) => {
  const body = req.body || {};
  const patch: FlagPatch = {};
  if (typeof body.hidden === 'boolean') patch.hidden = body.hidden;
  if (typeof body.name === 'string') patch.name = body.name.trim().slice(0, 40);
  if (typeof body.tagline === 'string') patch.tagline = body.tagline.trim().slice(0, 90) || null;
  if (CATEGORIES.includes(body.category)) patch.category = body.category;
  if (typeof body.color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(body.color)) patch.color = body.color.toUpperCase();
  if (patch.name === '') throw new ListingError('Name cannot be empty.');
  const id = String(req.params.id);
  let flag = Object.keys(patch).length ? await store.updateFlag(id, patch) : null;
  if (typeof body.verified === 'boolean') flag = await store.setVerified(id, body.verified);
  if (!flag) {
    res.status(404).json({ error: 'Listing not found.' });
    return;
  }
  invalidateBoard();
  res.json({ ok: true });
}));
