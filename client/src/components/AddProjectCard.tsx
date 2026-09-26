interface AddProjectCardProps {
  onClick?: () => void
}

function AddProjectCard({ onClick }: AddProjectCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Add project"
      className="flex h-40 w-56 shrink-0 items-center justify-center rounded-lg border-4 border-dotted border-[#E3350D]/30 bg-black/[0.03] font-[DM_Sans] text-base text-[#1a1a1a] transition-colors hover:bg-black/[0.05]"
    >
      + Add Project
    </button>
  )
}

export default AddProjectCard
