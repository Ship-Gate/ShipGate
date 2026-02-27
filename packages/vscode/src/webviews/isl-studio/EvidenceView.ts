/**
 * Evidence View Panel
 * 
 * VS Code webview panel for displaying verification evidence.
 * This is a read-only view that displays:
 * - Overall verification score
 * - PASS/PARTIAL/FAIL results list
 * - Assumptions and open questions
 * - Navigation actions (Open Spec, Open Report, Copy Fingerprint)
 */

import * as vscode from 'vscode';
import type {
  EvidenceViewState,
  WebviewMessage,
  ExtensionMessage
} from './evidenceViewState';
import { createInitialState } from './evidenceViewState';
import { buildEvidenceViewHtml } from './evidenceView.html';

/**
 * Manages the Evidence View webview panel
 */
export class EvidenceView {
  public static readonly viewType = 'isl.evidenceView';

  private static currentPanel: EvidenceView | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private state: EvidenceViewState;
  private disposables: vscode.Disposable[] = [];

  /**
   * Create or show the evidence view panel
   */
  public static createOrShow(
    extensionUri: vscode.Uri,
    initialState?: Partial<EvidenceViewState>
  ): EvidenceView {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (EvidenceView.currentPanel) {
      EvidenceView.currentPanel.panel.reveal(column);
      if (initialState) {
        EvidenceView.currentPanel.updateState(initialState);
      }
      return EvidenceView.currentPanel;
    }

    // Create a new panel
    const panel = vscode.window.createWebviewPanel(
      EvidenceView.viewType,
      'ISL Evidence',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri]
      }
    );

    EvidenceView.currentPanel = new EvidenceView(panel, extensionUri, initialState);
    return EvidenceView.currentPanel;
  }

  /**
   * Revive the panel from serialized state
   */
  public static revive(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    state?: EvidenceViewState
  ): EvidenceView {
    EvidenceView.currentPanel = new EvidenceView(panel, extensionUri, state);
    return EvidenceView.currentPanel;
  }

  /**
   * Get the current panel instance
   */
  public static getCurrent(): EvidenceView | undefined {
    return EvidenceView.currentPanel;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    initialState?: Partial<EvidenceViewState>
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.state = {
      ...createInitialState(),
      ...initialState
    };

    // Set the webview's initial html content
    this.updateWebview();

    // Listen for when the panel is disposed
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Update the content based on view changes
    this.panel.onDidChangeViewState(
      () => {
        if (this.panel.visible) {
          this.updateWebview();
        }
      },
      null,
      this.disposables
    );

    // Handle messages from the webview
    this.panel.webview.onDidReceiveMessage(
      (message: WebviewMessage) => this.handleMessage(message),
      null,
      this.disposables
    );
  }

  /**
   * Update the panel state and refresh the view
   */
  public updateState(newState: Partial<EvidenceViewState>): void {
    this.state = {
      ...this.state,
      ...newState,
      isLoading: false
    };
    this.sendMessage({ type: 'updateState', state: this.state });
  }

  /**
   * Set loading state
   */
  public setLoading(isLoading: boolean): void {
    this.state.isLoading = isLoading;
    this.sendMessage({ type: 'setLoading', isLoading });
  }

  /**
   * Set error state
   */
  public setError(error: string): void {
    this.state = {
      ...this.state,
      error,
      isLoading: false
    };
    this.sendMessage({ type: 'setError', error });
  }

  /**
   * Get the current state
   */
  public getState(): EvidenceViewState {
    return this.state;
  }

  /**
   * Dispose the panel
   */
  public dispose(): void {
    EvidenceView.currentPanel = undefined;

    this.panel.dispose();

    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  /**
   * Send a message to the webview
   */
  private sendMessage(message: ExtensionMessage): void {
    if (this.panel.visible) {
      this.panel.webview.postMessage(message);
    }
  }

  /**
   * Handle messages from the webview
   */
  private async handleMessage(message: WebviewMessage): Promise<void> {
    switch (message.type) {
      case 'openSpec':
        await this.openSpec();
        break;

      case 'openReport':
        await this.openReport();
        break;

      case 'copyFingerprint':
        await this.copyFingerprint();
        break;

      case 'refresh':
        await this.refresh();
        break;

      case 'navigateToResult':
        await this.navigateToResult(message.resultId);
        break;
    }
  }

  /**
   * Open the spec file in the editor
   */
  private async openSpec(): Promise<void> {
    const { specFile } = this.state.metadata;
    if (!specFile.path) {
      vscode.window.showWarningMessage('No spec file available');
      return;
    }

    try {
      const uri = vscode.Uri.file(specFile.path);
      const document = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(document);

      // Navigate to specific line if provided
      if (specFile.line !== undefined) {
        const line = Math.max(0, specFile.line - 1);
        const column = specFile.column ?? 0;
        const position = new vscode.Position(line, column);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(
          new vscode.Range(position, position),
          vscode.TextEditorRevealType.InCenter
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to open spec: ${message}`);
    }
  }

  /**
   * Open the report file in the editor
   */
  private async openReport(): Promise<void> {
    const { reportFile } = this.state.metadata;
    if (!reportFile?.path) {
      vscode.window.showWarningMessage('No report file available');
      return;
    }

    try {
      const uri = vscode.Uri.file(reportFile.path);
      const document = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(document);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to open report: ${message}`);
    }
  }

  /**
   * Copy the fingerprint to clipboard
   */
  private async copyFingerprint(): Promise<void> {
    const { fingerprint } = this.state.metadata;
    if (!fingerprint) {
      vscode.window.showWarningMessage('No fingerprint available');
      return;
    }

    await vscode.env.clipboard.writeText(fingerprint);
    vscode.window.showInformationMessage('Fingerprint copied to clipboard');
  }

  /**
   * Refresh the evidence data
   */
  private async refresh(): Promise<void> {
    this.setLoading(true);
    
    // Fire event for external handlers to refresh data
    // The extension can listen and call updateState with fresh data
    vscode.commands.executeCommand('isl.refreshEvidence');
  }

  /**
   * Navigate to a specific result in the spec
   */
  private async navigateToResult(resultId: string): Promise<void> {
    const result = this.state.results.find(r => r.id === resultId);
    if (!result) {
      return;
    }

    // Try to navigate to the result location
    // This would require location info in the result
    await this.openSpec();
  }

  /**
   * Update the webview HTML content
   */
  private updateWebview(): void {
    const webview = this.panel.webview;
    const nonce = this.getNonce();
    const cspSource = webview.cspSource;

    this.panel.webview.html = buildEvidenceViewHtml(this.state, nonce, cspSource);
  }

  /**
   * Generate a nonce for CSP
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
export class EvidenceViewSerializer implements vscode.WebviewPanelSerializer {
  constructor(private readonly extensionUri: vscode.Uri) {}

  async deserializeWebviewPanel(
    webviewPanel: vscode.WebviewPanel,
    state: EvidenceViewState
  ): Promise<void> {
    EvidenceView.revive(webviewPanel, this.extensionUri, state);
  }
}
