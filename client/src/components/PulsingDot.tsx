interface PulsingDotProps {
  className?: string
}

function PulsingDot({ className = 'bg-[#1a1a1a]' }: PulsingDotProps) {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${className}`} />
      <span className={`relative inline-flex h-2 w-2 rounded-full ${className}`} />
    </span>
  )
}

export default PulsingDot
