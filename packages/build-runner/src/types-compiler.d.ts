// ============================================================================
// Minimal type definitions for @isl-lang/isl-compiler
// ============================================================================
// This file provides type definitions for CompileResult when the dependency
// doesn't have declarations. Once @isl-lang/isl-compiler ships declarations,
// this file can be removed.

declare module '@isl-lang/isl-compiler' {
  import type { DomainDeclaration } from '@isl-lang/parser';

  export interface CompileOptions {
    types?: {
      includeValidation?: boolean;
      includeComments?: boolean;
    };
    tests?: {
      framework?: string;
    };
  }

  export interface CompileResult {
    types?: {
      filename: string;
      content: string;
    };
    tests?: {
      filename: string;
      content: string;
    };
  }

  export function compile(
    domain: DomainDeclaration,
    options?: CompileOptions
  ): CompileResult;

  export function preprocessSource(source: string): {
    source: string;
    imports: string[];
    errors: string[];
  };
}
