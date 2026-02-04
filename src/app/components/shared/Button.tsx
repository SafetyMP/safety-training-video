'use client';

import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  isLoading?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    'bg-primary text-primary-foreground hover:bg-primary-hover focus:ring-primary/50 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary-hover disabled:bg-[var(--card-border)] disabled:text-[var(--muted)]',
  secondary:
    'bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 focus:ring-slate-400 disabled:bg-slate-200/70 disabled:text-slate-500 dark:disabled:bg-slate-700/60 dark:disabled:text-slate-400',
  ghost:
    'bg-transparent text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 focus:ring-slate-400 disabled:text-[var(--muted)] disabled:bg-transparent',
  destructive:
    'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50 focus:ring-red-400 disabled:bg-red-100/60 disabled:text-red-400 dark:disabled:bg-red-900/20 dark:disabled:text-red-400',
  outline:
    'border-2 border-slate-300 bg-transparent text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800 focus:ring-slate-400 disabled:text-[var(--muted)] disabled:border-[var(--card-border)]',
};

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-sm font-medium',
  lg: 'px-6 py-3 text-base font-medium',
};

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  isLoading,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || isLoading}
      className={`
        inline-flex items-center justify-center gap-2 rounded-lg
        transition-all duration-200 ease-out
        focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-900
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...props}
    >
      {isLoading ? <span
          className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0"
          aria-hidden
        /> : null}
      {children}
    </button>
  );
}
