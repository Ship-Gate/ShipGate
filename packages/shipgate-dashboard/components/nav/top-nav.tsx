'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Badge } from '@/components/shared/badge';

const TABS = [
  { id: 'overview', label: 'Overview', href: '/dashboard' },
  { id: 'cicd', label: 'CI/CD', href: '/dashboard/cicd' },
  { id: 'prs', label: 'Pull Requests', href: '/dashboard/prs' },
  { id: 'deploys', label: 'Deployments', href: '/dashboard/deploys' },
  { id: 'findings', label: 'Findings', href: '/dashboard/findings' },
  { id: 'team', label: 'Team', href: '/dashboard/team' },
];

export function TopNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/dashboard/';
    return pathname.startsWith(href);
  };

  return (
    <nav className="sticky top-0 z-50 flex items-center py-2.5 px-5 border-b border-sg-border bg-sg-bg1">
      {/* Logo + repo */}
      <div className="flex items-center gap-2">
        <img
          src="/logo.png"
          alt="ShipGate"
          className="w-7 h-7 rounded-[6px]"
        />
        <span className="text-sm font-bold text-sg-text0 tracking-tight">ShipGate</span>
        <span className="text-[11px] text-sg-text3 ml-1">acme-api</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 ml-7">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            className={`py-1.5 px-3 rounded-[5px] text-xs font-medium transition-all ${
              isActive(tab.href)
                ? 'bg-[rgba(255,255,255,0.06)] text-sg-text0'
                : 'bg-transparent text-sg-text3 hover:text-sg-text1'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-2.5">
        {/* Live indicator */}
        <div
          className="flex items-center gap-1.5 py-1 px-2.5 rounded border"
          style={{
            background: 'rgba(56,189,248,0.08)',
            borderColor: 'rgba(56,189,248,0.2)',
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full bg-sg-blue animate-pulse"
            aria-hidden
          />
          <span className="text-[10px] text-sg-blue font-medium">1 scan running</span>
        </div>
        <Badge text="PRO" color="#00e68a" bg="rgba(0,230,138,0.08)" />
        <div
          className="w-7 h-7 rounded-full bg-sg-bg3 flex items-center justify-center text-[11px] font-semibold text-sg-text1"
          aria-label="User avatar"
        >
          G
        </div>
      </div>
    </nav>
  );
}
