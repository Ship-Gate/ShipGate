/**
 * ISL Generate Command
 *
 * Generate ISL spec files from existing source code.
 *
 * Usage:
 *   isl isl-generate <path>                      # Generate ISL specs from source files
 *   isl isl-generate <path> --output <dir>       # Write to specific directory
 *   isl isl-generate <path> --dry-run            # Print specs to stdout
 *   isl isl-generate <path> --interactive        # Confirm before each write
 *   isl isl-generate <path> --overwrite          # Overwrite existing .isl files
 *   isl isl-generate <path> --force              # Generate even for low-confidence files
 */

import { readFile, writeFile, mkdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, relative, dirname, basename, extname } from 'path';
import { glob } from 'glob';
import chalk from 'chalk';
import ora from 'ora';
import { parse as parseISL } from '@isl-lang/parser';
import { ExitCode } from '../exit-codes.js';
import { isTTY } from '../utils.js';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ISL_GENERATE_VERSION = '0.1.0';

/** Extensions we can analyze */
const SUPPORTED_EXTENSIONS = ['.ts', '.js', '.py', '.go'] as const;
type SupportedExtension = typeof SUPPORTED_EXTENSIONS[number];

/** Map extensions to inference languages */
const EXTENSION_LANGUAGE_MAP: Record<string, 'typescript' | 'python'> = {
  '.ts': 'typescript',
  '.js': 'typescript',
  '.py': 'python',
  '.go': 'typescript', // Go files get basic analysis via TS parser
};

/** Default confidence threshold to generate a spec */
const DEFAULT_CONFIDENCE_THRESHOLD = 0.3;

/** Glob patterns to ignore when scanning */
const IGNORE_PATTERNS = [
  'node_modules/**',
  'dist/**',
  '.git/**',
  'coverage/**',
  '**/*.test.*',
  '**/*.spec.*',
  '**/*.d.ts',
  '**/__tests__/**',
  '**/__mocks__/**',
  '**/fixtures/**',
  '**/*.min.*',
];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface IslGenerateOptions {
  /** Output directory for generated .isl files (default: alongside source) */
  output?: string;
  /** Print specs to stdout instead of writing files */
  dryRun?: boolean;
  /** Ask for confirmation before each file write */
  interactive?: boolean;
  /** Overwrite existing .isl files (default: skip) */
  overwrite?: boolean;
  /** Generate even for low-confidence files */
  force?: boolean;
  /** Verbose output */
  verbose?: boolean;
  /** Output format */
  format?: string;
  /** Confidence threshold (0-1) for generating specs */
  confidenceThreshold?: number;
  /** Use AI enhancement */
  ai?: boolean;
}

/** Result for a single generated file */
export interface GeneratedFileEntry {
  /** Source file path (relative) */
  sourceFile: string;
  /** Output .isl file path (relative) */
  islFile: string;
  /** Detected patterns */
  patterns: DetectedPattern[];
  /** Overall confidence for this file */
  confidence: number;
  /** Whether the file was written */
  written: boolean;
  /** Reason if skipped */
  skipReason?: string;
  /** Generated ISL content (for dry-run) */
  islContent?: string;
  /** Parse validation passed */
  parseValid: boolean;
  /** Parse errors (if any) */
  parseErrors: string[];
}

/** A detected pattern in a source file */
export interface DetectedPattern {
  /** Pattern name (e.g. "auth-login", "jwt-creation") */
  name: string;
  /** Confidence score 0-1 */
  confidence: number;
}

