"use client";

import Link from "next/link";
import { Download, Calendar, ArrowRight } from "lucide-react";
import { cn, formatNumber, formatDate } from "@/lib/utils";
import { TrustBadge } from "./TrustBadge";
import type { Intent } from "@/types";

interface IntentCardProps {
  intent: Intent;
  variant?: "default" | "compact" | "featured";
}

export function IntentCard({ intent, variant = "default" }: IntentCardProps) {
  const isFeatured = variant === "featured";
  const isCompact = variant === "compact";

  return (
    <Link
      href={`/intents/${intent.name}`}
      className={cn(
        "group relative flex flex-col rounded-xl border bg-card p-6 transition-all hover:shadow-lg hover:border-primary/50",
        isFeatured && "md:col-span-2 bg-gradient-to-br from-primary/5 to-transparent",
        isCompact && "p-4"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={cn(
              "font-semibold text-foreground group-hover:text-primary transition-colors truncate",
              isFeatured ? "text-xl" : "text-lg"
            )}>
              {intent.name}
            </h3>
            <TrustBadge score={intent.trustScore} verified={intent.verified} size="sm" />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            v{intent.version} by {intent.author}
          </p>
        </div>
        <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      <p className={cn(
        "mt-3 text-muted-foreground line-clamp-2",
        isCompact ? "text-sm" : "text-base"
      )}>
        {intent.description}
      </p>

      {!isCompact && (
        <div className="mt-4 flex flex-wrap gap-2">
          {intent.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
            >
              {tag}
            </span>
          ))}
          {intent.tags.length > 4 && (
            <span className="text-xs text-muted-foreground">
              +{intent.tags.length - 4} more
            </span>
          )}
        </div>
      )}

      <div className={cn(
        "flex items-center gap-4 text-sm text-muted-foreground",
        isCompact ? "mt-3" : "mt-4 pt-4 border-t"
      )}>
        <div className="flex items-center gap-1">
          <Download className="h-4 w-4" />
          <span>{formatNumber(intent.downloads)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Calendar className="h-4 w-4" />
          <span>{formatDate(intent.updatedAt)}</span>
        </div>
        <span className="ml-auto px-2 py-0.5 rounded bg-secondary text-xs capitalize">
          {intent.category}
        </span>
      </div>
    </Link>
  );
}
