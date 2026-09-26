import { createClient, type User } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in client/.env.local')
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey)

// Shared demo account (supabase/seed.sql). Visitors who "Try without login" are signed in as this user.
const DEMO_EMAIL = import.meta.env.VITE_DEMO_EMAIL as string | undefined
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD as string | undefined

export function isDemoUser(user: User | null): boolean {
  return !!user && !!DEMO_EMAIL && user.email?.toLowerCase() === DEMO_EMAIL.toLowerCase()
}

/** Signs in as the seeded demo user so guests get a real session and RLS-protected data works. */
export async function signInAsDemo(): Promise<void> {
  if (!DEMO_EMAIL || !DEMO_PASSWORD) {
    throw new Error('Set VITE_DEMO_EMAIL and VITE_DEMO_PASSWORD in client/.env.local')
  }
  const { error } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  })
  if (error) throw new Error(`Demo sign-in failed: ${error.message}`)
}
