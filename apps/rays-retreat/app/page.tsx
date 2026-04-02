import Link from 'next/link';
import { Card } from '@/components/ui/Card';

const steps = [
  {
    number: '01',
    title: 'Submit your idea',
    description: 'Describe your idea, target user, and what "yes" looks like to you. Takes 3 minutes.',
  },
  {
    number: '02',
    title: 'Real users get interviewed',
    description: 'A vetted researcher runs 5 interviews with real people from your target audience in 48 hours.',
  },
  {
    number: '03',
    title: 'Get your signal',
    description: 'Receive a clear pursue / pivot / drop recommendation backed by patterns from real conversations.',
  },
];

const testimonials = [
  {
    quote: 'I was about to spend three months building the wrong thing. The pivot recommendation saved me.',
    author: 'Founder, B2B SaaS',
    stage: 'Pre-revenue',
  },
  {
    quote: "Five conversations I never would have had on my own. The 'pursue' signal gave me real confidence.",
    author: 'Solo builder, AI tools',
    stage: 'MVP stage',
  },
  {
    quote: 'Way faster than hiring a researcher. The insights were exactly what I needed to move forward.',
    author: 'No-code founder',
    stage: 'Idea stage',
  },
];

const pricing = [
  {
    tier: 'Starter',
    price: '$99',
    interviews: 5,
    turnaround: '48 hours',
    features: ['5 targeted interviews', 'AI-assisted synthesis', 'Pursue / Pivot / Drop signal', 'Full transcripts'],
    href: '/submit?tier=starter',
    highlight: false,
  },
  {
    tier: 'Standard',
    price: '$149',
    interviews: 10,
    turnaround: '72 hours',
    features: ['10 targeted interviews', 'Deeper pattern analysis', 'Pursue / Pivot / Drop signal', 'Full transcripts', 'Follow-up recommendations'],
    href: '/submit?tier=standard',
    highlight: true,
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      {/* Hero */}
      <section className="mb-20 text-center">
        <h1 className="mb-6 font-serif text-5xl font-bold leading-tight text-ink sm:text-6xl">
          Know if your idea is worth building —{' '}
          <span className="text-brand-600">in 48 hours.</span>
        </h1>
        <p className="mx-auto mb-10 max-w-2xl font-sans text-xl leading-relaxed text-ink-muted">
          Stop guessing. Stop asking friends. Get 5 real-user interviews and a clear
          yes/no/pivot signal before you waste months building the wrong thing.
        </p>
        <Link
          href="/submit"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-8 py-4 font-sans text-lg font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors"
        >
          Validate my idea →
        </Link>
        <p className="mt-4 font-mono text-sm text-ink-faint">From $99 · Results in 48 hours · No subscriptions</p>
      </section>

      {/* 3-step explainer */}
      <section className="mb-20">
        <h2 className="mb-10 font-serif text-3xl font-bold text-ink">How it works</h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {steps.map((step) => (
            <Card key={step.number} className="relative">
              <span className="font-mono text-4xl font-bold text-brand-200">{step.number}</span>
              <h3 className="mt-2 font-serif text-lg font-bold text-ink">{step.title}</h3>
              <p className="mt-2 font-sans text-sm leading-relaxed text-ink-muted">{step.description}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="mb-20">
        <h2 className="mb-10 font-serif text-3xl font-bold text-ink">Pricing</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          {pricing.map((plan) => (
            <Card
              key={plan.tier}
              className={plan.highlight ? 'border-brand-400 ring-1 ring-brand-400' : ''}
            >
              {plan.highlight && (
                <span className="mb-3 inline-block font-mono text-xs font-semibold uppercase tracking-wide text-brand-600">
                  Most popular
                </span>
              )}
              <h3 className="font-serif text-2xl font-bold text-ink">{plan.tier}</h3>
              <p className="mt-1 font-mono text-4xl font-bold text-ink">{plan.price}</p>
              <p className="mt-1 font-sans text-sm text-ink-muted">
                {plan.interviews} interviews · {plan.turnaround}
              </p>
              <ul className="mt-4 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 font-sans text-sm text-ink-muted">
                    <span className="mt-0.5 text-brand-500">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className="mt-6 block w-full rounded bg-brand-600 px-4 py-2.5 text-center font-sans font-medium text-white hover:bg-brand-700 transition-colors"
              >
                Get started →
              </Link>
            </Card>
          ))}
        </div>
      </section>

      {/* Social proof */}
      <section className="mb-20">
        <h2 className="mb-10 font-serif text-3xl font-bold text-ink">Founders who validated first</h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {testimonials.map((t, i) => (
            <Card key={i}>
              <blockquote className="font-serif text-base leading-relaxed text-ink">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <footer className="mt-4">
                <p className="font-sans text-sm font-medium text-ink">{t.author}</p>
                <p className="font-mono text-xs text-ink-faint">{t.stage}</p>
              </footer>
            </Card>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="rounded-xl bg-brand-600 px-8 py-12 text-center text-white">
        <h2 className="mb-4 font-serif text-3xl font-bold">
          Stop building in the dark.
        </h2>
        <p className="mb-8 font-sans text-lg text-brand-100">
          48 hours from now you could have real feedback instead of assumptions.
        </p>
        <Link
          href="/submit"
          className="inline-flex items-center gap-2 rounded-lg bg-white px-8 py-4 font-sans font-semibold text-brand-700 hover:bg-brand-50 transition-colors"
        >
          Validate my idea →
        </Link>
      </section>
    </div>
  );
}
