/**
 * Same-origin proxy for flag logos. The cloth is drawn with WebGL, which can
 * only read cross-origin images that send CORS headers, and the favicon and
 * avatar services don't.
 */

const MAX_BYTES = 256 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 5000;
const CACHE_MAX = 500;
const CACHE_TTL_MS = 24 * 60 * 60_000;

// SVG is excluded: served from our origin it could run script if opened directly.
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon']);

export class LogoError extends Error {
  constructor(message: string, public status = 404) {
    super(message);
  }
}

interface Logo {
  body: Buffer;
  contentType: string;
}

const cache = new Map<string, { logo: Logo; at: number }>();
const inflight = new Map<string, Promise<Logo>>();

function isAllowedLogoUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  if (host === 'www.google.com') return url.pathname === '/s2/favicons';
  if (host === 'github.com') return /^\/[A-Za-z0-9-]+\.png$/.test(url.pathname);
  return (
    host === 'unavatar.io' ||
    host === 'avatars.githubusercontent.com' ||
    host === 'pbs.twimg.com' ||
    host === 'abs.twimg.com' ||
    /^t\d\.gstatic\.com$/.test(host)
  );
}

async function fetchLogo(start: string): Promise<Logo> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isAllowedLogoUrl(url)) throw new LogoError('Logo host not allowed', 400);
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; FreeBidsBot/1.0; +https://freebids.lol/rules)', accept: 'image/*' },
    });
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get('location');
      res.body?.cancel().catch(() => {});
      if (!next) throw new LogoError('Redirect without location');
      url = new URL(next, url).toString();
      continue;
    }
    if (!res.ok) {
      res.body?.cancel().catch(() => {});
      throw new LogoError(`Upstream ${res.status}`);
    }
    const contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!ALLOWED_TYPES.has(contentType)) {
      res.body?.cancel().catch(() => {});
      throw new LogoError('Not a supported image');
    }
    if (Number(res.headers.get('content-length') || 0) > MAX_BYTES) {
      res.body?.cancel().catch(() => {});
      throw new LogoError('Logo too large');
    }
    const body = Buffer.from(await res.arrayBuffer());
    if (body.length > MAX_BYTES) throw new LogoError('Logo too large');
    return { body, contentType };
  }
  throw new LogoError('Too many redirects');
}

export async function getLogo(url: string): Promise<Logo> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.logo;
  let pending = inflight.get(url);
  if (!pending) {
    pending = fetchLogo(url);
    inflight.set(url, pending);
  }
  try {
    const logo = await pending;
    cache.set(url, { logo, at: Date.now() });
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
    return logo;
  } finally {
    inflight.delete(url);
  }
}
