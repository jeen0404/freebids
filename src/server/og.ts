import fs from 'node:fs';
import { createRequire } from 'node:module';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import type { FlagView } from '../types/index.js';
import { formatCount } from '../utils/rules.js';
import { getLogo } from './logos.js';

const require = createRequire(import.meta.url);

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const CACHE_TTL_MS = 5 * 60_000;

const PAGE = '#FCFAF7';
const INK = '#1C1917';
const MUTED = '#6F6862';
const LINE = 'rgba(28,25,23,0.10)';
const ACCENT = '#E5674B';
const ACCENT_SOFT = '#FCEBE5';

type Node = { type: string; props: Record<string, any> };

function h(type: string, style: Record<string, any>, ...children: any[]): Node {
  const flat = children.flat().filter((c) => c !== null && c !== undefined && c !== false);
  return { type, props: { style: { display: 'flex', ...style }, children: flat.length === 1 ? flat[0] : flat } };
}

type OgFont = { name: string; data: Buffer; weight: 400 | 700; style: 'normal' };

let fontsPromise: Promise<OgFont[]> | null = null;
function loadFonts() {
  if (!fontsPromise) {
    fontsPromise = (async () => {
      // Literal paths: Vercel's file tracer only bundles files it can see in require.resolve calls.
      const [regular, bold] = await Promise.all([
        fs.promises.readFile(require.resolve('@fontsource/poppins/files/poppins-latin-400-normal.woff')),
        fs.promises.readFile(require.resolve('@fontsource/poppins/files/poppins-latin-700-normal.woff')),
      ]);
      return [
        { name: 'Poppins', data: regular, weight: 400 as const, style: 'normal' as const },
        { name: 'Poppins', data: bold, weight: 700 as const, style: 'normal' as const },
      ];
    })();
    fontsPromise.catch(() => {
      fontsPromise = null;
    });
  }
  return fontsPromise;
}

const cache = new Map<string, { png: Buffer; at: number }>();
const inflight = new Map<string, Promise<Buffer>>();

async function render(key: string, build: () => Node | Promise<Node>, width = OG_WIDTH, height = OG_HEIGHT): Promise<Buffer> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.png;
  const pending = inflight.get(key);
  if (pending) return pending;

  const job = (async () => {
    const svg = await satori((await build()) as any, { width, height, fonts: await loadFonts() });
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();
    cache.set(key, { png, at: Date.now() });
    if (cache.size > 500) cache.delete(cache.keys().next().value!);
    return png;
  })();
  inflight.set(key, job);
  try {
    return await job;
  } finally {
    inflight.delete(key);
  }
}

const wordmark = (size: number) => h('div', { fontSize: size, fontWeight: 700, color: INK }, 'Free', h('span', { color: ACCENT }, 'Bids'));

function frame(...children: any[]): Node {
  return h(
    'div',
    {
      width: '100%',
      height: '100%',
      flexDirection: 'column',
      backgroundColor: PAGE,
      color: INK,
      fontFamily: 'Poppins',
      padding: '56px 64px',
      justifyContent: 'space-between',
    },
    wordmark(36),
    ...children,
    h(
      'div',
      { justifyContent: 'space-between', alignItems: 'center', width: '100%', fontSize: 24, color: MUTED },
      h('div', {}, 'Free to list · Ranked by the visitors you bring'),
      h('div', { color: ACCENT, fontWeight: 700 }, 'freebids.lol')
    )
  );
}

const initialOf = (name: string) => (name.trim()[0] || '?').toUpperCase();

/** The logo as a data URI satori can embed, or null to fall back to the initial. */
async function logoDataUri(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const logo = await getLogo(url);
    if (logo.contentType !== 'image/png' && logo.contentType !== 'image/jpeg') return null;
    // Google's favicon service answers unknown domains with a 16px globe.
    if (url.includes('google.com/s2/favicons') && logo.contentType === 'image/png' && logo.body.readUInt32BE(16) <= 16) return null;
    return `data:${logo.contentType};base64,${logo.body.toString('base64')}`;
  } catch {
    return null;
  }
}

/** Rounded logo tile, or the initial on the listing's color. */
function logoTile(name: string, color: string, logo: string | null, size: number): Node {
  return h(
    'div',
    {
      width: size,
      height: size,
      flexShrink: 0,
      borderRadius: Math.round(size * 0.24),
      background: logo ? '#FFFFFF' : color,
      border: `2px solid ${LINE}`,
      alignItems: 'center',
      justifyContent: 'center',
      color: '#FFFFFF',
      fontSize: Math.round(size * 0.45),
      fontWeight: 700,
      boxShadow: '0 12px 32px rgba(28,25,23,0.10)',
    },
    logo
      ? { type: 'img', props: { src: logo, width: Math.round(size * 0.7), height: Math.round(size * 0.7), style: { objectFit: 'contain' } } }
      : initialOf(name)
  );
}

function rankPill(flag: FlagView, fontSize: number): Node {
  const label = flag.rank ? `#${flag.rank} on FreeBids` : 'New on FreeBids';
  const top = flag.rank === 1;
  return h(
    'div',
    {
      fontSize,
      fontWeight: 700,
      color: top ? '#FFFFFF' : ACCENT,
      background: top ? ACCENT : ACCENT_SOFT,
      borderRadius: 999,
      padding: `${Math.round(fontSize * 0.3)}px ${Math.round(fontSize * 0.9)}px`,
    },
    label
  );
}

const flagKey = (flag: FlagView) => `${flag.slug}:${flag.rank}:${flag.visits7d}:${flag.color}:${flag.name}:${flag.tagline}:${flag.logoUrl}`;
const weekly = (flag: FlagView) => `${formatCount(flag.visits7d)} visit${flag.visits7d === 1 ? '' : 's'} this week`;

