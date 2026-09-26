import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface Feature {
  title: string
  body: string
  icon: ReactNode
}

const iconProps = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

const FEATURES: Feature[] = [
  {
    title: 'Plans in, data out',
    body: 'Drop in site plans, wiring layouts, quotes, cable schedules and old COCs or ESCs. Pika reads them, pulls out the electrical details and flags anything it is unsure about for you to check.',
    icon: (
      <svg {...iconProps}>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5M9 13h6M9 17h4" />
      </svg>
    ),
  },
  {
    title: 'Variations clients actually approve',
    body: 'Scope changed on site? Describe it, price it and send it. Your client approves or rejects from their phone in one tap, with a comment if they want.',
    icon: (
      <svg {...iconProps}>
        <path d="M20 6 9 17l-5-5" />
      </svg>
    ),
  },
  {
    title: 'Get paid for every change',
    body: 'Every approved variation is logged with who approved it and when, and rolls into an invoice-ready total. No more eating the cost of extra work you can’t prove was agreed.',
    icon: (
      <svg {...iconProps}>
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <circle cx="12" cy="12" r="2.5" />
        <path d="M6 12h.01M18 12h.01" />
      </svg>
    ),
  },
  {
    title: 'A full paper trail',
    body: 'Approvals, rejections and changes of mind are all kept in a history per project, so disputes come down to facts instead of memory.',
    icon: (
      <svg {...iconProps}>
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    title: 'Email when it matters',
    body: 'Clients hear about new changes as soon as you send them. You hear the moment they are approved, so work never waits on a phone call.',
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </svg>
    ),
  },
  {
    title: 'Every job at a glance',
    body: 'Status, due dates, progress and outstanding approvals for all your projects on one screen, whether you run one van or five.',
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
]

const STEPS = [
  { title: 'Upload the plans', body: 'Pika turns them into structured job data.' },
  { title: 'Send a variation', body: 'Describe the change and put a price on it.' },
  { title: 'Client approves', body: 'One tap from their phone, logged forever.' },
  { title: 'Invoice with proof', body: 'Approved work is ready to bill.' },
]

function FeaturesPage() {
  return (
    <div className="mx-auto flex min-h-svh max-w-5xl flex-col gap-20 px-6 pt-32 pb-20 sm:px-8">
      <header className="flex flex-col items-center gap-4 text-center">
        <span className="font-[DM_Sans] text-xs font-semibold uppercase tracking-widest text-[#E3350D]">
          Features
        </span>
        <h1 className="max-w-3xl font-[DM_Sans] text-4xl font-bold text-[#1a1a1a] sm:text-5xl">
          Stop doing extra work for free.
        </h1>
        <p className="max-w-2xl font-[DM_Sans] text-lg text-[#1a1a1a]/70">
          Pika keeps plans, variations and client sign-off in one place, so every change on a
          job is agreed, recorded and paid for.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="flex flex-col gap-3 rounded-lg border border-black/10 bg-black/[0.03] p-6"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FFCC00] text-[#1a1a1a]">
              {feature.icon}
            </span>
            <h2 className="font-[DM_Sans] text-lg font-semibold text-[#1a1a1a]">{feature.title}</h2>
            <p className="font-[DM_Sans] text-sm leading-relaxed text-[#1a1a1a]/70">
              {feature.body}
            </p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-8">
        <h2 className="text-center font-[DM_Sans] text-lg font-semibold uppercase tracking-wide text-[#E3350D]">
          How it works
        </h2>
        <ol className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex flex-col gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#1a1a1a] font-[DM_Sans] text-sm font-bold text-[#1a1a1a]">
                {index + 1}
              </span>
              <span className="font-[DM_Sans] font-semibold text-[#1a1a1a]">{step.title}</span>
              <span className="font-[DM_Sans] text-sm text-[#1a1a1a]/70">{step.body}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col items-center gap-5 rounded-2xl border-2 border-[#1a1a1a] bg-[#FFCC00] px-6 py-12 text-center shadow-[0_6px_0_0_rgba(26,26,26,0.15)]">
        <h2 className="font-[DM_Sans] text-2xl font-bold text-[#1a1a1a] sm:text-3xl">
          Free for your first two jobs.
        </h2>
        <p className="max-w-xl font-[DM_Sans] text-[#1a1a1a]/80">
          No card needed. Your clients never pay a cent to approve changes.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            to="/projects"
            className="rounded-full bg-[#1a1a1a] px-6 py-2.5 font-[DM_Sans] text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-[#E3350D]"
          >
            Start free
          </Link>
          <Link
            to="/pricing"
            className="rounded-full border-2 border-[#1a1a1a] px-6 py-2 font-[DM_Sans] text-sm font-semibold uppercase tracking-wide text-[#1a1a1a] transition-colors hover:bg-white"
          >
            See pricing
          </Link>
        </div>
      </section>
    </div>
  )
}

export default FeaturesPage
