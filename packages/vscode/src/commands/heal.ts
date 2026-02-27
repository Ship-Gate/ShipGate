/**
 * Shipgate Heal Command
 *
 * AI-powered heal: runs verify → AI fix → re-verify loop
 * until the project reaches SHIP verdict.
 */

import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { getShipgateConfig } from '../config/config';

export interface HealResult {
  success: boolean;
  reason: string;
  iterations: number;
  finalScore: number;
  finalVerdict: 'SHIP' | 'NO_SHIP';
  files: string[];
  errors?: string[];
  history: Array<{
    iteration: number;
    patchesApplied: string[];
    duration: number;
  }>;
}

/**
 * Resolve the CLI executable for the heal command
 */
function resolveHealExecutable(workspaceRoot: string): { executable: string; args: string[] } {
  const root = resolve(workspaceRoot);

  // 1. Workspace local CLI
  const localPaths = [
    join(root, 'packages', 'cli', 'dist', 'cli.cjs'),
    join(root, 'node_modules', 'shipgate', 'dist', 'cli.cjs'),
  ];
  for (const p of localPaths) {
    if (existsSync(p)) {
      return { executable: 'node', args: [p] };
    }
  }

  // 2. Extension-local CLI (sibling package in monorepo)
  const extensionDir = dirname(__dirname);
  const extensionLocalCli = join(extensionDir, '..', 'cli', 'dist', 'cli.cjs');
  if (existsSync(extensionLocalCli)) {
    return { executable: 'node', args: [resolve(extensionLocalCli)] };
  }

  // 3. npx fallback
  return { executable: 'npx', args: ['--yes', 'shipgate'] };
}

export interface HealState {
  phase: 'idle' | 'running' | 'done';
  message: string | null;
  error: string | null;
  iterations: number;
  finalScore: number | null;
  finalVerdict: string | null;
  patchedFiles: string[];
}

/**
 * Run a heal via CLI subprocess and track state.
 */
async function runHealProcess(opts: {
  projectRoot: string;
  target: string;
  outputChannel: vscode.OutputChannel;
  healState: HealState;
  onStateChange: () => void;
  extraArgs?: string[];
  apiKey?: string | null;
}): Promise<HealResult | null> {
  const { projectRoot, target, outputChannel, healState, onStateChange, extraArgs = [], apiKey } = opts;

  healState.phase = 'running';
  healState.message = 'Verifying and generating fixes…';
  healState.error = null;
  healState.patchedFiles = [];
  onStateChange();

  const { executable, args } = resolveHealExecutable(projectRoot);
  const healArgs = [
    ...args,
    'heal', target, '--ai', '--format', 'json',
    '--max-iterations', '5',
    ...extraArgs,
  ];

  outputChannel.appendLine(`[Shipgate Heal] ${executable} ${healArgs.join(' ')}`);

  return new Promise<HealResult | null>((resolvePromise) => {
    const isWindows = process.platform === 'win32';
    const envOverrides: Record<string, string> = {};
    if (apiKey) envOverrides['OPENAI_API_KEY'] = apiKey;

    const proc = spawn(executable, healArgs, {
      cwd: projectRoot,
      shell: isWindows,
      env: { ...process.env, ...envOverrides },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stdout += chunk;
      for (const line of chunk.split('\n')) {
        if (line.trim()) outputChannel.appendLine(`[heal] ${line}`);
      }
    });

    proc.stderr?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stderr += chunk;
      for (const line of chunk.split('\n')) {
        if (line.trim()) outputChannel.appendLine(`[heal stderr] ${line}`);
      }
    });

    proc.on('close', (code) => {
      outputChannel.appendLine(`[Shipgate Heal] Process exited with code ${code}`);

      let result: HealResult | null = null;
      try {
        const jsonMatch = stdout.match(/\{[\s\S]*"success"[\s\S]*\}/);
        if (jsonMatch) result = JSON.parse(jsonMatch[0]);
      } catch {
        outputChannel.appendLine('[Shipgate Heal] Could not parse JSON output');
      }

      if (result) {
        healState.phase = 'done';
        healState.message = null;
        healState.iterations = result.iterations;
        healState.finalScore = result.finalScore;
        healState.finalVerdict = result.finalVerdict;
        healState.patchedFiles = result.files || [];
        healState.error = result.reason === 'ai_no_key'
          ? 'No AI API key. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.'
          : (result.errors && result.errors.length > 0 ? result.errors[0] : null);
      } else {
        healState.phase = 'done';
        healState.error = stderr.trim() || 'Heal process failed';
      }
      onStateChange();
      resolvePromise(result);
    });

    proc.on('error', (err) => {
      healState.phase = 'done';
      healState.error = err.message;
      onStateChange();
      resolvePromise(null);
    });
  });
}

/**
 * Register heal commands in VS Code
 */
