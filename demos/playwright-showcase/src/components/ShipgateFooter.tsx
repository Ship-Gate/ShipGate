import { motion } from 'framer-motion';

const FOOTER_LINKS = [
  {
    title: 'Product',
    links: [
      { label: 'Documentation', href: 'https://docs.shipgate.dev' },
      { label: 'Changelog', href: '#' },
      { label: 'Pricing', href: '#pricing' },
    ],
  },
  {
    title: 'Community',
    links: [
      { label: 'GitHub', href: 'https://github.com/AevumDecessworsen/shipgate' },
      { label: 'Discord', href: 'https://discord.gg/shipgate' },
      { label: 'Twitter', href: 'https://twitter.com/shipgate_dev' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '#' },
      { label: 'Blog', href: '#' },
      { label: 'Contact', href: 'mailto:team@shipgate.dev' },
    ],
  },
];

export default function ShipgateFooter() {
  return (
    <motion.footer
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="mt-32 border-t border-white/10"
    >
      <div className="max-w-5xl mx-auto px-4 py-16">
        {/* Link grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mb-12">
          {FOOTER_LINKS.map(({ title, links }) => (
            <div key={title}>
              <h4 className="text-sm font-semibold text-white/90 mb-4 uppercase tracking-wider">
                {title}
              </h4>
              <ul className="space-y-2">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <a
                      href={href}
                      className="text-sm text-white/50 hover:text-white/80 transition-colors duration-200"
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

        {/* Bottom bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t border-white/10">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white/70">Shipgate</span>
            <span className="text-white/30">—</span>
            <span className="text-white/50 text-sm">Behavioral verification for AI-generated code.</span>
          </div>
          <div className="text-xs text-white/40">
            Powered by ISL. MIT licensed.
          </div>
        </div>
      </div>
    </motion.footer>
  );
}
