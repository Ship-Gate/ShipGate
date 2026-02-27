import { Link } from 'react-router-dom';
import { Target, Shield, Code, Heart } from 'lucide-react';

export default function About() {
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

      <main className="max-w-3xl mx-auto px-4 py-16">
        <header className="mb-16">
          <h1 className="text-3xl md:text-4xl font-semibold text-white mb-4">
            About Shipgate
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed">
            We&apos;re building the world&apos;s first platform where you describe what you want
            in natural language, and get code that&apos;s verified safe before it ships.
          </p>
        </header>

        <section className="space-y-12">
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
              <Target className="w-6 h-6 text-emerald-400" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white mb-2">Mission</h2>
              <p className="text-zinc-400 leading-relaxed">
                Make AI-generated code verifiably safe. Shipgate stops AI from shipping fake features
                by verifying code against behavioral specs and producing evidence-backed SHIP/NO_SHIP
                decisions.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
              <Shield className="w-6 h-6 text-emerald-400" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white mb-2">What we do</h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                Shipgate provides proof-driven code verification and gating. We combine ISL (Intent
                Specification Language) behavioral specs with a security firewall to catch ghost routes,
                hallucinated APIs, and security blind spots before they reach production.
              </p>
              <ul className="list-disc pl-6 text-zinc-400 space-y-1">
                <li>CLI tools: shipgate init, verify, gate</li>
                <li>VS Code extension for inline diagnostics</li>
                <li>GitHub Actions for CI gating</li>
                <li>Local-first: your code never leaves your machine</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
              <Code className="w-6 h-6 text-emerald-400" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white mb-2">Open source</h2>
              <p className="text-zinc-400 leading-relaxed">
                The core of Shipgate is open source under the MIT license. We believe in
                transparency and community-driven innovation. Contribute at{' '}
                <a
                  href="https://github.com/guardiavault-oss/ISL-LANG"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300"
                >
                  GitHub
                </a>
                .
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
              <Heart className="w-6 h-6 text-emerald-400" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white mb-2">Get in touch</h2>
              <p className="text-zinc-400 leading-relaxed">
                We&apos;d love to hear from you. Whether you&apos;re a developer, platform engineer,
                or security lead, reach out at{' '}
                <Link to="/contact" className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300">
                  Contact
                </Link>
                .
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
