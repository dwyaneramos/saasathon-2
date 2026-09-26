import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { isDemoUser, signInAsDemo, supabase } from './supabase'

interface AuthContextValue {
  session: Session | null
  user: User | null
  // Signed in as the shared demo account via "Try without login".
  isGuest: boolean
  // True until Supabase has restored any saved session, so guards don't redirect too early.
  loading: boolean
  continueAsGuest: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
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

  async function signOut() {
    await supabase.auth.signOut()
  }

  const user = session?.user ?? null

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        isGuest: isDemoUser(user),
        loading,
        continueAsGuest: signInAsDemo,
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
