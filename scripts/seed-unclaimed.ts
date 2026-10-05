/**
 * Adds products from public launch boards as unclaimed listings: shown in the
 * "not claimed yet" list, never ranked, and moved onto the board only after the
 * owner verifies. Products that are already listed are skipped.
 *
 *   npm run seed:unclaimed -- launch/unclaimed.json            (dry run)
 *   npm run seed:unclaimed -- launch/unclaimed.json --write
 *
 * The file is a JSON array of { "url", "name", "tagline"?, "category"? }.
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { storeMode, store } from '../src/server/getStore';
import { screenFlagText } from '../src/server/promotionSafety';
import { normalizeTarget } from '../src/server/targets';
import { CATEGORIES, defaultColorFor } from '../src/utils/rules';

interface SeedRow {
  url: string;
  name: string;
  tagline?: string;
  category?: string;
}

async function main() {
  const file = process.argv[2];
  const write = process.argv.includes('--write');
  if (!file) throw new Error('Usage: npm run seed:unclaimed -- <file.json> [--write]');
  const rows: SeedRow[] = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(`${write ? 'Writing to' : 'Dry run against'} the ${storeMode} store, ${rows.length} rows`);

  let added = 0;
  for (const row of rows) {
    try {
      const target = await normalizeTarget(row.url);
      const existing = await store.getFlagByKey(target.targetKey);
      if (existing) {
        console.log(`skip  ${target.label} (already listed)`);
        continue;
      }
      const name = row.name.replace(/\s+/g, ' ').trim().slice(0, 40);
      const tagline = (row.tagline || '').replace(/\s+/g, ' ').trim().slice(0, 90);
      const textError = screenFlagText({ name, tagline });
      if (textError) {
        console.log(`skip  ${target.label} (${textError})`);
        continue;
      }
      if (write) {
        await store.createFlag({
          slug: target.slug,
          targetKey: target.targetKey,
          targetKind: target.targetKind,
          url: target.url,
          name,
          tagline: tagline || null,
          category: row.category && CATEGORIES.includes(row.category) ? row.category : 'Other',
          color: defaultColorFor(target.targetKey),
          logoUrl: target.logoUrl,
          ownerEmail: null,
          verifyToken: `fc-${crypto.randomBytes(8).toString('hex')}`,
          unclaimed: true,
        });
      }
      added++;
      console.log(`${write ? 'added' : 'would add'} ${target.label} – ${name}`);
    } catch (err: any) {
      console.log(`fail  ${row.url}: ${err.message}`);
    }
  }
  console.log(`${added} ${write ? 'added' : 'to add'}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
