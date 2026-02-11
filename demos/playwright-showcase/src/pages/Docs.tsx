import { Link } from 'react-router-dom';
import {
  BookOpen,
  Terminal,
  Shield,
  GitBranch,
  FileCode,
  Settings,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';

const DOC_SECTIONS = [
  {
    title: 'Getting started',
    description: 'Install Shipgate and run your first verification in minutes.',
    links: [
      { label: 'Installation', href: 'https://docs.shipgate.dev/getting-started/installation', desc: 'Install the CLI globally or per project' },
      { label: 'Quick start', href: 'https://docs.shipgate.dev/getting-started/quickstart', desc: '5-minute guide from zero to verified spec' },
      { label: 'Your first spec', href: 'https://docs.shipgate.dev/getting-started/your-first-spec', desc: 'Write an ISL behavioral spec' },
    ],
  },
  {
    title: 'CLI reference',
    description: 'All commands for init, verify, gate, and more.',
    links: [
      { label: 'shipgate init', href: 'https://docs.shipgate.dev/cli/init', desc: 'Initialize project config and truthpack' },
      { label: 'shipgate verify', href: 'https://docs.shipgate.dev/cli/verify', desc: 'Verify implementation against specs' },
      { label: 'shipgate gate', href: 'https://docs.shipgate.dev/cli/gate', desc: 'SHIP/NO_SHIP gate for CI' },
      { label: 'shipgate check', href: 'https://docs.shipgate.dev/cli/check', desc: 'Type-check and lint ISL files' },
      { label: 'shipgate lint', href: 'https://docs.shipgate.dev/cli/lint', desc: 'Lint specs and report issues' },
    ],
  },
  {
    title: 'Guides',
    description: 'Best practices and integration patterns.',
    links: [
      { label: 'CI integration', href: 'https://docs.shipgate.dev/guides/ci-integration', desc: 'GitHub Actions, unified gate workflow' },
      { label: 'Shipgate without specs', href: 'https://docs.shipgate.dev/guides/specless-mode', desc: 'Spec-less verification with 25+ rules' },
      { label: 'Team configuration', href: 'https://docs.shipgate.dev/guides/team-config', desc: 'Shared policies and team settings' },
      { label: 'Best practices', href: 'https://docs.shipgate.dev/guides/best-practices', desc: 'Writing effective ISL specs' },
    ],
  },
  {
    title: 'ISL language',
    description: 'Intent Specification Language syntax and concepts.',
    links: [
      { label: 'Syntax reference', href: 'https://docs.shipgate.dev/isl-language/syntax-reference', desc: 'ISL grammar and structure' },
      { label: 'Behaviors', href: 'https://docs.shipgate.dev/isl-language/behaviors', desc: 'Defining behaviors with pre/postconditions' },
      { label: 'Entities', href: 'https://docs.shipgate.dev/isl-language/entities', desc: 'Domain entities and invariants' },
      { label: 'Scenarios', href: 'https://docs.shipgate.dev/isl-language/scenarios', desc: 'Chaos and scenario testing' },
    ],
  },
  {
    title: 'Integrations',
    description: 'VS Code, CI, and API integration.',
    links: [
      { label: 'VS Code extension', href: 'https://docs.shipgate.dev/vscode/installation', desc: 'Install and configure the extension' },
      { label: 'Gate API', href: 'https://docs.shipgate.dev/api/gate-api', desc: 'Programmatic gate invocation' },
    ],
  },
];

const ICONS: Record<string, React.ComponentType<{ className?: string; strokeWidth?: string | number }>> = {
  'Getting started': BookOpen,
  'CLI reference': Terminal,
  'Guides': Settings,
  'ISL language': FileCode,
  'Integrations': GitBranch,
};

export default function Docs() {
  return (
    <div className="min-h-screen bg-zinc-950">
      <nav className="sticky top-0 z-50 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/80">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="font-semibold text-white">
            Shipgate
          </Link>
          <div className="flex items-center gap-6">
            <Link to="/" className="text-sm text-zinc-400 hover:text-white transition-colors">
              Home
            </Link>
            <a
              href="https://docs.shipgate.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
            >
              Full docs
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-16">
        <header className="mb-16">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-emerald-400" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-semibold text-white">
                Documentation
              </h1>
              <p className="text-zinc-400 mt-1">
                Learn how to verify AI-generated code with Shipgate
              </p>
            </div>
          </div>
        </header>

        <div className="space-y-16">
          {DOC_SECTIONS.map((section) => {
            const Icon = ICONS[section.title] ?? Shield;
            return (
              <section key={section.title}>
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-emerald-400" strokeWidth={2} />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">
                      {section.title}
                    </h2>
                    <p className="text-zinc-400 text-sm mt-1">{section.description}</p>
                  </div>
                </div>

                <div className="pl-14 space-y-3">
                  {section.links.map((link) => (
                    <a
                      key={link.label}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 hover:border-zinc-700 hover:bg-zinc-900/50 transition-colors group"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-white group-hover:text-emerald-400 transition-colors">
                            {link.label}
                          </span>
                          <p className="text-sm text-zinc-500 mt-0.5">{link.desc}</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-zinc-500 group-hover:text-emerald-400 transition-colors shrink-0" />
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <div className="mt-20 p-6 rounded-xl border border-zinc-800 bg-zinc-900/30">
          <h3 className="font-semibold text-white mb-2">Need help?</h3>
          <p className="text-zinc-400 text-sm mb-4">
            Can&apos;t find what you need? Check the full documentation or reach out.
          </p>
          <div className="flex flex-wrap gap-4">
            <a
              href="https://docs.shipgate.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/20 text-emerald-400 px-4 py-2 text-sm font-medium hover:bg-emerald-500/30 transition-colors"
            >
              Full documentation
              <ExternalLink className="w-4 h-4" />
            </a>
            <a
              href="https://github.com/guardiavault-oss/ISL-LANG/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 text-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-800/50 transition-colors"
            >
              GitHub issues
              <ExternalLink className="w-4 h-4" />
            </a>
            <a
              href="mailto:team@shipgate.dev"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 text-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-800/50 transition-colors"
            >
              Contact support
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
