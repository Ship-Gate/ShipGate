"use client";

import { Shield, ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import { cn, getTrustLevel } from "@/lib/utils";

interface TrustBadgeProps {
  score: number;
  verified?: boolean;
  size?: "sm" | "md" | "lg";
  showScore?: boolean;
  showLabel?: boolean;
}

export function TrustBadge({
  score,
  verified = false,
  size = "md",
  showScore = true,
  showLabel = false,
}: TrustBadgeProps) {
  const level = getTrustLevel(score);

  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  const colorClasses = {
    verified: "text-trust-verified",
    high: "text-trust-high",
    medium: "text-trust-medium",
    low: "text-trust-low",
  };

  const bgClasses = {
    verified: "bg-trust-verified/10",
    high: "bg-trust-high/10",
    medium: "bg-trust-medium/10",
    low: "bg-trust-low/10",
  };

  const labels = {
    verified: "Verified",
    high: "High Trust",
    medium: "Medium Trust",
    low: "Low Trust",
  };

  const Icon = verified
    ? ShieldCheck
    : level === "high"
    ? Shield
    : level === "medium"
    ? ShieldAlert
    : ShieldX;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
        bgClasses[verified ? "verified" : level],
        colorClasses[verified ? "verified" : level]
      )}
      title={`Trust Score: ${score}%`}
    >
      <Icon className={cn(sizeClasses[size], verified && "animate-pulse-trust")} />
      {showScore && (
        <span className={cn("font-medium", textSizeClasses[size])}>{score}%</span>
      )}
      {showLabel && (
        <span className={cn("font-medium", textSizeClasses[size])}>
          {labels[verified ? "verified" : level]}
        </span>
      )}
    </div>
  );
}

export function TrustScoreBar({ score }: { score: number }) {
  const level = getTrustLevel(score);

  const barColors = {
    verified: "bg-trust-verified",
    high: "bg-trust-high",
    medium: "bg-trust-medium",
    low: "bg-trust-low",
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Trust Score</span>
        <span className={cn("font-semibold", `text-trust-${level}`)}>{score}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColors[level])}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
