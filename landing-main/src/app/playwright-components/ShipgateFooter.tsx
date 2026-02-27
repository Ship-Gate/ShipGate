const FOOTER_LINKS = [
  {
    title: 'Product',
    links: [
      { label: 'Documentation', href: '/docs' },
      { label: 'Getting started', href: 'https://docs.shipgate.dev/getting-started' },
      { label: 'Pricing', href: '/#pricing' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Blog', href: 'https://blog.shipgate.dev' },
      { label: 'GitHub', href: 'https://github.com/guardiavault-oss/ISL-LANG' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Security', href: '/security' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
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
        {/* Link grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mb-12">
          {FOOTER_LINKS.map(({ title, links }) => (
            <div key={title}>
              <h4 className="text-sm font-semibold text-zinc-300 mb-4 uppercase tracking-wider">
                {title}
              </h4>
              <ul className="space-y-2">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <a
                      href={href}
                      className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors duration-200"
                      target={href.startsWith('http') ? '_blank' : undefined}
                      rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
                    >
                      {label}
                    </a>
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