export function registerHealCommand(
  context: vscode.ExtensionContext,
  scanState: { lastResult: import('../model/types').ScanResult | null; workspaceRoot: string },
  healState: HealState,
  onStateChange: () => void,
  getApiKey?: () => string | null,
  requirePro?: (featureName: string) => Promise<boolean>,
): void {
  const outputChannel = vscode.window.createOutputChannel('Shipgate Heal');

  // ── shipgate.heal — heal all failing files ──
  context.subscriptions.push(
    vscode.commands.registerCommand('shipgate.heal', async () => {
      if (requirePro) {
        const allowed = await requirePro('AI Heal');
        if (!allowed) return;
      }

      const root = scanState.workspaceRoot || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!root) {
        vscode.window.showWarningMessage('Shipgate: Open a workspace folder to run heal.');
        return;
      }

      const config = getShipgateConfig(root);
      const projectRoot = config.projectRoot || root;

      outputChannel.show(true);
      outputChannel.appendLine(`\n[Shipgate Heal] Starting AI-powered heal in ${projectRoot}...`);

      const apiKey = getApiKey?.() ?? null;
      const result = await runHealProcess({
        projectRoot,
        target: '.',
        outputChannel,
        healState,
        onStateChange,
        apiKey,
      });

      if (result) {
        const scorePercent = Math.round(result.finalScore * 100);
        if (result.success) {
          vscode.window.showInformationMessage(
            `Shipgate Heal: SHIP ✅ — Score: ${scorePercent}% after ${result.iterations} iteration(s)`
          );
          vscode.commands.executeCommand('shipgate.runScan');
        } else if (result.reason === 'ai_no_key') {
          vscode.window.showErrorMessage(
            'Shipgate Heal: No AI API key. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.'
          );
        } else {
          vscode.window.showWarningMessage(
            `Shipgate Heal: ${result.finalVerdict} — Score: ${scorePercent}% (${result.reason})`
          );
          vscode.commands.executeCommand('shipgate.runScan');
        }
      }
    })
  );

  // ── shipgate.healFile — heal a single file with optional user intent ──
  context.subscriptions.push(
    vscode.commands.registerCommand('shipgate.healFile', async (file: string, intent: string) => {
      if (requirePro) {
        const allowed = await requirePro('AI Heal');
        if (!allowed) return;
      }

      const root = scanState.workspaceRoot || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!root) {
        vscode.window.showWarningMessage('Shipgate: Open a workspace folder to run heal.');
        return;
      }

      const config = getShipgateConfig(root);
      const projectRoot = config.projectRoot || root;

      outputChannel.show(true);
      outputChannel.appendLine(`\n[Shipgate Heal] Healing file: ${file}`);
      if (intent) outputChannel.appendLine(`[Shipgate Heal] User intent: ${intent}`);

      // Pass the target file directly; if intent is provided, we set it via env
      const extraEnv: Record<string, string> = {};
      if (intent) extraEnv['SHIPGATE_HEAL_INTENT'] = intent;

      healState.phase = 'running';
      healState.message = `Healing ${file.split(/[/\\]/).pop()}…`;
      healState.error = null;
      healState.patchedFiles = [];
      onStateChange();

      const { executable, args } = resolveHealExecutable(projectRoot);
      const healArgs = [
        ...args,
        'heal', file, '--ai', '--format', 'json',
        '--max-iterations', '3',
      ];

      outputChannel.appendLine(`[Shipgate Heal] ${executable} ${healArgs.join(' ')}`);

      const result = await new Promise<HealResult | null>((resolvePromise) => {
        const isWindows = process.platform === 'win32';
        const proc = spawn(executable, healArgs, {
          cwd: projectRoot,
          shell: isWindows,
          env: { ...process.env, ...extraEnv },
        });

        let stdout = '';
        let stderr = '';

        proc.stdout?.on('data', (data: Buffer) => {
          stdout += data.toString();
          for (const line of data.toString().split('\n')) {
            if (line.trim()) outputChannel.appendLine(`[heal] ${line}`);
          }
        });

        proc.stderr?.on('data', (data: Buffer) => {
          stderr += data.toString();
          for (const line of data.toString().split('\n')) {
            if (line.trim()) outputChannel.appendLine(`[heal stderr] ${line}`);
          }
        });

        proc.on('close', () => {
          let parsed: HealResult | null = null;
          try {
            const m = stdout.match(/\{[\s\S]*"success"[\s\S]*\}/);
            if (m) parsed = JSON.parse(m[0]);
          } catch { /* ignore */ }

          if (parsed) {
            healState.phase = 'done';
            healState.iterations = parsed.iterations;
            healState.finalScore = parsed.finalScore;
            healState.finalVerdict = parsed.finalVerdict;
            healState.patchedFiles = parsed.files || [];
            healState.error = parsed.errors?.[0] ?? null;
          } else {
            healState.phase = 'done';
            healState.error = stderr.trim() || 'Heal failed';
          }
          healState.message = null;
          onStateChange();
          resolvePromise(parsed);
        });

        proc.on('error', (err) => {
          healState.phase = 'done';
          healState.error = err.message;
          healState.message = null;
          onStateChange();
          resolvePromise(null);
        });
      });

      if (result) {
        const scorePercent = Math.round(result.finalScore * 100);
        if (result.success) {
          vscode.window.showInformationMessage(`Healed ${file} ✅ — Score: ${scorePercent}%`);
        } else {
          vscode.window.showWarningMessage(`Heal ${file}: ${result.finalVerdict} — ${scorePercent}%`);
        }
        vscode.commands.executeCommand('shipgate.runScan');
      }
    })
  );
}
