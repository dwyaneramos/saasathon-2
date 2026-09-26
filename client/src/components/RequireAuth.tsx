import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'

// Sends visitors who are neither logged in nor browsing as a guest to /login, remembering where they were headed.
function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isGuest, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center font-[DM_Sans] text-sm text-black/50">
        Loading…
      </div>
    )
  }

  if (!user && !isGuest) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }

  return children
}

export default RequireAuth
