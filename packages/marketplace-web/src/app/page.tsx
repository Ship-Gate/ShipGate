"use client";

import { TrendingUp, Shield, Sparkles, ArrowRight } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { IntentCard } from "@/components/IntentCard";
import { TrustBadge } from "@/components/TrustBadge";
import { useMarketplace } from "@/hooks/useMarketplace";
import { CATEGORIES } from "@/types";
import Link from "next/link";

export default function HomePage() {
  const { trending, featured, categories, loading } = useMarketplace();

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background py-20">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="container relative">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Discover <span className="text-primary">Verified</span> Intents
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              Browse thousands of formally verified intents. Every contract is tested,
              verified, and trusted. Build with confidence.
            </p>
            <div className="mt-10 max-w-xl mx-auto">
              <SearchBar size="lg" placeholder="Search intents..." autoFocus />
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Shield className="h-4 w-4 text-trust-verified" />
                Formally Verified
              </span>
              <span className="flex items-center gap-1">
                <Sparkles className="h-4 w-4 text-primary" />
                Trust Scores
              </span>
              <span className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4 text-trust-medium" />
                10K+ Intents
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Section */}
      {featured.length > 0 && (
        <section className="py-12 border-b">
          <div className="container">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h2 className="text-2xl font-semibold">Featured Intents</h2>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {featured.map((intent) => (
                <IntentCard key={intent.name} intent={intent} variant="featured" />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Trending Section */}
      <section className="py-12 border-b">
        <div className="container">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-trust-medium" />
              <h2 className="text-2xl font-semibold">Trending This Week</h2>
            </div>
            <Link
              href="/search?sort=weekly"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />
              ))
            ) : (
              trending.map((intent) => (
                <IntentCard key={intent.name} intent={intent} />
              ))
            )}
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-12">
        <div className="container">
          <h2 className="text-2xl font-semibold mb-6">Browse by Category</h2>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {CATEGORIES.map((category) => {
              const count = categories.get(category.value)?.length || 0;
              return (
                <Link
                  key={category.value}
                  href={`/search?category=${category.value}`}
                  className="group flex flex-col items-center p-6 rounded-xl border bg-card hover:border-primary/50 hover:shadow-lg transition-all"
                >
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                    <span className="text-2xl">{getCategoryEmoji(category.value)}</span>
                  </div>
                  <span className="font-medium text-foreground">{category.label}</span>
                  <span className="text-sm text-muted-foreground">{count} intents</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-12 bg-muted/50">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <Shield className="h-12 w-12 mx-auto text-trust-verified mb-4" />
            <h2 className="text-2xl font-semibold mb-4">Built on Trust</h2>
            <p className="text-muted-foreground mb-6">
              Every intent in the marketplace is formally verified. We analyze preconditions,
              postconditions, and invariants to ensure contracts behave exactly as documented.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-background border">
                <TrustBadge score={99} verified showLabel />
                <span className="text-sm">Fully verified contracts</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-background border">
                <TrustBadge score={85} showLabel />
                <span className="text-sm">High trust score</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-background border">
                <TrustBadge score={65} showLabel />
                <span className="text-sm">Needs review</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function getCategoryEmoji(category: string): string {
  const emojis: Record<string, string> = {
    auth: "🔐",
    data: "📊",
    payment: "💳",
    crypto: "🔒",
    ai: "🧠",
    storage: "💾",
    network: "🌐",
    utility: "🔧",
    security: "🛡️",
    other: "📦",
  };
  return emojis[category] || "📦";
}
