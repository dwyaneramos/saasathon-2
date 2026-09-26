import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { isDemoUser, signInAsDemo, supabase } from './supabase'

interface AuthContextValue {
  session: Session | null
  user: User | null
  // Came in via "Try without login": either the shared demo account, or a local guest if that account isn't set up.
  isGuest: boolean
  // True until Supabase has restored any saved session, so guards don't redirect too early.
  loading: boolean
  continueAsGuest: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// Fallback guest mode with no Supabase session, used when the demo account can't sign in.
const LOCAL_GUEST_KEY = 'pika-guest'

function readLocalGuest(): boolean {
  try {
    return sessionStorage.getItem(LOCAL_GUEST_KEY) === 'true'
  } catch {
    return false
  }
}

function writeLocalGuest(value: boolean) {
  try {
    if (value) sessionStorage.setItem(LOCAL_GUEST_KEY, 'true')
    else sessionStorage.removeItem(LOCAL_GUEST_KEY)
  } catch {
    // Storage blocked: local guest mode just won't survive a refresh.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [localGuest, setLocalGuest] = useState(readLocalGuest)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  async function continueAsGuest() {
    try {
      await signInAsDemo()
    } catch (error) {
      console.warn('Demo account unavailable, continuing as a local guest:', error)
      writeLocalGuest(true)
      setLocalGuest(true)
    }
  }

  async function signOut() {
    writeLocalGuest(false)
    setLocalGuest(false)
    await supabase.auth.signOut()
  }

  const user = session?.user ?? null

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        isGuest: isDemoUser(user) || (!user && localGuest),
        loading,
        continueAsGuest,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
