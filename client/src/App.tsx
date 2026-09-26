import ElectricTitle from './components/ElectricTitle'

const navLinkClass =
  'relative text-white/75 transition-colors hover:text-white after:absolute after:inset-x-0 after:-bottom-1 after:h-px after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-300 hover:after:scale-x-100'

function App() {
  return (
    <div className="relative flex min-h-svh items-center justify-center px-8 text-center">
      <nav className="absolute top-10 left-1/2 flex -translate-x-1/2 items-center gap-12 font-[IBM_Plex_Sans] text-sm">
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
      <ElectricTitle className="font-[IBM_Plex_Mono] text-6xl font-bold uppercase tracking-wide md:text-8xl">
        Elekto
      </ElectricTitle>
    </div>
  )
}

export default App
