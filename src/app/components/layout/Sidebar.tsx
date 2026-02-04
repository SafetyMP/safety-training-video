'use client';

import { useState } from 'react';
import { ProviderCapabilities } from '@/app/components/ProviderCapabilities';
import { CostBreakdown } from '@/app/components/shared/CostBreakdown';
import { Card } from '@/app/components/shared/Card';

export function Sidebar({
  children,
  className = '',
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <aside
      className={`
        w-full lg:w-[var(--sidebar-width)] lg:min-w-[var(--sidebar-width)]
        flex flex-col gap-4 shrink-0
        ${className}
      `}
    >
      <button
        type="button"
        className="lg:hidden inline-flex items-center justify-between w-full px-4 py-2 rounded-card border border-[var(--card-border)] bg-[var(--card)] text-sm font-medium text-[var(--foreground)]"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls="sidebar-panels"
      >
        Sidebar details
        <span className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden>
          ▼
        </span>
      </button>
      <div id="sidebar-panels" className={`${isOpen ? 'block' : 'hidden'} lg:block`}>
        <Card padding="md">
          <h3 className="text-sm font-medium text-[var(--foreground)] mb-3">
            Active providers
          </h3>
          <ProviderCapabilities />
        </Card>
        <Card padding="md">
          <h3 className="text-sm font-medium text-[var(--foreground)] mb-3">
            Cost
          </h3>
          <CostBreakdown />
        </Card>
        {children}
      </div>
    </aside>
  );
}
