import { useRef } from 'react'
import { Link } from 'react-router-dom'
import ElectricTitle from '../components/ElectricTitle'
import PikaWordmark from '../components/PikaWordmark'
import { useAuth } from '../lib/auth'

function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null)
  const { user } = useAuth()
  const loggedIn = !!user

  return (
    <div className="flex min-h-svh flex-col items-start justify-center px-8 text-left md:px-16">
      <div ref={heroRef} className="flex flex-col items-start gap-10">
        <div>
          <ElectricTitle avoidRef={heroRef} className="text-8xl md:text-9xl lg:text-[11rem]">
            <PikaWordmark boltClassName="electric-bolt" />
          </ElectricTitle>
          <p className="mt-3 font-[DM_Sans] text-xl tracking-wide text-[#1a1a1a]/70 md:mt-4 md:text-2xl">
            From wires to wired
          </p>
        </div>
        <Link
          to={loggedIn ? '/projects' : '/login'}
          state={loggedIn ? undefined : { from: '/projects' }}
          className="rounded-full bg-[#FFCC00] px-6 py-2.5 font-[DM_Sans] text-sm uppercase tracking-wide text-[#1a1a1a] transition-colors hover:bg-[#ffd633]"
        >
          View Projects
        </Link>
      </div>
    </div>
  )
}

export default LandingPage
