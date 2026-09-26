import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'

interface AuthContextValue {
  session: Session | null
  user: User | null
  // Browsing via "Try without login": no Supabase session, so only mock data is available.
  isGuest: boolean
  // True until Supabase has restored any saved session, so guards don't redirect too early.
  loading: boolean
  continueAsGuest: () => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const GUEST_KEY = 'pika-guest'

function readGuestFlag(): boolean {
  try {
    return sessionStorage.getItem(GUEST_KEY) === 'true'
  } catch {
    return false
  }
}

function writeGuestFlag(value: boolean) {
  try {
    if (value) sessionStorage.setItem(GUEST_KEY, 'true')
    else sessionStorage.removeItem(GUEST_KEY)
  } catch {
    // Storage blocked: guest mode just won't survive a refresh.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isGuest, setIsGuest] = useState(readGuestFlag)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
      // A real login replaces guest mode.
      if (nextSession) {
        writeGuestFlag(false)
        setIsGuest(false)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])

  function continueAsGuest() {
    writeGuestFlag(true)
    setIsGuest(true)
  }

  async function signOut() {
    writeGuestFlag(false)
    setIsGuest(false)
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        isGuest: isGuest && !session,
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
