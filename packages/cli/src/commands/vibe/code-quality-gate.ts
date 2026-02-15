/**
 * CodeQualityGate — Post-generation quality checks
 *
 * Runs TypeScript compilation (tsc --noEmit) on the generated project.
 * If it fails, extracts errors and supports AI-assisted fix passes.
 *
 * @module @shipgate/cli/vibe/code-quality-gate
 */

import { execSync } from 'child_process';
import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';

export interface TscError {
  file: string;
  line: number;
  column: number;
  message: string;
  code?: string;
}

export interface CodeQualityGateResult {
  pass: boolean;
  tscPass: boolean;
  tscErrors: TscError[];
  fixAttempts: number;
  details: {
    rawOutput?: string;
    fixedFiles?: string[];
  };
}

const MAX_FIX_ATTEMPTS_PER_FILE = 3;

/**
 * Parse tsc --noEmit output into structured errors.
 * Handles both pretty and JSON output formats.
 */
export function parseTscErrors(output: string, projectRoot: string): TscError[] {
  const errors: TscError[] = [];
  const lines = output.split('\n');

  for (const line of lines) {
    // Match: src/app/api/v1/todos/route.ts(12,5): error TS2322: Type 'X' is not assignable to type 'Y'
    const match = line.match(/^(.+?)\((\d+),(\d+)\):\s*error\s*(?:TS\d+:\s*)?(.+)$/);
    if (match) {
      const [, filePath, lineNum, colNum, message] = match;
      const normalizedPath = resolve(projectRoot, filePath.trim());
      errors.push({
        file: normalizedPath,
        line: parseInt(lineNum!, 10),
        column: parseInt(colNum!, 10),
        message: message?.trim() ?? '',
      });
    }
  }

  return errors;
}

/**
 * Group errors by file path.
 */
export function groupErrorsByFile(errors: TscError[]): Map<string, TscError[]> {
  const byFile = new Map<string, TscError[]>();
  for (const err of errors) {
    const list = byFile.get(err.file) ?? [];
    list.push(err);
    byFile.set(err.file, list);
  }
  return byFile;
}

/**
 * Run tsc --noEmit in the project directory.
 */
export function runTscCheck(projectRoot: string): { success: boolean; output: string; errors: TscError[] } {
  const cwd = resolve(projectRoot);
  let output = '';

  try {
    output = execSync('npx tsc --noEmit 2>&1', {
      cwd,
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024,
    });
    return { success: true, output, errors: [] };
  } catch (err: unknown) {
    const execErr = err as { stdout?: string; stderr?: string };
    output = [execErr.stdout, execErr.stderr].filter(Boolean).join('\n') ?? String(err);
    const errors = parseTscErrors(output, cwd);
    return { success: false, output, errors };
  }
}

export interface FixPassOptions {
  projectRoot: string;
  filePath: string;
  content: string;
  errors: TscError[];
  fixPrompt: (opts: { filePath: string; content: string; errors: TscError[] }) => string;
  copilot: { chat: (prompt: string) => Promise<{ content: string }> };
}

/**
 * Run a single fix pass: send file + errors to AI, get fixed content.
 */
export async function runFixPass(opts: FixPassOptions): Promise<string> {
  const prompt = opts.fixPrompt({
    filePath: opts.filePath,
    content: opts.content,
    errors: opts.errors,
  });
  const result = await opts.copilot.chat(prompt);
  let fixed = result.content;

  // Strip markdown fences if present
  const fenceMatch = fixed.match(/```(?:typescript|ts)?\n([\s\S]*?)```/);
  if (fenceMatch) {
    fixed = fenceMatch[1]!.trim();
  }

  return fixed;
}

function buildFixPrompt(opts: { filePath: string; content: string; errors: TscError[] }): string {
  const errorList = opts.errors
    .map((e) => `  - Line ${e.line}, col ${e.column}: ${e.message}`)
    .join('\n');

  return `Fix the TypeScript errors in this file. The compiler reported:

${errorList}

## File: ${opts.filePath}

\`\`\`typescript
${opts.content}
\`\`\`

Return ONLY the corrected TypeScript code. No markdown fences, no explanations.
Do NOT use comment stubs. Every function must have a real implementation.`;
}

/**
 * CodeQualityGate — runs tsc check and optional AI fix loop.
 */
export class CodeQualityGate {
  constructor(
    private readonly projectRoot: string,
    private readonly copilot?: { chat: (prompt: string) => Promise<{ content: string }> },
    private readonly maxFixAttemptsPerFile = MAX_FIX_ATTEMPTS_PER_FILE,
  ) {}

  /**
   * Run the quality gate: tsc --noEmit, optionally with fix loop.
   */
  async run(opts?: { attemptFix?: boolean }): Promise<CodeQualityGateResult> {
    const attemptFix = opts?.attemptFix ?? !!this.copilot;
    const fixedFiles: string[] = [];
    const fixAttemptsByFile = new Map<string, number>();
    const projectRootResolved = resolve(this.projectRoot);

    let result = runTscCheck(this.projectRoot);

    if (result.success) {
      return {
        pass: true,
        tscPass: true,
        tscErrors: [],
        fixAttempts: 0,
        details: {},
      };
    }

    if (!attemptFix || !this.copilot) {
      return {
        pass: false,
        tscPass: false,
        tscErrors: result.errors,
        fixAttempts: 0,
        details: { rawOutput: result.output },
      };
    }

    // Fix loop: re-run until pass or no more fixable files
    for (let round = 0; round < 10; round++) {
      const byFile = groupErrorsByFile(result.errors);

      let fixedAny = false;
      for (const [absPath, fileErrors] of byFile) {
        const attempts = fixAttemptsByFile.get(absPath) ?? 0;
        if (attempts >= this.maxFixAttemptsPerFile) continue;

        const relPath = absPath.startsWith(projectRootResolved)
          ? absPath.slice(projectRootResolved.length).replace(/^[/\\]/, '')
          : absPath;

        let content: string;
        try {
          content = await readFile(absPath, 'utf-8');
        } catch {
          continue;
        }

        const fixed = await runFixPass({
          projectRoot: this.projectRoot,
          filePath: relPath,
          content,
          errors: fileErrors,
          fixPrompt: buildFixPrompt,
          copilot: this.copilot,
        });

        await writeFile(absPath, fixed, 'utf-8');
        fixedFiles.push(relPath);
        fixAttemptsByFile.set(absPath, attempts + 1);
        fixedAny = true;
      }

      if (!fixedAny) break;

      const recheck = runTscCheck(this.projectRoot);
      if (recheck.success) {
        return {
          pass: true,
          tscPass: true,
          tscErrors: [],
          fixAttempts: fixedFiles.length,
          details: { rawOutput: result.output, fixedFiles },
        };
      }
      result = recheck;
    }

    const finalCheck = runTscCheck(this.projectRoot);
    return {
      pass: false,
      tscPass: false,
      tscErrors: finalCheck.errors,
      fixAttempts: fixedFiles.length,
      details: { rawOutput: finalCheck.output, fixedFiles },
    };
  }
}
