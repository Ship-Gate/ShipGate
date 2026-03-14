'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

const PRIMARY_TABS = [
  { id: 'overview', label: 'Overview', href: '/dashboard' },
  { id: 'provenance', label: 'Provenance', href: '/dashboard/provenance' },
  { id: 'findings', label: 'Findings', href: '/dashboard/findings' },
  { id: 'runs', label: 'Runs', href: '/dashboard/runs' },
  { id: 'compliance', label: 'Compliance', href: '/dashboard/compliance' },
  { id: 'analytics', label: 'Analytics', href: '/dashboard/analytics' },
];

const MORE_GROUPS = [
  {
    label: 'CI/CD',
    items: [
      { id: 'cicd', label: 'CI/CD', href: '/dashboard/cicd' },
      { id: 'prs', label: 'Pull Requests', href: '/dashboard/prs' },
      { id: 'deploys', label: 'Deployments', href: '/dashboard/deploys' },
    ],
  },
  {
    label: 'Security',
    items: [
      { id: 'supply-chain', label: 'Supply Chain', href: '/dashboard/supply-chain' },
      { id: 'coverage', label: 'Coverage', href: '/dashboard/coverage' },
      { id: 'proofs', label: 'Proofs', href: '/dashboard/proofs' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { id: 'vibe', label: 'Vibe', href: '/dashboard/vibe' },
      { id: 'domains', label: 'Domains', href: '/dashboard/domains' },
      { id: 'team', label: 'Team', href: '/dashboard/team' },
    ],
  },
];

const ALL_MORE_ITEMS = MORE_GROUPS.flatMap((g) => g.items);

const PLAN_BADGE_STYLES: Record<string, string> = {
  free: 'bg-gray-600/20 text-gray-400 border-gray-600/30',
  pro: 'bg-sg-ship/20 text-sg-ship border-sg-ship/30',
  enterprise: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

function usePlan(): string {
  const [plan, setPlan] = useState('pro');
  useEffect(() => {
    try {
      const raw = document.cookie.split(';').find(c => c.trim().startsWith('shipgate-session='));
      if (raw) {
        const val = raw.split('=').slice(1).join('=').trim();
        const json = JSON.parse(atob(val.replace(/-/g, '+').replace(/_/g, '/')));
        setPlan(json.plan || (json.isPro ? 'pro' : 'free'));
      }
    } catch { /* keep default */ }
  }, []);
  return plan;
}

export function PillNav() {
  const pathname = usePathname();
  const plan = usePlan();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/dashboard/';
    return pathname.startsWith(href);
  };

  const moreIsActive = ALL_MORE_ITEMS.some((item) => isActive(item.href));

  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
  const badgeStyle = PLAN_BADGE_STYLES[plan] || PLAN_BADGE_STYLES.pro;

  return (
    <nav className="flex items-center gap-1 p-1 bg-sg-bg2 rounded-full border border-sg-border">
      {PRIMARY_TABS.map((tab) => (
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

      {/* More dropdown */}
      <div className="relative" ref={moreRef}>
        <button
          onClick={() => setMoreOpen(!moreOpen)}
          className={`flex items-center gap-1 px-4 py-2 rounded-full text-xs font-medium transition-all ${
            moreIsActive
              ? 'bg-sg-bg0 text-sg-text0 shadow-sm'
              : 'text-sg-text3 hover:text-sg-text1'
          }`}
        >
          More
          <ChevronDown className={`w-3 h-3 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
        </button>

        {moreOpen && (
          <div className="absolute top-full left-0 mt-2 w-56 bg-sg-bg1 border border-sg-border rounded-xl shadow-xl z-50 py-2">
            {MORE_GROUPS.map((group) => (
              <div key={group.label}>
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-sg-text3">
                  {group.label}
                </div>
                {group.items.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={`block px-3 py-2 text-xs transition-colors ${
                      isActive(item.href)
                        ? 'text-sg-text0 bg-sg-bg2'
                        : 'text-sg-text2 hover:text-sg-text0 hover:bg-sg-bg2'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2 pr-2">
        <span className={`px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${badgeStyle}`}>
          {planLabel}
        </span>
        {plan === 'pro' && (
          <Link
            href="/checkout?plan=enterprise"
            className="px-3 py-1 rounded-full text-[10px] font-medium bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors border border-purple-500/20"
          >
            Upgrade
          </Link>
        )}
      </div>
    </nav>
  );
}
