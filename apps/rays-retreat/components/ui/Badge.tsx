import { clsx } from 'clsx';

type Variant = 'pursue' | 'pivot' | 'drop' | 'neutral';

const variantClasses: Record<Variant, string> = {
  pursue: 'bg-brand-100 text-brand-800 border-brand-300',
  pivot:  'bg-amber-100 text-amber-800 border-amber-300',
  drop:   'bg-red-100 text-red-700 border-red-300',
  neutral: 'bg-surface-sunken text-ink-muted border-ink/20',
};

interface BadgeProps {
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
}

export function Badge({ variant = 'neutral', className, children }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-3 py-0.5 font-mono text-xs font-semibold uppercase tracking-wide',
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
