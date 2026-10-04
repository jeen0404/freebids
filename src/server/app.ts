import fs from 'node:fs';
import path from 'node:path';
import express, { Request, Response } from 'express';
import { apiRouter, clientIp, isStrictVisitCounting, rateLimit } from './api.js';
import { findFlagBySlug, getBoard, invalidateBoard, viewOf } from './board.js';
import { store } from './getStore.js';
import { AD_CLICK_MICROS } from '../utils/rules.js';
import { isBot, isValidVisitorId } from './presence.js';
import { isSponsored } from './store.js';
import { hashIp } from './turnstile.js';
import { buildSitemap, injectSeo, resolveSeo } from './seo.js';

// Loaded on first image request: satori's WASM setup must never be able to take down the API.
let ogModule: Promise<typeof import('./og.js')> | null = null;
function og() {
  ogModule ||= import('./og.js');
  ogModule.catch(() => {
    ogModule = null;
  });
  return ogModule;
}

const ROOT = process.cwd();
const STATIC_OG_FALLBACK = path.resolve(ROOT, 'public', 'og-default.png');

// Social cards can stay an hour stale. Pass a shorter cache for images that should track rank.
function ogRoute(handler: (req: Request) => Promise<Buffer | null>, cacheControl = 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400') {
  return async (req: Request, res: Response) => {
    try {
      const png = await handler(req);
      if (!png) {
        res.redirect(302, '/og-image.png');
        return;
      }
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', cacheControl);
      res.send(png);
    } catch (err: any) {
      console.error('[og]', err.message);
      if (fs.existsSync(STATIC_OG_FALLBACK)) {
        res.set('Cache-Control', 'public, max-age=60');
        res.sendFile(STATIC_OG_FALLBACK);
        return;
      }
      res.status(500).json({ error: 'Failed to render image' });
    }
  };
}

/** API, outbound redirects, social images and sitemap. HTML serving is attached separately per runtime. */
export function createApp() {
  const app = express();
  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 1));
  app.disable('x-powered-by');

  app.use(express.json({ limit: '100kb' }));
  app.use('/api', apiRouter);

  // Every outbound click goes through here so each flag shows its click count.
  app.get('/go/:slug', async (req, res) => {
    try {
      const flag = await findFlagBySlug(String(req.params.slug).toLowerCase());
      if (!flag || flag.hidden) {
        res.redirect(302, '/');
        return;
      }
      const human = !isBot(req.headers['user-agent']);
      const strict = isStrictVisitCounting();
      if (human && rateLimit(`click:${flag.id}`, clientIp(req), strict ? 1 : 30, strict ? 10 * 60_000 : 60_000)) {
        store.recordClick(flag.id).catch((err) => console.warn('[click]', err.message));
        if (!strict && flag.verifiedAt) {
          const ipHash = hashIp(clientIp(req));
          const visitorId = isValidVisitorId(req.query.v) ? req.query.v : `go_${ipHash.slice(0, 24)}`;
          await store
            .recordFlagVisit(flag.id, visitorId, ipHash, false)
            .then(invalidateBoard)
            .catch((err) => console.warn('[click visit]', err.message));
        }
      }
      // Clicks from the Sponsored strip (?ad=1) drain the sponsor's credit, once per visitor and IP per day.
      if (human && req.query.ad === '1' && isSponsored(flag)) {
        const ipHash = hashIp(clientIp(req));
        const visitorId = isValidVisitorId(req.query.v) ? req.query.v : ipHash;
        await store
          .chargeAd([flag.id], 'click', visitorId, ipHash, AD_CLICK_MICROS)
          .catch((err) => console.warn('[ad click]', err.message));
      }
      res.set('Cache-Control', 'no-store');
      res.set('X-Robots-Tag', 'noindex, nofollow');
      res.redirect(302, flag.url);
    } catch (err: any) {
      console.error('[go]', err.message);
      res.redirect(302, '/');
    }
  });

  app.get('/og-image.png', ogRoute(async () => (await og()).renderHomeOg((await getBoard()).views)));

  const flagView = async (slug: string) => {
    const flag = await findFlagBySlug(slug.toLowerCase());
    if (!flag || flag.hidden) return null;
    return viewOf(await getBoard(), flag);
  };

  app.get('/og/flag/:slug.png', ogRoute(async (req) => {
    const view = await flagView(String(req.params.slug));
    return view && (await og()).renderFlagOg(view);
  }));

  // Live rank sticker. The image itself is not a visit; the embed's link to /f/:slug is.
  app.get('/badge/:slug.png', ogRoute(async (req) => {
    const view = await flagView(String(req.params.slug));
    if (!view?.verified) return null;
    return (await og()).renderFlagBadge(view);
  }, 'public, max-age=120, s-maxage=300, stale-while-revalidate=3600'));

  app.get('/og/flag/:slug/story.png', ogRoute(async (req) => {
    const view = await flagView(String(req.params.slug));
    return view && (await og()).renderFlagStory(view);
  }));

  app.get('/sitemap.xml', async (_req, res) => {
    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    res.send(await buildSitemap());
  });

  return app;
}

/** Catch-all that serves the SPA shell with per-route SEO tags injected. */
export function serveHtml(app: express.Express, loadTemplate: (req: Request) => Promise<string>) {
  app.get('*', async (req, res, next) => {
    try {
      const [template, meta] = await Promise.all([loadTemplate(req), resolveSeo(req.path)]);
      res.set('Content-Type', 'text/html; charset=utf-8');
      // The shell holds no per-user data; the CDN serves it and a new deploy purges it.
      res.set('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400');
      res.send(injectSeo(template, meta));
    } catch (err) {
      next(err);
    }
  });
}
