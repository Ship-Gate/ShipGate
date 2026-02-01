import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import { FileSearch, Shield, BarChart3 } from 'lucide-react';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ISL Audit Viewer',
  description: 'View ISL audit logs and compliance trails',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="flex h-screen">
          {/* Sidebar */}
          <aside className="w-64 border-r bg-muted/30 flex flex-col">
            {/* Logo */}
            <div className="h-16 border-b flex items-center px-6">
              <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
                <FileSearch className="h-6 w-6 text-primary" />
                Audit Viewer
              </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4">
              <div className="space-y-1">
                <NavLink href="/" icon={FileSearch}>
                  Audit Log
                </NavLink>
                <NavLink href="/compliance" icon={Shield}>
                  Compliance
                </NavLink>
                <NavLink href="/analytics" icon={BarChart3}>
                  Analytics
                </NavLink>
              </div>
            </nav>

            {/* Footer */}
            <div className="p-4 border-t text-xs text-muted-foreground">
              <p>ISL Audit Viewer v0.1.0</p>
              <p className="mt-1">© 2024 IntentOS</p>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 overflow-hidden">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

function NavLink({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: typeof FileSearch;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
    >
      <Icon className="h-4 w-4" />
      {children}
    </Link>
  );
}
