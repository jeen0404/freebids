import type { Request } from 'express';
import { assertProductionReady } from '../src/server/launchChecks.js';
import { createApp, serveHtml } from '../src/server/app.js';

assertProductionReady();

const app = createApp();

// The built shell lives on the CDN (dist/index.html). It's fetched instead of bundled
// because the Vite build output isn't guaranteed to exist when the function is packaged.
let shell: Promise<string> | null = null;
function loadShell(req: Request): Promise<string> {
  if (!shell) {
    const origin = `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
    shell = fetch(`${origin}/index.html`, { headers: { 'x-freebids-shell': '1' } }).then((r) => {
      if (!r.ok) throw new Error(`Shell fetch failed: ${r.status}`);
      return r.text();
    });
    shell.catch(() => {
      shell = null;
    });
  }
  return shell;
}

serveHtml(app, loadShell);

export default app;
