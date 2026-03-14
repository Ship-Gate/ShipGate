'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface CommandItem {
  id: string;
  label: string;
  section: string;
  shortcut?: string;
  action: () => void;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const commands: CommandItem[] = [
    { id: 'nav-overview', label: 'Go to Overview', section: 'Navigation', action: () => router.push('/dashboard') },
    { id: 'nav-analytics', label: 'Go to Analytics', section: 'Navigation', action: () => router.push('/dashboard/analytics') },
    { id: 'nav-runs', label: 'Go to Runs', section: 'Navigation', action: () => router.push('/dashboard/runs') },
    { id: 'nav-findings', label: 'Go to Findings', section: 'Navigation', action: () => router.push('/dashboard/findings') },
    { id: 'nav-team', label: 'Go to Team', section: 'Navigation', action: () => router.push('/dashboard/team') },
    { id: 'nav-compliance', label: 'Go to Compliance', section: 'Navigation', action: () => router.push('/dashboard/compliance') },
    { id: 'nav-coverage', label: 'Go to Coverage', section: 'Navigation', action: () => router.push('/dashboard/coverage') },
    { id: 'nav-vibe', label: 'Go to Vibe', section: 'Navigation', action: () => router.push('/dashboard/vibe') },
    { id: 'nav-cicd', label: 'Go to CI/CD', section: 'Navigation', action: () => router.push('/dashboard/cicd') },
    { id: 'nav-prs', label: 'Go to Pull Requests', section: 'Navigation', action: () => router.push('/dashboard/prs') },
    { id: 'nav-deploys', label: 'Go to Deployments', section: 'Navigation', action: () => router.push('/dashboard/deploys') },
    { id: 'nav-domains', label: 'Go to Domains', section: 'Navigation', action: () => router.push('/dashboard/domains') },
    { id: 'nav-billing', label: 'Go to Billing', section: 'Navigation', action: () => router.push('/dashboard/billing') },
    { id: 'nav-settings', label: 'Go to Settings', section: 'Navigation', action: () => router.push('/dashboard/settings') },
    { id: 'nav-api-keys', label: 'Go to API Keys', section: 'Navigation', action: () => router.push('/dashboard/api-keys') },
    { id: 'nav-audit', label: 'Go to Audit Log', section: 'Navigation', action: () => router.push('/dashboard/audit') },
    { id: 'act-docs', label: 'Open Documentation', section: 'Actions', action: () => window.open('https://docs.shipgate.dev', '_blank') },
    { id: 'act-cli', label: 'Copy CLI install command', section: 'Actions', action: () => { navigator.clipboard.writeText('npm install -g shipgate'); } },
    { id: 'act-support', label: 'Contact Support', section: 'Actions', action: () => window.open('mailto:support@shipgate.dev', '_blank') },
    { id: 'act-github', label: 'Open GitHub', section: 'Actions', action: () => window.open('https://github.com/isl-lang/shipgate', '_blank') },
  ];

  const filtered = query.trim()
    ? commands.filter((c) =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.section.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  const sections = [...new Set(filtered.map((c) => c.section))];

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setOpen((o) => !o);
      setQuery('');
      setSelectedIndex(0);
    }
    if (e.key === 'Escape') {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault();
      filtered[selectedIndex].action();
      setOpen(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Palette */}
      <div className="relative w-full max-w-lg bg-sg-bg1 border border-sg-border rounded-xl shadow-2xl overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-sg-border">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-sg-text3 shrink-0">
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-sm text-sg-text0 placeholder:text-sg-text3 focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex text-[10px] text-sg-text3 bg-sg-bg2 border border-sg-border rounded px-1.5 py-0.5 font-mono">
            esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[320px] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-sg-text3 text-center py-8">No results found</p>
          ) : (
            sections.map((section) => (
              <div key={section}>
                <p className="text-[10px] font-medium uppercase tracking-wider text-sg-text3 px-4 py-1.5">
                  {section}
                </p>
                {filtered
                  .filter((c) => c.section === section)
                  .map((cmd) => {
                    const globalIdx = filtered.indexOf(cmd);
                    return (
                      <button
                        key={cmd.id}
                        onClick={() => {
                          cmd.action();
                          setOpen(false);
                        }}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                        className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-colors ${
                          globalIdx === selectedIndex
                            ? 'bg-sg-accent/10 text-sg-text0'
                            : 'text-sg-text1 hover:bg-sg-bg2'
                        }`}
                      >
                        <span>{cmd.label}</span>
                        {cmd.shortcut && (
                          <kbd className="text-[10px] text-sg-text3 bg-sg-bg2 border border-sg-border rounded px-1.5 py-0.5 font-mono">
                            {cmd.shortcut}
                          </kbd>
                        )}
                      </button>
                    );
                  })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-sg-border px-4 py-2 flex items-center gap-4 text-[10px] text-sg-text3">
          <span className="flex items-center gap-1">
            <kbd className="bg-sg-bg2 border border-sg-border rounded px-1 py-0.5 font-mono">↑↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-sg-bg2 border border-sg-border rounded px-1 py-0.5 font-mono">↵</kbd>
            select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-sg-bg2 border border-sg-border rounded px-1 py-0.5 font-mono">esc</kbd>
            close
          </span>
        </div>
      </div>
    </div>
  );
}
