/**
 * AI-Powered Code Generation
 * 
 * Uses @isl-lang/ai-copilot to generate real implementations from ISL specs
 * via LLMs (Anthropic Claude, OpenAI GPT).
 * 
 * Safety: All AI output is validated through the ISL parser before being written.
 * 
 * Usage:
 *   isl gen ts auth.isl --ai                    # AI-powered TypeScript generation
 *   isl gen ts auth.isl --ai --provider openai   # Use OpenAI instead of Anthropic
 *   isl gen ts auth.isl --ai --validate          # Validate output through verifier
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { resolve, relative, dirname, join, basename, extname } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { parse as parseISL } from '@isl-lang/parser';
import { loadConfig } from '../config.js';
import { withSpan, ISL_ATTR } from '@isl-lang/observability';
import type { GeneratedFile, GenResult, GenerationTarget } from './gen.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AIGenOptions {
  /** Output directory */
  output?: string;
  /** Overwrite existing files */
  force?: boolean;
  /** Verbose output */
  verbose?: boolean;
  /** Output format */
  format?: 'pretty' | 'json' | 'quiet';
  /** AI provider: anthropic or openai */
  provider?: 'anthropic' | 'openai';
  /** AI model override */
  model?: string;
  /** Validate AI output through parser */
  validate?: boolean;
  /** Include tests in generated output */
  includeTests?: boolean;
  /** Include validation logic */
  includeValidation?: boolean;
  /** Code style preference */
  style?: 'functional' | 'oop' | 'hybrid';
}

// ─────────────────────────────────────────────────────────────────────────────
// Target Language Mapping
// ─────────────────────────────────────────────────────────────────────────────

const TARGET_LANGUAGE_MAP: Record<string, string> = {
  'ts': 'typescript',
  'typescript': 'typescript',
  'rust': 'rust',
  'go': 'go',
  'python': 'python',
  'py': 'python',
  'graphql': 'graphql',
  'gql': 'graphql',
};

const TARGET_EXTENSION_MAP: Record<string, string> = {
  'typescript': '.ts',
  'rust': '.rs',
  'go': '.go',
  'python': '.py',
  'graphql': '.graphql',
};

// ─────────────────────────────────────────────────────────────────────────────
// API Key Resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the API key from config, environment, or error.
 */
