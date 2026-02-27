/**
 * ShipGate Diagnostics Integration
 *
 * Bridges the LSP diagnostics with ShipGate verify output.
 * Watches for ISL file saves and re-runs verification to keep
 * the Problems panel up-to-date.
 */

import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';

/**
 * Set up diagnostic integration that listens for file saves
 * and triggers LSP-based re-validation for ISL files.
 */
export function setupDiagnosticsIntegration(
  context: vscode.ExtensionContext,
  getClient: () => LanguageClient | undefined,
  outputChannel: vscode.OutputChannel
): void {
  const config = vscode.workspace.getConfiguration('shipgate');
  const lintOnSave = config.get<boolean>('lintOnSave', true);

  if (!lintOnSave) return;

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (document) => {
      if (document.languageId !== 'isl') return;

      const client = getClient();
      if (!client) return;

      try {
        await client.sendRequest('isl/lint', {
          uri: document.uri.toString(),
        });
      } catch {
        // Lint request not supported — LSP handles diagnostics via normal flow
        outputChannel.appendLine(
          '[ShipGate] Note: isl/lint request not supported by server, using standard LSP diagnostics'
        );
      }
    })
  );
}

/**
 * Count diagnostics across all open ISL files.
 * Used by the status bar to show error/warning counts.
 */
export function countIslDiagnostics(): { errors: number; warnings: number } {
  let errors = 0;
  let warnings = 0;

  for (const [uri, diagnostics] of vscode.languages.getDiagnostics()) {
    // Only count ISL files
    if (!uri.fsPath.endsWith('.isl')) continue;

    for (const diag of diagnostics) {
      if (diag.severity === vscode.DiagnosticSeverity.Error) {
        errors++;
      } else if (diag.severity === vscode.DiagnosticSeverity.Warning) {
        warnings++;
      }
    }
  }

  return { errors, warnings };
}
