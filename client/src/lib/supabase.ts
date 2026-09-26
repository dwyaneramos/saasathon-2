import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in client/.env.local')
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey)

/**
 * Signs in as the seeded demo user (supabase/seed.sql) if there's no session yet.
 * Stands in for real auth until a login flow exists - there is no sign-in UI.
 */
export async function ensureDemoSession(): Promise<void> {
  const { data } = await supabase.auth.getSession()
  if (data.session) return

  const email = import.meta.env.VITE_DEMO_EMAIL
  const password = import.meta.env.VITE_DEMO_PASSWORD
  if (!email || !password) {
    throw new Error('Set VITE_DEMO_EMAIL and VITE_DEMO_PASSWORD in client/.env.local')
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Demo sign-in failed: ${error.message}`)
}
