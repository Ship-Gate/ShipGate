"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search as SearchIcon, FileText, Hash, X, Command } from "lucide-react";
import { clsx } from "clsx";

interface SearchResult {
  title: string;
  href: string;
  section?: string;
  content?: string;
  type: "page" | "heading" | "content";
}

// Static search index - in production this would be generated from MDX
const searchIndex: SearchResult[] = [
  { title: "Introduction", href: "/docs/getting-started", type: "page", section: "Getting Started" },
  { title: "Installation", href: "/docs/getting-started/installation", type: "page", section: "Getting Started" },
  { title: "Your First Spec", href: "/docs/getting-started/first-spec", type: "page", section: "Getting Started" },
  { title: "Types", href: "/docs/language/types", type: "page", section: "Language Reference" },
  { title: "Entities", href: "/docs/language/entities", type: "page", section: "Language Reference" },
  { title: "Behaviors", href: "/docs/language/behaviors", type: "page", section: "Language Reference" },
  { title: "Scenarios", href: "/docs/language/scenarios", type: "page", section: "Language Reference" },
  { title: "Invariants", href: "/docs/language/invariants", type: "page", section: "Language Reference" },
  { title: "Runtime Verification", href: "/docs/verification/runtime", type: "page", section: "Verification" },
  { title: "Chaos Testing", href: "/docs/verification/chaos", type: "page", section: "Verification" },
  { title: "Temporal Properties", href: "/docs/verification/temporal", type: "page", section: "Verification" },
  { title: "Core Types", href: "/docs/stdlib/core", type: "page", section: "Standard Library" },
  { title: "Authentication", href: "/docs/stdlib/auth", type: "page", section: "Standard Library" },
  { title: "Payments", href: "/docs/stdlib/payments", type: "page", section: "Standard Library" },
  { title: "CLI Overview", href: "/docs/cli", type: "page", section: "CLI Reference" },
  { title: "isl check", href: "/docs/cli/check", type: "page", section: "CLI Reference", content: "Validate ISL specification files" },
  { title: "isl generate", href: "/docs/cli/generate", type: "page", section: "CLI Reference", content: "Generate code from specifications" },
  { title: "isl verify", href: "/docs/cli/verify", type: "page", section: "CLI Reference", content: "Run verification tests" },
  { title: "Playground", href: "/playground", type: "page" },
];

export function Search() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Keyboard shortcut to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Search logic
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const filtered = searchIndex.filter(
      (item) =>
        item.title.toLowerCase().includes(lowerQuery) ||
        item.section?.toLowerCase().includes(lowerQuery) ||
        item.content?.toLowerCase().includes(lowerQuery)
    );

    setResults(filtered.slice(0, 8));
    setSelectedIndex(0);
  }, [query]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      router.push(results[selectedIndex].href);
      setIsOpen(false);
      setQuery("");
    }
  };

  const handleSelect = (result: SearchResult) => {
    router.push(result.href);
    setIsOpen(false);
    setQuery("");
  };

  return (
    <>
      {/* Search trigger button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background hover:bg-muted transition-colors text-sm text-muted-foreground"
      >
        <SearchIcon className="w-4 h-4" />
        <span className="hidden sm:inline-block">Search docs...</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 h-5 rounded border border-border bg-muted text-xs">
          <Command className="w-3 h-3" />K
        </kbd>
      </button>

      {/* Search modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal */}
          <div className="relative max-w-xl mx-auto mt-20 bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
            {/* Search input */}
            <div className="flex items-center border-b border-border px-4">
              <SearchIcon className="w-5 h-5 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search documentation..."
                className="flex-1 h-14 px-4 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
              />
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Results */}
            <div className="max-h-80 overflow-y-auto p-2">
              {query && results.length === 0 && (
                <div className="py-8 text-center text-muted-foreground">
                  No results found for &quot;{query}&quot;
                </div>
              )}

              {results.length > 0 && (
                <ul className="space-y-1">
                  {results.map((result, index) => (
                    <li key={result.href}>
                      <button
                        onClick={() => handleSelect(result)}
                        className={clsx(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors",
                          index === selectedIndex
                            ? "bg-primary/10 text-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        {result.type === "page" ? (
                          <FileText className="w-4 h-4 shrink-0" />
                        ) : (
                          <Hash className="w-4 h-4 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {result.title}
                          </div>
                          {result.section && (
                            <div className="text-xs text-muted-foreground truncate">
                              {result.section}
                            </div>
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {!query && (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  <p className="mb-4">Start typing to search</p>
                  <div className="flex items-center justify-center gap-4 text-xs">
                    <span className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted">
                        ↑↓
                      </kbd>
                      Navigate
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted">
                        Enter
                      </kbd>
                      Select
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted">
                        Esc
                      </kbd>
                      Close
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
