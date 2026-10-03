/**
 * Renders the homepage social card without board data to public/og-default.png.
 * The live routes render dynamically; this static copy is the fallback served when
 * dynamic rendering fails, so it carries no ranks or counts that could go stale.
 *
 *   npm run og:default
 */
import fs from 'node:fs';
import path from 'node:path';
import { renderHomeOg } from '../src/server/og';

async function main() {
  const png = await renderHomeOg([]);
  const out = path.resolve(process.cwd(), 'public', 'og-default.png');
  await fs.promises.mkdir(path.dirname(out), { recursive: true });
  await fs.promises.writeFile(out, png);
  console.log(`Wrote ${out} (${(png.length / 1024).toFixed(0)} KB)`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
