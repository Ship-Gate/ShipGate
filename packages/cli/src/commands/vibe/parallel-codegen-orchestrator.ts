/**
 * ParallelCodegenOrchestrator — Parallel code generation to cut pipeline time ~60%
 *
 * Phase A (sequential): Prisma schema + shared types (dependencies for everything)
 * Phase B (parallel, 2 concurrent): Backend | Frontend
 * Phase C (parallel, up to 3 concurrent): Unit tests | API integration tests | Contract tests
 *
 * Each stream gets shared context (ISL spec, Prisma schema, shared types) + its own file manifest.
 * Partial results on stream failure — other streams continue.
 */

import { ThreadSafeProjectManifest } from '@isl-lang/coherence-engine';
import { ConcurrencyManager } from '../../pipeline/concurrency-manager.js';

export interface ParallelCodegenContext {
  islContent: string;
  domain: unknown;
  prismaSchema: string;
  sharedTypes: string;
  framework: string;
  database: string;
}

export interface ParallelCodegenOptions {
  islContent: string;
  domain: unknown;
  framework: string;
  database: string;
  maxConcurrent?: number;
  includeFrontend?: boolean;
  includeTests?: boolean;
  /** Callback for token usage (feeds pipeline budget) */
  onTokens?: (input: number, output: number, streamId?: string) => void;
}

export interface CodegenStreamResult {
  files: Map<string, string>;
  tokens: { input: number; output: number };
}

export interface ParallelCodegenResult {
  files: Map<string, { content: string; type: string }>;
  tokens: { input: number; output: number };
  streamResults: Array<{ streamId: string; success: boolean; error?: string }>;
}

export type GeneratePrismaFn = (
  domain: unknown,
  copilot: unknown,
  database: string,
) => Promise<{ content: string; tokens: { input: number; output: number } }>;

export type GenerateSharedTypesFn = (domain: unknown) => { content: string };

export type GenerateBackendFn = (
  islContent: string,
  domain: unknown,
  copilot: unknown,
  framework: string,
  database: string,
  prismaSchema: string,
  sharedTypes?: string,
) => Promise<CodegenStreamResult>;

export type GenerateFrontendFn = (
  islContent: string,
  domain: unknown,
  copilot: unknown,
) => Promise<CodegenStreamResult>;

export type GenerateTestsFn = (
  islContent: string,
  domain: unknown,
  copilot: unknown,
  framework: string,
  testType: 'unit' | 'api-integration' | 'contract',
) => Promise<CodegenStreamResult>;

/**
 * Orchestrates parallel code generation across Phase A, B, C.
 */
export class ParallelCodegenOrchestrator {
  private readonly manifest: ThreadSafeProjectManifest;
  private readonly concurrency: ConcurrencyManager;

  constructor(
    private readonly copilot: unknown,
    private readonly options: ParallelCodegenOptions,
    private readonly generators: {
      generatePrisma: GeneratePrismaFn;
      generateSharedTypes: GenerateSharedTypesFn;
      generateBackend: GenerateBackendFn;
      generateFrontend: GenerateFrontendFn;
      generateTests: GenerateTestsFn;
    },
  ) {
    this.manifest = new ThreadSafeProjectManifest({ rootDir: 'src' });
    this.concurrency = new ConcurrencyManager({
      maxConcurrent: options.maxConcurrent ?? 3,
      onTokens: options.onTokens,
    });
  }

