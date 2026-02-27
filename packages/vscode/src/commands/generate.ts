/**
 * ShipGate: Generate ISL Spec Command
 *
 * Runs `shipgate isl generate` on the current source file
 * and opens the resulting .isl spec in a split pane.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

interface GenerateResult {
  success: boolean;
  specPath?: string;
  error?: string;
}

/**
 * Register the generate spec command
 */
export function registerGenerateCommand(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('shipgate.generateSpec', () =>
      generateSpec(outputChannel)
    )
  );
}

/**
 * Generate an ISL spec from the current source file.
 *
 * Invokes `shipgate isl generate <file>`, parses the output path,
 * and opens the generated .isl spec beside the original file.
 */
async function generateSpec(outputChannel: vscode.OutputChannel): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('ShipGate: Open a source file first');
    return;
  }

  const filePath = editor.document.fileName;
  const ext = path.extname(filePath);
  const supportedExts = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs'];

  if (!supportedExts.includes(ext)) {
    vscode.window.showWarningMessage(
      `ShipGate: File type "${ext}" is not supported for spec generation. ` +
        `Supported: ${supportedExts.join(', ')}`
    );
    return;
  }

  // Save the file before generating
  if (editor.document.isDirty) {
    await editor.document.save();
  }

  outputChannel.appendLine(`[ShipGate] Generating spec for: ${filePath}`);
  outputChannel.show(true);

  const result = await runGenerate(filePath, outputChannel);

  if (result.success && result.specPath) {
    outputChannel.appendLine(`[ShipGate] Spec generated: ${result.specPath}`);

    // Open the generated spec in a split pane
    try {
      const doc = await vscode.workspace.openTextDocument(result.specPath);
      await vscode.window.showTextDocument(doc, {
        viewColumn: vscode.ViewColumn.Beside,
        preview: false,
      });
      vscode.window.showInformationMessage(
        `ShipGate: ISL spec generated at ${path.basename(result.specPath)}`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      outputChannel.appendLine(`[ShipGate] Failed to open spec: ${message}`);
      vscode.window.showErrorMessage(`ShipGate: Spec generated but could not open: ${message}`);
    }
  } else {
    const errMsg = result.error ?? 'Unknown error';
    outputChannel.appendLine(`[ShipGate] Generation failed: ${errMsg}`);
    vscode.window.showErrorMessage(`ShipGate: Spec generation failed — ${errMsg}`);
  }
}

/**
 * Run the shipgate CLI to generate a spec.
 * Falls back to npx if shipgate is not on PATH.
 */
async function runGenerate(
  filePath: string,
  outputChannel: vscode.OutputChannel
): Promise<GenerateResult> {
  const workspaceRoot =
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? path.dirname(filePath);

  const args = ['isl', 'generate', filePath, '--format', 'json'];

  try {
    // Try shipgate directly first
    const { stdout, stderr } = await execFileAsync('shipgate', args, {
      cwd: workspaceRoot,
      timeout: 30_000,
    });

    if (stderr) {
      outputChannel.appendLine(`[ShipGate] stderr: ${stderr}`);
    }

    return parseGenerateOutput(stdout, filePath);
  } catch {
    // Fall back to npx
    try {
      outputChannel.appendLine('[ShipGate] Falling back to npx shipgate...');
      const { stdout, stderr } = await execFileAsync(
        process.platform === 'win32' ? 'npx.cmd' : 'npx',
        ['shipgate', ...args],
        {
          cwd: workspaceRoot,
          timeout: 60_000,
        }
      );

      if (stderr) {
        outputChannel.appendLine(`[ShipGate] stderr: ${stderr}`);
      }

      return parseGenerateOutput(stdout, filePath);
    } catch (npxErr) {
      const message = npxErr instanceof Error ? npxErr.message : String(npxErr);
      return { success: false, error: message };
    }
  }
}

/**
 * Parse the JSON output from `shipgate isl generate`.
 * Falls back to convention-based path detection.
 */
function parseGenerateOutput(stdout: string, originalFile: string): GenerateResult {
  try {
    const parsed = JSON.parse(stdout) as { specPath?: string; success?: boolean; error?: string };
    if (parsed.specPath && fs.existsSync(parsed.specPath)) {
      return { success: true, specPath: parsed.specPath };
    }
    if (parsed.error) {
      return { success: false, error: parsed.error };
    }
  } catch {
    // JSON parse failed — try convention
  }

  // Convention: same directory, same name but .isl extension
  const conventionPath = originalFile.replace(/\.[^.]+$/, '.isl');
  if (fs.existsSync(conventionPath)) {
    return { success: true, specPath: conventionPath };
  }

  // Convention: specs/ subdirectory
  const dir = path.dirname(originalFile);
  const baseName = path.basename(originalFile).replace(/\.[^.]+$/, '.isl');
  const specsPath = path.join(dir, 'specs', baseName);
  if (fs.existsSync(specsPath)) {
    return { success: true, specPath: specsPath };
  }

  // If stdout contains a file path on any line
  const lines = stdout.trim().split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.endsWith('.isl') && fs.existsSync(trimmed)) {
      return { success: true, specPath: trimmed };
    }
  }

  return {
    success: false,
    error: 'Generated spec file not found. Ensure shipgate CLI is installed.',
  };
}
