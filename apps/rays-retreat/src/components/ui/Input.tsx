import { type InputHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...rest }, ref) => (
    <input
      ref={ref}
      className={clsx(
        'w-full rounded border bg-surface-raised px-3 py-2 font-sans text-sm text-ink',
        'placeholder:text-ink-faint',
        'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1',
        'disabled:cursor-not-allowed disabled:opacity-50',
        error ? 'border-red-400' : 'border-ink/20',
        className,
      )}
      aria-invalid={error ? 'true' : undefined}
      {...rest}
    />
  ),
);
Input.displayName = 'Input';