/** Overall result of the generate command */
export interface IslGenerateResult {
  /** Whether the command succeeded */
  success: boolean;
  /** Total source files scanned */
  scannedCount: number;
  /** Files that produced ISL specs */
  generatedCount: number;
  /** Files skipped (low confidence, existing, etc.) */
  skippedCount: number;
  /** Per-file results */
  files: GeneratedFileEntry[];
  /** Global errors */
  errors: string[];
  /** Duration in milliseconds */
  duration: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// File Scanning
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scan a path for supported source files.
 */
async function scanSourceFiles(targetPath: string): Promise<string[]> {
  const absPath = resolve(targetPath);

  // Check if it's a single file
  if (existsSync(absPath)) {
    const fileStat = await stat(absPath);
    if (fileStat.isFile()) {
      const ext = extname(absPath);
      if (SUPPORTED_EXTENSIONS.includes(ext as SupportedExtension)) {
        return [absPath];
      }
      return [];
    }
  }

  // Scan directory
  const extensionGlob = `**/*.{${SUPPORTED_EXTENSIONS.map((e) => e.slice(1)).join(',')}}`;
  const files = await glob(extensionGlob, {
    cwd: absPath,
    ignore: IGNORE_PATTERNS,
    absolute: true,
  });

  return files.sort();
}

/**
 * Compute the output .isl path for a source file.
 */
function computeIslPath(
  sourceFile: string,
  targetPath: string,
  outputDir?: string,
): string {
  const relPath = relative(resolve(targetPath), sourceFile);
  const baseName = basename(sourceFile, extname(sourceFile));

  if (outputDir) {
    return resolve(outputDir, dirname(relPath), `${baseName}.isl`);
  }

  return resolve(dirname(sourceFile), `${baseName}.isl`);
}

/**
 * Detect the language from a file extension.
 */
function detectLanguage(filePath: string): 'typescript' | 'python' {
  const ext = extname(filePath);
  return EXTENSION_LANGUAGE_MAP[ext] ?? 'typescript';
}

/**
 * Derive a domain name from a file path.
 * e.g. "src/auth/login.ts" -> "AuthLogin"
 */
function deriveDomainName(filePath: string): string {
  const base = basename(filePath, extname(filePath));
  // Convert kebab-case/snake_case to PascalCase
  return base
    .split(/[-_.]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * Infer patterns from file analysis.
 * Maps extracted functions/types to human-readable pattern names.
 */
function inferPatterns(
  functions: Array<{ name: string }>,
  types: Array<{ name: string }>,
  fileName: string,
): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const lowerName = fileName.toLowerCase();

  // Auth patterns
  if (lowerName.includes('auth') || lowerName.includes('login')) {
    patterns.push({ name: 'auth-login', confidence: 0.82 });
  }
  if (lowerName.includes('register') || lowerName.includes('signup')) {
    patterns.push({ name: 'user-registration', confidence: 0.78 });
  }

  // JWT patterns
  const hasJwt = functions.some(
    (f) =>
      f.name.toLowerCase().includes('token') ||
      f.name.toLowerCase().includes('jwt'),
  );
  if (hasJwt) {
    patterns.push({ name: 'jwt-creation', confidence: 0.75 });
  }

  // CRUD patterns
  const hasCrud = functions.some(
    (f) =>
      f.name.toLowerCase().startsWith('create') ||
      f.name.toLowerCase().startsWith('update') ||
      f.name.toLowerCase().startsWith('delete'),
  );
  if (hasCrud) {
    const crudTarget = types.length > 0 ? types[0].name.toLowerCase() : 'resource';
    patterns.push({ name: `${crudTarget}-crud`, confidence: 0.71 });
  }

  // User creation
  if (
    lowerName.includes('user') &&
    functions.some((f) => f.name.toLowerCase().includes('create'))
  ) {
    patterns.push({ name: 'user-creation', confidence: 0.71 });
  }

  // Payment patterns
  if (lowerName.includes('payment') || lowerName.includes('charge')) {
    patterns.push({ name: 'payment-processing', confidence: 0.68 });
  }

  // Rate limiting
  if (lowerName.includes('rate') || lowerName.includes('limit')) {
    patterns.push({ name: 'rate-limiting', confidence: 0.65 });
  }

  // Generic pattern from functions
  if (patterns.length === 0 && functions.length > 0) {
    const primaryFn = functions[0].name;
    const confidence = 0.4 + Math.min(functions.length * 0.05, 0.3);
    patterns.push({ name: `${primaryFn}-pattern`, confidence });
  }

  return patterns;
}

// ─────────────────────────────────────────────────────────────────────────────
// ISL Header Generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Prepend the standard header comment to generated ISL content.
 */
function addIslHeader(
  islContent: string,
  sourceFile: string,
  confidence: number,
): string {
  const header = [
    `// Generated by ShipGate ISL v${ISL_GENERATE_VERSION}`,
    `// Source: ${sourceFile}`,
    `// Confidence: ${confidence.toFixed(2)}`,
    '// Review this spec and adjust before committing.',
    '// Docs: https://shipgate.dev/docs/isl',
    '',
  ].join('\n');

  return header + islContent;
}

// ─────────────────────────────────────────────────────────────────────────────
// Interactive Prompt
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ask a yes/no question on stdin (for --interactive mode).
 */
async function askConfirmation(question: string): Promise<boolean> {
  if (!isTTY()) {
    return true; // Auto-confirm in non-TTY
  }

  return new Promise((resolvePromise) => {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr,
    });

    rl.question(`${question} [y/N] `, (answer: string) => {
      rl.close();
      resolvePromise(answer.trim().toLowerCase() === 'y');
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Generate Logic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate ISL spec files from existing source code.
 */
export async function islGenerate(
  targetPath: string,
  options: IslGenerateOptions,
): Promise<IslGenerateResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const fileResults: GeneratedFileEntry[] = [];
  const confidenceThreshold =
    options.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;

  const spinner = options.dryRun ? null : ora('Scanning source files...').start();

  // ── Step 1: Scan for source files ─────────────────────────────────────────
  let sourceFiles: string[];
  try {
    sourceFiles = await scanSourceFiles(targetPath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Failed to scan path: ${msg}`);
    spinner?.fail('Failed to scan source files');
    return {
      success: false,
      scannedCount: 0,
      generatedCount: 0,
      skippedCount: 0,
      files: [],
      errors,
      duration: Date.now() - startTime,
    };
  }

  if (sourceFiles.length === 0) {
    spinner?.warn('No supported source files found');
    return {
      success: true,
      scannedCount: 0,
      generatedCount: 0,
      skippedCount: 0,
      files: [],
      errors: [],
      duration: Date.now() - startTime,
    };
  }

  spinner?.succeed(`Found ${sourceFiles.length} source file(s)`);

  // ── Step 2: Dynamically import the inference engine ───────────────────────
  let inferEngine: any | null = null;
  try {
    // Inference module not available
    throw new Error('Inference module not available');
  } catch {
    // Inference package not available — we'll use a lightweight fallback
    if (options.verbose) {
      process.stderr.write(
        chalk.gray(
          '[debug] @isl-lang/inference not available, using lightweight analysis\n',
        ),
      );
    }
  }

  // ── Step 3: Process each source file ──────────────────────────────────────
  let generatedCount = 0;
  let skippedCount = 0;

  for (const sourceFile of sourceFiles) {
    const relSource = relative(process.cwd(), sourceFile);
    const islPath = computeIslPath(sourceFile, targetPath, options.output);
    const relIsl = relative(process.cwd(), islPath);
    const language = detectLanguage(sourceFile);
    const domainName = deriveDomainName(sourceFile);

    if (!options.dryRun) {
      process.stderr.write(chalk.gray(`Analyzing ${relSource}...\n`));
    }

    // ── 3a: Check if .isl already exists ──────────────────────────────────
    if (!options.overwrite && existsSync(islPath)) {
      skippedCount++;
      fileResults.push({
        sourceFile: relSource,
        islFile: relIsl,
        patterns: [],
        confidence: 0,
        written: false,
        skipReason: 'ISL file already exists (use --overwrite to replace)',
        parseValid: false,
        parseErrors: [],
      });
      if (!options.dryRun) {
        process.stderr.write(
          chalk.yellow(`  ⚠ Skipped: ${relIsl} already exists\n`),
        );
      }
      continue;
    }

    // ── 3b: Infer spec ──────────────────────────────────────────────────
    let islContent: string;
    let confidence: number;
    let patterns: DetectedPattern[];

    try {
      // Use the full inference engine
      // const result = await inferEngine.infer({
      //   language,
      //   sourceFiles: [sourceFile],
      //   domainName,
      //   inferInvariants: true,
      //   confidenceThreshold: 0, // We handle thresholding ourselves
      //   useAI: options.ai,
      // });

      // islContent = result.isl;
      // confidence = result.confidence.overall;

      // Derive patterns from the inference result
      // patterns = inferPatterns(
      //   result.parsed.functions,
      //   result.parsed.types,
      //   basename(sourceFile),
      // );

      // Use more granular confidence from functions/behaviors
      // if (result.confidence.behaviors.size > 0) {
      //   const behaviorScores = Array.from(result.confidence.behaviors.values());
      //   confidence = Math.max(
      //     confidence,
      //     behaviorScores.reduce((a, b) => a + b, 0) / behaviorScores.length,
      //   );
      // }

      // Lightweight fallback: read source and generate minimal spec
      const source = await readFile(sourceFile, 'utf-8');
      const result = generateMinimalSpec(source, domainName, relSource);
      islContent = result.isl;
      confidence = result.confidence;
      patterns = result.patterns;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to analyze ${relSource}: ${msg}`);
      skippedCount++;
      fileResults.push({
        sourceFile: relSource,
        islFile: relIsl,
        patterns: [],
        confidence: 0,
        written: false,
        skipReason: `Analysis failed: ${msg}`,
        parseValid: false,
        parseErrors: [],
      });
      continue;
    }

    // ── 3c: Print detected patterns ─────────────────────────────────────
    for (const pattern of patterns) {
      if (!options.dryRun) {
        const icon = pattern.confidence >= confidenceThreshold
          ? chalk.green('✓')
          : chalk.yellow('⚠');
        process.stderr.write(
          `  ${icon} Detected: ${pattern.name} pattern (confidence: ${pattern.confidence.toFixed(2)})\n`,
        );
      }
    }

    // ── 3d: Check confidence threshold ──────────────────────────────────
    if (confidence < confidenceThreshold && !options.force) {
      skippedCount++;
      fileResults.push({
        sourceFile: relSource,
        islFile: relIsl,
        patterns,
        confidence,
        written: false,
        skipReason: `Low confidence (${confidence.toFixed(2)})`,
        parseValid: false,
        parseErrors: [],
      });
      if (!options.dryRun) {
        process.stderr.write(
          chalk.yellow(
            `  ⚠ Low confidence (${confidence.toFixed(2)}) — skipped\n`,
          ),
        );
        process.stderr.write(
          chalk.gray('  → Run with --force to generate anyway\n'),
        );
      }
      continue;
    }

    // ── 3e: Add header and validate through parser ──────────────────────
    const fullIsl = addIslHeader(islContent, relSource, confidence);
    const parseResult = parseISL(fullIsl, relIsl);
    const parseValid = parseResult.success !== false && (!parseResult.errors || parseResult.errors.length === 0);
    const parseErrors = parseResult.errors
      ? parseResult.errors.map(
          (e: { message: string }) => e.message,
        )
      : [];

    if (!parseValid) {
      // If parse fails, try without header (comment syntax may differ)
      const fallbackResult = parseISL(islContent, relIsl);
      const fallbackValid = fallbackResult.success !== false && (!fallbackResult.errors || fallbackResult.errors.length === 0);

      if (!fallbackValid) {
        errors.push(
          `Generated ISL for ${relSource} has parse errors: ${parseErrors.join('; ')}`,
        );
        skippedCount++;
        fileResults.push({
          sourceFile: relSource,
          islFile: relIsl,
          patterns,
          confidence,
          written: false,
          skipReason: 'Generated spec has parse errors',
          parseValid: false,
          parseErrors,
        });
        if (!options.dryRun) {
          process.stderr.write(
            chalk.red(`  ✗ Parse errors in generated spec — skipped\n`),
          );
          if (options.verbose) {
            for (const pe of parseErrors) {
              process.stderr.write(chalk.red(`    ${pe}\n`));
            }
          }
        }
        continue;
      }
    }

    // ── 3f: Dry-run mode → print to stdout ──────────────────────────────
    if (options.dryRun) {
      generatedCount++;
      fileResults.push({
        sourceFile: relSource,
        islFile: relIsl,
        patterns,
        confidence,
        written: false,
        islContent: fullIsl,
        parseValid: true,
        parseErrors: [],
      });
      process.stdout.write(`\n${'─'.repeat(60)}\n`);
      process.stdout.write(chalk.bold(`# ${relIsl}\n`));
      process.stdout.write(`${'─'.repeat(60)}\n`);
      process.stdout.write(fullIsl);
      process.stdout.write('\n');
      continue;
    }

    // ── 3g: Interactive mode → ask before writing ───────────────────────
    if (options.interactive) {
      const confirmed = await askConfirmation(
        chalk.cyan(`  Write ${relIsl}?`),
      );
      if (!confirmed) {
        skippedCount++;
        fileResults.push({
          sourceFile: relSource,
          islFile: relIsl,
          patterns,
          confidence,
          written: false,
          skipReason: 'Skipped by user',
          parseValid: true,
          parseErrors: [],
        });
        process.stderr.write(chalk.gray('  → Skipped\n'));
        continue;
      }
    }

    // ── 3h: Write the .isl file ─────────────────────────────────────────
    try {
      const outputDir = dirname(islPath);
      if (!existsSync(outputDir)) {
        await mkdir(outputDir, { recursive: true });
      }
      await writeFile(islPath, fullIsl, 'utf-8');

      generatedCount++;
      fileResults.push({
        sourceFile: relSource,
        islFile: relIsl,
        patterns,
        confidence,
        written: true,
        parseValid: true,
        parseErrors: [],
      });
      process.stderr.write(chalk.green(`  → Generated: ${relIsl}\n`));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to write ${relIsl}: ${msg}`);
      skippedCount++;
      fileResults.push({
        sourceFile: relSource,
        islFile: relIsl,
        patterns,
        confidence,
        written: false,
        skipReason: `Write failed: ${msg}`,
        parseValid: true,
        parseErrors: [],
      });
    }
  }

  return {
    success: errors.length === 0,
    scannedCount: sourceFiles.length,
    generatedCount,
    skippedCount,
    files: fileResults,
    errors,
    duration: Date.now() - startTime,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Lightweight Fallback (when @isl-lang/inference is not available)
// ─────────────────────────────────────────────────────────────────────────────

// ── Signature extraction types ───────────────────────────────────────────────

interface ExtractedParam {
  name: string;
  type: string;
}

interface ExtractedFunction {
  name: string;
  isAsync: boolean;
  params: ExtractedParam[];
  returnType: string;
  throws: string[];
  effects: string[];
}

/**
 * Map a TypeScript type annotation to the closest ISL primitive.
 */
function tsTypeToIsl(tsType: string): string {
  const trimmed = tsType.trim();
  if (!trimmed || trimmed === 'any' || trimmed === 'unknown') return 'String';
  if (trimmed === 'string') return 'String';
  if (trimmed === 'number' || trimmed === 'bigint') return 'Int';
  if (trimmed === 'boolean') return 'Boolean';
  if (trimmed === 'void' || trimmed === 'undefined' || trimmed === 'never') return 'Void';
  if (trimmed === 'null') return 'Void';
  if (trimmed.endsWith('[]') || trimmed.startsWith('Array<')) return 'List';
  if (trimmed.startsWith('Promise<')) {
    const inner = trimmed.slice(8, -1);
    return tsTypeToIsl(inner);
  }
  if (trimmed.startsWith('Record<') || trimmed.startsWith('Map<') || trimmed === 'object') return 'Map';
  if (trimmed === 'Date') return 'DateTime';
  if (trimmed === 'Buffer' || trimmed === 'Uint8Array') return 'Bytes';
  if (/^[A-Z]\w*$/.test(trimmed)) return trimmed;
  return 'String';
}

/**
 * Extract function signatures with full type information from TS/JS source.
 */
function extractSignaturesForGen(source: string): {
  functions: ExtractedFunction[];
  types: string[];
} {
  const functions: ExtractedFunction[] = [];
  const types: string[] = [];

  const fnFullRegex = /export\s+(async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)\s*(?::\s*([^{]+?))?\s*\{/g;
  let match: RegExpExecArray | null;
  const seenFns = new Set<string>();

  while ((match = fnFullRegex.exec(source)) !== null) {
    const isAsync = !!match[1];
    const name = match[2];
    if (seenFns.has(name)) continue;
    seenFns.add(name);

    const rawParams = match[3].trim();
    const rawReturn = match[4]?.trim() ?? '';
    const params = parseParamListGen(rawParams);
    const returnType = rawReturn ? tsTypeToIsl(rawReturn) : (isAsync ? 'String' : 'Void');

    const fnStart = match.index! + match[0].length - 1;
    const fnBody = extractBracedBlockGen(source, fnStart);

    const throws = detectThrowsGen(fnBody);
    const effects = detectEffectsGen(fnBody);

    functions.push({ name, isAsync, params, returnType, throws, effects });
  }

  // Fallback: non-exported functions
  if (functions.length === 0) {
    const anyFnRegex = /(async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)\s*(?::\s*([^{]+?))?\s*\{/g;
    while ((match = anyFnRegex.exec(source)) !== null) {
      const isAsync = !!match[1];
      const name = match[2];
      if (seenFns.has(name)) continue;
      seenFns.add(name);

      const rawParams = match[3].trim();
      const rawReturn = match[4]?.trim() ?? '';
      const params = parseParamListGen(rawParams);
      const returnType = rawReturn ? tsTypeToIsl(rawReturn) : (isAsync ? 'String' : 'Void');

      const fnStart = match.index! + match[0].length - 1;
      const fnBody = extractBracedBlockGen(source, fnStart);
      const throws = detectThrowsGen(fnBody);
      const effects = detectEffectsGen(fnBody);

      functions.push({ name, isAsync, params, returnType, throws, effects });
    }
  }

  const typeRegex = /export\s+(?:interface|class|type)\s+(\w+)/g;
  while ((match = typeRegex.exec(source)) !== null) {
    types.push(match[1]);
  }
  if (types.length === 0) {
    const anyTypeRegex = /(?:interface|class)\s+(\w+)/g;
    while ((match = anyTypeRegex.exec(source)) !== null) {
      types.push(match[1]);
    }
  }

  return { functions, types };
}

function parseParamListGen(raw: string): ExtractedParam[] {
  if (!raw) return [];
  const params: ExtractedParam[] = [];
  let depth = 0;
  let current = '';
  for (const ch of raw) {
    if (ch === '<' || ch === '(' || ch === '{' || ch === '[') depth++;
    else if (ch === '>' || ch === ')' || ch === '}' || ch === ']') depth--;
    else if (ch === ',' && depth === 0) {
      params.push(parseOneParamGen(current.trim()));
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) params.push(parseOneParamGen(current.trim()));
  return params.filter((p) => p.name && p.name !== '');
}

function parseOneParamGen(raw: string): ExtractedParam {
  if (raw.startsWith('{')) {
    const colonIdx = raw.lastIndexOf(':');
    if (colonIdx > raw.indexOf('}')) {
      return { name: 'options', type: tsTypeToIsl(raw.slice(colonIdx + 1).trim()) };
    }
    return { name: 'options', type: 'Map' };
  }
  if (raw.startsWith('...')) {
    raw = raw.slice(3);
  }
  const optional = raw.includes('?:');
  const parts = raw.split(/\??:/);
  const name = parts[0].split('=')[0].trim();
  let type = 'String';
  if (parts.length > 1) {
    type = tsTypeToIsl(parts[1].split('=')[0].trim());
  }
  if (optional) type += '?';
  return { name, type };
}

function extractBracedBlockGen(source: string, startIdx: number): string {
  if (source[startIdx] !== '{') return '';
  let depth = 0;
  let end = startIdx;
  for (let i = startIdx; i < source.length && i < startIdx + 5000; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  return source.slice(startIdx, end + 1);
}

function detectThrowsGen(body: string): string[] {
  const throws: string[] = [];
  const seen = new Set<string>();

  const throwNewRegex = /throw\s+new\s+(\w+)/g;
  let m: RegExpExecArray | null;
  while ((m = throwNewRegex.exec(body)) !== null) {
    const name = m[1];
    if (!seen.has(name)) { seen.add(name); throws.push(name); }
  }

  if (throws.length === 0 && /throw\s+(?!new\b)/.test(body)) {
    throws.push('Error');
  }

  return throws;
}

function detectEffectsGen(body: string): string[] {
  const effects: string[] = [];

  if (/\bconsole\.\w+\s*\(/.test(body)) effects.push('logging');
  if (/\bfetch\s*\(/.test(body) || /\baxios[\s.]/.test(body) || /\.request\s*\(/.test(body)) effects.push('network');
  if (/\bfs\b|\breadFile\b|\bwriteFile\b|\bmkdir\b|\bunlink\b/.test(body)) effects.push('filesystem');
  if (/\b(?:query|execute|findOne|findMany|insert|update|delete|upsert)\s*\(/.test(body)) effects.push('database');
  if (/\bprocess\.env\b/.test(body)) effects.push('env_read');
  if (/\bprocess\.exit\b/.test(body)) effects.push('process_exit');
  if (/\bemit\s*\(|\bdispatch\s*\(|\bpublish\s*\(/.test(body)) effects.push('event_emit');
  if (/\bsetTimeout\s*\(|\bsetInterval\s*\(/.test(body)) effects.push('timer');
  if (/\bMath\.random\s*\(|\bcrypto\b/.test(body)) effects.push('nondeterminism');

  return effects;
}

// ── Spec generation ──────────────────────────────────────────────────────────

interface MinimalSpecResult {
  isl: string;
  confidence: number;
  patterns: DetectedPattern[];
}

/**
 * Generate a signature-faithful ISL spec from source code without the inference engine.
 * Extracts exact function names, param types, return types, throws, and effects.
 * Specs with no business rules are marked INCOMPLETE with capped confidence.
 */
function generateMinimalSpec(
  source: string,
  domainName: string,
  sourceFile: string,
): MinimalSpecResult {
  const lines: string[] = [];
  const patterns: DetectedPattern[] = [];
  let confidence = 0.3;

  // Extract full signatures
  const { functions, types } = extractSignaturesForGen(source);

  // Detect patterns (uses name-only interface expected by inferPatterns)
  patterns.push(
    ...inferPatterns(
      functions.map((f) => ({ name: f.name })),
      types.map((t) => ({ name: t })),
      basename(sourceFile),
    ),
  );

  // Adjust confidence based on what we found
  if (functions.length > 0) confidence += 0.15;
  if (types.length > 0) confidence += 0.1;
  if (functions.length >= 3) confidence += 0.1;
  confidence = Math.min(1, confidence);

  // No business rules in auto-generated specs → INCOMPLETE, cap confidence
  confidence = Math.min(confidence, 0.5);

  // Generate spec
  lines.push('# STATUS: INCOMPLETE — auto-generated typed contract scaffold');
  lines.push('# This spec captures exact signatures but has no business rules.');
  lines.push('# Add invariants, preconditions, and postconditions to complete it.');
  lines.push('');
  lines.push(`domain ${domainName} {`);
  lines.push('  version: "1.0.0"');
  lines.push('');

  // Generate entities from types
  if (types.length > 0) {
    lines.push('  # Entities');
    for (const t of types) {
      lines.push('');
      lines.push(`  entity ${t} {`);
      lines.push(`    id: String`);
      lines.push('  }');
    }
    lines.push('');
  }

  // Generate behaviors from functions with full signature fidelity
  if (functions.length > 0) {
    lines.push('  # Behaviors');
    for (const fn of functions) {
      lines.push('');
      lines.push(`  behavior ${fn.name} {`);

      // Input: exact params
      lines.push('    input {');
      if (fn.params.length > 0) {
        for (const p of fn.params) {
          lines.push(`      ${p.name}: ${p.type}`);
        }
      }
      lines.push('    }');
      lines.push('');

      // Output: exact return type + errors from throws
      lines.push('    output {');
      lines.push(`      success: ${fn.returnType}`);
      if (fn.throws.length > 0) {
        lines.push('');
        lines.push('      errors {');
        for (const errName of fn.throws) {
          lines.push(`        ${errName} {`);
          lines.push(`          when: "inferred from throw statement"`);
          lines.push('        }');
        }
        lines.push('      }');
      }
      lines.push('    }');

      // Effects as comments (not a parser keyword)
      if (fn.effects.length > 0) {
        lines.push('');
        lines.push(`    # effects: ${fn.effects.join(', ')}`);
      }

      lines.push('');
      lines.push('    invariants {');
      lines.push(`      - ${fn.name} never_throws_unhandled`);
      lines.push('    }');
      lines.push('  }');
    }
  }

  lines.push('}');
  lines.push('');

  return {
    isl: lines.join('\n'),
    confidence,
    patterns,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Output Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Print the generate result summary.
 */
export function printIslGenerateResult(
  result: IslGenerateResult,
  options: { format?: string; verbose?: boolean } = {},
): void {
  // JSON output
  if (options.format === 'json') {
    const payload = {
      success: result.success,
      scannedCount: result.scannedCount,
      generatedCount: result.generatedCount,
      skippedCount: result.skippedCount,
      files: result.files.map((f) => ({
        sourceFile: f.sourceFile,
        islFile: f.islFile,
        patterns: f.patterns,
        confidence: f.confidence,
        written: f.written,
        skipReason: f.skipReason ?? null,
        parseValid: f.parseValid,
        parseErrors: f.parseErrors,
      })),
      errors: result.errors,
      duration: result.duration,
    };
    process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
    return;
  }

  // Pretty output
  process.stderr.write('\n');

  if (result.generatedCount === 0 && result.scannedCount === 0) {
    process.stderr.write(chalk.yellow('No source files found to analyze.\n'));
    return;
  }

  // Summary
  if (result.generatedCount > 0) {
    process.stderr.write(
      chalk.bold.green(
        `Generated ${result.generatedCount} ISL spec${result.generatedCount === 1 ? '' : 's'}.`,
      ) + ' ',
    );
  } else {
    process.stderr.write(chalk.yellow('No ISL specs generated. '));
  }

  if (result.skippedCount > 0) {
    process.stderr.write(
      chalk.gray(`(${result.skippedCount} skipped)`),
    );
  }
  process.stderr.write('\n');

  // Git add hint
  const writtenFiles = result.files.filter((f) => f.written);
  if (writtenFiles.length > 0) {
    const dirs = [...new Set(writtenFiles.map((f) => dirname(f.islFile)))];
    process.stderr.write(chalk.gray('Review and commit:\n'));
    for (const dir of dirs) {
      process.stderr.write(chalk.cyan(`  git add ${dir}/*.isl\n`));
    }
  }

  // Errors
  if (result.errors.length > 0 && options.verbose) {
    process.stderr.write('\n');
    process.stderr.write(chalk.red.bold('Errors:\n'));
    for (const err of result.errors) {
      process.stderr.write(chalk.red(`  • ${err}\n`));
    }
  }

  process.stderr.write(chalk.gray(`\nCompleted in ${result.duration}ms\n`));
}

/**
 * Get the exit code for the generate result.
 */
export function getIslGenerateExitCode(result: IslGenerateResult): number {
  if (result.errors.length > 0) return ExitCode.ISL_ERROR;
  return ExitCode.SUCCESS;
}
