import type { PostHog } from 'posthog-js';
import { track as vercelTrack } from '@vercel/analytics';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://us.i.posthog.com';
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;
const FIRST_TOUCH_KEY = 'fc_first_touch';
const DATAFAST_ID = import.meta.env.VITE_DATAFAST_ID as string | undefined;
/** Public DataFast dashboard; the header "stats" link is hidden when unset. */
export const DATAFAST_SHARE_URL = (import.meta.env.VITE_DATAFAST_SHARE_URL as string | undefined) || null;

/** Injects the DataFast tracker when VITE_DATAFAST_ID is set and the page has no DataFast script yet. */
export function loadDatafast() {
  if (!DATAFAST_ID || typeof document === 'undefined') return;
  if (document.querySelector('script[src*="datafa.st"]')) return;
  const s = document.createElement('script');
  s.defer = true;
  s.src = 'https://datafa.st/js/script.cookieless.js';
  s.dataset.websiteId = DATAFAST_ID;
  s.dataset.domain = 'www.freebids.lol';
  document.head.appendChild(s);
}

let enabled = false;
let posthog: PostHog | null = null;
// posthog-js is loaded lazily so it stays out of the first-paint bundle; calls made before it loads are replayed.
let pending: Array<(ph: PostHog) => void> = [];

function withPosthog(fn: (ph: PostHog) => void) {
  if (!enabled) return;
  if (posthog) fn(posthog);
  else pending.push(fn);
}

function readUtm(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    const v = params.get(key);
    if (v) utm[key] = v.slice(0, 100);
  }
  return utm;
}

/** First-touch attribution survives later visits. */
function captureFirstTouch(utm: Record<string, string>) {
  try {
    if (localStorage.getItem(FIRST_TOUCH_KEY)) return;
    localStorage.setItem(
      FIRST_TOUCH_KEY,
      JSON.stringify({
        ...utm,
        referrer: document.referrer ? new URL(document.referrer).hostname : 'direct',
        landing: window.location.pathname,
        at: new Date().toISOString(),
      })
    );
  } catch {
    // storage unavailable
  }
}

function getFirstTouch(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(FIRST_TOUCH_KEY) || '{}');
  } catch {
    return {};
  }
}

export function initAnalytics(distinctId: string) {
  if (typeof window === 'undefined') return;
  const utm = readUtm();
  captureFirstTouch(utm);
  if (!POSTHOG_KEY || enabled) return;
  enabled = true;
  const key = POSTHOG_KEY;
  import('posthog-js')
    .then(({ default: ph }) => {
      startPosthog(ph, key, distinctId);
      posthog = ph;
      const queued = pending;
      pending = [];
      queued.forEach(fn => fn(ph));
    })
    .catch(() => {
      enabled = false;
      pending = [];
    });
}

function startPosthog(ph: PostHog, key: string, distinctId: string) {
  // Only the explicit track() events and manual pageviews are sent. Everything else that bills per event
  // or per request is off; web vitals come from Vercel Speed Insights instead.
  ph.init(key, {
    api_host: POSTHOG_HOST,
    capture_pageview: false,
    capture_pageleave: false,
    autocapture: false,
    rageclick: false,
    capture_dead_clicks: false,
    capture_heatmaps: false,
    capture_performance: false,
    disable_session_recording: true,
    disable_surveys: true,
    advanced_disable_feature_flags: true,
    persistence: 'localStorage+cookie',
    person_profiles: 'identified_only',
    bootstrap: { distinctID: distinctId },
  });
  const firstTouch = getFirstTouch();
  ph.register_once(
    Object.fromEntries(Object.entries(firstTouch).map(([k, v]) => [`first_${k}`, v]))
  );
}

// Vercel custom events (Pro plan) take flat, primitive props; only funnel steps are mirrored.
const VERCEL_EVENTS = new Set(['plant_opened', 'claim_checkout_started', 'flag_clicked', 'share_clicked']);

function mirrorToVercel(event: string, props: Record<string, unknown>) {
  if (!VERCEL_EVENTS.has(event)) return;
  const flat: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(props)) {
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') flat[k] = v;
  }
  vercelTrack(event, flat);
}

export function track(event: string, props: Record<string, unknown> = {}) {
  mirrorToVercel(event, props);
  if (!enabled) {
    if (import.meta.env.DEV) console.debug('[analytics]', event, props);
    return;
  }
  withPosthog(ph => ph.capture(event, props));
}

export function trackPageview(path: string) {
  track('$pageview', { $current_url: window.location.origin + path, path });
}
