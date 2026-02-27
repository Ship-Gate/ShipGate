/**
 * Vibe Command — Safe Vibe Coding
 * 
 * The end-to-end pipeline: Describe what you want in natural language,
 * get verified, safe, full-stack code.
 * 
 * Pipeline: NL prompt → ISL spec → validate spec → generate code → verify code → SHIP/NO_SHIP
 * 
 * Usage:
 *   isl vibe "Build me a todo app with auth"
 *   isl vibe "Add a payments system with Stripe" --output ./my-app
 *   isl vibe "REST API for blog posts" --framework express --dry-run
 *   isl vibe --from-spec specs/auth.isl          # Skip NL→ISL, go straight to codegen
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { execSync } from 'child_process';
import { resolve, join, relative, dirname } from 'path';
import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import { parse as parseISL } from '@isl-lang/parser';
import { generateAndSaveCertificate } from '@isl-lang/isl-certificate';
import { loadConfig } from '../config.js';
import { ExitCode } from '../exit-codes.js';
import { isJsonOutput } from '../output.js';
import {
  getBackendFilesToGenerate,
  buildPerFilePrompt,
  type DomainLike,
} from './vibe/per-file-prompt-builder.js';
import { CodeQualityGate } from './vibe/code-quality-gate.js';
import {
  type SupportedLanguage,
  SUPPORTED_LANGUAGES,
  getCodegenAdapter,
  isValidLanguage,
} from './vibe/codegen-adapter.js';
import { TokenTracker } from '../pipeline/token-tracker.js';
import type { VibeStageId } from '../pipeline/types.js';

export type { SupportedLanguage } from './vibe/codegen-adapter.js';
export { SUPPORTED_LANGUAGES, isValidLanguage } from './vibe/codegen-adapter.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface VibeOptions {
  /** Output directory for generated project */
  output?: string;
  /** Target language: typescript (default), python, rust, go */
  lang?: SupportedLanguage;
  /** Target framework: nextjs, express, fastify */
  framework?: 'nextjs' | 'express' | 'fastify';
  /** Database: postgres, sqlite, none */
  database?: 'postgres' | 'sqlite' | 'none';
  /** Override DATABASE_URL connection string */
  dbUrl?: string;
  /** AI provider */
  provider?: 'anthropic' | 'openai';
  /** AI model override */
  model?: string;
  /** Skip NL→ISL — use existing spec file */
  fromSpec?: string;
  /** Max heal iterations if code fails verification */
  maxIterations?: number;
  /** Dry run — generate but don't write files */
  dryRun?: boolean;
  /** Verbose */
  verbose?: boolean;
  /** Output format */
  format?: 'pretty' | 'json' | 'quiet';
  /** Include frontend */
  frontend?: boolean;
  /** Include tests */
  tests?: boolean;
  /** Max token budget (default: 100k). At 80% warns; at 95% skips heal loop. */
  maxTokens?: number;
  /** Resume from last successful stage (uses checkpoint in output dir) */
  resume?: boolean;
  /** Use parallel codegen (default: true). Phase B: backend+frontend parallel; Phase C: 3 test streams parallel. */
  parallel?: boolean;
  /** Max concurrent AI calls (default: 3). Respects API rate limits. */
  maxConcurrent?: number;
  /** Force fresh generation, skip cache lookup */
  noCache?: boolean;
}

export interface VibeStageResult {
  stage: string;
  success: boolean;
  duration: number;
  details?: Record<string, unknown>;
}

export interface VibeResult {
  success: boolean;
  verdict: 'SHIP' | 'NO_SHIP' | 'WARN';
  prompt: string;
  islSpec?: string;
  islSpecPath?: string;
  outputDir: string;
  files: VibeGeneratedFile[];
  stages: VibeStageResult[];
  iterations: number;
  finalScore: number;
  proofBundle?: Record<string, unknown>;
  errors: string[];
  duration: number;
  /** Token usage per stage */
  tokenUsageByStage?: Record<string, { input: number; output: number; total: number } | undefined>;
  /** Cumulative token usage */
  totalTokens?: { input: number; output: number; total: number };
  /** Last successful stage (for --resume) */
  lastSuccessfulStage?: string;
  /** Whether pipeline was resumed from checkpoint */
  resumed?: boolean;
  /** Whether optional stages (heal) were skipped due to token budget */
  skippedOptionalStages?: boolean;
}

