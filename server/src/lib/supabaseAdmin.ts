import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/**
 * Service-role client for trusted server-side access - bypasses RLS. This is a
 * simplification appropriate to the app's current single-demo-user, no-auth scope
 * (see docs/superpowers/specs/2026-09-26-wiring-plan-design.md); never expose this
 * key to the browser.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env');
    }
    client = createClient(url, key);
  }
  return client;
}
