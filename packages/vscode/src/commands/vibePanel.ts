/**
 * ISL Vibe Panel Commands
 *
 * Commands invoked from the Vibe sidebar panel.
 * Runs the vibe pipeline with parameters from the panel.
 */

import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { getShipgateConfig } from '../config/config';
import type { VibePanelState } from '../views/vibePanel/vibePanelProvider';

const STAGE_NAMES = [
  'Convert to ISL spec',
  'Validate spec',
  'Generate code',
  'Write files',
  'Verify',
];

interface VibeResult {
  success: boolean;
  verdict: 'SHIP' | 'NO_SHIP' | 'WARN';
  prompt: string;
  outputDir: string;
  files: Array<{ path: string; type: string; size: number }>;
  stages?: Array<{ stage: string; success: boolean; duration: number }>;
  iterations?: number;
  finalScore: number;
  errors: string[];
  duration?: number;
}

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

export function registerVibePanelCommands(
  context: vscode.ExtensionContext,
  vibePanelState: VibePanelState,
  onStateChange: () => void,
  getApiKey?: () => string | null,
  requirePro?: (featureName: string) => Promise<boolean>
): void {
  const outputChannel = vscode.window.createOutputChannel('ISL Vibe');

  function updateStages(
    currentIndex: number,
    status: 'running' | 'done' | 'failed',
    duration?: number,
    error?: string
  ): void {
    vibePanelState.stages = STAGE_NAMES.map((name, i) => ({
      id: i + 1,
      name: STAGE_NAMES[i],
      status:
        i < currentIndex
          ? 'done'
          : i === currentIndex
            ? status
            : 'pending',
      duration: i === currentIndex ? duration : vibePanelState.stages?.[i]?.duration,
      error: i === currentIndex ? error : undefined,
    }));
  }

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'shipgate.vibeFromPanel',
      async (params: { prompt: string; framework: string; database: string }) => {
        if (requirePro) {
          const allowed = await requirePro('Safe Vibe Coding');
          if (!allowed) return;
        }

        const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!root) {
          vscode.window.showWarningMessage('ISL: Open a workspace folder first.');
          return;
        }

        let outputDir = context.workspaceState.get<string>('vibe.lastOutputDir');
        if (!outputDir) {
          const uri = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select output folder',
            title: 'Where should the project be generated?',
          });
          const dir = uri?.[0]?.fsPath;
          if (!dir) return;
          context.workspaceState.update('vibe.lastOutputDir', dir);
          outputDir = dir;
        }

        const { prompt, framework, database } = params;
        const config = getShipgateConfig(root);
        const projectRoot = config.projectRoot || root;

        vibePanelState.phase = 'running';
        vibePanelState.prompt = prompt;
        vibePanelState.message = 'Starting pipeline...';
        vibePanelState.error = null;
        vibePanelState.verdict = null;
        vibePanelState.score = null;
        vibePanelState.outputDir = outputDir;
        vibePanelState.files = [];
        vibePanelState.overallProgress = 0;
        vibePanelState.etaSeconds = null;
        vibePanelState.certificate = null;
        updateStages(0, 'running');
        onStateChange();

        const { executable, args } = resolveCliExecutable(projectRoot);
        const vibeArgs = [
          ...args,
          'vibe',
          prompt,
          '--format',
          'json',
          '--output',
          outputDir,
          '--framework',
          framework,
          '--database',
          database,
        ];

        const apiKey = getApiKey?.() ?? null;
        const envOverrides: Record<string, string> = {};
        if (apiKey) envOverrides['OPENAI_API_KEY'] = apiKey;

        const isWindows = process.platform === 'win32';
        const proc = spawn(executable, vibeArgs, {
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
            const trimmed = line.trim();
            if (!trimmed) continue;
            outputChannel.appendLine(`[vibe] ${trimmed}`);
            for (let i = 1; i <= 5; i++) {
              if (trimmed.includes(`Stage ${i}`)) {
                updateStages(i - 1, 'running');
                vibePanelState.overallProgress = (i / 5) * 100;
                vibePanelState.etaSeconds = Math.max(0, 60 - i * 12);
                onStateChange();
                break;
              }
            }
          }
        });

        proc.stderr?.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        proc.on('close', (code) => {
          let parsed: VibeResult | null = null;
          try {
            const jsonMatch = stdout.match(/\{[\s\S]*"verdict"[\s\S]*\}/);
            if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
          } catch {
            // ignore
          }

          if (parsed) {
            vibePanelState.phase = 'done';
            vibePanelState.message = null;
            vibePanelState.verdict = parsed.verdict;
            vibePanelState.score = parsed.finalScore;
            vibePanelState.files = parsed.files ?? [];
            vibePanelState.overallProgress = 100;
            vibePanelState.etaSeconds = null;
            vibePanelState.error = parsed.errors?.length ? parsed.errors[0] : null;
            vibePanelState.certificate = {
              verdict: parsed.verdict,
              raw: parsed as unknown as Record<string, unknown>,
            };
            STAGE_NAMES.forEach((_, i) => {
              const s = parsed?.stages?.[i];
              if (vibePanelState.stages[i]) {
                vibePanelState.stages[i].status = 'done';
                vibePanelState.stages[i].duration = s?.duration;
              }
            });
          } else {
            vibePanelState.phase = 'done';
            vibePanelState.message = null;
            vibePanelState.error = stderr.trim() || 'Vibe process failed';
            updateStages(0, 'failed', undefined, vibePanelState.error);
          }
          onStateChange();
        });

        proc.on('error', (err) => {
          vibePanelState.phase = 'done';
          vibePanelState.error = err.message;
          updateStages(0, 'failed', undefined, err.message);
          onStateChange();
        });
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('shipgate.vibeSelectOutputDir', async () => {
      const uri = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select output folder',
        title: 'Where should the project be generated?',
      });
      const dir = uri?.[0]?.fsPath;
      if (dir) {
        context.workspaceState.update('vibe.lastOutputDir', dir);
        vscode.window.showInformationMessage(`Output folder: ${dir}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('shipgate.vibeRunTests', async () => {
      const outputDir = vibePanelState.outputDir;
      if (!outputDir) {
        vscode.window.showWarningMessage('No output directory. Run Generate first.');
        return;
      }
      const term = vscode.window.createTerminal({
        name: 'ISL Vibe Tests',
        cwd: outputDir,
      });
      term.show();
      term.sendText('npx vitest run');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('shipgate.vibeStartDevServer', async () => {
      const outputDir = vibePanelState.outputDir;
      if (!outputDir) {
        vscode.window.showWarningMessage('No output directory. Run Generate first.');
        return;
      }
      const term = vscode.window.createTerminal({
        name: 'ISL Vibe Dev',
        cwd: outputDir,
      });
      term.show();
      term.sendText('npm run dev');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('shipgate.vibeRegenerateFile', async (filePath: string) => {
      vscode.window.showInformationMessage(
        `Regenerate file: ${filePath} (not yet implemented)`
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('shipgate.vibeOpenCertificate', async () => {
      const cert = vibePanelState.certificate;
      if (!cert?.raw) {
        vscode.window.showInformationMessage('No certificate available.');
        return;
      }
      const doc = await vscode.workspace.openTextDocument({
        content: JSON.stringify(cert.raw, null, 2),
        language: 'json',
      });
      await vscode.window.showTextDocument(doc);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('shipgate.vibeRetryStage', async (_stageId: number) => {
      vscode.window.showInformationMessage(
        'Retry stage: Re-run Generate to retry the pipeline.'
      );
    })
  );
}
