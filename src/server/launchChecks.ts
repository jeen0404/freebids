import { resolveStoreMode } from './getStore.js';

export const isProduction = process.env.NODE_ENV === 'production';

export function assertProductionReady(): void {
  if (!isProduction) return;

  const errors: string[] = [];
  const warnings: string[] = [];
  const env = process.env;

  if (!env.TURNSTILE_SECRET) errors.push('TURNSTILE_SECRET is required: referral visits only count after a Cloudflare Turnstile check.');
  if (!env.VITE_TURNSTILE_SITE_KEY) warnings.push('VITE_TURNSTILE_SITE_KEY not set at build time: no referral visits will count.');
  if (!env.VISIT_SALT) warnings.push('VISIT_SALT not set: IP hashes fall back to the Supabase service key as salt.');

  if (resolveStoreMode() !== 'supabase') {
    errors.push('Production needs Supabase: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  if (!env.APP_URL || !env.APP_URL.startsWith('https://')) {
    errors.push('APP_URL must be the public https:// URL (used for referral links, verification and OG tags).');
  }

  if (!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD === 'change-me' || env.ADMIN_PASSWORD.length < 12) {
    errors.push('ADMIN_PASSWORD must be set to a strong value (12+ chars).');
  }

  if (env.SKIP_LISTING_VERIFICATION === 'true') warnings.push('SKIP_LISTING_VERIFICATION is on: new listings go live without an ownership check.');
  if (env.STRICT_VISIT_COUNTING !== 'true') warnings.push('STRICT_VISIT_COUNTING is off: every listing page view, refresh and click counts as a visit, without the human check.');

  if (!env.VITE_POSTHOG_KEY) warnings.push('VITE_POSTHOG_KEY not set at build time: product analytics are disabled.');

  warnings.forEach((w) => console.warn(`[launch-check] WARN ${w}`));
  if (errors.length) {
    errors.forEach((e) => console.error(`[launch-check] FAIL ${e}`));
    throw new Error(`Refusing to start in production: ${errors.length} launch check(s) failed.`);
  }
  console.log('[launch-check] Production configuration OK');
}
