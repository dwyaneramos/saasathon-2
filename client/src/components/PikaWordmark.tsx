interface PikaWordmarkProps {
  // Size it with a text-* class; everything scales with the font size. Letters inherit the text colour.
  className?: string
  boltClassName?: string
}

// Official Pika logo: "PIKA" with the I replaced by a lightning bolt.
function PikaWordmark({ className = '', boltClassName = '' }: PikaWordmarkProps) {
  return (
    <span
      role="img"
      aria-label="Pika"
      className={`inline-flex items-center font-[DM_Sans] leading-none font-extrabold tracking-tight ${className}`}
    >
      <span aria-hidden="true">P</span>
      <svg
        aria-hidden="true"
        viewBox="0 0 25 56"
        fill="#E3350D"
        className={`mx-[0.03em] h-[1.05em] w-auto ${boltClassName}`}
      >
        <path d="M17 0 1 30h11l-8 26 20-36H13l9-20z" />
      </svg>
      <span aria-hidden="true">KA</span>
    </span>
  )
}

export default PikaWordmark
