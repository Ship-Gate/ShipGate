// ============================================================================
// lib/utils.ts — cn() helper for Tailwind class merging
// ============================================================================

export function emitLibUtils(): string {
  return `import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
`;
}
