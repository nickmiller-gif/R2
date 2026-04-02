import { clsx } from 'clsx';

interface CardProps {
  className?: string;
  children: React.ReactNode;
}

export function Card({ className, children }: CardProps) {
  return (
    <div
      className={clsx(
        'rounded-lg border border-ink/10 bg-surface-raised p-6 shadow-sm',
        className,
      )}
    >
      {children}
    </div>
  );
}
