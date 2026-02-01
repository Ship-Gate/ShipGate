/**
 * ISL VS Code Extension
 *
 * Entry point for the Intent Specification Language extension.
 * Provides syntax highlighting, LSP integration, commands, and status bar.
 */

import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
import { createLanguageClient, startClient, stopClient } from './client';
import { registerCommands } from './commands';
import { createStatusBar, StatusBarManager } from './statusbar';

let client: LanguageClient | undefined;
let statusBar: StatusBarManager | undefined;
let outputChannel: vscode.OutputChannel;

/**
 * Extension activation
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const startTime = Date.now();
  
  outputChannel = vscode.window.createOutputChannel('ISL');
  outputChannel.appendLine('ISL extension activating...');

  // Create status bar (shows immediately for fast perceived activation)
  statusBar = createStatusBar(context, () => client);

  // Register all commands
  registerCommands(context, () => client, outputChannel);

  // Start language server if enabled
  const config = vscode.workspace.getConfiguration('isl');
  if (config.get<boolean>('languageServer.enabled', true)) {
    await startLanguageServer(context);
  }

  // Watch for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration('isl.languageServer.enabled')) {
        const enabled = vscode.workspace
          .getConfiguration('isl')
          .get<boolean>('languageServer.enabled', true);

        if (enabled && !client) {
          await startLanguageServer(context);
        } else if (!enabled && client) {
          await stopClient(client);
          client = undefined;
        }
      }

      // Handle format on save setting
      if (e.affectsConfiguration('isl.formatOnSave')) {
        updateFormatOnSave();
      }

      // Handle lint on save setting
      if (e.affectsConfiguration('isl.lintOnSave')) {
        updateLintOnSave(context);
      }
    })
  );

  // Set up format on save if enabled
  updateFormatOnSave();
  
  // Set up lint on save if enabled
  updateLintOnSave(context);

  const activationTime = Date.now() - startTime;
  outputChannel.appendLine(`ISL extension activated in ${activationTime}ms`);
  
  // Warn if activation is slow
  if (activationTime > 500) {
    outputChannel.appendLine(`Warning: Activation took ${activationTime}ms (target: <500ms)`);
  }
}

/**
 * Extension deactivation
 */
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

/**
 * Start the language server
 */
async function startLanguageServer(context: vscode.ExtensionContext): Promise<void> {
  try {
    statusBar?.updateStatus('checking');
    
    client = createLanguageClient(context, outputChannel);
    await startClient(client);
    context.subscriptions.push(client);
    
    // Set up notification handlers
    setupClientNotifications(client);
    
    // Fetch and display version
    try {
      const versionResult = await client.sendRequest<{ version: string }>('isl/version');
      if (versionResult?.version) {
        statusBar?.updateVersion(versionResult.version);
      }
    } catch {
      // Version request not supported, continue without it
    }
    
    statusBar?.updateStatus('ready');
    outputChannel.appendLine('Language server started');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    outputChannel.appendLine(`Failed to start language server: ${message}`);
    statusBar?.updateStatus('error');
    
    vscode.window.showWarningMessage(
      `ISL language server failed to start: ${message}. Syntax highlighting will still work.`
    );
  }
}

/**
 * Set up client notification handlers
 */
function setupClientNotifications(languageClient: LanguageClient): void {
  // Handle status updates from server
  languageClient.onNotification('isl/status', (params: { status: string; message?: string; errorCount?: number }) => {
    switch (params.status) {
      case 'ready':
        statusBar?.updateStatus('ready');
        break;
      case 'checking':
        statusBar?.updateStatus('checking');
        break;
      case 'error':
        statusBar?.updateStatus('error', params.errorCount);
        if (params.message) {
          vscode.window.showErrorMessage(`ISL: ${params.message}`);
        }
        break;
    }
  });

  // Handle version updates from server
  languageClient.onNotification('isl/version', (params: { version: string }) => {
    statusBar?.updateVersion(params.version);
  });
}

/**
 * Update format on save based on settings
 */
function updateFormatOnSave(): void {
  const config = vscode.workspace.getConfiguration('isl');
  const formatOnSave = config.get<boolean>('formatOnSave', true);
  
  // Update editor configuration for ISL files
  const editorConfig = vscode.workspace.getConfiguration('editor', { languageId: 'isl' });
  editorConfig.update('formatOnSave', formatOnSave, vscode.ConfigurationTarget.Workspace, true);
}

/**
 * Update lint on save based on settings
 */
function updateLintOnSave(context: vscode.ExtensionContext): void {
  const config = vscode.workspace.getConfiguration('isl');
  const lintOnSave = config.get<boolean>('lintOnSave', true);
  
  if (lintOnSave) {
    // Register save listener for linting
    const saveDisposable = vscode.workspace.onDidSaveTextDocument(async (document) => {
      if (document.languageId === 'isl' && client) {
        try {
          // Trigger diagnostics refresh
          await client.sendRequest('isl/lint', { uri: document.uri.toString() });
        } catch {
          // Lint request not supported, diagnostics will be handled by normal LSP flow
        }
      }
    });
    context.subscriptions.push(saveDisposable);
  }
}
