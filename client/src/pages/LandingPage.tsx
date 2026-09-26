import { Link } from 'react-router-dom'
import ElectricTitle from '../components/ElectricTitle'

function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-10 px-8 text-center">
      <ElectricTitle className="font-[DM_Sans] text-6xl font-bold uppercase tracking-wide md:text-8xl">
        Pika
      </ElectricTitle>
      <Link
        to="/projects"
        className="rounded-full border-2 border-[#E3350D] bg-[#FFCC00] px-6 py-2.5 font-[DM_Sans] text-sm uppercase tracking-wide text-[#1a1a1a] transition-colors hover:bg-[#ffd633]"
      >
        View Projects
      </Link>
    </div>
  )
}

export default LandingPage
