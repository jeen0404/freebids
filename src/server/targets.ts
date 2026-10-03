import type { TargetKind } from '../types/index.js';
import { checkUrl, isShortener } from './promotionSafety.js';

export class TargetError extends Error {
  status = 400;
}

interface NormalizedTarget {
  targetKey: string;
  targetKind: TargetKind;
  url: string;
  label: string;
  suggestedName: string;
  logoUrl: string | null;
  slug: string;
}

const X_HOSTS = new Set(['x.com', 'twitter.com', 'mobile.twitter.com', 'mobile.x.com']);
const X_RESERVED = new Set(['home', 'i', 'intent', 'share', 'search', 'explore', 'settings', 'hashtag', 'messages', 'notifications', 'compose']);

const CHAT_HOSTS = [
  't.me', 'telegram.me', 'telegram.dog', 'telegram.org', 'wa.me', 'whatsapp.com', 'chat.whatsapp.com',
  'discord.gg', 'discord.com', 'discordapp.com', 'm.me', 'messenger.com', 'signal.me', 'signal.group',
  'line.me', 'kik.me', 'viber.com', 'invite.viber.com', 'chat.google.com', 'groupme.com',
];

/** Platforms where many unrelated products share a host, so the path is the identity. */
const PATH_KEYED_HOSTS: Record<string, number> = {
  'github.com': 2,
  'gitlab.com': 2,
  'huggingface.co': 2,
  'npmjs.com': 2,
  'pypi.org': 2,
  'producthunt.com': 2,
  'youtube.com': 1,
  'linkedin.com': 2,
  'instagram.com': 1,
  'tiktok.com': 1,
  'threads.net': 1,
  'reddit.com': 2,
  'medium.com': 1,
  'facebook.com': 1,
  'bsky.app': 2,
  'addons.mozilla.org': 4,
  'marketplace.visualstudio.com': 2,
  'apps.apple.com': 0,
  'play.google.com': 0,
  'chromewebstore.google.com': 0,
  'chrome.google.com': 0,
};

const HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/;

function xTarget(handle: string): NormalizedTarget {
  if (!HANDLE_RE.test(handle) || X_RESERVED.has(handle.toLowerCase())) {
    throw new TargetError('That is not a valid X @handle.');
  }
  const lower = handle.toLowerCase();
  return {
    targetKey: `x:${lower}`,
    targetKind: 'x',
    url: `https://x.com/${handle}`,
    label: `@${handle}`,
    suggestedName: handle,
    logoUrl: `https://unavatar.io/x/${lower}`,
    slug: `x-${lower.replace(/_/g, '-')}`.replace(/-+$/, ''),
  };
}

function isChatLink(host: string, path: string): boolean {
  if (CHAT_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
    if ((host === 'discord.com' || host === 'discordapp.com') && !path.startsWith('/invite')) return false;
    return true;
  }
  return false;
}

function slugify(key: string): string {
  return key
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '') || 'flag';
}

function titleCase(s: string): string {
  const clean = s.replace(/[-_]+/g, ' ').trim();
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : s;
}

function faviconFor(host: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
}

function platformKey(host: string, url: URL): { keyPath: string; urlPath: string; name: string } {
  const segments = url.pathname.split('/').filter(Boolean);
  const depth = PATH_KEYED_HOSTS[host];

  if (host === 'play.google.com') {
    const id = url.searchParams.get('id');
    if (!id || !/^[A-Za-z0-9._]+$/.test(id)) throw new TargetError('Link to your app page on Google Play (it has ?id= in the link).');
    return { keyPath: `/store/apps/details?id=${id.toLowerCase()}`, urlPath: `/store/apps/details?id=${id}`, name: id.split('.').pop() || id };
  }
  if (host === 'apps.apple.com') {
    const id = segments.find((s) => /^id\d+$/.test(s));
    if (!id) throw new TargetError('Link to your app page on the App Store.');
    const nameIdx = segments.indexOf(id) - 1;
    return { keyPath: `/${id}`, urlPath: url.pathname.replace(/\/$/, ''), name: segments[nameIdx] || id };
  }
  if (host === 'chromewebstore.google.com' || host === 'chrome.google.com') {
    const id = segments.find((s) => /^[a-p]{32}$/.test(s));
    if (!id) throw new TargetError('Link to your extension page on the Chrome Web Store.');
    const name = segments[segments.indexOf(id) - 1] || id;
    return { keyPath: `/${id}`, urlPath: url.pathname.replace(/\/$/, ''), name };
  }

  if (segments.length < depth) {
    throw new TargetError(`Link to your own page on ${host}, not the ${host} homepage.`);
  }
  const kept = segments.slice(0, depth);
  return {
    keyPath: `/${kept.join('/').toLowerCase()}`,
    urlPath: `/${kept.join('/')}`,
    name: (kept[kept.length - 1] || host).replace(/^@/, ''),
  };
}

async function resolveShortLink(url: URL): Promise<string> {
  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; FreeBidsBot/1.0; +https://freebids.lol/rules)' },
    });
    res.body?.cancel().catch(() => {});
    return res.url;
  } catch {
    throw new TargetError('We could not follow that short link. Paste the full URL instead.');
  }
}

export async function normalizeTarget(raw: unknown, depth = 0): Promise<NormalizedTarget> {
  if (typeof raw !== 'string' || !raw.trim()) throw new TargetError('Enter a website or an X @handle.');
  const value = raw.trim().slice(0, 500);

  if (value.startsWith('@')) return xTarget(value.slice(1));
  if (!value.includes('.') && !value.includes('/')) {
    throw new TargetError('Enter a website (example.com) or an X @handle (starting with @).');
  }

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    throw new TargetError('That link is not a valid URL.');
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');

  if (X_HOSTS.has(host)) {
    const handle = url.pathname.split('/').filter(Boolean)[0];
    if (!handle) throw new TargetError('Link to an X profile, like x.com/yourhandle.');
    return xTarget(handle);
  }
  if (isChatLink(host, url.pathname)) {
    throw new TargetError('Chat and invite links are not allowed. The board is for products and profiles, not group chats.');
  }
  if (isShortener(host)) {
    if (depth > 0) throw new TargetError('Link shorteners are not allowed. Paste the full URL.');
    return normalizeTarget(await resolveShortLink(url), depth + 1);
  }

  const urlError = checkUrl(url.toString());
  if (urlError) throw new TargetError(urlError);

  if (host in PATH_KEYED_HOSTS) {
    const { keyPath, urlPath, name } = platformKey(host, url);
    const key = `${host}${keyPath}`;
    const githubOwner = host === 'github.com' ? keyPath.split('/')[1] : null;
    return {
      targetKey: key,
      targetKind: 'website',
      url: `https://${host}${urlPath}`,
      label: `${host}${urlPath}`.slice(0, 80),
      suggestedName: titleCase(name).slice(0, 40),
      logoUrl: githubOwner ? `https://github.com/${githubOwner}.png?size=128` : faviconFor(host),
      slug: slugify(key),
    };
  }

  const path = url.pathname.replace(/\/+$/, '');
  return {
    targetKey: host,
    targetKind: 'website',
    url: `https://${url.hostname.toLowerCase()}${path}`,
    label: host,
    suggestedName: titleCase(host.split('.').slice(0, -1).pop() || host).slice(0, 40),
    logoUrl: faviconFor(host),
    slug: slugify(host),
  };
}
