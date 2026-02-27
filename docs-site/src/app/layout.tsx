import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/Sidebar'
import { Header } from '@/components/Header'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ISL Verify - Proof Bundle Documentation',
  description: 'Complete documentation for ISL Verify proof bundle system - cryptographic proof that AI-generated code is safe',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen flex flex-col">
          <Header />
          <div className="flex flex-1">
            <Sidebar />
            <main className="flex-1 p-8 max-w-5xl">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  )
}
