/**
 * ShipGate: Verify Commands
 *
 * - shipgate.verify    → verify current file, push results to Problems panel
 * - shipgate.verifyAll → verify entire workspace
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/** Shape of a single violation from the CLI JSON output */
interface VerifyViolation {
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  rule?: string;
  spec?: string;
}

/** Shape of the full verify JSON output */
interface VerifyOutput {
  success: boolean;
  violations: VerifyViolation[];
  summary?: {
    total: number;
    passed: number;
    failed: number;
    specced: number;
    specless: number;
  };
}

let diagnosticCollection: vscode.DiagnosticCollection;

/**
 * Register verify commands and create the diagnostic collection.
 */
export function registerVerifyCommands(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel
): vscode.DiagnosticCollection {
  diagnosticCollection = vscode.languages.createDiagnosticCollection('shipgate');
  context.subscriptions.push(diagnosticCollection);

  context.subscriptions.push(
    vscode.commands.registerCommand('shipgate.verify', () =>
      verifyCurrentFile(outputChannel)
    ),
    vscode.commands.registerCommand('shipgate.verifyAll', () =>
      verifyWorkspace(outputChannel)
    )
  );

  return diagnosticCollection;
}

/**
 * Get the shared diagnostic collection (for other modules).
 */
export function getDiagnosticCollection(): vscode.DiagnosticCollection {
  return diagnosticCollection;
}

// ---------------------------------------------------------------------------
// Verify current file
// ---------------------------------------------------------------------------

async function verifyCurrentFile(outputChannel: vscode.OutputChannel): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('ShipGate: Open a file first');
    return;
  }

  if (editor.document.isDirty) {
    await editor.document.save();
  }

  const filePath = editor.document.fileName;
  outputChannel.appendLine(`[ShipGate] Verifying: ${filePath}`);
  outputChannel.show(true);

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'ShipGate: Verifying...',
      cancellable: false,
    },
    async () => {
      const result = await runVerify([filePath], outputChannel);
      applyDiagnostics(result);
      showVerifySummary(result, outputChannel);
    }
  );
}

// ---------------------------------------------------------------------------
// Verify workspace
// ---------------------------------------------------------------------------

async function verifyWorkspace(outputChannel: vscode.OutputChannel): Promise<void> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    vscode.window.showWarningMessage('ShipGate: No workspace folder open');
    return;
  }

  outputChannel.appendLine(`[ShipGate] Verifying workspace: ${workspaceRoot}`);
  outputChannel.show(true);

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'ShipGate: Verifying workspace...',
      cancellable: false,
    },
    async () => {
      const result = await runVerify([], outputChannel);
      applyDiagnostics(result);
      showVerifySummary(result, outputChannel);
    }
  );
}

// ---------------------------------------------------------------------------
// CLI invocation
// ---------------------------------------------------------------------------

async function runVerify(
  targets: string[],
  outputChannel: vscode.OutputChannel
): Promise<VerifyOutput> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
  const args = ['verify', '--format', 'json', ...targets];

  const runWithBin = async (
    bin: string,
    extraArgs: string[]
  ): Promise<{ stdout: string; stderr: string }> =>
    execFileAsync(bin, extraArgs, {
      cwd: workspaceRoot,
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
    });

  try {
    const { stdout, stderr } = await runWithBin('shipgate', args);
    if (stderr) outputChannel.appendLine(`[ShipGate] stderr: ${stderr}`);
    return parseVerifyOutput(stdout);
  } catch {
    try {
      outputChannel.appendLine('[ShipGate] Falling back to npx shipgate...');
      const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      const { stdout, stderr } = await runWithBin(npx, ['shipgate', ...args]);
      if (stderr) outputChannel.appendLine(`[ShipGate] stderr: ${stderr}`);
      return parseVerifyOutput(stdout);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      outputChannel.appendLine(`[ShipGate] Verify failed: ${message}`);
      return { success: false, violations: [] };
    }
  }
}

function parseVerifyOutput(stdout: string): VerifyOutput {
  try {
    return JSON.parse(stdout) as VerifyOutput;
  } catch {
    // If JSON fails, treat any output as a single error
    return {
      success: false,
      violations: [],
      summary: undefined,
    };
  }
}

// ---------------------------------------------------------------------------
// Diagnostics integration
// ---------------------------------------------------------------------------

function applyDiagnostics(result: VerifyOutput): void {
  diagnosticCollection.clear();

  const grouped = new Map<string, vscode.Diagnostic[]>();

  for (const v of result.violations) {
    const absPath = path.isAbsolute(v.file)
      ? v.file
      : path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '', v.file);

    const uri = vscode.Uri.file(absPath).toString();

    if (!grouped.has(uri)) {
      grouped.set(uri, []);
    }

    const range = new vscode.Range(
      Math.max(0, v.line - 1),
      Math.max(0, v.column - 1),
      Math.max(0, (v.endLine ?? v.line) - 1),
      Math.max(0, (v.endColumn ?? v.column + 20) - 1)
    );

    const severity =
      v.severity === 'error'
        ? vscode.DiagnosticSeverity.Error
        : v.severity === 'warning'
          ? vscode.DiagnosticSeverity.Warning
          : vscode.DiagnosticSeverity.Information;

    const diag = new vscode.Diagnostic(range, v.message, severity);
    diag.source = 'shipgate';
    if (v.rule) {
      diag.code = v.rule;
    }

    grouped.get(uri)!.push(diag);
  }

  for (const [uriStr, diags] of grouped) {
    diagnosticCollection.set(vscode.Uri.parse(uriStr), diags);
  }
}

// ---------------------------------------------------------------------------
// Summary display
// ---------------------------------------------------------------------------

function showVerifySummary(result: VerifyOutput, outputChannel: vscode.OutputChannel): void {
  const violationCount = result.violations.length;
  const summary = result.summary;

  if (summary) {
    outputChannel.appendLine(
      `[ShipGate] Results: ${summary.passed}/${summary.total} passed, ` +
        `${summary.specced} specced, ${summary.specless} specless`
    );
  }

  if (result.success) {
    const msg = summary
      ? `ShipGate: All ${summary.passed} checks passed`
      : 'ShipGate: Verification passed';
    vscode.window.showInformationMessage(msg);
  } else {
    const errCount = result.violations.filter((v) => v.severity === 'error').length;
    const warnCount = result.violations.filter((v) => v.severity === 'warning').length;
    const parts: string[] = [];
    if (errCount > 0) parts.push(`${errCount} error${errCount === 1 ? '' : 's'}`);
    if (warnCount > 0) parts.push(`${warnCount} warning${warnCount === 1 ? '' : 's'}`);

    const msg = `ShipGate: ${parts.join(', ') || `${violationCount} issue${violationCount === 1 ? '' : 's'}`}`;
    vscode.window.showWarningMessage(msg, 'Show Problems').then((choice) => {
      if (choice === 'Show Problems') {
        vscode.commands.executeCommand('workbench.actions.view.problems');
      }
    });
  }
}
