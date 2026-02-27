import Link from 'next/link'
import { Github, Search } from 'lucide-react'

export function Header() {
  return (
    <header className="border-b sticky top-0 bg-background z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <div className="w-8 h-8 bg-primary rounded flex items-center justify-center text-primary-foreground">
            ISL
          </div>
          ISL Verify
        </Link>
        
        <nav className="hidden md:flex items-center gap-6">
          <Link href="/quickstart" className="text-sm hover:text-primary transition">
            Quick Start
          </Link>
          <Link href="/specification" className="text-sm hover:text-primary transition">
            Specification
          </Link>
          <Link href="/guides" className="text-sm hover:text-primary transition">
            Guides
          </Link>
          <Link href="/properties" className="text-sm hover:text-primary transition">
            Properties
          </Link>
          <Link href="/api" className="text-sm hover:text-primary transition">
            API
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-accent rounded-md transition">
            <Search className="w-5 h-5" />
          </button>
          <a
            href="https://github.com/yourusername/isl-verify"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 hover:bg-accent rounded-md transition"
          >
            <Github className="w-5 h-5" />
          </a>
        </div>
      </div>
    </header>
  )
}
