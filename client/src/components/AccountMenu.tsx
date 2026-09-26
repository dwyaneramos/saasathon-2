import type { User } from '@supabase/supabase-js'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

const pillClass =
  'rounded-full bg-[#FFCC00] px-4 py-1.5 font-[DM_Sans] text-xs font-semibold tracking-wide text-[#1a1a1a] uppercase transition-colors hover:bg-[#E3350D] hover:text-white'

function displayName(user: User): string {
  const fullName = user.user_metadata?.full_name
  return typeof fullName === 'string' && fullName.trim() ? fullName : (user.email ?? 'Account')
}

// Nav bar slot: a Login button when signed out, name + Log out when signed in.
function AccountMenu() {
  const { user, loading, signOut } = useAuth()
  const navigate = useNavigate()

  if (loading) return <span className="w-16" />

  if (!user) {
    return (
      <Link to="/login" className={pillClass}>
        Login
      </Link>
    )
  }

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <div className="flex items-center gap-3">
      <Link
        to="/projects"
        title={user.email}
        className="hidden max-w-32 truncate font-[DM_Sans] text-sm text-[#1a1a1a] hover:text-[#E3350D] sm:block"
      >
        {displayName(user)}
      </Link>
      <button type="button" onClick={handleSignOut} className={pillClass}>
        Log out
      </button>
    </div>
  )
}

export default AccountMenu
