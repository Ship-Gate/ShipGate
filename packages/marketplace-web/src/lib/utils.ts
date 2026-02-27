import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function getTrustLevel(score: number): "verified" | "high" | "medium" | "low" {
  if (score >= 95) return "verified";
  if (score >= 80) return "high";
  if (score >= 60) return "medium";
  return "low";
}

export function getTrustColor(score: number): string {
  const level = getTrustLevel(score);
  switch (level) {
    case "verified":
    case "high":
      return "text-trust-high";
    case "medium":
      return "text-trust-medium";
    case "low":
      return "text-trust-low";
  }
}
