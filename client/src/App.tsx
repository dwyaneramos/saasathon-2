import { Route, Routes } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import NewProjectPage from './pages/NewProjectPage'
import ProjectOverviewPage from './pages/ProjectOverviewPage'
import ProjectsPage from './pages/ProjectsPage'

const navLinkClass =
  'relative text-[#1a1a1a]/60 transition-colors hover:text-[#1a1a1a] after:absolute after:inset-x-0 after:-bottom-1 after:h-px after:origin-left after:scale-x-0 after:bg-[#E3350D] after:transition-transform after:duration-300 hover:after:scale-x-100'

function App() {
  return (
    <div className="relative min-h-svh">
      <nav className="fixed top-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-6 rounded-full border-2 border-[#1a1a1a] bg-white/95 px-6 py-2.5 shadow-[0_4px_0_0_rgba(26,26,26,0.15)] backdrop-blur-sm sm:gap-10 sm:px-8">
        <span className="font-[DM_Sans] text-base font-bold tracking-wide text-[#1a1a1a] uppercase">
          Pika
        </span>
        <div className="hidden items-center gap-8 font-[DM_Sans] text-sm sm:flex">
          <a href="#" className={navLinkClass}>
            Features
          </a>
          <a href="#" className={navLinkClass}>
            Pricing
          </a>
        </div>
        <a
          href="#"
          className="rounded-full bg-[#FFCC00] px-4 py-1.5 font-[DM_Sans] text-xs font-semibold tracking-wide text-[#1a1a1a] uppercase transition-colors hover:bg-[#E3350D] hover:text-white"
        >
          Login
        </a>
      </nav>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/new" element={<NewProjectPage />} />
        <Route path="/projects/:id" element={<ProjectOverviewPage />} />
      </Routes>
    </div>
  )
}

export default App
