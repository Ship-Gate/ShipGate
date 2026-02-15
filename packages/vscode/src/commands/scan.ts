/**
 * Shipgate Scan Commands
 *
 * runScan, openReport, openSettings, selectWorkspaceRoot
 */

import * as vscode from 'vscode';
import { runShipgateScan } from '../cli/shipgateRunner';
import { applyScanDiagnostics } from '../diagnostics/diagnosticsProvider';
import { getShipgateConfig } from '../config/config';
import { ShipgateReportPanel } from '../views/shipgateReport/reportPanel';

export type ScanState = {
  lastResult: import('../model/types').ScanResult | null;
  workspaceRoot: string;
};

export interface ScanStatusBarCallbacks {
  setRunning(): void;
  setVerdict(verdict: 'SHIP' | 'WARN' | 'NO_SHIP' | 'Idle', timestamp?: string): void;
}

export function registerScanCommands(
  context: vscode.ExtensionContext,
  state: ScanState,
  diagnosticCollection: vscode.DiagnosticCollection,
  onScanComplete: (result: import('../model/types').ScanResult | null) => void,
  statusBar: ScanStatusBarCallbacks | null
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('shipgate.runScan', async () => {
      const root = state.workspaceRoot || getWorkspaceRoot();
      if (!root) {
        vscode.window.showWarningMessage('Shipgate: Open a workspace folder to run scan.');
        return;
      }

      const config = getShipgateConfig(root);
      const projectRoot = config.projectRoot || root;

      const outputChannel = vscode.window.createOutputChannel('Shipgate Scan');
      outputChannel.appendLine(`[Shipgate] Running scan in ${projectRoot}...`);

      onScanComplete(null);
      statusBar?.setRunning();

      // DEBUG: log which CLI binary will be resolved
      const { resolveShipgateExecutable } = await import('../cli/shipgateRunner');
      const resolved = await resolveShipgateExecutable(projectRoot, config.executablePath || undefined);
      outputChannel.appendLine(`[Shipgate DEBUG] executable=${resolved.executable} args=${resolved.args.join(' ')}`);

      const token = new vscode.CancellationTokenSource().token;
      const out = await runShipgateScan({
        workspaceRoot: projectRoot,
        executablePath: config.executablePath || undefined,
        token,
      });

      // DEBUG: log raw scan output
      outputChannel.appendLine(`[Shipgate DEBUG] success=${out.success}, hasResult=${!!out.result}, error=${out.error ?? 'none'}`);
      if (out.result) {
        const r = out.result.result;
        outputChannel.appendLine(`[Shipgate DEBUG] verdict=${r.verdict}, score=${r.score}, files=${r.files.length}, mode=${r.mode}`);
      }
      outputChannel.show(true);

      if (out.success && out.result) {
        state.lastResult = out.result;
        applyScanDiagnostics(diagnosticCollection, out.result, projectRoot);
        onScanComplete(out.result);
        const verdict = out.result.result.verdict;
        const score = out.result.result.score;
        statusBar?.setVerdict(verdict, out.result.metadata.timestamp);
        outputChannel.appendLine(`[Shipgate] Scan complete: ${verdict} score=${score}`);
        vscode.window.showInformationMessage(`Shipgate: ${verdict} — Score: ${Math.round(score * 100)}%`);
      } else {
        const err = out.error || 'Unknown error';
        outputChannel.appendLine(`[Shipgate] Scan failed: ${err}`);
        if (out.stderr) outputChannel.appendLine(out.stderr);
        const hint =
          /command not found|Cannot find module|ENOENT|not found/i.test(err) ||
          (out.stderr && /command not found|Cannot find module|ENOENT/i.test(out.stderr))
            ? ' Build the CLI first: pnpm --filter shipgate build'
            : '';
        vscode.window.showErrorMessage(`Shipgate scan failed: ${err}${hint}`);
        statusBar?.setVerdict('Idle');
      }
    }),

    vscode.commands.registerCommand('shipgate.openReport', () => {
      const root = state.workspaceRoot || getWorkspaceRoot();
      if (!root) {
        vscode.window.showWarningMessage('Shipgate: Open a workspace folder first.');
        return;
      }
      const config = getShipgateConfig(root);
      ShipgateReportPanel.createOrShow(
        context.extensionUri,
        state.lastResult,
        root,
        config.configPath || null
      );
    }),

    vscode.commands.registerCommand('shipgate.openSettings', () => {
      vscode.commands.executeCommand('workbench.action.openSettings', 'shipgate');
    }),

    vscode.commands.registerCommand('shipgate.selectWorkspaceRoot', async () => {
      const folders = vscode.workspace.workspaceFolders;
      if (!folders || folders.length === 0) {
        vscode.window.showInformationMessage('No workspace folders open.');
        return;
      }
      if (folders.length === 1) {
        state.workspaceRoot = folders[0].uri.fsPath;
        vscode.window.showInformationMessage(`Shipgate: Using ${state.workspaceRoot}`);
        return;
      }
      const chosen = await vscode.window.showQuickPick(
        folders.map((f) => ({ label: f.name, fsPath: f.uri.fsPath })),
        { placeHolder: 'Select workspace root for Shipgate scan' }
      );
      if (chosen) {
        state.workspaceRoot = chosen.fsPath;
        vscode.window.showInformationMessage(`Shipgate: Using ${chosen.fsPath}`);
      }
    })
  );
}

function getWorkspaceRoot(): string {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return '';
  return folders[0].uri.fsPath;
}
