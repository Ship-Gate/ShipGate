import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Intent Marketplace | Discover Verified Intents",
  description: "Browse, search, and install verified intents for your IntentOS projects. Trusted contracts with formal verification.",
  keywords: ["intents", "contracts", "marketplace", "verified", "trust"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("min-h-screen bg-background font-sans antialiased", inter.variable)}>
        <div className="relative flex min-h-screen flex-col">
          <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-16 items-center justify-between">
              <a href="/" className="flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                  <span className="text-lg font-bold text-primary-foreground">I</span>
                </div>
                <span className="text-xl font-bold">Intent Marketplace</span>
              </a>
              <nav className="flex items-center space-x-6">
                <a href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Browse
                </a>
                <a href="/search" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Search
                </a>
                <a href="https://docs.intentos.dev" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Docs
                </a>
              </nav>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t py-6 md:py-0">
            <div className="container flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row">
              <p className="text-sm text-muted-foreground">
                Built with trust verification. Every intent is formally verified.
              </p>
              <div className="flex items-center space-x-4">
                <a href="https://github.com/intentos" className="text-sm text-muted-foreground hover:text-foreground">
                  GitHub
                </a>
                <a href="https://discord.gg/intentos" className="text-sm text-muted-foreground hover:text-foreground">
                  Discord
                </a>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
