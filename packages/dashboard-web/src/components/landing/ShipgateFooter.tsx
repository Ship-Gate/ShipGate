'use client';

import Link from 'next/link';

const FOOTER_LINKS = [
  {
    title: 'Product',
    links: [
      { label: 'Documentation', href: 'https://docs.shipgate.dev/getting-started' },
      { label: 'Dashboard', href: '/login' },
      { label: 'Pricing', href: '/#pricing' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'GitHub', href: 'https://github.com/guardiavault-oss/ISL-LANG' },
      { label: 'Privacy Policy', href: '/privacy' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms & Conditions', href: '/terms' },
    ],
  },
];

export default function ShipgateFooter() {
  return (
    <footer className="mt-32 border-t border-zinc-800">
      <div className="max-w-5xl mx-auto px-4 py-16">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mb-12">
          {FOOTER_LINKS.map(({ title, links }) => (
            <div key={title}>
              <h4 className="text-sm font-semibold text-zinc-300 mb-4 uppercase tracking-wider">
                {title}
              </h4>
              <ul className="space-y-2">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    {href.startsWith('http') ? (
                      <a
                        href={href}
                        className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors duration-200"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {label}
                      </a>
                    ) : (
                      <Link
                        href={href}
                        className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors duration-200"
                      >
                        {label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-400">Shipgate</span>
            <span className="text-zinc-600">—</span>
            <span className="text-zinc-500 text-sm">Proof-driven code verification and gating.</span>
          </div>
          <div className="text-xs text-zinc-600">
            Powered by ISL. MIT licensed.
          </div>
        </div>
      </div>
    </footer>
  );
}
