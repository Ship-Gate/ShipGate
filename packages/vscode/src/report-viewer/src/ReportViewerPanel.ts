/**
 * Report Viewer Panel
 * 
 * VS Code webview panel for displaying evidence reports with
 * clause navigation and "Fix Next" functionality.
 */

import * as vscode from 'vscode';
import type {
  ReportViewerState,
  EvidenceReport,
  ClauseResult,
  WebviewToExtensionMessage,
  ExtensionToWebviewMessage,
  ClauseStatus,
  ClauseCategory
} from './types';
import { createInitialState, filterClauses } from './types';
import { navigateToLocation, navigateToNextFailure, applyDiagnostics } from './navigation';
import { buildReportViewerHtml } from './reportViewer.html';

/**
 * Manages the Report Viewer webview panel
 */
export class ReportViewerPanel {
  public static readonly viewType = 'isl.reportViewer';

  private static currentPanel: ReportViewerPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private state: ReportViewerState;
  private disposables: vscode.Disposable[] = [];
  private diagnosticCollection: vscode.DiagnosticCollection;

  /**
   * Create or show the report viewer panel
   */
  public static createOrShow(
    extensionUri: vscode.Uri,
    initialReport?: EvidenceReport
  ): ReportViewerPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (ReportViewerPanel.currentPanel) {
      ReportViewerPanel.currentPanel.panel.reveal(column);
      if (initialReport) {
        ReportViewerPanel.currentPanel.loadReport(initialReport);
      }
      return ReportViewerPanel.currentPanel;
    }

    // Create a new panel
    const panel = vscode.window.createWebviewPanel(
      ReportViewerPanel.viewType,
      'Evidence Report',
      column || vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri]
      }
    );

    ReportViewerPanel.currentPanel = new ReportViewerPanel(panel, extensionUri, initialReport);
    return ReportViewerPanel.currentPanel;
  }

  /**
   * Revive the panel from serialized state
   */
  public static revive(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    state?: ReportViewerState
  ): ReportViewerPanel {
    ReportViewerPanel.currentPanel = new ReportViewerPanel(panel, extensionUri, state?.report ?? undefined);
    return ReportViewerPanel.currentPanel;
  }

  /**
   * Get the current panel instance
   */
  public static getCurrent(): ReportViewerPanel | undefined {
    return ReportViewerPanel.currentPanel;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    initialReport?: EvidenceReport
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.state = {
      ...createInitialState(),
      report: initialReport ?? null,
      isLoading: !initialReport
    };

    // Create diagnostic collection for showing failures
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('isl-evidence');

    // Set initial HTML
    this.updateWebview();

    // Update diagnostics if we have a report
    if (initialReport) {
      applyDiagnostics(this.diagnosticCollection, initialReport);
    }

    // Listen for panel disposal
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Update on visibility change
    this.panel.onDidChangeViewState(
      () => {
        if (this.panel.visible) {
          this.updateWebview();
        }
      },
      null,
      this.disposables
    );

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage(
      (message: WebviewToExtensionMessage) => this.handleMessage(message),
      null,
      this.disposables
    );
  }

  /**
   * Load a new evidence report
   */
  public loadReport(report: EvidenceReport): void {
    this.state = {
      ...this.state,
      report,
      isLoading: false,
      error: undefined,
      selectedClauseId: undefined
    };
    
    this.sendMessage({ type: 'loadReport', report });
    applyDiagnostics(this.diagnosticCollection, report);
  }

  /**
   * Set loading state
   */
  public setLoading(isLoading: boolean): void {
    this.state = { ...this.state, isLoading };
    this.sendMessage({ type: 'setLoading', isLoading });
  }

  /**
   * Set error state
   */
  public setError(error: string): void {
    this.state = { ...this.state, error, isLoading: false };
    this.sendMessage({ type: 'setError', error });
  }

  /**
   * Highlight a specific clause
   */
  public highlightClause(clauseId: string): void {
    this.state = { ...this.state, selectedClauseId: clauseId };
    this.sendMessage({ type: 'highlightClause', clauseId });
  }

  /**
   * Get current state
   */
  public getState(): ReportViewerState {
    return this.state;
  }

  /**
   * Get current report
   */
  public getReport(): EvidenceReport | null {
    return this.state.report;
  }

  /**
   * Dispose the panel
   */
  public dispose(): void {
    ReportViewerPanel.currentPanel = undefined;

    this.diagnosticCollection.dispose();
    this.panel.dispose();

    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  /**
   * Send message to webview
   */
  private sendMessage(message: ExtensionToWebviewMessage): void {
    if (this.panel.visible) {
      this.panel.webview.postMessage(message);
    }
  }

  /**
   * Handle messages from webview
   */
  private async handleMessage(message: WebviewToExtensionMessage): Promise<void> {
    switch (message.type) {
      case 'ready':
        // Webview is ready
        break;

      case 'openFile':
        await navigateToLocation(message.location);
        break;

      case 'fixNext':
        if (this.state.report) {
          const clause = await navigateToNextFailure(this.state.report);
          if (clause) {
            this.highlightClause(clause.id);
          }
        }
        break;

      case 'selectClause':
        this.highlightClause(message.clauseId);
        // Also navigate to the clause
        if (this.state.report) {
          const clause = this.state.report.clauses.find(c => c.id === message.clauseId);
          if (clause?.location) {
            await navigateToLocation(clause.location);
          }
        }
        break;

      case 'refresh':
        // Fire refresh command for external handlers
        await vscode.commands.executeCommand('isl.reportViewer.refresh');
        break;

      case 'copyClipboard':
        await vscode.env.clipboard.writeText(message.text);
        vscode.window.showInformationMessage('Copied to clipboard');
        break;

      case 'filterByStatus':
        this.state = { ...this.state, statusFilter: message.status };
        this.sendMessage({ 
          type: 'updateFilters', 
          statusFilter: message.status 
        });
        break;

      case 'filterByCategory':
        this.state = { ...this.state, categoryFilter: message.category };
        this.sendMessage({ 
          type: 'updateFilters', 
          categoryFilter: message.category 
        });
        break;
    }
  }

  /**
   * Update webview HTML
   */
  private updateWebview(): void {
    const webview = this.panel.webview;
    const nonce = this.getNonce();
    const cspSource = webview.cspSource;

    this.panel.webview.html = buildReportViewerHtml(this.state, nonce, cspSource);
  }

  /**
   * Generate nonce for CSP
   */
  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}

/**
 * Serializer for webview persistence
 */
export class ReportViewerSerializer implements vscode.WebviewPanelSerializer {
  constructor(private readonly extensionUri: vscode.Uri) {}

  async deserializeWebviewPanel(
    webviewPanel: vscode.WebviewPanel,
    state: ReportViewerState
  ): Promise<void> {
    ReportViewerPanel.revive(webviewPanel, this.extensionUri, state);
  }
}
