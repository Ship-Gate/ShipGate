/**
 * ShipGate: Validate ISL Command
 *
 * Triggers LSP diagnostics validation for the current ISL file.
 * This command uses the language server to parse and typecheck the file,
 * then displays diagnostics in the Problems panel.
 */

import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';

/**
 * Register the validate ISL command
 */
export function registerValidateCommand(
  context: vscode.ExtensionContext,
  getClient: () => LanguageClient | undefined,
  outputChannel: vscode.OutputChannel
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('shipgate.validateISL', async () => {
      await validateCurrentFile(getClient, outputChannel);
    })
  );
}

/**
 * Validate the current ISL file using the LSP server
 */
async function validateCurrentFile(
  getClient: () => LanguageClient | undefined,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor?.document) {
    vscode.window.showWarningMessage('ShipGate: Open an ISL file first');
    return;
  }

  if (editor.document.languageId !== 'isl') {
    vscode.window.showWarningMessage('ShipGate: Current file is not an ISL file');
    return;
  }

  const client = getClient();
  if (!client) {
    vscode.window.showWarningMessage(
      'ShipGate: Language server is not running. Enable it in settings (shipgate.languageServer.enabled)'
    );
    return;
  }

  const uri = editor.document.uri.toString();
  outputChannel.appendLine(`[ShipGate] Validating ISL: ${editor.document.fileName}`);
  outputChannel.show(true);

  try {
    // Trigger validation by requesting diagnostics from the server
    // The server will parse and typecheck, then send diagnostics
    const result = await client.sendRequest<{ valid: boolean; errors: string[] }>(
      'isl/validate',
      { uri }
    );

    if (result.valid) {
      vscode.window.showInformationMessage('ShipGate: ISL file is valid ✓');
      outputChannel.appendLine('[ShipGate] Validation passed');
    } else {
      const errorCount = result.errors.length;
      const message = `ShipGate: Found ${errorCount} error${errorCount === 1 ? '' : 's'}`;
      vscode.window.showWarningMessage(message, 'Show Problems').then((choice) => {
        if (choice === 'Show Problems') {
          vscode.commands.executeCommand('workbench.actions.view.problems');
        }
      });
      outputChannel.appendLine(`[ShipGate] Validation found ${errorCount} error(s):`);
      for (const error of result.errors) {
        outputChannel.appendLine(`  - ${error}`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    outputChannel.appendLine(`[ShipGate] Validation error: ${message}`);
    vscode.window.showErrorMessage(`ShipGate: Validation failed - ${message}`);
  }
}
