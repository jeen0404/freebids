import { supabase } from './supabase.js';
import { JsonStore } from './jsonStore.js';
import { SupabaseStore } from './supabaseStore.js';
import { FlagStore } from './store.js';

/** Supabase whenever it is configured; DATA_STORE=json forces the local ledger. */
export function resolveStoreMode(): 'supabase' | 'json' {
  if (process.env.DATA_STORE === 'json') return 'json';
  if (supabase) return 'supabase';
  if (process.env.DATA_STORE === 'supabase') throw new Error('DATA_STORE=supabase but Supabase is not configured');
  return 'json';
}

function createStore(): FlagStore {
  if (resolveStoreMode() === 'supabase' && supabase) {
    console.log('[store] Using Supabase Postgres as the source of truth');
    return new SupabaseStore(supabase);
  }
  console.log('[store] Using local JSON ledger (freebids_db.json)');
  return new JsonStore();
}

export const store: FlagStore = createStore();
export const storeMode = resolveStoreMode();