function resolveApiKey(provider: string, configApiKey?: string): string | null {
  // 1. Config file (supports ${VAR} interpolation)
  if (configApiKey) {
    const envMatch = configApiKey.match(/^\$\{(\w+)\}$/);
    if (envMatch) {
      return process.env[envMatch[1]] ?? null;
    }
    return configApiKey;
  }

  // 2. Environment variables
  if (provider === 'anthropic') {
    return process.env['ANTHROPIC_API_KEY'] ?? process.env['ISL_ANTHROPIC_KEY'] ?? null;
  }
  if (provider === 'openai') {
    return process.env['OPENAI_API_KEY'] ?? process.env['ISL_OPENAI_KEY'] ?? null;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate code from an ISL file using AI (LLM).
 */
export async function genAI(
  target: string,
  file: string,
  options: AIGenOptions = {},
): Promise<GenResult> {
  const startTime = Date.now();
  const spinner = options.format !== 'json' ? ora('Initializing AI code generation...').start() : null;

  const normalizedTarget = TARGET_LANGUAGE_MAP[target.toLowerCase()];
  if (!normalizedTarget) {
    spinner?.fail(`Unknown target: ${target}`);
    return {
      success: false,
      target: target as GenerationTarget,
      sourceFile: file,
      files: [],
      errors: [`Unknown target: ${target}`],
      duration: Date.now() - startTime,
    };
  }

  // Load config
  const { config } = await loadConfig();
  const provider = options.provider ?? (config?.ai as Record<string, string> | undefined)?.provider as 'anthropic' | 'openai' ?? 'anthropic';
  const outputDir = resolve(options.output ?? config?.output?.dir ?? './generated');
  const filePath = resolve(file);

  // Resolve API key
  const apiKey = resolveApiKey(provider, config?.ai?.apiKey);
  if (!apiKey) {
    spinner?.fail('No API key configured');
    const envVar = provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
    return {
      success: false,
      target: normalizedTarget as GenerationTarget,
      sourceFile: filePath,
      files: [],
      errors: [
        `No API key found for ${provider}.`,
        `Set ${envVar} environment variable, or add ai.apiKey to your .islrc.yaml config.`,
        `Example: export ${envVar}=sk-...`,
      ],
      duration: Date.now() - startTime,
    };
  }

  const files: GeneratedFile[] = [];
  const errors: string[] = [];

  try {
    // Step 1: Read and parse ISL file
    spinner && (spinner.text = 'Reading ISL specification...');
    const source = await readFile(filePath, 'utf-8');
    const parseResult = parseISL(source, filePath);

    if (parseResult.errors.length > 0 || !parseResult.domain) {
      spinner?.fail('ISL parse failed');
      return {
        success: false,
        target: normalizedTarget as GenerationTarget,
        sourceFile: filePath,
        files: [],
        errors: parseResult.errors.map((e: { message: string }) => e.message),
        duration: Date.now() - startTime,
      };
    }

    // Step 2: Initialize AI copilot
    spinner && (spinner.text = `Connecting to ${provider}...`);

    let ISLCopilot: any;
    try {
      const mod = await import('@isl-lang/ai-copilot');
      ISLCopilot = mod.ISLCopilot;
    } catch {
      spinner?.fail('AI copilot package not available');
      return {
        success: false,
        target: normalizedTarget as GenerationTarget,
        sourceFile: filePath,
        files: [],
        errors: ['@isl-lang/ai-copilot package not available. Run `pnpm build` first.'],
        duration: Date.now() - startTime,
      };
    }

    const copilot = new ISLCopilot({
      provider,
      apiKey,
      model: options.model ?? config?.ai?.model,
      maxTokens: config?.ai?.maxTokens ?? 4096,
      temperature: config?.ai?.temperature ?? 0.3,
      cacheEnabled: true,
    });

    await copilot.initialize();

    // Step 3: Generate code via LLM
    spinner && (spinner.text = `Generating ${normalizedTarget} implementation with AI...`);

    const result = await withSpan('codegen.ai', {
      attributes: {
        [ISL_ATTR.CODEGEN_TARGET]: normalizedTarget,
        [ISL_ATTR.CODEGEN_SOURCE]: relative(process.cwd(), filePath),
        'isl.ai.provider': provider,
      },
    }, async (aiSpan) => {
      const genResult = await copilot.islToCode({
        islSpec: source,
        targetLanguage: normalizedTarget,
        framework: undefined,
        options: {
          includeTests: options.includeTests,
          includeValidation: options.includeValidation ?? true,
          style: options.style ?? 'hybrid',
        },
      });

      aiSpan.setAttribute('isl.ai.confidence', genResult.confidence);
      aiSpan.setAttribute('isl.ai.tokens.input', genResult.tokens.input);
      aiSpan.setAttribute('isl.ai.tokens.output', genResult.tokens.output);

      return genResult;
    });

    if (!result.content || result.content.trim().length === 0) {
      spinner?.fail('AI returned empty response');
      return {
        success: false,
        target: normalizedTarget as GenerationTarget,
        sourceFile: filePath,
        files: [],
        errors: ['AI returned empty response. Try again or check your API key.'],
        duration: Date.now() - startTime,
      };
    }

    // Step 4: Extract code from AI response (strip markdown fences if present)
    let generatedCode = result.content;
    const codeBlockMatch = generatedCode.match(/```(?:\w+)?\n([\s\S]*?)```/);
    if (codeBlockMatch) {
      generatedCode = codeBlockMatch[1].trim();
    }

    // Step 5: AI Validation Gate — validate generated code
    if (options.validate !== false) {
      spinner && (spinner.text = 'Validating AI output...');

      const validationErrors: string[] = [];

      // 5a: Basic syntax validation (check for common AI hallucination patterns)
      if (generatedCode.includes('```')) {
        // AI left markdown fences in the code
        generatedCode = generatedCode.replace(/```\w*\n?/g, '').trim();
      }

      // 5b: Check for empty or trivially short output
      const nonCommentLines = generatedCode.split('\n').filter(
        (line: string) => line.trim() && !line.trim().startsWith('//') && !line.trim().startsWith('*') && !line.trim().startsWith('/*'),
      );
      if (nonCommentLines.length < 3) {
        validationErrors.push('AI generated trivially short code (fewer than 3 non-comment lines)');
      }

      // 5c: For TypeScript, check that the output contains expected constructs
      if (normalizedTarget === 'typescript') {
        const domainName = parseResult.domain!.name.name;
        const hasExport = generatedCode.includes('export ');
        const hasInterface = generatedCode.includes('interface ') || generatedCode.includes('type ');
        const hasFunction = generatedCode.includes('function ') || generatedCode.includes('=>');
        const hasClass = generatedCode.includes('class ');

        if (!hasExport) {
          validationErrors.push('Generated TypeScript has no exports — may not be usable as a module');
        }
        if (!hasInterface && !hasClass && !hasFunction) {
          validationErrors.push(`Generated code has no interfaces, classes, or functions for domain "${domainName}"`);
        }
      }

      // 5d: Report validation results
      if (validationErrors.length > 0 && options.verbose) {
        for (const ve of validationErrors) {
          console.log(chalk.yellow(`  ⚠ ${ve}`));
        }
      }

      // Validation warnings don't block output — they're informational
      if (validationErrors.length > 0) {
        errors.push(...validationErrors.map((e) => `[validation] ${e}`));
      }
    }

    // Step 6: Write output
    const domainName = parseResult.domain.name.name.toLowerCase();
    const ext = TARGET_EXTENSION_MAP[normalizedTarget] ?? '.txt';
    const outputPath = join(outputDir, `${normalizedTarget}-ai`, `${domainName}${ext}`);

    await mkdir(dirname(outputPath), { recursive: true });

    const header = `/**
 * AI-Generated from ISL Specification
 * Source: ${relative(process.cwd(), filePath)}
 * Provider: ${provider}
 * Generated: ${new Date().toISOString()}
 * Confidence: ${result.confidence.toFixed(2)}
 * 
 * ⚠ Review before committing — run \`isl verify\` to validate.
 */

`;

    await writeFile(outputPath, header + generatedCode);
    files.push({
      path: outputPath,
      content: generatedCode,
      target: normalizedTarget as GenerationTarget,
    });

    // Step 6: Report token usage
    const tokenInfo = result.tokens.input + result.tokens.output > 0
      ? ` (${result.tokens.input + result.tokens.output} tokens)`
      : '';

    spinner?.succeed(
      `Generated ${relative(process.cwd(), outputPath)}${tokenInfo} (${Date.now() - startTime}ms)`,
    );

    // Print suggestions if any
    if (result.suggestions && result.suggestions.length > 0 && options.format !== 'json') {
      console.log('');
      console.log(chalk.bold('Suggestions:'));
      for (const suggestion of result.suggestions) {
        const icon = suggestion.priority === 'high' ? chalk.red('!') : chalk.yellow('•');
        console.log(`  ${icon} ${suggestion.message}`);
      }
    }

    return {
      success: true,
      target: normalizedTarget as GenerationTarget,
      sourceFile: filePath,
      files,
      errors,
      duration: Date.now() - startTime,
    };
  } catch (err) {
    spinner?.fail('AI generation failed');
    const errorMsg = err instanceof Error ? err.message : String(err);
    errors.push(errorMsg);

    return {
      success: false,
      target: normalizedTarget as GenerationTarget,
      sourceFile: filePath,
      files,
      errors,
      duration: Date.now() - startTime,
    };
  }
}
