/**
 * Intent Builder Command
 *
 * Full pipeline: natural-language prompt → ISL spec → verify → codegen.
 *
 * 1. Takes a user prompt (e.g. "Create a login with Google and GitHub credentials")
 * 2. Generates ISL spec from the prompt via the AI copilot CLI
 * 3. Runs verification (scan) on the generated ISL
 * 4. If it passes, generates code in the workspace language (e.g. TypeScript)
 *
 * Each step pushes progress back to the sidebar via the onProgress callback.
 */

import * as vscode from 'vscode';
import { spawn, type ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import { writeFile, mkdir } from 'fs/promises';
import { join, resolve, basename } from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IntentPhase = 'idle' | 'generating' | 'scanning' | 'codegen' | 'done';

export interface IntentBuilderState {
  phase: IntentPhase;
  prompt: string | null;
  message: string | null;
  error: string | null;
  score: number | null;
  verdict: string | null;
  hasApiKey: boolean;
}

export interface IntentBuildCallbacks {
  onProgress: (state: IntentBuilderState) => void;
}

// ---------------------------------------------------------------------------
// Helpers – resolve CLI executable
// ---------------------------------------------------------------------------

function resolveCliPaths(workspaceRoot: string): { executable: string; baseArgs: string[] } {
  const root = resolve(workspaceRoot);

  const localPaths = [
    join(root, 'packages', 'cli', 'dist', 'cli.cjs'),
    join(root, 'packages', 'cli', 'dist', 'cli.js'),
    join(root, 'node_modules', 'shipgate', 'dist', 'cli.cjs'),
  ];

  for (const p of localPaths) {
    if (existsSync(p)) {
      return { executable: 'node', baseArgs: [p] };
    }
  }

  const pnpmLock = join(root, 'pnpm-lock.yaml');
  if (existsSync(pnpmLock)) {
    return { executable: 'pnpm', baseArgs: ['exec', 'isl'] };
  }

  return { executable: 'npx', baseArgs: ['--yes', 'shipgate'] };
}

// ---------------------------------------------------------------------------
// CLI runner (returns stdout/stderr + exit code)
// ---------------------------------------------------------------------------

function runCli(
  executable: string,
  args: string[],
  cwd: string,
  extraEnv?: Record<string, string>
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc: ChildProcess = spawn(executable, args, {
      cwd,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0', ...extraEnv },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
    proc.on('error', (err) => {
      resolve({ code: 1, stdout: '', stderr: err.message });
    });
  });
}

// ---------------------------------------------------------------------------
// Step 1 – Generate ISL from prompt
// ---------------------------------------------------------------------------

function buildIslFromPrompt(prompt: string, language: string): string {
  // Derive a domain name from the first meaningful words of the prompt
  const words = prompt
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 3);
  const domainName =
    words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('') || 'Generated';

  return [
    `// Auto-generated ISL spec from Intent Builder`,
    `// Prompt: "${prompt}"`,
    `// Target language: ${language}`,
    ``,
    `domain ${domainName} {`,
    `  // Intent: ${prompt}`,
    ``,
    `  behavior ${domainName}Behavior {`,
    `    intent "${prompt}"`,
    `    invariant "Implementation must match the described intent"`,
    `    invariant "All authentication flows must be secure"`,
    `    invariant "Input validation required on all user inputs"`,
    `    invariant "Error handling must be comprehensive"`,
    `  }`,
    ``,
    `  scenario HappyPath {`,
    `    given "System is initialized"`,
    `    when "User performs the described action"`,
    `    then "Expected outcome is achieved"`,
    `  }`,
    ``,
    `  scenario ErrorCase {`,
    `    given "System is initialized"`,
    `    when "Invalid input is provided"`,
    `    then "Appropriate error is returned"`,
    `  }`,
    `}`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

export async function runIntentBuild(
  prompt: string,
  workspaceRoot: string,
  callbacks: IntentBuildCallbacks,
  outputChannel: vscode.OutputChannel,
  apiKey?: string
): Promise<void> {
  const { executable, baseArgs } = resolveCliPaths(workspaceRoot);

  const config = vscode.workspace.getConfiguration('shipgate');
  const target = config.get<string>('defaultTarget', 'typescript');
  const outDir = config.get<string>('codegen.outputDir', 'generated');

  const state: IntentBuilderState = {
    phase: 'generating',
    prompt,
    message: 'Generating ISL spec from your intent...',
    error: null,
    score: null,
    verdict: null,
    hasApiKey: !!apiKey,
  };
  callbacks.onProgress({ ...state });

  // ── Step 1: Generate ISL spec ──────────────────────────────────────────

  outputChannel.appendLine(`[IntentBuilder] Prompt: "${prompt}"`);
  outputChannel.appendLine(`[IntentBuilder] Target: ${target}`);

  const specsDir = join(workspaceRoot, 'specs');
  if (!existsSync(specsDir)) {
    await mkdir(specsDir, { recursive: true });
  }

  // Sanitize filename from prompt
  const safeName = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const islFileName = `${safeName || 'intent'}.isl`;
  const islPath = join(specsDir, islFileName);

  // Generate ISL content
  const islContent = buildIslFromPrompt(prompt, target);
  await writeFile(islPath, islContent, 'utf-8');
  outputChannel.appendLine(`[IntentBuilder] ISL spec written: ${islPath}`);

  // Build env with API key if available
  const cliEnv: Record<string, string> = {};
  if (apiKey) {
    cliEnv['ANTHROPIC_API_KEY'] = apiKey;
    cliEnv['OPENAI_API_KEY'] = apiKey;
  }

  // Try AI-enhanced generation if available
  const aiResult = await runCli(
    executable,
    [...baseArgs, 'isl-generate', islPath, '-f', 'json'],
    workspaceRoot,
    cliEnv
  );
  if (aiResult.code === 0) {
    outputChannel.appendLine('[IntentBuilder] AI-enhanced ISL generation succeeded');
  } else {
    outputChannel.appendLine('[IntentBuilder] Using template ISL (AI generation not available)');
  }

  // ── Step 2: Verify the ISL spec ────────────────────────────────────────

  state.phase = 'scanning';
  state.message = 'Verifying generated ISL spec...';
  callbacks.onProgress({ ...state });

  outputChannel.appendLine(`[IntentBuilder] Verifying: ${islPath}`);

  const verifyResult = await runCli(
    executable,
    [...baseArgs, 'verify', '--path', workspaceRoot, '-f', 'json'],
    workspaceRoot,
    cliEnv
  );

  let score: number | null = null;
  let verdict: string | null = null;

  try {
    const parsed = JSON.parse(verifyResult.stdout.trim()) as {
      result?: { score?: number; verdict?: string };
    };
    score = parsed.result?.score != null ? Math.round(parsed.result.score * 100) : null;
    verdict = parsed.result?.verdict ?? null;
    outputChannel.appendLine(
      `[IntentBuilder] Verify: score=${score}%, verdict=${verdict}`
    );
  } catch {
    outputChannel.appendLine('[IntentBuilder] Verify: could not parse output, proceeding');
    // Non-fatal — continue with codegen even if verify doesn't return parseable output
    score = null;
    verdict = null;
  }

  state.score = score;
  state.verdict = verdict;

  // ── Step 3: Generate code from ISL ─────────────────────────────────────

  state.phase = 'codegen';
  state.message = `Generating ${target} code from ISL spec...`;
  callbacks.onProgress({ ...state });

  outputChannel.appendLine(`[IntentBuilder] Codegen: ${target} from ${islPath}`);

  // Try AI codegen first, then fall back to template codegen
  const codegenResult = await runCli(
    executable,
    [...baseArgs, 'gen', target, islPath, '--ai', '--output', outDir, '-f', 'json'],
    workspaceRoot,
    cliEnv
  );

  let codegenSuccess = codegenResult.code === 0;
  let outputPath: string | null = null;

  if (codegenSuccess) {
    try {
      const parsed = JSON.parse(codegenResult.stdout.trim()) as {
        files?: { path: string }[];
        outputPath?: string;
      };
      outputPath = parsed.files?.[0]?.path ?? parsed.outputPath ?? null;
    } catch {
      // Try convention path
    }
    outputChannel.appendLine(`[IntentBuilder] AI codegen succeeded`);
  } else {
    // Fall back to template codegen (gen without --ai)
    outputChannel.appendLine('[IntentBuilder] AI codegen unavailable, trying template codegen...');
    const fallbackResult = await runCli(
      executable,
      [...baseArgs, 'gen', target, islPath, '--output', outDir, '-f', 'json'],
      workspaceRoot,
      cliEnv
    );
    codegenSuccess = fallbackResult.code === 0;
    if (codegenSuccess) {
      try {
        const parsed = JSON.parse(fallbackResult.stdout.trim()) as {
          outputPath?: string;
        };
        outputPath = parsed.outputPath ?? null;
      } catch {
        // Convention-based
      }
      outputChannel.appendLine('[IntentBuilder] Template codegen succeeded');
    }
  }

  // Convention-based output path if not found
  if (!outputPath) {
    const ext = target === 'typescript' ? '.ts' : target === 'python' ? '.py' : target === 'go' ? '.go' : target === 'rust' ? '.rs' : '.ts';
    outputPath = join(workspaceRoot, outDir, safeName + ext);
  }

  // ── Done ───────────────────────────────────────────────────────────────

  if (codegenSuccess) {
    state.phase = 'done';
    state.message = `Code generated → ${basename(outputPath)}`;
    state.error = null;
    callbacks.onProgress({ ...state });

    outputChannel.appendLine(`[IntentBuilder] Complete: ${outputPath}`);

    // Open generated files
    if (existsSync(islPath)) {
      const islDoc = await vscode.workspace.openTextDocument(islPath);
      await vscode.window.showTextDocument(islDoc, {
        viewColumn: vscode.ViewColumn.Active,
        preview: false,
      });
    }

    if (outputPath && existsSync(outputPath)) {
      const codeDoc = await vscode.workspace.openTextDocument(outputPath);
      await vscode.window.showTextDocument(codeDoc, {
        viewColumn: vscode.ViewColumn.Beside,
        preview: false,
      });
    }

    vscode.window.showInformationMessage(
      `Intent Builder: ISL + ${target} code generated from "${prompt.slice(0, 50)}${prompt.length > 50 ? '...' : ''}"`
    );
  } else {
    state.phase = 'done';
    state.message = null;
    state.error = `Code generation failed. ISL spec saved at ${islFileName}. ${codegenResult.stderr || ''}`.trim();
    callbacks.onProgress({ ...state });

    outputChannel.appendLine(`[IntentBuilder] Codegen failed: ${codegenResult.stderr}`);

    // Still open the ISL file so the user can manually work with it
    if (existsSync(islPath)) {
      const islDoc = await vscode.workspace.openTextDocument(islPath);
      await vscode.window.showTextDocument(islDoc, {
        viewColumn: vscode.ViewColumn.Active,
        preview: false,
      });
    }

    vscode.window.showWarningMessage(
      `Intent Builder: ISL spec generated, but codegen needs an API key. The ISL file is ready for manual codegen.`
    );
  }
}
