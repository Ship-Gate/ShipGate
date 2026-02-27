/**
 * CLI Integration
 *
 * Provides the `--fix` flag integration for `shipgate verify`.
 * Handles interactive prompts, dry-run output, and patch generation.
 */

import type { FixSuggestion } from './fix-suggestion.js';
import type { PromptChoice, FixEngineResult, FixMode } from './fix-engine.js';
import { FixEngine } from './fix-engine.js';
import { formatDiffBlock, generateInlineDiff } from './diff-generator.js';
import { createInterface } from 'readline';

// ============================================================================
// CLI Options (maps to command-line flags)
// ============================================================================

export interface FixCLIOptions {
  /** Files/directories to scan */
  targets: string[];
  /** Apply fixes without prompting (--yes) */
  yes?: boolean;
  /** Show fixes but don't apply (--dry-run) */
  dryRun?: boolean;
  /** Write combined patch to file (--output <path>) */
  output?: string;
  /** Minimum confidence threshold */
  minConfidence?: number;
  /** Also apply breaking-change fixes when --yes */
  includeBreaking?: boolean;
  /** JSON output for CI */
  json?: boolean;
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Run the fix pipeline from CLI flags.
 *
 * Usage:
 *   shipgate verify src/ --fix               # interactive
 *   shipgate verify src/ --fix --yes         # auto-apply non-breaking
 *   shipgate verify src/ --fix --dry-run     # show fixes only
 *   shipgate verify src/ --fix --output f.patch  # write patch file
 */
export async function runFixCLI(options: FixCLIOptions): Promise<FixEngineResult> {
  const mode: FixMode = options.dryRun
    ? 'dry-run'
    : options.yes
      ? 'auto'
      : 'interactive';

  const engine = new FixEngine({
    mode,
    outputPatch: options.output,
    minConfidence: options.minConfidence ?? 0.5,
    includeBreaking: options.includeBreaking ?? false,
  });

  const promptFn =
    mode === 'interactive' ? createInteractivePrompt() : undefined;

  const result = await engine.run(options.targets, promptFn);

  // Output
  if (options.json) {
    printJSON(result);
  } else {
    printHumanReadable(result, mode);
  }

  return result;
}

// ============================================================================
// Interactive Prompt
// ============================================================================

function createInteractivePrompt(): (
  fix: FixSuggestion,
) => Promise<PromptChoice> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stderr,
    terminal: process.stdin.isTTY ?? false,
  });

  let skipAll = false;

  return async (fix: FixSuggestion): Promise<PromptChoice> => {
    if (skipAll) return 'skip-all';

    // Print the violation header
    process.stderr.write('\n');
    process.stderr.write(
      `${fix.file}  ${STATUS_FAIL}  ${fix.violation}\n`,
    );
    process.stderr.write(`Confidence: ${(fix.confidence * 100).toFixed(0)}%`);
    if (fix.breaking) {
      process.stderr.write(`  ${BREAKING_TAG}`);
    }
    process.stderr.write('\n\n');

    // Print compact diff
    process.stderr.write('Suggested fix:\n');
    process.stderr.write(
      formatDiffBlock(
        fix.file,
        fix.location.line,
        fix.location.endLine ?? fix.location.line,
        fix.currentCode,
        fix.suggestedCode,
      ),
    );
    process.stderr.write('\n');
    process.stderr.write(`${fix.explanation}\n\n`);

    // Prompt
    const answer = await askQuestion(
      rl,
      '  Apply this fix? [y/N/d(diff)/s(skip all)] ',
    );

    const choice = answer.trim().toLowerCase();

    switch (choice) {
      case 'y':
      case 'yes':
        return 'apply';
      case 'd':
      case 'diff':
        // Print full unified diff and re-ask
        process.stderr.write('\n' + fix.diff + '\n');
        return askApply(rl);
      case 's':
      case 'skip all':
        skipAll = true;
        return 'skip-all';
      default:
        return 'skip';
    }
  };
}

function askQuestion(
  rl: ReturnType<typeof createInterface>,
  question: string,
): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function askApply(
  rl: ReturnType<typeof createInterface>,
): Promise<PromptChoice> {
  const answer = await askQuestion(rl, '  Apply? [y/N] ');
  return answer.trim().toLowerCase() === 'y' ? 'apply' : 'skip';
}

// ============================================================================
// Output Formatters
// ============================================================================

const STATUS_FAIL = '\u2717 FAIL';
const STATUS_FIX = '\u2713 FIXED';
const BREAKING_TAG = '[BREAKING]';

function printHumanReadable(result: FixEngineResult, mode: FixMode): void {
  if (result.suggestions.length === 0) {
    process.stderr.write('\nNo fixable violations found.\n');
    return;
  }

  process.stderr.write('\n');

  // Per-file summary
  for (const summary of result.fileSummary) {
    if (summary.applied > 0) {
      process.stderr.write(
        `${summary.file}  ${STATUS_FIX}  ${summary.applied}/${summary.total} fixes applied\n`,
      );
    } else if (summary.total > 0) {
      process.stderr.write(
        `${summary.file}  ${STATUS_FAIL}  ${summary.total} violations\n`,
      );
    }
  }

  process.stderr.write('\n');

  // Dry-run: show all suggestions
  if (mode === 'dry-run') {
    for (const fix of result.suggestions) {
      process.stderr.write(`${fix.file}:${fix.location.line}  ${fix.violation}\n`);
      process.stderr.write(
        generateInlineDiff(fix.currentCode, fix.suggestedCode) + '\n\n',
      );
    }
  }

  // Summary line
  process.stderr.write(
    `\nTotal: ${result.suggestions.length} suggestion(s), ` +
      `${result.applied.length} applied, ` +
      `${result.skipped.length} skipped\n`,
  );

  if (result.patchContent && mode === 'dry-run') {
    process.stderr.write(
      '\nPatch content generated (use --output <file> to save)\n',
    );
  }
}

function printJSON(result: FixEngineResult): void {
  const payload = {
    suggestions: result.suggestions.map(serializeFix),
    applied: result.applied.map(serializeFix),
    skipped: result.skipped.map(serializeFix),
    fileSummary: result.fileSummary,
    patchAvailable: !!result.patchContent,
  };
  process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
}

function serializeFix(fix: FixSuggestion): Record<string, unknown> {
  return {
    violation: fix.violation,
    file: fix.file,
    location: fix.location,
    currentCode: fix.currentCode,
    suggestedCode: fix.suggestedCode,
    explanation: fix.explanation,
    confidence: fix.confidence,
    breaking: fix.breaking,
    patternId: fix.patternId ?? null,
    tags: fix.tags,
  };
}
