'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { id: 'overview', label: 'Overview', href: '/dashboard' },
  { id: 'domains', label: 'Domains', href: '/dashboard/domains' },
  { id: 'cicd', label: 'CI/CD', href: '/dashboard/cicd' },
  { id: 'prs', label: 'Pull Requests', href: '/dashboard/prs' },
  { id: 'deploys', label: 'Deployments', href: '/dashboard/deploys' },
  { id: 'findings', label: 'Findings', href: '/dashboard/findings' },
  { id: 'team', label: 'Team', href: '/dashboard/team' },
  { id: 'verifications', label: 'Verifications', href: '/dashboard/verifications' },
  { id: 'runs', label: 'Runs', href: '/dashboard/runs' },
];

export function PillNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/dashboard/';
    return pathname.startsWith(href);
  };

  return (
    <nav className="flex items-center gap-1 p-1 bg-sg-bg2 rounded-full border border-sg-border">
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${
            isActive(tab.href)
              ? 'bg-sg-bg0 text-sg-text0 shadow-sm'
              : 'text-sg-text3 hover:text-sg-text1'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
