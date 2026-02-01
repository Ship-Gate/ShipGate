"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  initialQuery?: string;
  placeholder?: string;
  autoFocus?: boolean;
  size?: "sm" | "md" | "lg";
  onSearch?: (query: string) => void;
}

export function SearchBar({
  initialQuery = "",
  placeholder = "Search intents...",
  autoFocus = false,
  size = "md",
  onSearch,
}: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const sizeClasses = {
    sm: "h-9 text-sm",
    md: "h-11 text-base",
    lg: "h-14 text-lg",
  };

  const iconSizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!query.trim()) return;

      setIsLoading(true);
      if (onSearch) {
        onSearch(query);
        setIsLoading(false);
      } else {
        router.push(`/search?q=${encodeURIComponent(query)}`);
      }
    },
    [query, onSearch, router]
  );

  const handleClear = useCallback(() => {
    setQuery("");
    inputRef.current?.focus();
  }, []);

  return (
    <form onSubmit={handleSearch} className="relative w-full">
      <div className="relative">
        <Search
          className={cn(
            "absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground",
            iconSizeClasses[size]
          )}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "w-full rounded-xl border bg-background pl-12 pr-12 transition-all",
            "focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary",
            "placeholder:text-muted-foreground",
            sizeClasses[size]
          )}
        />
        {query && !isLoading && (
          <button
            type="button"
            onClick={handleClear}
            className={cn(
              "absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors",
              iconSizeClasses[size]
            )}
          >
            <X className={iconSizeClasses[size]} />
          </button>
        )}
        {isLoading && (
          <Loader2
            className={cn(
              "absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin",
              iconSizeClasses[size]
            )}
          />
        )}
      </div>
    </form>
  );
}

export function SearchSuggestions({
  suggestions,
  onSelect,
}: {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
}) {
  if (suggestions.length === 0) return null;

  return (
    <div className="absolute top-full left-0 right-0 mt-2 rounded-xl border bg-popover p-2 shadow-lg z-50">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          onClick={() => onSelect(suggestion)}
          className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-accent transition-colors"
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}
