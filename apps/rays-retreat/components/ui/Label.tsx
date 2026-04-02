import { type LabelHTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export function Label({ required, className, children, ...rest }: LabelProps) {
  return (
    <label
      className={clsx('block font-sans text-sm font-medium text-ink', className)}
      {...rest}
    >
      {children}
      {required && (
        <span aria-hidden className="ml-1 text-red-500">
          *
        </span>
      )}
    </label>
  );
}
