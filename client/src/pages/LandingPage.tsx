import { Link } from 'react-router-dom'
import ElectricTitle from '../components/ElectricTitle'

function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-10 px-8 text-center">
      <div>
        <ElectricTitle className="font-[DM_Sans] text-8xl font-bold uppercase tracking-wide md:text-9xl lg:text-[11rem]">
          Pika
        </ElectricTitle>
        <p className="-mt-2 font-[DM_Sans] text-xl tracking-wide text-[#1a1a1a]/70 md:-mt-4 md:text-2xl">
          From wires to wired
        </p>
      </div>
      <Link
        to="/projects"
        className="rounded-full bg-[#FFCC00] px-6 py-2.5 font-[DM_Sans] text-sm uppercase tracking-wide text-[#1a1a1a] transition-colors hover:bg-[#ffd633]"
      >
        View Projects
      </Link>
    </div>
  )
}

export default LandingPage
