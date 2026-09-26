import { useState } from 'react'
import { Link } from 'react-router-dom'

type Billing = 'monthly' | 'yearly'

interface Plan {
  name: string
  tagline: string
  // Price per month in NZD excl. GST; yearly is the per-month equivalent when billed annually.
  price: Record<Billing, number>
  seats: string
  cta: string
  highlighted?: boolean
  features: string[]
}

const PLANS: Plan[] = [
  {
    name: 'Spark',
    tagline: 'Try Pika on a real job.',
    price: { monthly: 0, yearly: 0 },
    seats: '1 electrician',
    cta: 'Start free',
    features: [
      '2 active projects',
      'Client approvals for variations',
      'Email notifications',
      '20 document pages read per month',
    ],
  },
  {
    name: 'Pro',
    tagline: 'For the owner-operator.',
    price: { monthly: 35, yearly: 29 },
    seats: '1 electrician',
    cta: 'Start 14-day trial',
    highlighted: true,
    features: [
      'Unlimited projects',
      'Everything in Spark',
      'Invoice-ready variation totals',
      'Full approval history and export',
      '300 document pages read per month',
      'Your logo on the client view',
    ],
  },
  {
    name: 'Crew',
    tagline: 'For small teams and contractors.',
    price: { monthly: 99, yearly: 82 },
    seats: 'Up to 5 electricians, then $15 each',
    cta: 'Start 14-day trial',
    features: [
      'Everything in Pro',
      'Shared projects across the team',
      'Owner and electrician roles',
      '1,500 document pages read per month',
      'Priority support',
    ],
  },
]

const FAQS = [
  {
    question: 'Do my clients need to pay or sign up?',
    answer:
      'No. Clients get a link to their project and can view plans and approve changes for free. Only electricians pay.',
  },
  {
    question: 'Are prices in NZD and do they include GST?',
    answer: 'Prices are in New Zealand dollars and exclude GST, which is added at checkout.',
  },
  {
    question: 'What counts as a document page?',
    answer:
      'Each page of a plan, quote, cable schedule or certificate that Pika reads for you. Viewing and sharing documents is always unlimited.',
  },
  {
    question: 'Can I change plans or cancel?',
    answer:
      'Any time. Upgrades apply straight away, and if you cancel you keep access until the end of your billing period.',
  },
]

function formatPrice(amount: number): string {
  return amount === 0 ? '$0' : `$${amount}`
}

function PricingPage() {
  const [billing, setBilling] = useState<Billing>('monthly')

  const toggleClass = (active: boolean) =>
    `rounded-full px-4 py-1.5 font-[DM_Sans] text-xs font-semibold uppercase tracking-wide transition-colors ${
      active ? 'bg-[#1a1a1a] text-white' : 'text-[#1a1a1a] hover:bg-black/10'
    }`

  return (
    <div className="mx-auto flex min-h-svh max-w-5xl flex-col gap-16 px-6 pt-32 pb-20 sm:px-8">
      <header className="flex flex-col items-center gap-4 text-center">
        <span className="font-[DM_Sans] text-xs font-semibold uppercase tracking-widest text-[#E3350D]">
          Pricing
        </span>
        <h1 className="font-[DM_Sans] text-4xl font-bold text-[#1a1a1a] sm:text-5xl">
          One approved variation pays for it.
        </h1>
        <p className="max-w-2xl font-[DM_Sans] text-lg text-[#1a1a1a]/70">
          Simple plans for electricians. Clients always use Pika for free.
        </p>

        <div
          role="group"
          aria-label="Billing period"
          className="mt-2 flex items-center gap-1 rounded-full border-2 border-[#1a1a1a] bg-white p-1"
        >
          <button
            type="button"
            aria-pressed={billing === 'monthly'}
            onClick={() => setBilling('monthly')}
            className={toggleClass(billing === 'monthly')}
          >
            Monthly
          </button>
          <button
            type="button"
            aria-pressed={billing === 'yearly'}
            onClick={() => setBilling('yearly')}
            className={toggleClass(billing === 'yearly')}
          >
            Yearly · save 17%
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 items-start gap-6 md:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={`relative flex flex-col gap-6 rounded-2xl p-6 ${
              plan.highlighted
                ? 'border-2 border-[#1a1a1a] bg-white shadow-[0_6px_0_0_rgba(26,26,26,0.15)]'
                : 'border border-black/10 bg-black/[0.03]'
            }`}
          >
            {plan.highlighted && (
              <span className="absolute -top-3 left-6 rounded-full bg-[#E3350D] px-3 py-0.5 font-[DM_Sans] text-[10px] font-semibold uppercase tracking-wide text-white">
                Most popular
              </span>
            )}

            <div className="flex flex-col gap-1">
              <h2 className="font-[DM_Sans] text-xl font-bold text-[#1a1a1a]">{plan.name}</h2>
              <p className="font-[DM_Sans] text-sm text-[#1a1a1a]/60">{plan.tagline}</p>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-baseline gap-1">
                <span className="font-[DM_Sans] text-4xl font-bold text-[#1a1a1a]">
                  {formatPrice(plan.price[billing])}
                </span>
                <span className="font-[DM_Sans] text-sm text-[#1a1a1a]/60">/ month + GST</span>
              </div>
              <span className="font-[DM_Sans] text-xs text-[#1a1a1a]/60">
                {plan.price.monthly === 0
                  ? 'Free forever'
                  : billing === 'yearly'
                    ? `Billed $${plan.price.yearly * 12} yearly`
                    : 'Billed monthly'}{' '}
                · {plan.seats}
              </span>
            </div>

            <Link
              to="/projects"
              className={`rounded-full px-4 py-2 text-center font-[DM_Sans] text-sm font-semibold uppercase tracking-wide transition-colors ${
                plan.highlighted
                  ? 'bg-[#FFCC00] text-[#1a1a1a] hover:bg-[#E3350D] hover:text-white'
                  : 'border-2 border-[#1a1a1a] text-[#1a1a1a] hover:bg-[#1a1a1a] hover:text-white'
              }`}
            >
              {plan.cta}
            </Link>

            <ul className="flex flex-col gap-2.5">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2 font-[DM_Sans] text-sm text-[#1a1a1a]">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#E3350D"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mt-0.5 shrink-0"
                    aria-hidden="true"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <h2 className="text-center font-[DM_Sans] text-lg font-semibold uppercase tracking-wide text-[#E3350D]">
          Questions
        </h2>
        <div className="flex flex-col divide-y divide-black/10 rounded-lg border border-black/10">
          {FAQS.map((faq) => (
            <details key={faq.question} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-[DM_Sans] font-semibold text-[#1a1a1a]">
                {faq.question}
                <span className="text-xl text-[#1a1a1a]/40 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 font-[DM_Sans] text-sm leading-relaxed text-[#1a1a1a]/70">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}

export default PricingPage