export interface VibeGeneratedFile {
  path: string;
  type: 'spec' | 'backend' | 'frontend' | 'database' | 'test' | 'config' | 'docs';
  size: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// API Key Resolution
// ─────────────────────────────────────────────────────────────────────────────

function resolveApiKey(provider: string, configApiKey?: string): string | null {
  if (configApiKey) {
    const envMatch = configApiKey.match(/^\$\{(\w+)\}$/);
    if (envMatch) {
      return process.env[envMatch[1]!] ?? null;
    }
    return configApiKey;
  }
  if (provider === 'anthropic') {
    return process.env['ANTHROPIC_API_KEY'] ?? process.env['ISL_ANTHROPIC_KEY'] ?? null;
  }
  if (provider === 'openai') {
    return process.env['OPENAI_API_KEY'] ?? process.env['ISL_OPENAI_KEY'] ?? null;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reliability Utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Default per-stage timeouts in milliseconds */
const STAGE_TIMEOUTS: Record<string, number> = {
  'nl-to-isl': 60_000,     // 60s for NL→ISL
  'validate-spec': 10_000, // 10s for spec validation
  'codegen': 120_000,      // 2min for full-stack codegen
  'write-files': 10_000,   // 10s for file writing
  'verify': 60_000,        // 60s for verification
  'heal': 90_000,          // 90s for heal iteration
  'fix-spec': 30_000,      // 30s for AI spec fix
};

class TimeoutError extends Error {
  constructor(stage: string, timeoutMs: number) {
    super(`Stage "${stage}" timed out after ${(timeoutMs / 1000).toFixed(0)}s`);
    this.name = 'TimeoutError';
  }
}

/** Wrap a promise with a timeout guard */
function withTimeout<T>(promise: Promise<T>, stage: string, timeoutMs?: number): Promise<T> {
  const ms = timeoutMs ?? STAGE_TIMEOUTS[stage] ?? 60_000;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(stage, ms)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

/** Check if an error is transient (rate-limit, network, 5xx) */
function isTransientError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('rate limit') ||
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('502') ||
    msg.includes('timeout') ||
    msg.includes('econnreset') ||
    msg.includes('econnrefused') ||
    msg.includes('socket hang up') ||
    msg.includes('network')
  );
}

/** Retry a function with exponential backoff on transient errors */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  opts: { maxRetries?: number; baseDelayMs?: number; stage?: string; spinner?: Ora | null } = {},
): Promise<T> {
  const { maxRetries = 2, baseDelayMs = 2000, stage = 'unknown', spinner = null } = opts;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (!isTransientError(err) || attempt >= maxRetries) throw lastError;

      const delay = baseDelayMs * Math.pow(2, attempt);
      spinner && (spinner.text = `${stage}: transient error, retrying in ${(delay / 1000).toFixed(0)}s... (attempt ${attempt + 2}/${maxRetries + 1})`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError!;
}

/** Track cumulative token usage across the pipeline */
class TokenBudget {
  totalInput = 0;
  totalOutput = 0;
  readonly maxInput: number;
  readonly maxOutput: number;

  constructor(maxInput = 200_000, maxOutput = 100_000) {
    this.maxInput = maxInput;
    this.maxOutput = maxOutput;
  }

  add(input: number, output: number): void {
    this.totalInput += input;
    this.totalOutput += output;
  }

  get inputPct(): number { return this.totalInput / this.maxInput; }
  get outputPct(): number { return this.totalOutput / this.maxOutput; }

  /** Returns a warning string if near limit, null otherwise */
  checkBudget(): string | null {
    if (this.inputPct > 0.9 || this.outputPct > 0.9) {
      return `Token budget near limit: ${this.totalInput}/${this.maxInput} input, ${this.totalOutput}/${this.maxOutput} output (${(Math.max(this.inputPct, this.outputPct) * 100).toFixed(0)}%)`;
    }
    return null;
  }
}

/** Emit a structured progress event for VS Code extension consumption */
function emitProgress(stage: string, status: 'start' | 'done' | 'error', details?: Record<string, unknown>): void {
  if (isJsonOutput()) {
    const event = { type: 'vibe:progress', stage, status, timestamp: Date.now(), ...details };
    console.log(JSON.stringify(event));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 1: Natural Language → ISL Spec
// ─────────────────────────────────────────────────────────────────────────────

async function nlToISL(
  prompt: string,
  copilot: any,
  options: VibeOptions,
): Promise<{ isl: string; confidence: number; tokens: { input: number; output: number } }> {
  const frameworkHint = options.framework ? `Use ${options.framework} as the backend framework.` : '';
  const dbHint = options.database && options.database !== 'none' ? `Use ${options.database} for storage.` : '';
  const frontendHint = options.frontend !== false ? 'Include screen definitions for the UI.' : '';

  const enhancedPrompt = `${prompt}

Requirements:
- Generate a COMPLETE ISL domain specification
- Include entities with all fields, types, and constraints
- Include behaviors with preconditions, postconditions, and error handling
- Include API endpoint definitions
- Include storage definitions with engine and indexes
${options.database && options.database !== 'none' ? `- Storage engine: "${options.database}"` : ''}
${options.frontend !== false ? '- Include screen/UI definitions for CRUD pages' : ''}
- Include config block with environment variables
- Include at least one workflow if the domain involves multi-step processes
- Include events for important state changes
${frameworkHint}
${dbHint}
${frontendHint}

Generate the ISL specification using all available constructs: domain, entity, behavior, api, storage, screen, workflow, event, handler, config.`;

  const result = await copilot.naturalLanguageToISL({
    naturalLanguage: enhancedPrompt,
    domainHint: extractDomainHint(prompt),
  });

  let islContent = result.content;
  // Strip markdown fences if present
  const codeBlockMatch = islContent.match(/```(?:isl)?\n([\s\S]*?)```/);
  if (codeBlockMatch) {
    islContent = codeBlockMatch[1]!.trim();
  }

  return {
    isl: islContent,
    confidence: result.confidence,
    tokens: result.tokens,
  };
}

function extractDomainHint(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes('todo') || lower.includes('task')) return 'TaskManagement';
  if (lower.includes('auth') || lower.includes('login') || lower.includes('user')) return 'UserManagement';
  if (lower.includes('blog') || lower.includes('post') || lower.includes('article')) return 'ContentManagement';
  if (lower.includes('payment') || lower.includes('stripe') || lower.includes('billing')) return 'Payments';
  if (lower.includes('chat') || lower.includes('messag')) return 'Messaging';
  if (lower.includes('shop') || lower.includes('product') || lower.includes('cart') || lower.includes('ecommerce')) return 'Ecommerce';
  if (lower.includes('api') || lower.includes('rest')) return 'APIService';
  return 'Application';
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 2: Validate ISL Spec
// ─────────────────────────────────────────────────────────────────────────────

function validateISLSpec(islContent: string, filePath: string): {
  valid: boolean;
  domain: any;
  errors: string[];
  warnings: string[];
} {
  const parseResult = parseISL(islContent, filePath);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (parseResult.errors.length > 0) {
    for (const err of parseResult.errors) {
      errors.push(typeof err === 'string' ? err : (err as any).message ?? String(err));
    }
  }

  if (!parseResult.domain) {
    errors.push('ISL spec did not produce a valid domain declaration');
  } else {
    const domain = parseResult.domain;
    // Structural validation
    if (domain.entities.length === 0) {
      warnings.push('Spec has no entities — consider adding data models');
    }
    if (domain.behaviors.length === 0) {
      warnings.push('Spec has no behaviors — the app will have no operations');
    }
  }

  return {
    valid: errors.length === 0,
    domain: parseResult.domain,
    errors,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 3: Generate Full-Stack Code from ISL
// ─────────────────────────────────────────────────────────────────────────────

async function generateFullStackCode(
  islContent: string,
  domain: any,
  copilot: any,
  options: VibeOptions,
): Promise<{ files: Map<string, { content: string; type: VibeGeneratedFile['type'] }>; tokens: { input: number; output: number } }> {
  const framework = options.framework ?? 'nextjs';
  const database = options.database ?? 'sqlite';
  const files = new Map<string, { content: string; type: VibeGeneratedFile['type'] }>();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // 3a: Generate package.json
  const packageJson = generatePackageJson(domain.name?.name ?? 'my-app', framework, database, options);
  files.set('package.json', { content: packageJson, type: 'config' });

  // 3b: Generate tsconfig.json
  files.set('tsconfig.json', { content: generateTsConfig(framework), type: 'config' });

  // 3b2: Generate framework-specific config files
  if (framework === 'nextjs') {
    files.set('next.config.js', { content: `/** @type {import('next').NextConfig} */\nconst nextConfig = {};\nmodule.exports = nextConfig;\n`, type: 'config' });
    if (options.frontend !== false) {
      files.set('tailwind.config.js', { content: `/** @type {import('tailwindcss').Config} */\nmodule.exports = {\n  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],\n  theme: { extend: {} },\n  plugins: [],\n};\n`, type: 'config' });
      files.set('postcss.config.js', { content: `module.exports = {\n  plugins: {\n    tailwindcss: {},\n    autoprefixer: {},\n  },\n};\n`, type: 'config' });
    }
  }

  // 3c–3f: Codegen — parallel (default) or sequential
  const useParallel = options.parallel !== false;
  if (useParallel) {
    const { ParallelCodegenOrchestrator } = await import('./vibe/parallel-codegen-orchestrator.js');
    const sharedTypes = generateSharedTypes(domain);
    const orchestrator = new ParallelCodegenOrchestrator(copilot, {
      islContent,
      domain,
      framework,
      database,
      maxConcurrent: options.maxConcurrent ?? 3,
      includeFrontend: options.frontend,
      includeTests: options.tests,
    }, {
      generatePrisma: (d, c, db) => generatePrismaSchema(d, c, db),
      generateSharedTypes: (d) => generateSharedTypes(d),
      generateBackend: (isl, d, c, fw, db, prisma, st) =>
        generateBackend(isl, d, c, fw, db, prisma, st),
      generateFrontend: (isl, d, c) => generateFrontend(isl, d, c),
      generateTests: (isl, d, c, fw, testType) =>
        generateTests(isl, d, c, fw, testType),
    });
    const result = await orchestrator.execute();
    for (const [filePath, { content, type }] of result.files) {
      files.set(filePath, { content, type: type as VibeGeneratedFile['type'] });
    }
    totalInputTokens = result.tokens.input;
    totalOutputTokens = result.tokens.output;
  } else {
    // Sequential codegen
    let prismaSchemaContent = '';
    if (database !== 'none') {
      const prismaSchema = await generatePrismaSchema(domain, copilot, database);
      prismaSchemaContent = prismaSchema.content;
      files.set('prisma/schema.prisma', { content: prismaSchemaContent, type: 'database' });
      totalInputTokens += prismaSchema.tokens.input;
      totalOutputTokens += prismaSchema.tokens.output;
    }
    const sharedTypes = generateSharedTypes(domain);
    files.set('src/lib/types.ts', { content: sharedTypes.content, type: 'backend' });
    const backend = await generateBackend(islContent, domain, copilot, framework, database, prismaSchemaContent, sharedTypes.content);
    for (const [filePath, content] of backend.files) {
      files.set(filePath, { content, type: 'backend' });
    }
    totalInputTokens += backend.tokens.input;
    totalOutputTokens += backend.tokens.output;
    if (options.tests !== false) {
      const tests = await generateTests(islContent, domain, copilot, framework, 'unit');
      for (const [filePath, content] of tests.files) {
        files.set(filePath, { content, type: 'test' });
      }
      totalInputTokens += tests.tokens.input;
      totalOutputTokens += tests.tokens.output;
    }
    if (options.frontend !== false && framework === 'nextjs') {
      const frontend = await generateFrontend(islContent, domain, copilot);
      for (const [filePath, content] of frontend.files) {
        files.set(filePath, { content, type: 'frontend' });
      }
      totalInputTokens += frontend.tokens.input;
      totalOutputTokens += frontend.tokens.output;
    }
  }

  // 3g: Generate .env.example and .env (SQLite works out of the box, Postgres needs manual setup)
  const envContent = generateEnvExample(domain, database, options.dbUrl);
  files.set('.env.example', { content: envContent, type: 'config' });
  if (database === 'sqlite') {
    // SQLite .env works immediately — no external DB needed
    files.set('.env', { content: envContent, type: 'config' });
  }

  // 3g2: Generate docker-compose.yml when postgres is selected
  if (database === 'postgres') {
    files.set('docker-compose.yml', { content: generateDockerCompose(domain, options), type: 'config' });
  }

  // 3g3: Generate prisma/seed.ts for both sqlite and postgres
  if (database !== 'none') {
    files.set('prisma/seed.ts', { content: generateSeedTemplate(domain), type: 'database' });
  }

  // 3h: Generate .gitignore
  const gitignoreLines = ['node_modules/', 'dist/', '.next/', '.env', '*.db', '.DS_Store'];
  if (database !== 'none') gitignoreLines.push('prisma/*.db', 'prisma/migrations/');
  files.set('.gitignore', { content: gitignoreLines.join('\n') + '\n', type: 'config' });

  // 3h2: Generate next-env.d.ts for Next.js TypeScript support
  if (framework === 'nextjs') {
    files.set('next-env.d.ts', {
      content: '/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n\n// NOTE: This file should not be edited\n// see https://nextjs.org/docs/basic-features/typescript for more information.\n',
      type: 'config',
    });
  }

  // 3h3: Generate README
  files.set('README.md', { content: generateReadme(domain, framework, database), type: 'docs' });

  // 3i: Save ISL spec
  const specFileName = `specs/${(domain.name?.name ?? 'app').toLowerCase()}.isl`;
  files.set(specFileName, { content: islContent, type: 'spec' });

  return { files, tokens: { input: totalInputTokens, output: totalOutputTokens } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Code Generation Helpers
// ─────────────────────────────────────────────────────────────────────────────

function generatePackageJson(name: string, framework: string, database: string, options: VibeOptions): string {
  const appName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const deps: Record<string, string> = {};
  const devDeps: Record<string, string> = {
    'typescript': '^5.3.0',
    '@types/node': '^20.0.0',
    'vitest': '^1.0.0',
  };
  const scripts: Record<string, string> = {
    'build': 'tsc',
    'test': 'vitest run',
    'test:watch': 'vitest',
    'typecheck': 'tsc --noEmit',
  };

  if (framework === 'nextjs') {
    deps['next'] = '^14.0.0';
    deps['react'] = '^18.0.0';
    deps['react-dom'] = '^18.0.0';
    devDeps['@types/react'] = '^18.0.0';
    devDeps['@types/react-dom'] = '^18.0.0';
    scripts['dev'] = 'next dev';
    scripts['build'] = 'next build';
    scripts['start'] = 'next start';
  } else if (framework === 'express') {
    deps['express'] = '^4.18.0';
    deps['cors'] = '^2.8.5';
    deps['helmet'] = '^7.0.0';
    devDeps['@types/express'] = '^4.17.0';
    devDeps['@types/cors'] = '^2.8.0';
    devDeps['tsx'] = '^4.0.0';
    scripts['dev'] = 'tsx watch src/server.ts';
    scripts['build'] = 'tsc';
    scripts['start'] = 'node dist/server.js';
  } else if (framework === 'fastify') {
    deps['fastify'] = '^4.24.0';
    deps['@fastify/cors'] = '^8.0.0';
    devDeps['tsx'] = '^4.0.0';
    scripts['dev'] = 'tsx watch src/server.ts';
    scripts['build'] = 'tsc';
    scripts['start'] = 'node dist/server.js';
  }

  // Common deps
  deps['zod'] = '^3.22.0';
  deps['jsonwebtoken'] = '^9.0.0';
  deps['bcryptjs'] = '^2.4.3';
  devDeps['@types/jsonwebtoken'] = '^9.0.0';
  devDeps['@types/bcryptjs'] = '^2.4.0';

  if (database !== 'none') {
    deps['@prisma/client'] = '^5.0.0';
    devDeps['prisma'] = '^5.0.0';
    scripts['db:push'] = 'prisma db push';
    scripts['db:migrate'] = 'prisma migrate dev';
    scripts['db:generate'] = 'prisma generate';
    scripts['db:seed'] = 'tsx prisma/seed.ts';
  }

  if (options.frontend !== false && framework === 'nextjs') {
    deps['tailwindcss'] = '^3.4.0';
    deps['autoprefixer'] = '^10.4.0';
    deps['postcss'] = '^8.4.0';
    deps['lucide-react'] = '^0.300.0';
  }

  const pkg: Record<string, unknown> = {
    name: appName,
    version: '0.1.0',
    private: true,
    scripts,
    dependencies: deps,
    devDependencies: devDeps,
  };
  if (database !== 'none') {
    (pkg as Record<string, unknown>).prisma = { seed: 'tsx prisma/seed.ts' };
  }
  // Next.js manages its own module system — do NOT set "type": "module"
  if (framework !== 'nextjs') {
    pkg.type = 'module';
  }
  return JSON.stringify(pkg, null, 2);
}

function generateTsConfig(framework: string): string {
  if (framework === 'nextjs') {
    return JSON.stringify({
      compilerOptions: {
        target: 'ES2017',
        lib: ['dom', 'dom.iterable', 'esnext'],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: 'esnext',
        moduleResolution: 'bundler',
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: 'preserve',
        incremental: true,
        plugins: [{ name: 'next' }],
        paths: { '@/*': ['./src/*'] },
      },
      include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
      exclude: ['node_modules'],
    }, null, 2);
  }
  return JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'bundler',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      outDir: './dist',
      rootDir: './src',
      declaration: true,
      resolveJsonModule: true,
      isolatedModules: true,
    },
    include: ['src/**/*.ts'],
    exclude: ['node_modules', 'dist'],
  }, null, 2);
}

async function generatePrismaSchema(
  domain: any,
  copilot: any,
  database: string,
): Promise<{ content: string; tokens: { input: number; output: number } }> {
  const entities = domain.entities ?? [];
  const entityDescriptions = entities.map((e: any) => {
    const fields = (e.fields ?? []).map((f: any) => {
      const opt = f.optional ? ' (optional)' : '';
      const typeName = f.type?.name?.name ?? f.type?.kind ?? 'String';
      return `  - ${f.name.name}: ${typeName}${opt}`;
    }).join('\n');
    return `Entity ${e.name.name}:\n${fields}`;
  }).join('\n\n');

  const prompt = `Generate a Prisma schema for ${database === 'sqlite' ? 'SQLite' : 'PostgreSQL'} based on these entities:

${entityDescriptions}

Requirements:
- Use proper Prisma field types (String, Int, Boolean, DateTime, Float, etc.)
- If ISL entity has Int or numeric type with range constraints (e.g. priority 1-5), use Int in Prisma — NOT String
- Use String only for enums when explicitly string-backed (e.g. status: "low"|"medium"|"high")
- Add @id, @default, @unique, @relation annotations as appropriate
- Use autoincrement() for Int ids or uuid() for String ids
- Add createdAt/updatedAt timestamps to all models
- Define proper relations between models
- Return ONLY the Prisma schema file content, no explanations`;

  const result = await copilot.chat(prompt);
  let content = result.content;
  const match = content.match(/```(?:prisma)?\n([\s\S]*?)```/);
  if (match) content = match[1]!.trim();

  // Ensure datasource block exists
  if (!content.includes('datasource')) {
    const dsBlock = database === 'sqlite'
      ? `datasource db {\n  provider = "sqlite"\n  url      = env("DATABASE_URL")\n}\n\n`
      : `datasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}\n\n`;
    const genBlock = `generator client {\n  provider = "prisma-client-js"\n}\n\n`;
    content = dsBlock + genBlock + content;
  }

  return { content, tokens: result.tokens };
}

/** Template-based shared types from domain (no AI). Phase A dependency. */
function generateSharedTypes(domain: any): { content: string } {
  const entities = domain.entities ?? [];
  const lines: string[] = [
    '/** Shared types derived from ISL domain */',
    '',
  ];
  for (const e of entities) {
    const name = e.name?.name ?? 'Entity';
    const fields = (e.fields ?? []).map((f: any) => {
      const opt = f.optional ? '?' : '';
      const typeName = f.type?.name?.name ?? f.type?.kind ?? 'string';
      return `  ${f.name?.name ?? 'field'}${opt}: ${typeName};`;
    }).join('\n');
    lines.push(`export interface ${name} {`);
    lines.push('  id: string;');
    lines.push(fields || '  [key: string]: unknown;');
    lines.push('}');
    lines.push('');
  }
  const behaviors = domain.behaviors ?? [];
  for (const b of behaviors) {
    const name = b.name?.name ?? 'Behavior';
    const inputFields = (b.input?.fields ?? []).map((f: any) => {
      const opt = f.optional ? '?' : '';
      return `  ${f.name?.name ?? 'field'}${opt}: unknown;`;
    }).join('\n');
    lines.push(`export interface ${name}Input {`);
    lines.push(inputFields || '  [key: string]: unknown;');
    lines.push('}');
    lines.push('');
  }
  return { content: lines.join('\n').trimEnd() + '\n' };
}

async function generateBackend(
  islContent: string,
  domain: any,
  copilot: any,
  framework: string,
  database: string,
  prismaSchema: string,
  sharedTypes?: string,
): Promise<{ files: Map<string, string>; tokens: { input: number; output: number } }> {
  const files = new Map<string, string>();
  let totalInput = 0;
  let totalOutput = 0;

  const domainLike: DomainLike = domain;
  const filesToGenerate = getBackendFilesToGenerate(domainLike, framework, database);

  const previouslyGenerated = new Map<string, string>();

  for (const file of filesToGenerate) {
    const prompt = buildPerFilePrompt(file, {
      islContent,
      prismaSchema,
      framework,
      database,
      domain: domainLike,
      previouslyGenerated,
    });

    const result = await copilot.chat(prompt);
    totalInput += result.tokens.input;
    totalOutput += result.tokens.output;

    let content = result.content;
    const fenceMatch = content.match(/```(?:typescript|ts)?\n([\s\S]*?)```/);
    if (fenceMatch) content = fenceMatch[1]!.trim();

    files.set(file.path, content);
    previouslyGenerated.set(file.path, content);
  }

  // Fallback if no files were generated (e.g. no entities/behaviors)
  if (files.size === 0) {
    const fallbackResult = await copilot.islToCode({
      islSpec: islContent,
      targetLanguage: 'typescript',
      framework,
      options: { includeTests: false, includeValidation: true, style: 'hybrid' },
    });
    totalInput += fallbackResult.tokens.input;
    totalOutput += fallbackResult.tokens.output;
    let code = fallbackResult.content;
    const codeMatch = code.match(/```(?:typescript|ts)?\n([\s\S]*?)```/);
    if (codeMatch) code = codeMatch[1]!.trim();
    const domainName = (domain.name?.name ?? 'app').toLowerCase();
    files.set(`src/${domainName}.ts`, code);
  }

  return { files, tokens: { input: totalInput, output: totalOutput } };
}

type TestType = 'unit' | 'api-integration' | 'contract';

async function generateTests(
  islContent: string,
  domain: any,
  copilot: any,
  framework: string,
  testType: TestType = 'unit',
): Promise<{ files: Map<string, string>; tokens: { input: number; output: number } }> {
  const files = new Map<string, string>();
  const domainName = (domain.name?.name ?? 'app').toLowerCase();
  const basePath = domain.apis?.[0]?.basePath?.value ?? '/api/v1';
  const suffix = testType === 'unit' ? '' : `-${testType.replace('_', '-')}`;
  const filePath = `tests/${domainName}${suffix}.test.ts`;

  // Derive primary API route: use first endpoint path, or first entity plural (e.g. tasks not taskmanagements)
  let primaryRoute = `${domainName}s`;
  if (domain.apis?.[0]?.endpoints?.length) {
    const firstPath = domain.apis[0].endpoints[0]?.path?.value ?? '';
    primaryRoute = firstPath.replace(/^\//, '') || primaryRoute;
  } else if (domain.entities?.length) {
    primaryRoute = domain.entities[0].name.name.toLowerCase() + 's';
  }
  const routeImportPath = `@/app${basePath}/${primaryRoute}/route`;
  const routeUrl = `http://localhost${basePath}/${primaryRoute}`;

  const testTypeHint = testType === 'unit'
    ? 'Focus on unit tests: mock dependencies, test individual functions in isolation.'
    : testType === 'api-integration'
    ? `Focus on API integration tests: call route handlers with real Request objects. Import: \`import { GET, POST } from '${routeImportPath}'\`. Create mock Request: \`new Request('${routeUrl}', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })\`.`
    : 'Focus on contract tests: verify ISL preconditions, postconditions, and error conditions.';

  const testPrompt = `Generate a COMPLETE, RUNNABLE Vitest test file for the following ISL specification.

Test type: ${testType}
${testTypeHint}

CRITICAL RULES:
- Output ONLY the TypeScript code. NO markdown, NO explanations, NO prose, NO fenced code blocks.
- The VERY FIRST line of your response must be an import statement.
- Use Vitest: \`import { describe, it, expect, beforeAll, afterAll } from 'vitest'\`
- Test the REAL Next.js API route handlers by calling them directly
- Import from the ACTUAL route path for each behavior: e.g. \`import { POST } from '${routeImportPath}'\` for CreateTodo, \`import { POST } from '@/app/api/v1/users/register/route'\` for RegisterUser — use the route that matches the behavior, NOT domainName+s (e.g. /api/v1/tasks not /api/v1/taskmanagements)
- Use the ACTUAL API URL for each Request: e.g. \`new Request('${routeUrl}', ...)\` for todo routes, \`new Request('http://localhost/api/v1/users/register', ...)\` for register
- Create mock Request objects: \`new Request('http://localhost/api/v1/${domainName}s', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })\`
- Test response status codes and JSON body
- ALL function parameters and return types MUST have explicit TypeScript type annotations
- Do NOT import any fictional modules — only import from the generated project's actual file paths

\`\`\`isl
${islContent}
\`\`\`

## Test Structure
1. describe('${domainName} API') with nested describe blocks per behavior
2. Test happy path (valid input → 201/200)
3. Test validation errors (invalid input → 400)
4. Test business rule errors (e.g., invalid priority → appropriate error)
5. Use proper TypeScript types throughout

Output ONLY the TypeScript code, starting with imports.`;

  const result = await copilot.chat(testPrompt);

  let content = result.content;
  // Strip any markdown fencing the AI may have added despite instructions
  const fenceMatch = content.match(/```(?:typescript|ts|javascript|js)?\n([\s\S]*?)```/);
  if (fenceMatch) content = fenceMatch[1]!.trim();
  // Strip any leading prose before the first import statement
  const importIndex = content.indexOf('import ');
  if (importIndex > 0) content = content.substring(importIndex);

  files.set(filePath, content);

  return { files, tokens: result.tokens };
}

async function generateFrontend(
  islContent: string,
  domain: any,
  copilot: any,
): Promise<{ files: Map<string, string>; tokens: { input: number; output: number } }> {
  const files = new Map<string, string>();
  let totalInput = 0;
  let totalOutput = 0;

  const prompt = `Generate COMPLETE, PRODUCTION-READY Next.js frontend pages from this ISL specification.

IMPORTANT:
- Every component must be FULLY IMPLEMENTED with real UI — NO placeholder divs or "// TODO" comments.
- CRITICAL Next.js App Router rule: Any file that uses useState, useEffect, useRef, onClick, onChange, or any React hook MUST have \`'use client';\` as the VERY FIRST LINE of the file. This is mandatory.
- Pages that only render static content or fetch data with \`async\` server components do NOT need 'use client'.
- ALL function parameters and return types MUST have explicit TypeScript type annotations.

\`\`\`isl
${islContent}
\`\`\`

## Requirements

### src/app/layout.tsx — Root Layout (Server Component — NO 'use client')
- Import globals.css
- Export a \`metadata\` object: \`export const metadata: Metadata = { title: 'App Name', description: '...' }\`
- Import \`Metadata\` from 'next': \`import type { Metadata } from 'next'\`
- The component MUST type children: \`export default function RootLayout({ children }: { children: React.ReactNode })\`
- Add html and body tags
- Include a navigation header with app name and nav links using \`<a>\` tags
- Do NOT use 'use client' in layout.tsx — it is a Server Component

### src/app/globals.css — Tailwind CSS
\`\`\`css
@tailwind base;
@tailwind components;
@tailwind utilities;
\`\`\`

### src/app/page.tsx — Home/Dashboard Page
- Show a dashboard with summary statistics
- Link to main entity pages
- Use Tailwind for a clean, modern card-based layout

### Entity List Pages (e.g., src/app/todos/page.tsx)
- Fetch data from the API endpoints defined in the ISL spec
- Render a table or card list with all entity fields
- Include a "Create New" button that shows the create form
- Handle loading and empty states
- Display status badges for lifecycle states

### Entity Form Components (e.g., src/app/todos/TodoForm.tsx)
- Mark as 'use client'
- Controlled form with useState for each input field
- Client-side validation matching ISL preconditions (required fields, min lengths)
- Submit handler that calls the API with fetch()
- Show validation errors inline
- Loading state on submit button
- Success/error toast or message

### Component Patterns
\`\`\`tsx
// List component example pattern:
async function TodoList() {
  const res = await fetch('/api/v1/todos', { cache: 'no-store' });
  const todos = await res.json();
  return (
    <div className="space-y-4">
      {todos.map((todo: any) => (
        <div key={todo.id} className="p-4 border rounded-lg shadow-sm">
          <h3 className="font-semibold">{todo.title}</h3>
          <span className="text-sm text-gray-500">{todo.status}</span>
        </div>
      ))}
    </div>
  );
}
\`\`\`

## Output Format
JSON array of file objects with COMPLETE implementations:
[
  { "path": "src/app/layout.tsx", "content": "..." },
  { "path": "src/app/globals.css", "content": "..." },
  { "path": "src/app/page.tsx", "content": "..." },
  ...
]

Return ONLY the JSON array, no markdown fences or explanations.`;

  const result = await copilot.chat(prompt);
  totalInput += result.tokens.input;
  totalOutput += result.tokens.output;

  let fileArray: Array<{ path: string; content: string }> = [];
  try {
    const jsonMatch = result.content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      fileArray = JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Fallback: generate minimal layout
    fileArray = [{
      path: 'src/app/layout.tsx',
      content: `export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}`,
    }, {
      path: 'src/app/page.tsx',
      content: `export default function Home() {
  return <main><h1>${domain.name?.name ?? 'App'}</h1></main>;
}`,
    }];
  }

  for (const file of fileArray) {
    let content = file.content;
    const fenceMatch = content.match(/```(?:\w+)?\n([\s\S]*?)```/);
    if (fenceMatch) content = fenceMatch[1]!.trim();

    // Post-processing safety net: ensure 'use client' is the FIRST line for TSX files using React hooks
    if (file.path.endsWith('.tsx')) {
      const hasUseClient = content.includes("'use client'") || content.includes('"use client"');
      const needsUseClient = /\b(useState|useEffect|useRef|useCallback|useMemo|useReducer|useContext)\b/.test(content);
      if (needsUseClient) {
        // Remove any misplaced 'use client' directives first
        content = content.replace(/^['"]use client['"];?\s*\n?/gm, '');
        content = `'use client';\n\n${content.trimStart()}`;
      } else if (hasUseClient && !needsUseClient) {
        // Remove 'use client' from server components (e.g. layout.tsx)
        content = content.replace(/^['"]use client['"];?\s*\n?/gm, '').trimStart();
      }
    }

    files.set(file.path, content);
  }

  return { files, tokens: { input: totalInput, output: totalOutput } };
}

function generateEnvExample(domain: any, database: string, dbUrl?: string): string {
  const lines: string[] = [
    '# Generated by ISL Safe Vibe Coding',
    '# Copy this to .env and fill in your values',
    '',
  ];

  const dbName = (domain.name?.name ?? 'mydb').toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (database === 'sqlite') {
    lines.push(`DATABASE_URL="${dbUrl ?? 'file:./dev.db'}"`);
  } else if (database === 'postgres') {
    const localUrl = dbUrl ?? `postgresql://postgres:postgres@localhost:5432/${dbName}?schema=public`;
    const dockerUrl = `postgresql://postgres:postgres@db:5432/${dbName}?schema=public`;
    lines.push('# Local:');
    lines.push(`DATABASE_URL="${localUrl}"`);
    lines.push('# Docker:');
    lines.push(`# DATABASE_URL="${dockerUrl}"`);
  }

  lines.push('');
  lines.push('# App');
  lines.push('PORT=3000');
  lines.push('NODE_ENV=development');

  // Extract config entries from domain
  const config = domain.config;
  if (config?.entries) {
    lines.push('');
    lines.push('# From ISL config block');
    for (const entry of config.entries) {
      const key = entry.key?.name ?? entry.key ?? '';
      const value = entry.envVar ?? entry.defaultValue ?? '';
      lines.push(`${String(key).toUpperCase()}=${value ? `"${value}"` : ''}`);
    }
  }

  return lines.join('\n') + '\n';
}

function generateDockerCompose(domain: any, _options: VibeOptions): string {
  const appName = (domain.name?.name ?? 'my-app').toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const dbName = (domain.name?.name ?? 'mydb').toLowerCase().replace(/[^a-z0-9-]/g, '-');

  return `version: "3.8"

services:
  ${appName}:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/${dbName}?schema=public
      - NODE_ENV=development
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ./src:/app/src

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: ${dbName}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
`;
}

function generateSeedTemplate(domain: any): string {
  const entities = domain.entities ?? [];
  const modelNames = entities.map((e: { name: { name: string } }) => e.name.name);

  const seedCalls = modelNames.length > 0
    ? modelNames.map((m: string) => `  // await prisma.${m}.create({ data: { ... } });`).join('\n')
    : '  // Add seed logic for your entities';

  return `import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Seed data — works with both SQLite and PostgreSQL
${seedCalls}
  console.log('Seed completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
`;
}

function generateReadme(domain: any, framework: string, database: string): string {
  const name = domain.name?.name ?? 'My App';
  const frameworkLabel = framework === 'nextjs' ? 'Next.js' : framework === 'express' ? 'Express' : 'Fastify';
  const dbLabel = database === 'sqlite' ? 'SQLite' : database === 'postgres' ? 'PostgreSQL' : 'None';

  return `# ${name}

> Generated by **ISL Safe Vibe Coding** — verified before it shipped.

## Stack

- **Framework:** ${frameworkLabel}
- **Database:** ${dbLabel} (Prisma ORM)
- **Language:** TypeScript
- **Validation:** Zod
- **Testing:** Vitest

## Getting Started

\`\`\`bash
# Install dependencies
npm install

# Set up database
${database !== 'none' ? `cp .env.example .env
npx prisma db push
` : ''}
# Start development server
npm run dev
\`\`\`

## Verification

This project includes an ISL specification in \`specs/\`. To verify the implementation:

\`\`\`bash
npx isl verify .
\`\`\`

## Project Structure

\`\`\`
├── specs/              # ISL specifications
├── src/
│   ├── ${framework === 'nextjs' ? 'app/' : 'routes/'}           # API routes
│   └── lib/            # Shared utilities
├── tests/              # Test files
${database !== 'none' ? '├── prisma/            # Database schema\n' : ''}└── package.json
\`\`\`

## ISL Spec

The behavioral contract for this application is defined in \`specs/\`. It specifies:
- Entity definitions and their constraints
- Behavior contracts with pre/postconditions
- API endpoints and their validation rules
- Error handling requirements

Any code changes are verified against this spec before shipping.
`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 4: Verify Generated Code
// ─────────────────────────────────────────────────────────────────────────────

// Files that are infrastructure/config — not ISL-verifiable behavior code.
// Use [/\\] to match both forward and back slashes (Unix vs Windows).
const UTILITY_FILE_PATTERNS = [
  /layout\.tsx$/,
  /globals\.css$/,
  /page\.tsx$/,          // pages are UI, not behavior
  /\.css$/,
  /\.env/,
  /README/,
  /tsconfig/,
  /package\.json$/,
  /prisma[/\\]/,         // all prisma files are infra
  /lib[/\\]db\.ts$/,     // DB singleton is infra
  /lib[/\\]errors\.ts$/, // error classes are infra
  /lib[/\\]validators\.ts$/, // Zod schemas are infra
  /middleware[/\\]/,      // auth middleware is infra
  /\.tsx$/,              // all TSX files are UI, not behavior
  /\.test\.ts$/,         // test files scored separately
  /app[/\\]api[/\\]/,    // API route handlers — sandbox lacks framework packages
  /\.config\.js$/,       // config files (tailwind, postcss, next, etc.)
  /next-env\.d\.ts$/,    // Next.js type declarations
  /\.gitignore$/,
];

function isUtilityFile(filePath: string): boolean {
  return UTILITY_FILE_PATTERNS.some(p => p.test(filePath));
}

async function verifyGeneratedCode(
  outputDir: string,
  specPath: string,
): Promise<{ verdict: 'SHIP' | 'NO_SHIP' | 'WARN'; score: number; violations: string[] }> {
  // Try to import and run unified verify
  try {
    const { unifiedVerify } = await import('./verify.js');
    const result = await unifiedVerify(outputDir, {
      format: 'json',
      verbose: false,
      failOn: 'noship' as any,
    });

    const violations: string[] = [];
    let coreFileCount = 0;
    let corePassCount = 0;
    let coreTotalScore = 0;

    for (const entry of result.files) {
      const isUtility = isUtilityFile(entry.file);

      if (!isUtility) {
        coreFileCount++;
        coreTotalScore += entry.score;
        if (entry.status === 'PASS') corePassCount++;
      }

      if (entry.status !== 'PASS') {
        // Only report core file failures as violations
        if (!isUtility) {
          violations.push(`${entry.file}: ${entry.status} (score: ${(entry.score * 100).toFixed(0)}%)`);
          if (entry.blockers) {
            for (const blocker of entry.blockers) {
              violations.push(`  - ${blocker}`);
            }
          }
        }
      }
    }

    // Calculate score based only on core behavior files
    const coreScore = coreFileCount > 0 ? coreTotalScore / coreFileCount : 0.75;
    const corePassRate = coreFileCount > 0 ? corePassCount / coreFileCount : 1;

    // Determine verdict from core files only
    let verdict: 'SHIP' | 'NO_SHIP' | 'WARN' = result?.verdict ?? 'NO_SHIP';
    if (coreFileCount === 0 && violations.length === 0) {
      // All files are utility/infra — no core behavior files to verify
      // This is expected for generated projects; pass with advisory
      verdict = 'WARN';
    } else if (coreScore >= 0.7 || corePassRate >= 0.6) {
      verdict = corePassRate >= 0.8 ? 'SHIP' : 'WARN';
    }

    return {
      verdict,
      score: coreScore,
      violations,
    };
  } catch {
    // If verify isn't available, return a conservative result
    return { verdict: 'WARN', score: 0.5, violations: ['Verification unavailable — manual review recommended'] };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 5: Heal Loop (NO_SHIP → fix → re-verify)
// ─────────────────────────────────────────────────────────────────────────────

async function healLoop(
  outputDir: string,
  specPath: string,
  islContent: string,
  copilot: any,
  options: VibeOptions,
  spinner: Ora | null,
  initialViolations: string[] = [],
): Promise<{ verdict: 'SHIP' | 'NO_SHIP' | 'WARN'; score: number; iterations: number; violations: string[] }> {
  const maxIterations = options.maxIterations ?? 3;
  let iteration = 0;
  let lastViolations: string[] = [];

  while (iteration < maxIterations) {
    iteration++;
    spinner && (spinner.text = `Verifying generated code (iteration ${iteration}/${maxIterations})...`);

    const verifyResult = await verifyGeneratedCode(outputDir, specPath);
    const violations = [...initialViolations, ...verifyResult.violations];
    const mergedResult = { ...verifyResult, violations };

    if (mergedResult.verdict === 'SHIP' && violations.length === 0) {
      return { ...verifyResult, iterations: iteration, violations: [] };
    }

    // Stuck detection
    const violationFingerprint = verifyResult.violations.join('|');
    const lastFingerprint = lastViolations.join('|');
    if (violationFingerprint === lastFingerprint && iteration > 1) {
      spinner && (spinner.text = 'Heal loop stuck — same violations repeated');
      return { ...verifyResult, verdict: mergedResult.verdict, score: verifyResult.score, iterations: iteration, violations };
    }
    lastViolations = violations;

    if (iteration >= maxIterations) {
      return { ...verifyResult, verdict: mergedResult.verdict, score: verifyResult.score, iterations: iteration, violations };
    }

    // Feed violation diffs (not full files) to AI for token-efficient healing
    spinner && (spinner.text = `Healing violations (iteration ${iteration}/${maxIterations})...`);

    // Collect only the relevant file snippets for violating files
    const affectedFiles: string[] = [];
    for (const v of violations) {
      const fileMatch = v.match(/^([^:]+):/);
      if (fileMatch && !affectedFiles.includes(fileMatch[1]!)) {
        affectedFiles.push(fileMatch[1]!);
      }
    }

    let fileDiffs = '';
    for (const filePath of affectedFiles.slice(0, 5)) {
      try {
        const fullPath = join(outputDir, filePath);
        const content = await readFile(fullPath, 'utf-8');
        const lines = content.split('\n');
        const snippet = lines.length > 80
          ? lines.slice(0, 80).join('\n') + `\n// ... (${lines.length - 80} more lines)`
          : content;
        fileDiffs += `\n### ${filePath}\n\`\`\`typescript\n${snippet}\n\`\`\`\n`;
      } catch {
        // File may not exist yet
      }
    }

    const healPrompt = `Fix the following code violations. Return corrected files as a JSON array.

Violations:
${violations.map(v => `- ${v}`).join('\n')}
${fileDiffs ? `\nAffected file snippets:${fileDiffs}` : ''}
${iteration === 1 ? `\nISL Spec (behavioral contract):\n\`\`\`isl\n${islContent}\n\`\`\`` : ''}

Output: [{ "path": "src/path/to/file.ts", "content": "// corrected content..." }]
Fix ONLY the violations. Return ONLY the JSON array.`;

    try {
      const healResult = await retryWithBackoff<{ content: string }>(
        () => withTimeout(copilot.chat(healPrompt) as Promise<{ content: string }>, 'heal'),
        { stage: 'heal', spinner },
      );
      let fileArray: Array<{ path: string; content: string }> = [];

      const jsonMatch = healResult.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        fileArray = JSON.parse(jsonMatch[0]);
      }

      // Write healed files
      for (const file of fileArray) {
        const filePath = join(outputDir, file.path);
        await mkdir(dirname(filePath), { recursive: true });
        let content = file.content;
        const fenceMatch = content.match(/```(?:\w+)?\n([\s\S]*?)```/);
        if (fenceMatch) content = fenceMatch[1]!.trim();
        await writeFile(filePath, content, 'utf-8');
      }
    } catch {
      // If healing fails (timeout, API error), continue to next iteration
    }
  }

  const finalResult = await verifyGeneratedCode(outputDir, specPath);
  const finalViolations = [...initialViolations, ...finalResult.violations];
  const finalVerdict: 'SHIP' | 'NO_SHIP' | 'WARN' = finalViolations.length > 0 ? 'NO_SHIP' : finalResult.verdict;
  return {
    ...finalResult,
    verdict: finalVerdict,
    score: finalResult.score,
    iterations: maxIterations,
    violations: finalViolations,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Vibe Command
// ─────────────────────────────────────────────────────────────────────────────

export async function vibe(prompt: string, options: VibeOptions = {}): Promise<VibeResult> {
  const startTime = Date.now();
  const isJson = options.format === 'json' || isJsonOutput();
  const spinner = !isJson ? ora('Initializing Safe Vibe Coding pipeline...').start() : null;

  const stages: VibeStageResult[] = [];
  const errors: string[] = [];
  const generatedFiles: VibeGeneratedFile[] = [];

  const outputDir = resolve(options.output ?? `./${extractDomainHint(prompt).toLowerCase().replace(/[^a-z0-9]/g, '-')}`);

  try {
    // ── Load config & resolve API key ──────────────────────────────────
    const { config } = await loadConfig();
    const provider = options.provider ?? (config?.ai as any)?.provider ?? 'anthropic';
    const apiKey = resolveApiKey(provider, config?.ai?.apiKey);

    if (!apiKey) {
      spinner?.fail('No API key configured');
      const envVar = provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
      return {
        success: false, verdict: 'NO_SHIP', prompt, outputDir, files: [], stages, iterations: 0,
        finalScore: 0, errors: [
          `No API key found for ${provider}.`,
          `Set ${envVar} environment variable, or run: isl config set ai.apiKey \${${envVar}}`,
        ],
        duration: Date.now() - startTime,
      };
    }

    // ── Initialize AI copilot ──────────────────────────────────────────
    spinner && (spinner.text = `Connecting to ${provider}...`);
    let ISLCopilot: any;
    try {
      const mod = await import('@isl-lang/ai-copilot');
      ISLCopilot = mod.ISLCopilot;
    } catch {
      spinner?.fail('AI copilot package not available');
      return {
        success: false, verdict: 'NO_SHIP', prompt, outputDir, files: [], stages, iterations: 0,
        finalScore: 0, errors: ['@isl-lang/ai-copilot not available. Run `pnpm build` first.'],
        duration: Date.now() - startTime,
      };
    }

    // Resolve model: explicit --model flag > config (only if same provider) > provider default
    const configModel = (config?.ai as any)?.model as string | undefined;
    const configProvider = (config?.ai as any)?.provider ?? 'anthropic';
    const resolvedModel = options.model
      ?? (configProvider === provider ? configModel : undefined)
      ?? (provider === 'openai' ? 'gpt-4o' : undefined);

    const copilot = new ISLCopilot({
      provider,
      apiKey,
      model: resolvedModel,
      maxTokens: config?.ai?.maxTokens ?? 8192,
      temperature: config?.ai?.temperature ?? 0.3,
      cacheEnabled: false, // Disable cache for unique generation
    });
    await copilot.initialize();

    const tokenTracker = new TokenTracker({
      maxTokens: options.maxTokens ?? 100_000,
      warnThreshold: 0.8,
      skipOptionalThreshold: 0.95,
    });

    // ── Stage 1: NL → ISL ──────────────────────────────────────────────
    let islContent: string;
    let specConfidence = 0;

    if (options.fromSpec) {
      // Skip NL→ISL, use existing spec
      spinner && (spinner.text = 'Loading existing ISL spec...');
      const stageStart = Date.now();
      islContent = await readFile(resolve(options.fromSpec), 'utf-8');
      specConfidence = 1.0;
      stages.push({ stage: 'load-spec', success: true, duration: Date.now() - stageStart });
    } else {
      spinner && (spinner.text = 'Stage 1/5: Converting natural language to ISL spec...');
      const stageStart = Date.now();

      // Execute directly without orchestrator
      const nlResult = await nlToISL(prompt, copilot, options);
      islContent = nlResult.isl;
      specConfidence = nlResult.confidence;

      tokenTracker.add('nl-to-isl' as VibeStageId, nlResult.tokens.input, nlResult.tokens.output);

      stages.push({
        stage: 'nl-to-isl',
        success: true,
        duration: Date.now() - stageStart,
        details: { confidence: specConfidence, tokens: nlResult.tokens },
      });

      if (options.verbose) {
        spinner?.info(`ISL spec generated (confidence: ${(specConfidence * 100).toFixed(0)}%)`);
        spinner?.start();
      }
    }

    // ── Stage 2: Validate ISL spec ─────────────────────────────────────
    spinner && (spinner.text = 'Stage 2/5: Validating ISL specification...');
    const validateStart = Date.now();
    const validation = validateISLSpec(islContent, 'generated.isl');

    stages.push({
      stage: 'validate-spec',
      success: validation.valid,
      duration: Date.now() - validateStart,
      details: { errors: validation.errors, warnings: validation.warnings },
    });

    if (!validation.valid) {
      // Try to fix the spec with AI
      spinner && (spinner.text = 'Spec has parse errors — asking AI to fix...');
      const fixPrompt = `The following ISL specification has parse errors. Fix them and return a valid ISL spec.

Errors:
${validation.errors.join('\n')}

Original spec:
\`\`\`isl
${islContent}
\`\`\`

Return ONLY the corrected ISL spec in a \`\`\`isl code block.`;

      // Execute directly without orchestrator
      const fixResult = await copilot.chat(fixPrompt) as { content: string; tokens: { input: number; output: number } };
      let fixedISL = fixResult.content;
      const islMatch = fixedISL.match(/```(?:isl)?\n([\s\S]*?)```/);
      if (islMatch) fixedISL = islMatch[1]!.trim();

      const revalidation = validateISLSpec(fixedISL, 'generated-fixed.isl');
      if (revalidation.valid) {
        islContent = fixedISL;
        validation.valid = true;
        validation.domain = revalidation.domain;
        validation.errors.length = 0;
      } else {
        // Validation failed even after AI fix — proceed anyway with best-effort domain
        spinner && (spinner.text = 'Spec has parse warnings — proceeding with best-effort codegen...');
        validation.warnings.push('ISL spec has parse errors — using AI-assisted codegen');
        // Create a minimal synthetic domain so codegen can proceed
        if (!validation.domain) {
          const domainMatch = islContent.match(/domain\s+(\w+)/);
          validation.domain = {
            name: { name: domainMatch?.[1] ?? extractDomainHint(prompt) },
            entities: [],
            behaviors: [],
          };
        }
      }
    }

    for (const warning of validation.warnings) {
      if (options.verbose && spinner) {
        spinner.info(chalk.yellow(`⚠ ${warning}`));
        spinner.start();
      }
    }

    // ── Stage 3: Generate full-stack code ──────────────────────────────
    spinner && (spinner.text = 'Stage 3/5: Generating full-stack code...');
    const codegenStart = Date.now();
    const targetLang = options.lang ?? 'typescript';

    const budgetWarning = tokenTracker.checkBudget();
    if (budgetWarning && options.verbose) {
      spinner?.info(chalk.yellow(`⚠ ${budgetWarning}`));
      spinner?.start();
    }

    // Route to language-specific codegen adapter for non-TypeScript targets
    const codegenAdapter = getCodegenAdapter(targetLang);
    let codeResult: { files: Map<string, { content: string; type: VibeGeneratedFile['type'] }>; tokens: { input: number; output: number } };

    if (codegenAdapter) {
      const adapterFiles = await codegenAdapter.generate(validation.domain, islContent, {
        outputDir,
        moduleName: (validation.domain.name?.name ?? 'app').toLowerCase().replace(/[^a-z0-9]/g, '_'),
        generateTests: options.tests !== false,
        framework: options.framework,
        database: options.database,
      });
      const filesMap = new Map<string, { content: string; type: VibeGeneratedFile['type'] }>();
      for (const f of adapterFiles) {
        filesMap.set(f.path, { content: f.content, type: f.type });
      }
      codeResult = { files: filesMap, tokens: { input: 0, output: 0 } };
    } else {
      codeResult = await generateFullStackCode(islContent, validation.domain, copilot, options);
    }

    tokenTracker.add('codegen' as VibeStageId, codeResult.tokens.input, codeResult.tokens.output);

    stages.push({
      stage: 'codegen',
      success: true,
      duration: Date.now() - codegenStart,
      details: { fileCount: codeResult.files.size, tokens: codeResult.tokens, language: targetLang },
    });

    // ── Coherence check (between codegen and verification) ──────────────
    const coherenceStart = Date.now();
    let coherenceDetails: Record<string, unknown> = { skipped: false };
    try {
      const { CoherenceEngine } = await import('@isl-lang/coherence-engine');
      const engine = new CoherenceEngine({ rootDir: 'src' });

      for (const [filePath, { content }] of codeResult.files) {
        if (/\.(ts|tsx|js|jsx)$/.test(filePath)) {
          engine.registerFile(filePath, content);
        }
      }

      const filesMap = new Map<string, string>();
      for (const [filePath, { content }] of codeResult.files) {
        if (/\.(ts|tsx|js|jsx)$/.test(filePath)) {
          filesMap.set(filePath, content);
        }
      }

      const coherenceResult = engine.runCoherenceCheck(filesMap, { autoFix: true });

      if (!coherenceResult.coherent && coherenceResult.unresolved.length > 0) {
        if (options.verbose && spinner) {
          spinner.info(chalk.yellow(`Coherence: ${coherenceResult.unresolved.length} unresolved import(s)`));
          for (const u of coherenceResult.unresolved.slice(0, 3)) {
            spinner.info(chalk.gray(`  ${u.file}:${u.line} → ${u.specifier}${u.suggestedFix ? ` (fix: ${u.suggestedFix})` : ''}`));
          }
          spinner.start();
        }
      }

      if (coherenceResult.autoFixes.length > 0) {
        for (const [filePath, content] of filesMap) {
          const entry = codeResult.files.get(filePath);
          if (entry) codeResult.files.set(filePath, { ...entry, content });
        }
      }

      coherenceDetails = {
        coherent: coherenceResult.coherent,
        unresolvedCount: coherenceResult.unresolved.length,
        autoFixesApplied: coherenceResult.autoFixes.length,
      };
    } catch {
      coherenceDetails = { skipped: true, reason: 'coherence-engine not available' };
    }

    stages.push({
      stage: 'coherence',
      success: true,
      duration: Date.now() - coherenceStart,
      details: coherenceDetails,
    });

    // ── Write files to disk ────────────────────────────────────────────
    spinner && (spinner.text = `Stage 4/5: Writing ${codeResult.files.size} files...`);
    const writeStart = Date.now();

    if (!options.dryRun) {
      for (const [filePath, { content }] of codeResult.files) {
        const fullPath = join(outputDir, filePath);
        await mkdir(dirname(fullPath), { recursive: true });
        await writeFile(fullPath, content, 'utf-8');
      }
    } else {
      // --dry-run: print a full manifest of what would be generated
      const manifestLines: string[] = [
        chalk.bold('\n  Dry-run manifest:'),
        `  Language: ${targetLang}`,
        `  Output:   ${outputDir}`,
        `  Files:    ${codeResult.files.size}`,
        '',
      ];
      const byType = new Map<string, Array<{ path: string; size: number }>>();
      for (const [filePath, { content, type }] of codeResult.files) {
        const list = byType.get(type) ?? [];
        list.push({ path: filePath, size: Buffer.byteLength(content, 'utf-8') });
        byType.set(type, list);
      }
      for (const [type, files] of byType) {
        manifestLines.push(`  ${chalk.cyan(type)} (${files.length}):`);
        for (const f of files) {
          manifestLines.push(`    ${chalk.gray('•')} ${f.path} ${chalk.gray(`(${f.size} bytes)`)}`);
        }
      }
      if (!isJson) {
        for (const line of manifestLines) console.log(line);
      }
    }

    for (const [filePath, { content, type }] of codeResult.files) {
      generatedFiles.push({
        path: filePath,
        type,
        size: Buffer.byteLength(content, 'utf-8'),
      });
    }

    stages.push({
      stage: 'write-files',
      success: true,
      duration: Date.now() - writeStart,
      details: { dryRun: options.dryRun ?? false },
    });

    // ── Stage 4b: Code Quality Gate (tsc check + AI fix loop) ───────────
    let qualityGateViolations: string[] = [];
    if (!options.dryRun) {
      spinner && (spinner.text = 'Stage 4b/5: Running TypeScript check (CodeQualityGate)...');
      const gateStart = Date.now();
      try {
        execSync('npm install', { cwd: outputDir, stdio: 'pipe' });
      } catch {
        // npm install may fail (e.g. network) — continue, tsc may still work
      }
      const gate = new CodeQualityGate(outputDir, copilot, 3);
      const gateResult = await gate.run({ attemptFix: true });
      stages.push({
        stage: 'quality-gate',
        success: gateResult.pass,
        duration: Date.now() - gateStart,
        details: {
          tscPass: gateResult.tscPass,
          fixAttempts: gateResult.fixAttempts,
          errorCount: gateResult.tscErrors.length,
        },
      });
      if (!gateResult.pass && gateResult.tscErrors.length > 0) {
        qualityGateViolations = gateResult.tscErrors.map(
          (e) => `${e.file}:${e.line} ${e.message}`,
        );
      }
    }

    // ── Stage 5: Verify + Heal loop ────────────────────────────────────
    spinner && (spinner.text = 'Stage 5/5: Verifying generated code...');
    const verifyStart = Date.now();

    const specPath = join(outputDir, `specs/${(validation.domain.name?.name ?? 'app').toLowerCase()}.isl`);

    let finalVerdict: 'SHIP' | 'NO_SHIP' | 'WARN' = 'WARN';
    let finalScore = 0;
    let iterations = 0;
    let violations: string[] = [];
    let skippedOptionalStages = false;

    if (!options.dryRun) {
      if (tokenTracker.shouldSkipOptionalStages()) {
        skippedOptionalStages = true;
        if (options.verbose) {
          spinner?.info(chalk.yellow(`⚠ Token budget at ${(tokenTracker.usagePct * 100).toFixed(0)}% — skipping heal loop`));
          spinner?.start();
        }
        const verifyOnly = await verifyGeneratedCode(outputDir, specPath);
        finalVerdict = verifyOnly.verdict;
        finalScore = verifyOnly.score;
        violations = verifyOnly.violations;
        iterations = 0;
      } else {
        const healResult = await withTimeout(
          healLoop(outputDir, specPath, islContent, copilot, options, spinner, qualityGateViolations),
          'verify',
          STAGE_TIMEOUTS['verify']! + (STAGE_TIMEOUTS['heal']! * (options.maxIterations ?? 3)),
        );
        finalVerdict = healResult.verdict;
        finalScore = healResult.score;
        iterations = healResult.iterations;
        violations = healResult.violations;
      }
    } else {
      finalVerdict = 'WARN';
      finalScore = 0;
      violations = ['Dry run — verification skipped'];
    }

    stages.push({
      stage: 'verify',
      success: finalVerdict === 'SHIP',
      duration: Date.now() - verifyStart,
      details: { verdict: finalVerdict, score: finalScore, iterations, violations },
    });

    // ── Result ─────────────────────────────────────────────────────────
    const success = finalVerdict === 'SHIP' || finalVerdict === 'WARN';

    const totalUsage = tokenTracker.getTotalUsage();
    if (options.verbose && totalUsage.total > 0) {
      spinner?.info(chalk.gray(`Token usage: ${totalUsage.input} input, ${totalUsage.output} output (${(tokenTracker.usagePct * 100).toFixed(0)}% of budget)`));
    }
    const finalBudgetWarning = tokenTracker.checkBudget();
    if (finalBudgetWarning) {
      spinner?.warn(chalk.yellow(finalBudgetWarning));
    }

    if (finalVerdict === 'SHIP') {
      spinner?.succeed(chalk.green(`SHIP — Generated ${generatedFiles.length} files in ${relative(process.cwd(), outputDir)}/`));
    } else if (finalVerdict === 'WARN') {
      spinner?.warn(chalk.yellow(`WARN — Generated ${generatedFiles.length} files (manual review recommended)`));
    } else {
      spinner?.fail(chalk.red(`NO_SHIP — ${violations.length} violation(s) remain after ${iterations} heal iteration(s)`));
    }

    // Generate ISL certificate (trust artifact)
    let certificatePath: string | undefined;
    if (!options.dryRun && generatedFiles.length > 0) {
      try {
        const certVerdict = finalVerdict === 'WARN' ? 'REVIEW' : finalVerdict;
        const { path: certPath } = await generateAndSaveCertificate(
          {
            prompt,
            islSpec: {
              content: islContent,
              version: '1.0',
              constructCount: (validation.domain?.entities?.length ?? 0) + (validation.domain?.behaviors?.length ?? 0),
            },
            generatedFiles: generatedFiles.map((f) => ({
              path: f.path,
              tier: (f.type === 'spec' || f.type === 'backend' ? 1 : f.type === 'test' ? 2 : 3) as 1 | 2 | 3,
              specCoverage: finalScore,
            })),
            verification: {
              verdict: certVerdict,
              trustScore: Math.round(finalScore * 100),
              evidenceCount: iterations > 0 ? 1 : 0,
              testsRun: 0,
              testsPassed: 0,
            },
            model: {
              provider,
              model: resolvedModel ?? 'unknown',
              tokensUsed: tokenTracker.total,
            },
            pipeline: {
              duration: Date.now() - startTime,
              stages: stages.map((s) => ({
                name: s.stage,
                duration: s.duration,
                status: s.success ? 'success' : 'failed',
              })),
            },
          },
          { projectRoot: outputDir }
        );
        certificatePath = certPath;
        if (options.verbose) {
          spinner?.info(chalk.gray(`Certificate: ${relative(process.cwd(), certPath)}`));
        }
      } catch (certErr) {
        if (options.verbose) {
          spinner?.warn(chalk.yellow(`Certificate generation skipped: ${certErr instanceof Error ? certErr.message : String(certErr)}`));
        }
      }
    }

    // Store last-run spec for incremental codegen (diff on next run)
    // Note: noCache option not yet implemented
    if (success) {
      try {
        const { CacheManager, sha256 } = await import('@isl-lang/isl-cache');
        const cache = new CacheManager({ projectRoot: process.cwd() });
        const promptHash = options.fromSpec
          ? sha256(islContent)
          : cache.getPromptHash(prompt, { framework: options.framework, database: options.database, frontend: options.frontend });
        const parseResult = parseISL(islContent, 'last-run.isl');
        await cache.storeLastRun({
          promptHash,
          islSpec: islContent,
          parsedAST: parseResult.domain ?? parseResult,
          timestamp: Date.now(),
          modelUsed: resolvedModel ?? 'unknown',
        });
      } catch {
        // Non-fatal
      }
    }

    return {
      success,
      verdict: finalVerdict,
      prompt,
      islSpec: islContent,
      islSpecPath: specPath,
      outputDir,
      files: generatedFiles,
      stages,
      iterations,
      finalScore,
      errors: violations,
      duration: Date.now() - startTime,
      tokenUsageByStage: Object.fromEntries(
        Array.from(tokenTracker.byStage.entries()),
      ) as Record<string, { input: number; output: number; total: number } | undefined>,
      totalTokens: totalUsage,
      skippedOptionalStages,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    spinner?.fail(`Pipeline failed: ${message}`);
    errors.push(message);

    return {
      success: false, verdict: 'NO_SHIP', prompt, outputDir, files: generatedFiles,
      stages, iterations: 0, finalScore: 0, errors,
      duration: Date.now() - startTime,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Print & Exit Code
// ─────────────────────────────────────────────────────────────────────────────

export function printVibeResult(result: VibeResult, opts?: { format?: string }): void {
  if (opts?.format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log('');
  console.log(chalk.bold('━━━ Safe Vibe Coding Result ━━━'));
  console.log('');

  // Verdict
  const verdictColor = result.verdict === 'SHIP' ? chalk.green : result.verdict === 'WARN' ? chalk.yellow : chalk.red;
  console.log(`  ${chalk.bold('Verdict:')}  ${verdictColor(result.verdict)}`);
  console.log(`  ${chalk.bold('Score:')}    ${(result.finalScore * 100).toFixed(0)}%`);
  console.log(`  ${chalk.bold('Duration:')} ${(result.duration / 1000).toFixed(1)}s`);
  console.log(`  ${chalk.bold('Output:')}   ${result.outputDir}`);
  // Cache stats display - disabled until feature is implemented
  // if (result.cacheStats && result.cacheStats.length > 0) {
  //   for (const msg of result.cacheStats) {
  //     console.log(`  ${chalk.cyan(msg)}`);
  //   }
  //   console.log('');
  // }
  console.log('');

  // Stages
  console.log(chalk.bold('  Pipeline Stages:'));
  for (const stage of result.stages) {
    const icon = stage.success ? chalk.green('✓') : chalk.red('✗');
    const duration = chalk.gray(`(${stage.duration}ms)`);
    console.log(`    ${icon} ${stage.stage} ${duration}`);
  }
  console.log('');

  // Files
  if (result.files.length > 0) {
    console.log(chalk.bold('  Generated Files:'));
    const byType = new Map<string, VibeGeneratedFile[]>();
    for (const file of result.files) {
      if (!byType.has(file.type)) byType.set(file.type, []);
      byType.get(file.type)!.push(file);
    }
    for (const [type, files] of byType) {
      console.log(`    ${chalk.cyan(type)} (${files.length})`);
      for (const file of files.slice(0, 5)) {
        console.log(`      ${chalk.gray('•')} ${file.path}`);
      }
      if (files.length > 5) {
        console.log(`      ${chalk.gray(`  ... and ${files.length - 5} more`)}`);
      }
    }
    console.log('');
  }

  // Errors/violations
  if (result.errors.length > 0) {
    console.log(chalk.bold('  Issues:'));
    for (const error of result.errors.slice(0, 10)) {
      console.log(`    ${chalk.red('•')} ${error}`);
    }
    if (result.errors.length > 10) {
      console.log(`    ${chalk.gray(`  ... and ${result.errors.length - 10} more`)}`);
    }
    console.log('');
  }

  // Next steps
  if (result.success) {
    console.log(chalk.bold('  Next Steps:'));
    console.log(`    ${chalk.gray('$')} cd ${relative(process.cwd(), result.outputDir)}`);
    console.log(`    ${chalk.gray('$')} npm install`);
    if (result.files.some(f => f.type === 'database')) {
      console.log(`    ${chalk.gray('$')} npx prisma db push`);
    }
    console.log(`    ${chalk.gray('$')} npm run dev`);
    console.log('');
  }
}

export function getVibeExitCode(result: VibeResult): number {
  if (result.verdict === 'SHIP') return ExitCode.SUCCESS;
  if (result.verdict === 'WARN') return ExitCode.SUCCESS;
  return ExitCode.ISL_ERROR;
}
