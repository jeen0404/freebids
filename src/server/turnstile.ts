import crypto from 'node:crypto';
import { isProduction } from './launchChecks.js';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export function isTurnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET);
}

/** Checks a Cloudflare Turnstile token. Without a secret, development accepts every visit and production rejects them. */
export async function verifyTurnstile(token: unknown, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) return !isProduction;
  if (typeof token !== 'string' || !token || token.length > 2048) return false;
  try {
    const body = new URLSearchParams({ secret, response: token, remoteip: ip });
    const res = await fetch(VERIFY_URL, { method: 'POST', body, signal: AbortSignal.timeout(5000) });
    const data: any = await res.json();
    return Boolean(data?.success);
  } catch (err: any) {
    console.warn('[turnstile]', err.message);
    return false;
  }
}

/** Raw IPs are never stored; a salted hash is enough to count one visit per IP per flag per 3 hours. */
export function hashIp(ip: string): string {
  const salt = process.env.VISIT_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || 'freebids-dev';
  return crypto.createHmac('sha256', salt).update(ip).digest('hex').slice(0, 32);
}