  /**
   * Execute parallel codegen. Returns merged files and total tokens.
   */
  async execute(): Promise<ParallelCodegenResult> {
    const files = new Map<string, { content: string; type: string }>();
    let totalInput = 0;
    let totalOutput = 0;
    const streamResults: Array<{ streamId: string; success: boolean; error?: string }> = [];

    // ── Phase A: Sequential (Prisma + shared types) ─────────────────────────
    let prismaSchemaContent = '';
    if (this.options.database !== 'none') {
      const prismaResult = await this.generators.generatePrisma(
        this.options.domain,
        this.copilot,
        this.options.database,
      );
      prismaSchemaContent = prismaResult.content;
      totalInput += prismaResult.tokens.input;
      totalOutput += prismaResult.tokens.output;
      files.set('prisma/schema.prisma', { content: prismaSchemaContent, type: 'database' });
    }

    const sharedTypes = this.generators.generateSharedTypes(this.options.domain);
    files.set('src/lib/types.ts', { content: sharedTypes.content, type: 'backend' });
    this.manifest.registerFileSync('src/lib/types.ts', sharedTypes.content);

    const ctx: ParallelCodegenContext = {
      islContent: this.options.islContent,
      domain: this.options.domain,
      prismaSchema: prismaSchemaContent,
      sharedTypes: sharedTypes.content,
      framework: this.options.framework,
      database: this.options.database,
    };

    // ── Phase B: Parallel (Backend | Frontend) ─────────────────────────────
    const phaseBStreams: Array<{
      id: string;
      fn: () => Promise<{ result: CodegenStreamResult; tokens?: { input: number; output: number } }>;
    }> = [];

    phaseBStreams.push({
      id: 'backend',
      fn: async () => {
        const result = await this.generators.generateBackend(
          ctx.islContent,
          ctx.domain,
          this.copilot,
          ctx.framework,
          ctx.database,
          ctx.prismaSchema,
          ctx.sharedTypes,
        );
        for (const [path, content] of result.files) {
          await this.manifest.registerFile(path, content);
        }
        return {
          result,
          tokens: result.tokens,
        };
      },
    });

    if (this.options.includeFrontend !== false && this.options.framework === 'nextjs') {
      phaseBStreams.push({
        id: 'frontend',
        fn: async () => {
          const result = await this.generators.generateFrontend(
            ctx.islContent,
            ctx.domain,
            this.copilot,
          );
          for (const [path, content] of result.files) {
            await this.manifest.registerFile(path, content);
          }
          return {
            result,
            tokens: result.tokens,
          };
        },
      });
    }

    const phaseBResults = await this.concurrency.runAll(phaseBStreams);
    for (const r of phaseBResults) {
      if (r.success && r.result) {
        for (const [path, content] of r.result.files) {
          files.set(path, {
            content,
            type: r.streamId === 'backend' ? 'backend' : 'frontend',
          });
          totalInput += r.tokens?.input ?? 0;
          totalOutput += r.tokens?.output ?? 0;
        }
      }
      streamResults.push({
        streamId: r.streamId,
        success: r.success,
        error: r.error?.message,
      });
    }

    // ── Phase C: Parallel (Unit | API integration | Contract tests) ───────
    if (this.options.includeTests !== false) {
      const phaseCStreams: Array<{
        id: string;
        fn: () => Promise<{ result: CodegenStreamResult; tokens?: { input: number; output: number } }>;
      }> = [
        {
          id: 'unit-tests',
          fn: () =>
            this.generators.generateTests(
              ctx.islContent,
              ctx.domain,
              this.copilot,
              ctx.framework,
              'unit',
            ).then((r) => ({ result: r, tokens: r.tokens })),
        },
        {
          id: 'api-integration-tests',
          fn: () =>
            this.generators.generateTests(
              ctx.islContent,
              ctx.domain,
              this.copilot,
              ctx.framework,
              'api-integration',
            ).then((r) => ({ result: r, tokens: r.tokens })),
        },
        {
          id: 'contract-tests',
          fn: () =>
            this.generators.generateTests(
              ctx.islContent,
              ctx.domain,
              this.copilot,
              ctx.framework,
              'contract',
            ).then((r) => ({ result: r, tokens: r.tokens })),
        },
      ];

      const phaseCResults = await this.concurrency.runAll(phaseCStreams);
      for (const r of phaseCResults) {
        if (r.success && r.result) {
          for (const [path, content] of r.result.files) {
            files.set(path, { content, type: 'test' });
            totalInput += r.tokens?.input ?? 0;
            totalOutput += r.tokens?.output ?? 0;
          }
        }
        streamResults.push({
          streamId: r.streamId,
          success: r.success,
          error: r.error?.message,
        });
      }
    }

    return {
      files,
      tokens: { input: totalInput, output: totalOutput },
      streamResults,
    };
  }

  /** Get manifest for coherence check after execution */
  getManifest(): ThreadSafeProjectManifest {
    return this.manifest;
  }
}
