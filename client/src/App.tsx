import { Route, Routes } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import ProjectOverviewPage from './pages/ProjectOverviewPage'
import ProjectsPage from './pages/ProjectsPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/projects" element={<ProjectsPage />} />
      <Route path="/projects/:id" element={<ProjectOverviewPage />} />
    </Routes>
  )
}

export default App
