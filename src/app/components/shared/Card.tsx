'use client';

import { createElement, type HTMLAttributes, type ElementType, type ReactNode } from 'react';

interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Render as a different HTML element (default: div). */
  as?: ElementType;
  children?: ReactNode;
}

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

export function Card({
  padding = 'md',
  className = '',
  children,
  as: Component = 'div',
  ...props
}: CardProps) {
  return createElement(
    Component,
    {
      className: `
        rounded-card border border-[var(--card-border)]
        bg-[var(--card)] shadow-sm
        transition-colors duration-200
        ${paddingClasses[padding]}
        ${className}
      `.trim(),
      ...props,
    },
    children
  );
}

export function CardHeader({
  title,
  description,
  className = '',
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={`mb-4 ${className}`}>
      <h2 className="text-lg font-display font-semibold text-[var(--foreground)]">
        {title}
      </h2>
      {description && (
        <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
      )}
    </div>
  );
}
