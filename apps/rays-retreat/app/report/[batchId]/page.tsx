import { getResults } from '@/lib/api/getResults';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PrintButton } from '@/components/ui/PrintButton';
import type { OracleSignal } from '@/types/validation';

const QUOTES = [
  { text: "I've been doing this manually for years — I'd pay twice that to get this done for me.", role: 'Participant A' },
  { text: "I tried three tools and none of them solved the core problem. This would.", role: 'Participant B' },
  { text: "The turnaround alone is the value. I don't have time to recruit my own interviewees.", role: 'Participant C' },
];

const NEXT_STEPS: Record<OracleSignal['recommendation'], string[]> = {
  pursue: [
    'Define your MVP scope — narrow to the single strongest use case.',
    'Set up a waitlist or pre-order page to test price sensitivity.',
    'Schedule 3 follow-up interviews to dig into the top desire.',
  ],
  pivot: [
    'Review the top objections — which can be solved by a different form factor?',
    'Identify the strongest desire and ask: can you build a product around that alone?',
    'Order a follow-up batch focused on the pivot hypothesis.',
  ],
  drop: [
    'The evidence shows no clear market need at this time.',
    'Consider the adjacent whitespace your interviews revealed.',
    'Review the transcripts for any surprise insights worth exploring separately.',
  ],
};

const CONFIDENCE_LABELS: Record<OracleSignal['confidence'], string> = {
  low: 'Low confidence (3 interviews)',
  medium: 'Medium confidence (5 interviews)',
  high: 'High confidence (10+ interviews)',
};

const WTP_LABELS: Record<OracleSignal['willingnessToPay'], string> = {
  none: "None — users wouldn't pay",
  low: 'Low — maybe under $20',
  medium: 'Medium — $20–$100 range',
  high: 'High — $100+ or enterprise',
};

export default async function ReportPage({ params }: { params: { batchId: string } }) {
  const signal = await getResults(params.batchId);
  const nextSteps = NEXT_STEPS[signal.recommendation];

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <header className="mb-10">
        <p className="font-mono text-sm uppercase tracking-wide text-ink-faint">Validation report</p>
        <h1 className="mt-1 font-serif text-4xl font-bold text-ink">Your signal is in.</h1>
      </header>

      {/* Oracle score */}
      <Card className="mb-6 flex flex-col items-center gap-2 py-10 text-center sm:flex-row sm:text-left sm:gap-10">
        <div className="relative flex items-center justify-center">
          <svg width="120" height="120" viewBox="0 0 120 120" aria-hidden>
            <circle cx="60" cy="60" r="50" fill="none" stroke="#e5e7eb" strokeWidth="10" />
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke={signal.score >= 60 ? '#2aa35d' : signal.score >= 40 ? '#d97706' : '#ef4444'}
              strokeWidth="10"
              strokeDasharray={`${(signal.score / 100) * 314} 314`}
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
            />
          </svg>
          <span className="absolute font-mono text-3xl font-bold text-ink">{signal.score}</span>
        </div>
        <div>
          <Badge variant={signal.recommendation} className="mb-3 text-base px-4 py-1">
            {signal.recommendation.toUpperCase()}
          </Badge>
          <p className="font-sans text-ink-muted">{CONFIDENCE_LABELS[signal.confidence]}</p>
          <p className="mt-1 font-sans text-sm text-ink-muted">
            Willingness to pay: <span className="font-medium text-ink">{WTP_LABELS[signal.willingnessToPay]}</span>
          </p>
        </div>
      </Card>

      {/* Top reasons */}
      <Card className="mb-6">
        <h2 className="mb-4 font-serif text-xl font-bold text-ink">Why this signal?</h2>
        <ol className="space-y-2">
          {signal.topReasons.map((r, i) => (
            <li key={i} className="flex items-start gap-3 font-sans text-sm text-ink-muted">
              <span className="font-mono font-bold text-brand-500">{i + 1}.</span>
              {r}
            </li>
          ))}
        </ol>
      </Card>

      {/* 3-column insights */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <h3 className="mb-3 font-serif text-base font-bold text-red-700">Top objections</h3>
          <ul className="space-y-2">
            {signal.topObjections.map((o, i) => (
              <li key={i} className="flex items-start gap-2 font-sans text-sm text-ink-muted">
                <span className="mt-0.5 text-red-400">✗</span>{o}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h3 className="mb-3 font-serif text-base font-bold text-brand-700">Top desires</h3>
          <ul className="space-y-2">
            {signal.topDesires.map((d, i) => (
              <li key={i} className="flex items-start gap-2 font-sans text-sm text-ink-muted">
                <span className="mt-0.5 text-brand-500">✓</span>{d}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h3 className="mb-3 font-serif text-base font-bold text-ink">Willingness to pay</h3>
          <p className="font-mono text-2xl font-bold text-ink capitalize">{signal.willingnessToPay}</p>
          <p className="mt-2 font-sans text-sm text-ink-muted">{WTP_LABELS[signal.willingnessToPay]}</p>
        </Card>
      </div>

      {/* Quotes carousel (static for now) */}
      <Card className="mb-6">
        <h2 className="mb-4 font-serif text-xl font-bold text-ink">Key quotes from participants</h2>
        <div className="space-y-4">
          {QUOTES.map((q, i) => (
            <blockquote key={i} className="border-l-4 border-brand-300 pl-4">
              <p className="font-serif text-base leading-relaxed text-ink">&ldquo;{q.text}&rdquo;</p>
              <footer className="mt-1 font-mono text-xs text-ink-faint">{q.role}</footer>
            </blockquote>
          ))}
        </div>
      </Card>

      {/* What to do next */}
      <Card className="mb-8">
        <h2 className="mb-4 font-serif text-xl font-bold text-ink">What to do next</h2>
        <ol className="space-y-3">
          {nextSteps.map((step, i) => (
            <li key={i} className="flex items-start gap-3 font-sans text-sm text-ink-muted">
              <span className="font-mono font-bold text-brand-500">{i + 1}.</span>
              {step}
            </li>
          ))}
        </ol>
      </Card>

      {/* Download PDF */}
      <div className="text-center">
        <PrintButton />
        <p className="mt-2 font-mono text-xs text-ink-faint">
          {/* R2 integration: Chart service will generate a PDF artifact linked as a document */}
          Opens print dialog — PDF export via Chart service coming soon
        </p>
      </div>
    </div>
  );
}
