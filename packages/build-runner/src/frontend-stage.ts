// ============================================================================
// Frontend Generation Stage
// ============================================================================

import type { Domain } from '@isl-lang/parser';
import { FrontendGenerator } from '@isl-lang/frontend-generator';
import type { StageResult, StageError, OutputFile } from './types.js';

export interface FrontendStageData {
  files: OutputFile[];
  shadcnComponents: string[];
}

/**
 * Execute the frontend generation stage.
 * Generates Next.js + shadcn/ui components from ISL domain.
 */
export function frontendStage(
  domain: Domain,
  frontendOutDir: string = 'frontend'
): StageResult<FrontendStageData> {
  const start = performance.now();
  const errors: StageError[] = [];

  try {
    const generator = new FrontendGenerator({
      domain,
      baseUrl: '/api',
      outputPrefix: '',
      appName: domain.name.name,
    });

    const result = generator.generate();

    for (const err of result.errors) {
      errors.push({
        stage: 'frontend',
        code: 'FRONTEND_ERROR',
        message: err,
      });
    }

    const files: OutputFile[] = result.files.map((f) => ({
      path: `${frontendOutDir}/${f.path}`,
      content: f.content,
      type: 'config' as const,
    }));

    return {
      success: errors.length === 0,
      data: {
        files,
        shadcnComponents: result.shadcnComponents,
      },
      errors,
      durationMs: performance.now() - start,
    };
  } catch (error) {
    errors.push({
      stage: 'frontend',
      code: 'FRONTEND_ERROR',
      message: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      data: undefined,
      errors,
      durationMs: performance.now() - start,
    };
  }
}
