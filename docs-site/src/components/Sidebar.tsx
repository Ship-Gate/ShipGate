'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const navigation = [
  {
    title: 'Getting Started',
    items: [
      { title: 'Introduction', href: '/' },
      { title: 'Quick Start', href: '/quickstart' },
      { title: 'Installation', href: '/installation' },
    ],
  },
  {
    title: 'Core Concepts',
    items: [
      { title: 'Proof Bundle Specification', href: '/specification' },
      { title: 'Property Provers', href: '/property-provers' },
      { title: 'Verification Methods', href: '/verification-methods' },
      { title: 'Confidence Levels', href: '/confidence-levels' },
      { title: 'Residual Risks', href: '/residual-risks' },
    ],
  },
  {
    title: 'Integration Guides',
    items: [
      { title: 'CI/CD Integration', href: '/guides/ci-integration' },
      { title: 'GitHub Actions', href: '/guides/github-actions' },
      { title: 'GitLab CI', href: '/guides/gitlab-ci' },
      { title: 'SOC 2 Compliance', href: '/guides/soc2-compliance' },
      { title: 'Cursor/Copilot Workflow', href: '/guides/ai-workflow' },
      { title: 'Custom Provers', href: '/guides/custom-provers' },
    ],
  },
  {
    title: 'Reference',
    items: [
      { title: 'Property Reference', href: '/properties' },
      { title: 'API Reference', href: '/api' },
      { title: 'CLI Commands', href: '/cli' },
      { title: 'JSON Schema', href: '/schema' },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 border-r p-6 overflow-y-auto sticky top-16 h-[calc(100vh-4rem)]">
      <nav className="sidebar-nav space-y-6">
        {navigation.map((section) => (
          <div key={section.title}>
            <h3 className="font-semibold text-sm mb-2 text-muted-foreground uppercase tracking-wider">
              {section.title}
            </h3>
            <ul className="space-y-1">
              {section.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'block px-3 py-2 rounded-md text-sm transition-colors',
                      pathname === item.href
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-accent'
                    )}
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  )
}
