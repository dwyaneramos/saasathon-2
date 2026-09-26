import { Route, Routes } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import ProjectOverviewPage from './pages/ProjectOverviewPage'
import ProjectsPage from './pages/ProjectsPage'

const navLinkClass =
  'relative text-white/75 transition-colors hover:text-white after:absolute after:inset-x-0 after:-bottom-1 after:h-px after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-300 hover:after:scale-x-100'

function App() {
  return (
    <div className="relative min-h-svh">
      <nav className="absolute top-10 left-1/2 z-10 flex -translate-x-1/2 items-center gap-12 font-[IBM_Plex_Sans] text-sm">
        <span className="font-[IBM_Plex_Mono] text-base font-semibold tracking-widest uppercase">
          Elekto
        </span>
        <a href="#" className={navLinkClass}>
          Features
        </a>
        <a href="#" className={navLinkClass}>
          Pricing
        </a>
        <a href="#" className={`${navLinkClass} font-semibold text-[rgb(190,220,255)]`}>
          Login
        </a>
      </nav>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:id" element={<ProjectOverviewPage />} />
      </Routes>
    </div>
  )
}

export default App
