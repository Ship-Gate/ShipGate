import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

interface LegalPageLayoutProps {
  title: string;
  description?: string;
  lastUpdated?: string;
  children: ReactNode;
}

export default function LegalPageLayout({
  title,
  description,
  lastUpdated,
  children,
}: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen bg-zinc-950">
      <nav className="sticky top-0 z-50 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/80">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="font-semibold text-white">
            Shipgate
          </Link>
          <Link
            to="/"
            className="text-sm text-zinc-400 hover:text-white transition-colors"
          >
            ← Back to home
          </Link>
        </div>
      </nav>

      <article className="max-w-3xl mx-auto px-4 py-16">
        <header className="mb-12">
          <h1 className="text-3xl md:text-4xl font-semibold text-white mb-4">
            {title}
          </h1>
          {description && (
            <p className="text-zinc-400 text-lg mb-2">{description}</p>
          )}
          {lastUpdated && (
            <p className="text-zinc-500 text-sm">Last updated: {lastUpdated}</p>
          )}
        </header>

        <div className="legal-content [&_h2]:mt-12 [&_h2]:mb-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-white [&_h3]:mt-8 [&_h3]:mb-3 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-zinc-200 [&_p]:mb-4 [&_p]:text-zinc-400 [&_p]:leading-relaxed [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:text-zinc-400 [&_li]:mb-1 [&_a]:text-emerald-400 [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-emerald-300 [&_strong]:text-zinc-300 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:bg-zinc-800 [&_code]:text-zinc-300 [&_code]:font-mono [&_code]:text-sm">
          {children}
        </div>
      </article>
    </div>
  );
}
