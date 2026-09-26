import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

type Mode = 'login' | 'signup'

// Dev-only shortcut. import.meta.env.DEV is false in production builds, so Vite strips this out.
const DEV_LOGIN =
  import.meta.env.DEV && import.meta.env.VITE_DEV_LOGIN_EMAIL && import.meta.env.VITE_DEV_LOGIN_PASSWORD
    ? {
        email: import.meta.env.VITE_DEV_LOGIN_EMAIL as string,
        password: import.meta.env.VITE_DEV_LOGIN_PASSWORD as string,
      }
    : null

const labelClass = 'font-[DM_Sans] text-xs uppercase tracking-wide text-black/50'
const inputClass =
  'w-full rounded-md border border-black/15 bg-white px-3 py-2 font-[DM_Sans] text-sm text-[#1a1a1a] focus:border-[#1a1a1a] focus:outline-none'

function AuthPage({ mode }: { mode: Mode }) {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/projects'

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) return <Navigate to={redirectTo} replace />

  const isSignup = mode === 'signup'

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setSubmitting(true)

    if (isSignup) {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName.trim() },
          emailRedirectTo: `${window.location.origin}/projects`,
        },
      })
      setSubmitting(false)
      if (signUpError) return setError(signUpError.message)
      // With email confirmation on, Supabase returns no session until the link is clicked.
      if (!data.session) {
        setNotice(`Check ${email} for a confirmation link, then log in.`)
        return
      }
      navigate(redirectTo, { replace: true })
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      setSubmitting(false)
      if (signInError) return setError(signInError.message)
      navigate(redirectTo, { replace: true })
    }
  }

  async function handleDevLogin() {
    if (!DEV_LOGIN) return
    setError(null)
    setSubmitting(true)
    const { error: signInError } = await supabase.auth.signInWithPassword(DEV_LOGIN)
    setSubmitting(false)
    if (signInError) return setError(`Dev login failed: ${signInError.message}`)
    navigate(redirectTo, { replace: true })
  }

  return (
    <div className="flex min-h-svh items-center justify-center px-6 pt-28 pb-10">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-2xl border-2 border-[#1a1a1a] bg-white p-8 shadow-[0_6px_0_0_rgba(26,26,26,0.15)]">
        <div className="flex flex-col gap-1">
          <h1 className="font-[DM_Sans] text-2xl font-bold text-[#1a1a1a]">
            {isSignup ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="font-[DM_Sans] text-sm text-black/60">
            {isSignup ? 'Free for your first two jobs.' : 'Log in to see your projects.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {isSignup && (
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Full name</span>
              <input
                required
                autoComplete="name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className={inputClass}
              />
            </label>
          )}
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Email</span>
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Password</span>
            <input
              required
              type="password"
              minLength={isSignup ? 8 : undefined}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClass}
            />
            {isSignup && <span className="font-[DM_Sans] text-xs text-black/50">At least 8 characters.</span>}
          </label>

          {error && (
            <p role="alert" className="rounded-md bg-[#E3350D]/10 px-3 py-2 font-[DM_Sans] text-sm text-[#E3350D]">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="rounded-md bg-[#FFCC00]/30 px-3 py-2 font-[DM_Sans] text-sm text-[#1a1a1a]">
              {notice}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-[#FFCC00] px-4 py-2.5 font-[DM_Sans] text-sm font-semibold uppercase tracking-wide text-[#1a1a1a] transition-colors hover:bg-[#E3350D] hover:text-white disabled:opacity-50"
          >
            {submitting ? 'Please wait…' : isSignup ? 'Sign up' : 'Log in'}
          </button>
        </form>

        {DEV_LOGIN && (
          <>
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-black/10" />
              <span className="font-[DM_Sans] text-xs uppercase tracking-wide text-black/40">or</span>
              <span className="h-px flex-1 bg-black/10" />
            </div>
            <button
              type="button"
              onClick={handleDevLogin}
              disabled={submitting}
              className="rounded-full border-2 border-dashed border-[#E3350D] px-4 py-2 font-[DM_Sans] text-xs font-semibold uppercase tracking-wide text-[#E3350D] transition-colors hover:bg-[#E3350D]/10 disabled:opacity-50"
            >
              Dev quick login · {DEV_LOGIN.email}
            </button>
          </>
        )}

        <p className="text-center font-[DM_Sans] text-sm text-black/60">
          {isSignup ? 'Already have an account? ' : 'New to Pika? '}
          <Link
            to={isSignup ? '/login' : '/signup'}
            state={location.state}
            className="font-semibold text-[#1a1a1a] underline-offset-2 hover:text-[#E3350D] hover:underline"
          >
            {isSignup ? 'Log in' : 'Create an account'}
          </Link>
        </p>
      </div>
    </div>
  )
}

export default AuthPage
