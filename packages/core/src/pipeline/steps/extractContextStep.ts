/**
 * Context Extraction Step
 *
 * Extracts context from the workspace to inform translation and verification.
 */

import type { ContextPack, ExtractContextOptions } from '../../context/contextTypes.js';
import type { ContextStepResult, PipelineState } from '../pipelineTypes.js';

/**
 * Create a stub context pack for when context extraction is skipped
 */
function createStubContext(workspacePath: string): ContextPack {
  const now = new Date().toISOString();
  return {
    workspacePath,
    extractedAt: now,
    stack: {
      language: 'unknown',
      runtime: 'unknown',
      frameworks: [],
      databases: [],
      auth: [],
      hasTypeScript: false,
      isMonorepo: false,
    },
    detectedEntities: [],
    policySuggestions: [],
    keyFiles: [],
    warnings: ['Context extraction was skipped - using stub context'],
    metadata: {
      durationMs: 0,
      filesScanned: 0,
      extractorVersion: 'stub',
    },
  };
}

/**
 * Run the context extraction step
 *
 * @param state - Current pipeline state
 * @returns Context step result
 */
export async function runContextStep(state: PipelineState): Promise<ContextStepResult> {
  const startTime = performance.now();
  const warnings: string[] = [];

  try {
    // If skip context is enabled, return stub
    if (state.options.skipContext) {
      const stubContext = createStubContext(state.options.workspacePath);
      warnings.push('Context extraction skipped - using stub context');

      return {
        stepName: 'context',
        success: true,
        data: stubContext,
        durationMs: performance.now() - startTime,
        warnings,
      };
    }

    // Try to dynamically import the context extractor
    // This allows the pipeline to work even if context module has issues
    try {
      const { extractContext } = await import('../../context/extractContext.js');
      const context = await extractContext(
        state.options.workspacePath,
        state.options.contextOptions
      );

      return {
        stepName: 'context',
        success: true,
        data: context,
        durationMs: performance.now() - startTime,
        warnings: [...warnings, ...context.warnings],
      };
    } catch (importError) {
      // Context module not available - use stub
      warnings.push(
        `Context extraction module not available: ${importError instanceof Error ? importError.message : String(importError)}`
      );
      const stubContext = createStubContext(state.options.workspacePath);

      return {
        stepName: 'context',
        success: true,
        data: stubContext,
        durationMs: performance.now() - startTime,
        warnings,
      };
    }
  } catch (error) {
    return {
      stepName: 'context',
      success: false,
      error: error instanceof Error ? error.message : String(error),
      durationMs: performance.now() - startTime,
      warnings,
    };
  }
}
