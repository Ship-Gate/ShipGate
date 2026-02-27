/**
 * Type declarations for optional peer dependencies.
 *
 * These packages may or may not be installed at runtime.
 * The adapters use dynamic imports with graceful fallbacks.
 */

declare module '@isl-lang/security-scanner' {
  export function scanSource(
    source: string,
    language?: string,
  ): Array<{
    id: string;
    title: string;
    severity: string;
    category: string;
    description: string;
    recommendation: string;
    location: { file: string; startLine: number };
  }>;
}
