import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { cn } from '@/lib/utils'
import { CookieConsent } from '@/components/CookieConsent'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'IntentOS Dashboard',
  description: 'Verification dashboard for IntentOS domains',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={cn(inter.className, 'min-h-screen bg-background antialiased')}>
        {/* Skip to main content link for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Skip to main content
        </a>
        <div className="relative flex min-h-screen flex-col">
          <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 items-center">
              <div className="mr-4 flex">
                <a className="mr-6 flex items-center space-x-2" href="/">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-6 w-6 text-primary"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                  <span className="font-bold">IntentOS</span>
                </a>
                <nav className="flex items-center space-x-6 text-sm font-medium">
                  <a
                    className="transition-colors hover:text-foreground/80 text-foreground"
                    href="/"
                  >
                    Dashboard
                  </a>
                  <a
                    className="transition-colors hover:text-foreground/80 text-muted-foreground"
                    href="/domains"
                  >
                    Domains
                  </a>
                  <a
                    className="transition-colors hover:text-foreground/80 text-muted-foreground"
                    href="/verifications"
                  >
                    Verifications
                  </a>
                </nav>
              </div>
            </div>
          </header>
          <main id="main-content" className="flex-1" tabIndex={-1}>
            {children}
          </main>
          <footer className="border-t py-6">
            <div className="container flex flex-col items-center justify-between gap-4 md:h-10 md:flex-row">
              <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
                IntentOS Verification Dashboard
              </p>
              <div className="flex gap-4 text-sm">
                <a href="/privacy" className="text-muted-foreground hover:text-foreground">
                  Privacy Policy
                </a>
              </div>
            </div>
          </footer>
        </div>
        <CookieConsent />
      </body>
    </html>
  )
}
