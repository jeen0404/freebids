import { store } from './getStore.js';

/** Clients ping once per page load with no heartbeat, so "online" means seen in the last 10 minutes. */
const ONLINE_WINDOW_MS = 10 * 60_000;
const MAX_NEW_VISITORS_PER_IP_PER_DAY = 20;

const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|quora|pinterest|headless|lighthouse|curl|wget|python|axios|node-fetch/i;

const lastSeen = new Map<string, number>();
const idsPerIp = new Map<string, Set<string>>();
let ipDay = '';

export function isValidVisitorId(id: unknown): id is string {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{6,100}$/.test(id);
}

export function isBot(userAgent: string | undefined): boolean {
  return !userAgent || BOT_UA.test(userAgent);
}

/** Caps how many distinct visitor ids one IP can register per day, so the counter can't be trivially inflated. */
function allowVisitorForIp(ip: string, visitorId: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (ipDay !== today) {
    idsPerIp.clear();
    ipDay = today;
  }
  let ids = idsPerIp.get(ip);
  if (!ids) {
    ids = new Set();
    idsPerIp.set(ip, ids);
  }
  if (ids.has(visitorId)) return true;
  if (ids.size >= MAX_NEW_VISITORS_PER_IP_PER_DAY) return false;
  ids.add(visitorId);
  return true;
}

export function touchPresence(visitorId: string) {
  lastSeen.set(visitorId, Date.now());
}

export function onlineCount(): number {
  const cutoff = Date.now() - ONLINE_WINDOW_MS;
  let online = 0;
  for (const [id, ts] of lastSeen) {
    if (ts < cutoff) lastSeen.delete(id);
    else online++;
  }
  return online;
}

export async function recordVisitor(visitorId: string, ip: string): Promise<void> {
  touchPresence(visitorId);
  if (!allowVisitorForIp(ip, visitorId)) return;
  await store.recordVisit(visitorId);
}
