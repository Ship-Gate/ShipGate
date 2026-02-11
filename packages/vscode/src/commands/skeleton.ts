/**
 * ISL: Generate Skeleton from Spec
 *
 * Invokes the CLI generator (`shipgate codegen`) on the current .isl file
 * and opens the resulting implementation skeleton beside the spec.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * Register the `isl.generateSkeleton` command.
 *
 * The command can be triggered from:
 *   - The command palette
 *   - The editor context menu
 *   - A code action returned by the LSP server
 */
export function registerGenerateSkeletonCommand(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'shipgate.isl.generateSkeleton',
      (uri?: string, domainName?: string) =>
        generateSkeleton(outputChannel, uri, domainName)
    )
  );
}

async function generateSkeleton(
  outputChannel: vscode.OutputChannel,
  uri?: string,
  domainName?: string
): Promise<void> {
  // Resolve the ISL file path
  let filePath: string | undefined;

  if (uri) {
    // Called from code action — uri is a string like "file:///..."
    filePath = vscode.Uri.parse(uri).fsPath;
  } else {
    // Called from palette / menu — use active editor
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'isl') {
      vscode.window.showWarningMessage(
        'ISL: Open an .isl file first to generate a skeleton.'
      );
      return;
    }
    filePath = editor.document.fileName;
  }

  if (!filePath || !fs.existsSync(filePath)) {
    vscode.window.showErrorMessage('ISL: Cannot resolve ISL file path.');
    return;
  }

  // Ensure file is saved
  const doc = vscode.workspace.textDocuments.find(
    (d) => d.fileName === filePath
  );
  if (doc?.isDirty) {
    await doc.save();
  }

  const config = vscode.workspace.getConfiguration('shipgate');
  const target = config.get<string>('defaultTarget', 'typescript');
  const outDir = config.get<string>('codegen.outputDir', 'generated');

  outputChannel.appendLine(
    `[ISL] Generating ${target} skeleton for: ${filePath}` +
      (domainName ? ` (domain: ${domainName})` : '')
  );
  outputChannel.show(true);

  const workspaceRoot =
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ??
    path.dirname(filePath);

  const result = await runCodegen(
    filePath,
    target,
    outDir,
    workspaceRoot,
    outputChannel
  );

  if (result.success && result.outputPath) {
    outputChannel.appendLine(`[ISL] Skeleton generated: ${result.outputPath}`);
    try {
      const outDoc = await vscode.workspace.openTextDocument(result.outputPath);
      await vscode.window.showTextDocument(outDoc, {
        viewColumn: vscode.ViewColumn.Beside,
        preview: false,
      });
      vscode.window.showInformationMessage(
        `ISL: Skeleton generated → ${path.basename(result.outputPath)}`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      outputChannel.appendLine(`[ISL] Could not open output: ${msg}`);
    }
  } else {
    const errMsg = result.error ?? 'Unknown error';
    outputChannel.appendLine(`[ISL] Generation failed: ${errMsg}`);
    vscode.window.showErrorMessage(
      `ISL: Skeleton generation failed — ${errMsg}`
    );
  }
}

// ---------------------------------------------------------------------------
// CLI runner
// ---------------------------------------------------------------------------

interface CodegenResult {
  success: boolean;
  outputPath?: string;
  error?: string;
}

async function runCodegen(
  filePath: string,
  target: string,
  outDir: string,
  cwd: string,
  outputChannel: vscode.OutputChannel
): Promise<CodegenResult> {
  const args = [
    'codegen',
    filePath,
    '--target',
    target,
    '--out-dir',
    outDir,
    '--format',
    'json',
  ];

  // Try `shipgate` on PATH first, then fall back to npx
  for (const { cmd, cmdArgs, label } of [
    { cmd: 'shipgate', cmdArgs: args, label: 'shipgate' },
    {
      cmd: process.platform === 'win32' ? 'npx.cmd' : 'npx',
      cmdArgs: ['shipgate', ...args],
      label: 'npx shipgate',
    },
  ]) {
    try {
      outputChannel.appendLine(`[ISL] Trying ${label}...`);
      const { stdout, stderr } = await execFileAsync(cmd, cmdArgs, {
        cwd,
        timeout: 60_000,
      });
      if (stderr) {
        outputChannel.appendLine(`[ISL] stderr: ${stderr}`);
      }
      return parseCodegenOutput(stdout, filePath, target, outDir, cwd);
    } catch {
      // Try next candidate
    }
  }

  return {
    success: false,
    error:
      'shipgate CLI not found. Install with: npm install -g @isl-lang/cli',
  };
}

function parseCodegenOutput(
  stdout: string,
  originalFile: string,
  target: string,
  outDir: string,
  cwd: string
): CodegenResult {
  // Try JSON parse first
  try {
    const parsed = JSON.parse(stdout) as {
      outputPath?: string;
      success?: boolean;
      error?: string;
    };
    if (parsed.outputPath && fs.existsSync(parsed.outputPath)) {
      return { success: true, outputPath: parsed.outputPath };
    }
    if (parsed.error) {
      return { success: false, error: parsed.error };
    }
  } catch {
    // not JSON — fall through
  }

  // Convention-based discovery
  const baseName = path.basename(originalFile, '.isl');
  const ext = target === 'typescript' ? '.ts' : target === 'rust' ? '.rs' : target === 'go' ? '.go' : target === 'python' ? '.py' : '.ts';

  const candidates = [
    path.join(cwd, outDir, `${baseName}${ext}`),
    path.join(path.dirname(originalFile), outDir, `${baseName}${ext}`),
    path.join(cwd, outDir, `${baseName}.spec${ext}`),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return { success: true, outputPath: candidate };
    }
  }

  // Check stdout for file paths
  for (const line of stdout.trim().split('\n')) {
    const trimmed = line.trim();
    if (trimmed && fs.existsSync(trimmed)) {
      return { success: true, outputPath: trimmed };
    }
  }

  return {
    success: false,
    error: 'Generated skeleton not found. Check CLI output.',
  };
}
