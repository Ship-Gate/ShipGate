/**
 * ShipGate ISL — VS Code Extension
 *
 * Entry point. Wires up the LSP client, ShipGate commands,
 * CodeLens provider, status bar, and diagnostics integration.
 */

import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
import { createLanguageClient, startClient, stopClient } from './client';
import { registerCommands } from './commands-legacy';
import {
  registerGenerateCommand,
  registerGenerateSkeletonCommand,
  registerVerifyCommands,
  registerCoverageCommand,
  registerValidateCommand,
  getLastCoverageReport,
} from './commands/index';
import { registerCodeLensProvider, setupDiagnosticsIntegration } from './providers/index';
import { createShipGateStatusBar, ShipGateStatusBar } from './views/status-bar';

let client: LanguageClient | undefined;
let statusBar: ShipGateStatusBar | undefined;
let outputChannel: vscode.OutputChannel;

// ============================================================================
// Activation
// ============================================================================

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const startTime = Date.now();

  outputChannel = vscode.window.createOutputChannel('ShipGate ISL');
  outputChannel.appendLine('[ShipGate] Extension activating...');

  // ── Status bar (renders immediately for perceived speed) ──
  statusBar = createShipGateStatusBar(context);

  // ── ShipGate commands ──
  registerGenerateCommand(context, outputChannel);
  registerGenerateSkeletonCommand(context, outputChannel);
  const diagnosticCollection = registerVerifyCommands(context, outputChannel);
  registerCoverageCommand(context, outputChannel);
  registerValidateCommand(context, () => client, outputChannel);

  // ── Legacy ISL commands (parse, typecheck, codegen, etc.) ──
  registerCommands(context, () => client, outputChannel);

  // ── CodeLens provider ──
  const codeLensProvider = registerCodeLensProvider(context);

  // ── Diagnostics integration ──
  setupDiagnosticsIntegration(context, () => client, outputChannel);

  // ── Language server ──
  const config = vscode.workspace.getConfiguration('shipgate');
  if (config.get<boolean>('languageServer.enabled', true)) {
    await startLanguageServer(context);
  }

  // ── Watch for config changes ──
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration('shipgate.languageServer.enabled')) {
        const enabled = vscode.workspace
          .getConfiguration('shipgate')
          .get<boolean>('languageServer.enabled', true);

        if (enabled && !client) {
          await startLanguageServer(context);
        } else if (!enabled && client) {
          await stopClient(client);
          client = undefined;
          statusBar?.setReady();
        }
      }
    })
  );

  // ── Refresh CodeLens on diagnostics change ──
  context.subscriptions.push(
    vscode.languages.onDidChangeDiagnostics(() => {
      codeLensProvider.refresh();
    })
  );

  // ── Refresh status bar on coverage data ──
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(() => {
      const report = getLastCoverageReport();
      if (report) {
        statusBar?.updateCoverage(report);
      }
    })
  );

  const activationTime = Date.now() - startTime;
  outputChannel.appendLine(`[ShipGate] Extension activated in ${activationTime}ms`);

  if (activationTime > 500) {
    outputChannel.appendLine(
      `[ShipGate] Warning: Activation took ${activationTime}ms (target: <500ms)`
    );
  }
}

// ============================================================================
// Deactivation
// ============================================================================

export async function deactivate(): Promise<void> {
  if (client) {
    await stopClient(client);
    client = undefined;
  }
  if (statusBar) {
    statusBar.dispose();
    statusBar = undefined;
  }
}

// ============================================================================
// Language Server Lifecycle
// ============================================================================

async function startLanguageServer(context: vscode.ExtensionContext): Promise<void> {
  try {
    statusBar?.setChecking();

    client = createLanguageClient(context, outputChannel);
    await startClient(client);
    context.subscriptions.push(client);

    setupClientNotifications(client);

    // Fetch server version
    try {
      const versionResult = await client.sendRequest<{ version: string }>('isl/version');
      if (versionResult?.version) {
        statusBar?.setVersion(versionResult.version);
      }
    } catch {
      // Version request not supported — continue
    }

    statusBar?.setReady();
    outputChannel.appendLine('[ShipGate] Language server started');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    outputChannel.appendLine(`[ShipGate] Failed to start language server: ${message}`);
    statusBar?.setError();

    vscode.window.showWarningMessage(
      `ShipGate: Language server failed to start: ${message}. Syntax highlighting will still work.`
    );
  }
}

function setupClientNotifications(languageClient: LanguageClient): void {
  // Server status updates
  languageClient.onNotification(
    'isl/status',
    (params: { status: string; message?: string; errorCount?: number }) => {
      switch (params.status) {
        case 'ready':
          statusBar?.setReady();
          break;
        case 'checking':
          statusBar?.setChecking();
          break;
        case 'error':
          statusBar?.setError(params.errorCount);
          if (params.message) {
            vscode.window.showErrorMessage(`ShipGate: ${params.message}`);
          }
          break;
      }
    }
  );

  // Server version updates
  languageClient.onNotification('isl/version', (params: { version: string }) => {
    statusBar?.setVersion(params.version);
  });
}
