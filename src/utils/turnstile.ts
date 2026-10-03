const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TIMEOUT_MS = 20_000;

interface TurnstileApi {
  render(el: HTMLElement, opts: Record<string, unknown>): string;
  remove(id: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loader: Promise<TurnstileApi> | null = null;

function loadScript(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loader ||= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile unavailable')));
    script.onerror = () => {
      loader = null;
      reject(new Error('Turnstile failed to load'));
    };
    document.head.appendChild(script);
  });
  return loader;
}

/**
 * Runs an invisible Cloudflare Turnstile check and resolves with its token.
 * Resolves null when no site key is configured (local development) or the check fails.
 */
export async function getTurnstileToken(): Promise<string | null> {
  if (!SITE_KEY || typeof window === 'undefined') return null;
  let api: TurnstileApi;
  try {
    api = await loadScript();
  } catch {
    return null;
  }
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;bottom:0;right:0;z-index:2147483647;';
  document.body.appendChild(host);
  return new Promise<string | null>((resolve) => {
    let widgetId = '';
    const finish = (token: string | null) => {
      clearTimeout(timer);
      try {
        if (widgetId) api.remove(widgetId);
      } catch {
        // already removed
      }
      host.remove();
      resolve(token);
    };
    const timer = setTimeout(() => finish(null), TIMEOUT_MS);
    widgetId = api.render(host, {
      sitekey: SITE_KEY,
      appearance: 'interaction-only',
      callback: (token: string) => finish(token),
      'error-callback': () => finish(null),
      'expired-callback': () => finish(null),
    });
  });
}
