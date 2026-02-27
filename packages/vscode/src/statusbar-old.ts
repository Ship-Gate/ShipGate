/**
 * ISL VS Code Extension - Status Bar
 *
 * Manages the ISL status bar items showing version and parse/check status.
 */

import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';

export interface StatusBarManager {
  updateStatus(status: 'ready' | 'checking' | 'error', errorCount?: number): void;
  updateVersion(version: string): void;
  show(): void;
  hide(): void;
  dispose(): void;
}

interface DiagnosticCounts {
  errors: number;
  warnings: number;
}

/**
 * Create and manage ISL status bar items
 */
export function createStatusBar(
  context: vscode.ExtensionContext,
  getClient: () => LanguageClient | undefined
): StatusBarManager {
  // Version status bar item (left side)
  const versionItem = vscode.window.createStatusBarItem(
    'isl-version',
    vscode.StatusBarAlignment.Left,
    100
  );
  versionItem.name = 'ISL Version';
  versionItem.tooltip = 'ISL Language Version';

  // Status bar item (right side, near problems)
  const statusItem = vscode.window.createStatusBarItem(
    'isl-status',
    vscode.StatusBarAlignment.Right,
    100
  );
  statusItem.name = 'ISL Status';
  statusItem.command = 'workbench.actions.view.problems';

  context.subscriptions.push(versionItem, statusItem);

  let currentDiagnostics: DiagnosticCounts = { errors: 0, warnings: 0 };
  let isIslFileOpen = false;

  // Track active editor changes
  const updateVisibility = () => {
    const editor = vscode.window.activeTextEditor;
    isIslFileOpen = editor?.document.languageId === 'isl';
    
    if (isIslFileOpen) {
      versionItem.show();
      statusItem.show();
      // Update diagnostics for current file
      if (editor) {
        updateDiagnosticsForDocument(editor.document.uri);
      }
    } else {
      versionItem.hide();
      statusItem.hide();
    }
  };

  // Update diagnostics count for a document
  const updateDiagnosticsForDocument = (uri: vscode.Uri) => {
    const diagnostics = vscode.languages.getDiagnostics(uri);
    const errors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error).length;
    const warnings = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Warning).length;
    
    currentDiagnostics = { errors, warnings };
    updateStatusDisplay();
  };

  // Update the status display
  const updateStatusDisplay = () => {
    if (currentDiagnostics.errors > 0) {
      statusItem.text = `$(error) ${currentDiagnostics.errors}`;
      statusItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
      statusItem.tooltip = `ISL: ${currentDiagnostics.errors} error${currentDiagnostics.errors === 1 ? '' : 's'}. Click to show problems.`;
    } else if (currentDiagnostics.warnings > 0) {
      statusItem.text = `$(warning) ${currentDiagnostics.warnings}`;
      statusItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      statusItem.tooltip = `ISL: ${currentDiagnostics.warnings} warning${currentDiagnostics.warnings === 1 ? '' : 's'}. Click to show problems.`;
    } else {
      statusItem.text = '$(check) ISL';
      statusItem.backgroundColor = undefined;
      statusItem.tooltip = 'ISL: No problems. Click to show problems panel.';
    }
  };

  // Listen for active editor changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => {
      updateVisibility();
    })
  );

  // Listen for diagnostics changes
  context.subscriptions.push(
    vscode.languages.onDidChangeDiagnostics((e) => {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document.languageId === 'isl') {
        const changed = e.uris.some(uri => uri.toString() === editor.document.uri.toString());
        if (changed) {
          updateDiagnosticsForDocument(editor.document.uri);
        }
      }
    })
  );

  // Fetch ISL version from language server
  const fetchVersion = async () => {
    const client = getClient();
    if (client) {
      try {
        const result = await client.sendRequest<{ version: string }>('isl/version');
        if (result?.version) {
          versionItem.text = `ISL v${result.version}`;
          versionItem.tooltip = `Intent Specification Language v${result.version}`;
        }
      } catch {
        // Use fallback version
        versionItem.text = 'ISL';
        versionItem.tooltip = 'Intent Specification Language';
      }
    } else {
      versionItem.text = 'ISL';
      versionItem.tooltip = 'Intent Specification Language (LSP not connected)';
    }
  };

  // Initialize
  updateVisibility();
  fetchVersion();

  return {
    updateStatus(status: 'ready' | 'checking' | 'error', errorCount?: number): void {
      switch (status) {
        case 'ready':
          statusItem.text = '$(check) ISL';
          statusItem.backgroundColor = undefined;
          statusItem.tooltip = 'ISL: Ready';
          break;
        case 'checking':
          statusItem.text = '$(sync~spin) ISL';
          statusItem.backgroundColor = undefined;
          statusItem.tooltip = 'ISL: Checking...';
          break;
        case 'error':
          statusItem.text = `$(error) ${errorCount ?? '?'}`;
          statusItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
          statusItem.tooltip = `ISL: ${errorCount ?? 'Unknown'} error${errorCount === 1 ? '' : 's'}`;
          break;
      }
    },

    updateVersion(version: string): void {
      versionItem.text = `ISL v${version}`;
      versionItem.tooltip = `Intent Specification Language v${version}`;
    },

    show(): void {
      if (isIslFileOpen) {
        versionItem.show();
        statusItem.show();
      }
    },

    hide(): void {
      versionItem.hide();
      statusItem.hide();
    },

    dispose(): void {
      versionItem.dispose();
      statusItem.dispose();
    }
  };
}
