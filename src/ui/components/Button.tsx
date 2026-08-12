import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover disabled:bg-accent-muted disabled:text-text-faint',
  secondary: 'bg-bg-raised text-text border border-border hover:border-accent/60 hover:text-white disabled:opacity-50',
  ghost: 'bg-transparent text-text-muted hover:text-text hover:bg-bg-raised disabled:opacity-40',
  danger: 'bg-danger/10 text-danger border border-danger/40 hover:bg-danger/20 disabled:opacity-40',
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'text-xs px-2.5 py-1.5 gap-1.5',
  md: 'text-sm px-4 py-2 gap-2',
  lg: 'text-base px-6 py-3 gap-2.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className = '', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-150 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    />
  );
});