const BADGE_WIDTH = 640;
const BADGE_HEIGHT = 120;

/** Compact sticker (640×120, shown at 320×60) for a site footer. Clicks belong to the surrounding link, not this image. */
export function renderFlagBadge(flag: FlagView) {
  const rankLabel = flag.rank ? `#${flag.rank}` : 'New';
  return render(
    `badge:${flag.slug}:${flag.rank}:${flag.visits7d}`,
    async () =>
      h(
        'div',
        {
          width: '100%',
          height: '100%',
          backgroundColor: PAGE,
          fontFamily: 'Poppins',
          alignItems: 'center',
          padding: '12px 18px',
          border: `4px solid ${LINE}`,
          borderRadius: 28,
        },
        h(
          'div',
          {
            background: flag.rank === 1 ? ACCENT : ACCENT_SOFT,
            color: flag.rank === 1 ? '#FFFFFF' : ACCENT,
            borderRadius: 18,
            padding: '8px 16px',
            fontSize: rankLabel.length >= 4 ? 32 : 40,
            fontWeight: 700,
          },
          rankLabel
        ),
        h(
          'div',
          { flexDirection: 'column', marginLeft: 18, justifyContent: 'center' },
          wordmark(26),
          h('div', { fontSize: 22, color: MUTED, marginTop: 2 }, weekly(flag))
        )
      ),
    BADGE_WIDTH,
    BADGE_HEIGHT
  );
}

/** Landscape card (1200×630) for link previews, X, LinkedIn and Facebook. */
export function renderFlagOg(flag: FlagView) {
  return render(`flag:${flagKey(flag)}`, async () => {
    const logo = await logoDataUri(flag.logoUrl);
    return frame(
      h(
        'div',
        { alignItems: 'center', gap: 56 },
        logoTile(flag.name, flag.color, logo, 240),
        h(
          'div',
          { flexDirection: 'column', alignItems: 'flex-start', gap: 12, maxWidth: 700 },
          rankPill(flag, 26),
          h('div', { fontSize: flag.name.length > 18 ? 56 : 72, fontWeight: 700, lineHeight: 1.05 }, flag.name),
          flag.tagline ? h('div', { fontSize: 28, color: MUTED }, flag.tagline) : null,
          h('div', { fontSize: 42, fontWeight: 700, marginTop: 6, color: ACCENT }, weekly(flag))
        )
      )
    );
  });
}

const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;

/** Portrait card (1080×1920) for Instagram, WhatsApp and TikTok stories. */
export function renderFlagStory(flag: FlagView) {
  return render(
    `story:${flagKey(flag)}`,
    async () => {
      const logo = await logoDataUri(flag.logoUrl);
      return h(
        'div',
        {
          width: '100%',
          height: '100%',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '120px 80px 110px',
          backgroundColor: PAGE,
          color: INK,
          fontFamily: 'Poppins',
          textAlign: 'center',
        },
        wordmark(56),
        h(
          'div',
          { flexDirection: 'column', alignItems: 'center', gap: 32 },
          logoTile(flag.name, flag.color, logo, 420),
          rankPill(flag, 40),
          h('div', { fontSize: flag.name.length > 14 ? 80 : 104, fontWeight: 700, lineHeight: 1.05, maxWidth: 920, justifyContent: 'center' }, flag.name),
          flag.tagline ? h('div', { fontSize: 40, color: MUTED, maxWidth: 860, justifyContent: 'center' }, flag.tagline) : null,
          h('div', { fontSize: 72, fontWeight: 700, marginTop: 8, color: ACCENT }, weekly(flag))
        ),
        h(
          'div',
          { flexDirection: 'column', alignItems: 'center', gap: 14 },
          h('div', { fontSize: 38, color: MUTED }, 'Every visit through the link moves it up.'),
          h('div', { fontSize: 48, fontWeight: 700, color: ACCENT }, 'freebids.lol')
        )
      );
    },
    STORY_WIDTH,
    STORY_HEIGHT
  );
}

export function renderHomeOg(top: FlagView[]) {
  const podium = top.slice(0, 3);
  const key = `home:${podium.map((f) => `${f.id}:${f.visits7d}`).join('|')}`;
  return render(key, async () => {
    const logos = await Promise.all(podium.map((f) => logoDataUri(f.logoUrl)));
    return frame(
      h(
        'div',
        { flexDirection: 'column', gap: 26 },
        h(
          'div',
          { flexDirection: 'column', fontSize: 60, fontWeight: 700, lineHeight: 1.1 },
          h('div', {}, 'List your business free.'),
          h('div', { color: ACCENT, fontSize: 40 }, 'The visitors you bring decide your rank.')
        ),
        podium.length
          ? h(
              'div',
              { flexDirection: 'column', gap: 10, width: '100%' },
              ...podium.map((f, i) =>
                h(
                  'div',
                  {
                    alignItems: 'center',
                    gap: 20,
                    background: i === 0 ? ACCENT_SOFT : '#FFFFFF',
                    border: `2px solid ${LINE}`,
                    borderRadius: 20,
                    padding: '10px 22px',
                  },
                  h('div', { fontSize: 26, fontWeight: 700, color: ACCENT, width: 52 }, `#${i + 1}`),
                  logoTile(f.name, f.color, logos[i], 48),
                  h('div', { fontSize: 26, fontWeight: 700, flexGrow: 1 }, f.name.length > 28 ? `${f.name.slice(0, 27)}…` : f.name),
                  h('div', { fontSize: 24, fontWeight: 700, color: ACCENT }, `${formatCount(f.visits7d, { compact: true })} visits`)
                )
              )
            )
          : h('div', { fontSize: 32, color: ACCENT, fontWeight: 700 }, '#1 is open. List yours free.')
      )
    );
  });
}
