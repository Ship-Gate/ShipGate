/**
 * Semantic Analysis Framework
 * 
 * Plugin-style architecture for semantic analysis passes
 */

import type { Domain } from '@isl-lang/parser';
import type { Diagnostic } from '@isl-lang/errors';

// ============================================================================
// Types
// ============================================================================

export interface SemanticPass {
  /** Unique identifier for this pass */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what this pass checks */
  description: string;
  /** Run the semantic analysis */
  analyze(domain: Domain): Diagnostic[];
}

export interface SemanticAnalysisResult {
  /** All diagnostics found */
  diagnostics: Diagnostic[];
  /** Whether analysis succeeded (no errors) */
  success: boolean;
  /** Statistics about the analysis */
  stats: {
    totalPasses: number;
    passesRun: number;
    errors: number;
    warnings: number;
    hints: number;
  };
}

export interface SemanticAnalyzerOptions {
  /** Which passes to run (empty = all) */
  passes?: string[];
  /** Which passes to skip */
  skip?: string[];
  /** Whether to include hints */
  includeHints?: boolean;
}

// ============================================================================
// Semantic Analyzer
// ============================================================================

export class SemanticAnalyzer {
  private passes: Map<string, SemanticPass> = new Map();

  /**
   * Register a semantic analysis pass
   */
  register(pass: SemanticPass): void {
    this.passes.set(pass.id, pass);
  }

  /**
   * Register multiple passes
   */
  registerAll(passes: SemanticPass[]): void {
    for (const pass of passes) {
      this.register(pass);
    }
  }

  /**
   * Get a registered pass by ID
   */
  getPass(id: string): SemanticPass | undefined {
    return this.passes.get(id);
  }

  /**
   * Get all registered passes
   */
  getAllPasses(): SemanticPass[] {
    return Array.from(this.passes.values());
  }

  /**
   * Run semantic analysis on a domain
   */
  analyze(domain: Domain, options: SemanticAnalyzerOptions = {}): SemanticAnalysisResult {
    const diagnostics: Diagnostic[] = [];
    const { passes: requestedPasses, skip = [], includeHints = false } = options;

    // Determine which passes to run
    let passesToRun: SemanticPass[];
    if (requestedPasses && requestedPasses.length > 0) {
      passesToRun = requestedPasses
        .map(id => this.passes.get(id))
        .filter((p): p is SemanticPass => p !== undefined);
    } else {
      passesToRun = Array.from(this.passes.values());
    }

    // Filter out skipped passes
    passesToRun = passesToRun.filter(p => !skip.includes(p.id));

    // Run each pass
    for (const pass of passesToRun) {
      try {
        const passDiagnostics = pass.analyze(domain);
        
        // Filter hints if not requested
        const filteredDiagnostics = includeHints
          ? passDiagnostics
          : passDiagnostics.filter(d => d.severity !== 'hint');
        
        diagnostics.push(...filteredDiagnostics);
      } catch (error) {
        // If a pass fails, add an error diagnostic
        diagnostics.push({
          severity: 'error',
          code: 'E0500',
          message: `Semantic pass '${pass.id}' failed: ${error instanceof Error ? error.message : String(error)}`,
          location: domain.location ? {
            file: domain.location.file,
            line: domain.location.line,
            column: domain.location.column,
            endLine: domain.location.endLine,
            endColumn: domain.location.endColumn,
          } : { file: 'unknown', line: 1, column: 1 },
          source: 'typechecker',
        } as Diagnostic);
      }
    }

    // Count diagnostics by severity
    const errors = diagnostics.filter(d => d.severity === 'error').length;
    const warnings = diagnostics.filter(d => d.severity === 'warning').length;
    const hints = diagnostics.filter(d => d.severity === 'hint').length;

    return {
      diagnostics,
      success: errors === 0,
      stats: {
        totalPasses: this.passes.size,
        passesRun: passesToRun.length,
        errors,
        warnings,
        hints,
      },
    };
  }
}
