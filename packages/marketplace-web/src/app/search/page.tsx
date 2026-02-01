"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Filter, SlidersHorizontal } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { IntentCard } from "@/components/IntentCard";
import { useSearch } from "@/hooks/useMarketplace";
import { CATEGORIES, type IntentCategory } from "@/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function SearchContent() {
  const searchParams = useSearchParams();
  const { filters, results, loading, search, setFilters } = useSearch();

  useEffect(() => {
    const query = searchParams.get("q") || "";
    const category = searchParams.get("category") as IntentCategory | null;
    const verified = searchParams.get("verified") === "true";
    const minTrust = searchParams.get("minTrust");

    search({
      query,
      category: category || undefined,
      verified: verified || undefined,
      minTrustScore: minTrust ? parseInt(minTrust, 10) : undefined,
    });
  }, [searchParams]);

  const handleSearch = (query: string) => {
    search({ query });
  };

  return (
    <div className="container py-8">
      {/* Search Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Search Intents</h1>
        <div className="max-w-2xl">
          <SearchBar
            initialQuery={filters.query}
            onSearch={handleSearch}
            size="lg"
            autoFocus
          />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Filters Sidebar */}
        <aside className="w-full lg:w-64 shrink-0">
          <div className="sticky top-24 space-y-6">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <SlidersHorizontal className="h-5 w-5" />
              Filters
            </div>

            {/* Category Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select
                value={filters.category || "all"}
                onValueChange={(value) =>
                  search({ category: value === "all" ? undefined : (value as IntentCategory) })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Trust Score Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Minimum Trust Score</label>
              <Select
                value={filters.minTrustScore?.toString() || "0"}
                onValueChange={(value) =>
                  search({ minTrustScore: parseInt(value, 10) || undefined })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any trust score" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Any trust score</SelectItem>
                  <SelectItem value="60">60% or higher</SelectItem>
                  <SelectItem value="80">80% or higher</SelectItem>
                  <SelectItem value="90">90% or higher</SelectItem>
                  <SelectItem value="95">95% or higher (Verified)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Verified Only Filter */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="verified"
                checked={filters.verified || false}
                onChange={(e) => search({ verified: e.target.checked || undefined })}
                className="h-4 w-4 rounded border-input"
              />
              <label htmlFor="verified" className="text-sm font-medium cursor-pointer">
                Verified only
              </label>
            </div>

            {/* Sort */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Sort by</label>
              <Select
                value={`${filters.sortBy}-${filters.sortOrder}`}
                onValueChange={(value) => {
                  const [sortBy, sortOrder] = value.split("-") as [
                    typeof filters.sortBy,
                    typeof filters.sortOrder
                  ];
                  search({ sortBy, sortOrder });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="downloads-desc">Most downloads</SelectItem>
                  <SelectItem value="downloads-asc">Least downloads</SelectItem>
                  <SelectItem value="trust-desc">Highest trust</SelectItem>
                  <SelectItem value="trust-asc">Lowest trust</SelectItem>
                  <SelectItem value="updated-desc">Recently updated</SelectItem>
                  <SelectItem value="created-desc">Newest</SelectItem>
                  <SelectItem value="created-asc">Oldest</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {loading ? "Searching..." : `${results.total} intents found`}
            </p>
          </div>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : results.intents.length === 0 ? (
            <div className="text-center py-12">
              <Filter className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No intents found</h3>
              <p className="text-muted-foreground">
                Try adjusting your search or filters to find what you're looking for.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {results.intents.map((intent) => (
                <IntentCard key={intent.name} intent={intent} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="container py-8">
          <div className="h-12 w-48 bg-muted animate-pulse rounded mb-4" />
          <div className="h-14 max-w-2xl bg-muted animate-pulse rounded mb-8" />
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
