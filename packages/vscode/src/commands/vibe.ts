/**
 * ISL Vibe Command
 *
 * Safe Vibe Coding: describe what you want → get verified code.
 * Runs CLI subprocess: isl vibe "prompt" --format json
 */

import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { getShipgateConfig } from '../config/config';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface VibeResult {
  success: boolean;
  verdict: 'SHIP' | 'NO_SHIP' | 'WARN';
  prompt: string;
  outputDir: string;
  files: Array<{ path: string; type: string; size: number }>;
  stages: Array<{ stage: string; success: boolean; duration: number }>;
  iterations: number;
  finalScore: number;
  errors: string[];
  duration: number;
}

export interface VibeState {
  phase: 'idle' | 'running' | 'done';
  prompt: string | null;
  message: string | null;
  error: string | null;
  verdict: string | null;
  score: number | null;
  outputDir: string | null;
  fileCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI Resolution
// ─────────────────────────────────────────────────────────────────────────────

function resolveCliExecutable(workspaceRoot: string): { executable: string; args: string[] } {
  const root = resolve(workspaceRoot);

  const localPaths = [
    join(root, 'packages', 'cli', 'dist', 'cli.cjs'),
    join(root, 'node_modules', 'isl', 'dist', 'cli.cjs'),
  ];
  for (const p of localPaths) {
    if (existsSync(p)) {
      return { executable: 'node', args: [p] };
    }
  }

  const extensionDir = dirname(__dirname);
  const extensionLocalCli = join(extensionDir, '..', 'cli', 'dist', 'cli.cjs');
  if (existsSync(extensionLocalCli)) {
    return { executable: 'node', args: [resolve(extensionLocalCli)] };
  }

  return { executable: 'npx', args: ['--yes', 'isl'] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Register Command
// ─────────────────────────────────────────────────────────────────────────────

export function registerVibeCommand(
  context: vscode.ExtensionContext,
  vibeState: VibeState,
  onStateChange: () => void,
  getApiKey?: () => string | null,
  requirePro?: (featureName: string) => Promise<boolean>,
): void {
  const outputChannel = vscode.window.createOutputChannel('ISL Vibe');

  context.subscriptions.push(
    vscode.commands.registerCommand('shipgate.vibe', async () => {
      // Pro gate
      if (requirePro) {
        const allowed = await requirePro('Safe Vibe Coding');
        if (!allowed) return;
      }

      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!root) {
        vscode.window.showWarningMessage('ISL: Open a workspace folder first.');
        return;
      }

      // Ask for prompt
      const prompt = await vscode.window.showInputBox({
        prompt: 'Describe the app you want to build',
        placeHolder: 'Build me a todo app with auth and a REST API',
        ignoreFocusOut: true,
      });

      if (!prompt?.trim()) return;

      // Ask for framework
      const framework = await vscode.window.showQuickPick(
        [
          { label: 'Next.js', description: 'Full-stack React framework', value: 'nextjs' },
          { label: 'Express', description: 'Minimal Node.js framework', value: 'express' },
          { label: 'Fastify', description: 'Fast Node.js framework', value: 'fastify' },
        ],
        { placeHolder: 'Choose a framework (default: Next.js)' },
      );

      // Ask for output directory
      const outputUri = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select output folder',
        title: 'Where should the project be generated?',
      });

      const outputDir = outputUri?.[0]?.fsPath;
      if (!outputDir) return;

      const config = getShipgateConfig(root);
      const projectRoot = config.projectRoot || root;

      outputChannel.show(true);
      outputChannel.appendLine(`\n[ISL Vibe] Starting Safe Vibe Coding...`);
      outputChannel.appendLine(`[ISL Vibe] Prompt: "${prompt}"`);
      outputChannel.appendLine(`[ISL Vibe] Framework: ${framework?.value ?? 'nextjs'}`);
      outputChannel.appendLine(`[ISL Vibe] Output: ${outputDir}`);

      // Update state
      vibeState.phase = 'running';
      vibeState.prompt = prompt;
      vibeState.message = 'Generating ISL spec from description...';
      vibeState.error = null;
      vibeState.verdict = null;
      vibeState.score = null;
      vibeState.outputDir = outputDir;
      vibeState.fileCount = 0;
      onStateChange();

      // Build CLI args
      const { executable, args } = resolveCliExecutable(projectRoot);
      const vibeArgs = [
        ...args,
        'vibe', prompt,
        '--format', 'json',
        '--output', outputDir,
        '--framework', framework?.value ?? 'nextjs',
        '--database', 'sqlite',
      ];

      const apiKey = getApiKey?.() ?? null;
      const envOverrides: Record<string, string> = {};
      if (apiKey) envOverrides['OPENAI_API_KEY'] = apiKey;

      outputChannel.appendLine(`[ISL Vibe] ${executable} ${vibeArgs.join(' ')}`);

      // Show progress notification
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'ISL: Safe Vibe Coding',
          cancellable: true,
        },
        async (progress, token) => {
          progress.report({ message: 'Generating ISL spec...' });

          const result = await new Promise<VibeResult | null>((resolvePromise) => {
            const isWindows = process.platform === 'win32';
            const proc = spawn(executable, vibeArgs, {
              cwd: projectRoot,
              shell: isWindows,
              env: { ...process.env, ...envOverrides },
            });

            let stdout = '';
            let stderr = '';

            token.onCancellationRequested(() => {
              proc.kill();
              vibeState.phase = 'done';
              vibeState.message = null;
              vibeState.error = 'Cancelled by user';
              onStateChange();
              resolvePromise(null);
            });

            proc.stdout?.on('data', (data: Buffer) => {
              const chunk = data.toString();
              stdout += chunk;
              for (const line of chunk.split('\n')) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                outputChannel.appendLine(`[vibe] ${trimmed}`);

                // Update progress based on stage markers in output
                if (trimmed.includes('Stage 1')) {
                  progress.report({ message: 'Converting to ISL spec...' });
                  vibeState.message = 'Converting to ISL spec...';
                  onStateChange();
                } else if (trimmed.includes('Stage 2')) {
                  progress.report({ message: 'Validating spec...' });
                  vibeState.message = 'Validating spec...';
                  onStateChange();
                } else if (trimmed.includes('Stage 3')) {
                  progress.report({ message: 'Generating full-stack code...' });
                  vibeState.message = 'Generating full-stack code...';
                  onStateChange();
                } else if (trimmed.includes('Stage 4')) {
                  progress.report({ message: 'Writing files...' });
                  vibeState.message = 'Writing files...';
                  onStateChange();
                } else if (trimmed.includes('Stage 5')) {
                  progress.report({ message: 'Verifying generated code...' });
                  vibeState.message = 'Verifying generated code...';
                  onStateChange();
                }
              }
            });

            proc.stderr?.on('data', (data: Buffer) => {
              const chunk = data.toString();
              stderr += chunk;
              for (const line of chunk.split('\n')) {
                if (line.trim()) outputChannel.appendLine(`[vibe stderr] ${line}`);
              }
            });

            proc.on('close', (code) => {
              outputChannel.appendLine(`[ISL Vibe] Process exited with code ${code}`);

              let parsed: VibeResult | null = null;
              try {
                const jsonMatch = stdout.match(/\{[\s\S]*"verdict"[\s\S]*\}/);
                if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
              } catch {
                outputChannel.appendLine('[ISL Vibe] Could not parse JSON output');
              }

              if (parsed) {
                vibeState.phase = 'done';
                vibeState.message = null;
                vibeState.verdict = parsed.verdict;
                vibeState.score = parsed.finalScore;
                vibeState.fileCount = parsed.files?.length ?? 0;
                vibeState.error = parsed.errors?.length > 0 ? parsed.errors[0] : null;
              } else {
                vibeState.phase = 'done';
                vibeState.message = null;
                vibeState.error = stderr.trim() || 'Vibe process failed';
              }
              onStateChange();
              resolvePromise(parsed);
            });

            proc.on('error', (err) => {
              vibeState.phase = 'done';
              vibeState.message = null;
              vibeState.error = err.message;
              onStateChange();
              resolvePromise(null);
            });
          });

          // Show result
          if (result) {
            const scorePercent = Math.round(result.finalScore * 100);

            if (result.verdict === 'SHIP') {
              const action = await vscode.window.showInformationMessage(
                `ISL Vibe: SHIP ✅ — ${result.files.length} files generated (${scorePercent}%)`,
                'Open Project',
              );
              if (action === 'Open Project') {
                const uri = vscode.Uri.file(result.outputDir);
                await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: true });
              }
            } else if (result.verdict === 'WARN') {
              const action = await vscode.window.showWarningMessage(
                `ISL Vibe: ${result.files.length} files generated — manual review recommended`,
                'Open Project',
              );
              if (action === 'Open Project') {
                const uri = vscode.Uri.file(result.outputDir);
                await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: true });
              }
            } else {
              vscode.window.showErrorMessage(
                `ISL Vibe: NO_SHIP — ${result.errors.length} violation(s) remain`,
              );
            }
          }
        },
      );
    }),
  );
}
