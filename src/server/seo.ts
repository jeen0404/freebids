import { RANK_WINDOW_DAYS } from '../utils/rules.js';
import { findFlagBySlug, getBoard, viewOf } from './board.js';
import { appBaseUrl } from './config.js';

interface SeoMeta {
  title: string;
  description: string;
  path: string;
  image: string;
  noindex?: boolean;
}

const HOME_TITLE = 'FreeBids – List your business free. The visitors you bring decide your rank.';
const DEFAULT_DESCRIPTION = `A free public board of websites and X profiles, ranked by one number: visits each one brings through its own link in the last ${RANK_WINDOW_DAYS} days. Add yours, share your link, climb.`;

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const PREVIEW_BUCKET_MS = 60 * 60_000;

/** Cache-busts link previews when the board moves, at most once an hour (matches the OG image cache). */
function version(...parts: (number | string | undefined)[]): string {
  return [...parts.map((p) => String(p ?? 0)), Math.floor(Date.now() / PREVIEW_BUCKET_MS)].join('-');
}

export async function resolveSeo(pathname: string): Promise<SeoMeta> {
  const home: SeoMeta = { title: HOME_TITLE, description: DEFAULT_DESCRIPTION, path: '/', image: '/og-image.png' };

  try {
    // Referral links (/f/) share the flag page's preview; the canonical URL keeps them out of search results.
    const flagMatch = pathname.match(/^\/(flag|f)\/([a-z0-9-]+)\/?$/i);
    if (flagMatch) {
      const slug = flagMatch[2].toLowerCase();
      const flag = await findFlagBySlug(slug);
      if (!flag || flag.hidden) return home;
      const view = viewOf(await getBoard(), flag);
      return {
        title: view.rank ? `${flag.name} is #${view.rank} on FreeBids` : `${flag.name} on FreeBids`,
        description: `${flag.name}${flag.tagline ? ` – ${flag.tagline}` : ''}. ${view.visits7d.toLocaleString('en-US')} visits this week on the FreeBids board. Every visit through this link moves it up.`,
        path: `/flag/${flag.slug}`,
        image: `/og/flag/${flag.slug}.png?v=${version(view.rank, view.visits7d)}`,
        noindex: flagMatch[1].toLowerCase() === 'f',
      };
    }
    if (pathname === '/' || pathname === '') {
      const top = (await getBoard()).views[0];
      return { ...home, image: `/og-image.png?v=${version(top?.id, top?.visits7d)}` };
    }
  } catch (err: any) {
    console.warn('[seo] falling back to defaults:', err.message);
  }

  const staticPages: Record<string, Partial<SeoMeta>> = {
    '/rules': { title: 'Rules – FreeBids', description: 'How the FreeBids board ranks listings, what you can list, how verification works, and what counts as fake traffic.' },
    '/terms': { title: 'Terms of Service – FreeBids' },
    '/privacy': { title: 'Privacy Policy – FreeBids' },
    '/refunds': { title: 'Refund Policy – FreeBids' },
  };
  const clean = pathname.replace(/\/$/, '') || '/';
  if (staticPages[clean]) return { ...home, ...staticPages[clean], path: clean };
  if (clean.startsWith('/admin')) return { ...home, path: clean, noindex: true };
  return home;
}

function renderSeoBlock(meta: SeoMeta): string {
  const base = appBaseUrl();
  const url = `${base}${meta.path}`;
  const image = meta.image.startsWith('http') ? meta.image : `${base}${meta.image}`;
  const t = escapeAttr(meta.title);
  const d = escapeAttr(meta.description);
  return [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${escapeAttr(url)}" />`,
    `<meta property="og:image" content="${escapeAttr(image)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<link rel="canonical" href="${escapeAttr(url)}" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    `<meta name="twitter:image" content="${escapeAttr(image)}" />`,
    meta.noindex ? `<meta name="robots" content="noindex" />` : '',
  ]
    .filter(Boolean)
    .join('\n    ');
}

export function injectSeo(html: string, meta: SeoMeta): string {
  return html.replace(/<!--SEO_START-->[\s\S]*?<!--SEO_END-->/, renderSeoBlock(meta));
}

export async function buildSitemap(): Promise<string> {
  const base = appBaseUrl();
  const today = new Date().toISOString().slice(0, 10);
  const flags = (await getBoard().catch(() => null))?.views.slice(0, 500) || [];
  const urls: { loc: string; priority: string; freq: string }[] = [
    { loc: '/', priority: '1.0', freq: 'hourly' },
    ...flags.map((f) => ({ loc: `/flag/${f.slug}`, priority: '0.6', freq: 'daily' })),
    { loc: '/rules', priority: '0.3', freq: 'monthly' },
    { loc: '/terms', priority: '0.1', freq: 'yearly' },
    { loc: '/privacy', priority: '0.1', freq: 'yearly' },
    { loc: '/refunds', priority: '0.1', freq: 'yearly' },
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((u) => `  <url><loc>${base}${u.loc}</loc><lastmod>${today}</lastmod><changefreq>${u.freq}</changefreq><priority>${u.priority}</priority></url>`)
  .join('\n')}
</urlset>
`;
}
