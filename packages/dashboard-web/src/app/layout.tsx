import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { cn } from '@/lib/utils'
import { CookieConsent } from '@/components/CookieConsent'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Shipgate — AI Code. Verified.',
  description: 'Shipgate verifies AI-generated code against your intent specs. Catches fake features, hallucinated APIs, and security blind spots. AI Code. Verified.',
  icons: { icon: '/logo.svg' },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={cn(inter.className, 'min-h-screen bg-background antialiased')}>
        {/* Skip to main content link for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Skip to main content
        </a>
        <div className="relative flex min-h-screen flex-col">
          <header className="sticky top-0 z-50 w-full pt-4 pb-4 mt-[-46px] mb-[-46px]">
            <div className="flex justify-center">
              <nav
                className="flex items-center gap-1 rounded-full bg-black px-6 py-2.5 shadow-lg"
                aria-label="Main navigation"
              >
                <a
                  className="rounded-full px-4 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-white"
                  href="/"
                >
                  Landing
                </a>
                <a
                  className="rounded-full px-4 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-white"
                  href="/#pricing"
                >
                  Pricing
                </a>
                <a
                  className="rounded-full px-4 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-white"
                  href="/#how-it-works"
                >
                  How it works
                </a>
                <a
                  className="rounded-full px-4 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-white"
                  href="/#demo"
                >
                  Demo
                </a>
                <a
                  className="rounded-full px-4 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-white"
                  href="/contact"
                >
                  Contact
                </a>
                <a
                  className="rounded-full px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
                  href="/login"
                >
                  Dashboard
                </a>
              </nav>
            </div>
          </header>
          <main id="main-content" className="flex-1" tabIndex={-1}>
            {children}
          </main>
        </div>
        <CookieConsent />
      </body>
    </html>
  )
}
