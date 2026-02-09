/**
 * Type declarations for dependencies that may not have type definitions
 * This allows the build to proceed even if dependencies aren't fully built
 */

declare module '@isl-lang/isl-core' {
  export type SourceSpan = {
    file: string;
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
  // Add other types as needed
  export * from '@isl-lang/isl-core';
}

declare module '@isl-lang/secrets-hygiene' {
  export function safeJSONStringify(
    obj: unknown,
    maskerOptions?: unknown,
    space?: string | number
  ): string;
  export * from '@isl-lang/secrets-hygiene';
}

declare module '@isl-lang/isl-coverage' {
  export interface CoverageReport {
    timestamp: string;
    summary: {
      totalDomains: number;
      totalBehaviors: number;
      boundBehaviors: number;
      exercisedBehaviors: number;
      totalConstraints: number;
      evaluatedConstraints: number;
      alwaysUnknownConstraints: number;
    };
    domains: unknown[];
    unboundBehaviors: unknown[];
    unknownConstraints: unknown[];
  }
  export * from '@isl-lang/isl-coverage';
}
