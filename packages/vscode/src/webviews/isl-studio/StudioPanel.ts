/**
 * ISL Studio Panel
 * 
 * VS Code webview panel for the ISL Studio - the main interface for
 * generating, previewing, and verifying ISL specifications from
 * natural language prompts.
 */

import * as vscode from 'vscode';
import type {
  StudioState,
  StudioWebviewMessage,
  StudioExtensionMessage,
  GeneratedSpec,
  StudioScore
} from './studioState';
import { createInitialStudioState } from './studioState';
import { buildStudioHtml } from './studio.html';

/**
 * Manages the ISL Studio webview panel
 */
export class StudioPanel {
  public static readonly viewType = 'isl.studioPanel';

  private static currentPanel: StudioPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private state: StudioState;
  private disposables: vscode.Disposable[] = [];

  /**
   * Create or show the studio panel
   */
  public static createOrShow(
    extensionUri: vscode.Uri,
    initialState?: Partial<StudioState>
  ): StudioPanel {
    const column = vscode.ViewColumn.One;

    // If we already have a panel, show it
    if (StudioPanel.currentPanel) {
      StudioPanel.currentPanel.panel.reveal(column);
      if (initialState) {
        StudioPanel.currentPanel.updateState(initialState);
      }
      return StudioPanel.currentPanel;
    }

    // Create a new panel
    const panel = vscode.window.createWebviewPanel(
      StudioPanel.viewType,
      'ISL Studio',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri]
      }
    );

    StudioPanel.currentPanel = new StudioPanel(panel, extensionUri, initialState);
    return StudioPanel.currentPanel;
  }

  /**
   * Revive the panel from serialized state
   */
  public static revive(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    state?: StudioState
  ): StudioPanel {
    StudioPanel.currentPanel = new StudioPanel(panel, extensionUri, state);
    return StudioPanel.currentPanel;
  }

  /**
   * Get the current panel instance
   */
  public static getCurrent(): StudioPanel | undefined {
    return StudioPanel.currentPanel;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    initialState?: Partial<StudioState>
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.state = {
      ...createInitialStudioState(),
      ...initialState
    };

    // Set the webview's initial HTML content
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
      (message: StudioWebviewMessage) => this.handleMessage(message),
      null,
      this.disposables
    );
  }

  /**
   * Update the panel state and refresh the view
   */
  public updateState(newState: Partial<StudioState>): void {
    this.state = {
      ...this.state,
      ...newState
    };
    this.sendMessage({ type: 'updateState', state: this.state });
    this.updateWebview();
  }

  /**
   * Set the status
   */
  public setStatus(status: StudioState['status'], message?: string): void {
    this.state.status = status;
    if (message) {
      this.state.statusMessage = message;
    }
    this.state.isLoading = ['generating', 'building', 'auditing'].includes(status);
    this.sendMessage({ type: 'setStatus', status, message });
    this.updateWebview();
  }

  /**
   * Set the generated spec
   */
  public setSpec(spec: GeneratedSpec): void {
    this.state.spec = spec;
    this.state.lastGenerated = Date.now();
    this.sendMessage({ type: 'setSpec', spec });
    this.updateWebview();
  }

  /**
   * Set the score
   */
  public setScore(score: StudioScore): void {
    this.state.score = score;
    this.sendMessage({ type: 'setScore', score });
    this.updateWebview();
  }

  /**
   * Set error state
   */
  public setError(error: string): void {
    this.state.error = error;
    this.state.status = 'error';
    this.state.isLoading = false;
    this.sendMessage({ type: 'setError', error });
    this.updateWebview();
  }

  /**
   * Append to activity log
   */
  public appendLog(log: string): void {
    this.state.logs.push(`[${new Date().toLocaleTimeString()}] ${log}`);
    this.sendMessage({ type: 'appendLog', log: `[${new Date().toLocaleTimeString()}] ${log}` });
  }

  /**
   * Clear state
   */
  public clearState(): void {
    this.state = createInitialStudioState();
    this.updateWebview();
  }

  /**
   * Get the current state
   */
  public getState(): StudioState {
    return this.state;
  }

  /**
   * Dispose the panel
   */
  public dispose(): void {
    StudioPanel.currentPanel = undefined;

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
  private sendMessage(message: StudioExtensionMessage): void {
    if (this.panel.visible) {
      this.panel.webview.postMessage(message);
    }
  }

  /**
   * Handle messages from the webview
   */
  private async handleMessage(message: StudioWebviewMessage): Promise<void> {
    switch (message.type) {
      case 'generateSpec':
        await this.handleGenerateSpec(message.prompt);
        break;

      case 'generateAndBuild':
        await this.handleGenerateAndBuild(message.prompt);
        break;

      case 'auditExisting':
        await this.handleAuditExisting(message.specPath);
        break;

      case 'cancelOperation':
        await this.handleCancelOperation();
        break;

      case 'saveSpec':
        await this.handleSaveSpec(message.path);
        break;

      case 'copySpec':
        await this.handleCopySpec();
        break;

      case 'answerQuestion':
        await this.handleAnswerQuestion(message.questionId, message.answer);
        break;

      case 'clearState':
        this.clearState();
        break;

      case 'openSettings':
        await vscode.commands.executeCommand('workbench.action.openSettings', 'isl');
        break;
    }
  }

  /**
   * Handle generate spec request
   */
  private async handleGenerateSpec(prompt: string): Promise<void> {
    this.state.prompt = prompt;
    this.setStatus('generating', 'Generating ISL specification...');
    this.appendLog('Starting spec generation...');

    try {
      // Fire command for external handler
      await vscode.commands.executeCommand('isl.generateSpec', prompt);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.setError(`Generation failed: ${message}`);
      this.appendLog(`Error: ${message}`);
    }
  }

  /**
   * Handle generate and build request
   */
  private async handleGenerateAndBuild(prompt: string): Promise<void> {
    this.state.prompt = prompt;
    this.setStatus('generating', 'Generating ISL specification...');
    this.appendLog('Starting spec generation with build...');

    try {
      // Fire command for external handler
      await vscode.commands.executeCommand('isl.generateAndBuild', prompt);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.setError(`Generation failed: ${message}`);
      this.appendLog(`Error: ${message}`);
    }
  }

  /**
   * Handle audit existing spec request
   */
  private async handleAuditExisting(specPath?: string): Promise<void> {
    this.setStatus('auditing', 'Auditing existing specification...');
    this.appendLog('Starting spec audit...');

    try {
      // If no path provided, prompt user to select file
      let path = specPath;
      if (!path) {
        const files = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: false,
          filters: { 'ISL Specs': ['isl'] },
          title: 'Select ISL Specification to Audit'
        });

        if (files && files.length > 0) {
          path = files[0].fsPath;
        } else {
          this.setStatus('idle', 'Audit cancelled');
          return;
        }
      }

      this.state.specPath = path;
      await vscode.commands.executeCommand('isl.auditSpec', path);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.setError(`Audit failed: ${message}`);
      this.appendLog(`Error: ${message}`);
    }
  }

  /**
   * Handle cancel operation request
   */
  private async handleCancelOperation(): Promise<void> {
    this.appendLog('Operation cancelled by user');
    this.setStatus('idle', 'Operation cancelled');
    await vscode.commands.executeCommand('isl.cancelOperation');
  }

  /**
   * Handle save spec request
   */
  private async handleSaveSpec(path?: string): Promise<void> {
    if (!this.state.spec) {
      vscode.window.showWarningMessage('No specification to save');
      return;
    }

    try {
      let savePath = path;
      if (!savePath) {
        const uri = await vscode.window.showSaveDialog({
          filters: { 'ISL Specs': ['isl'] },
          title: 'Save ISL Specification'
        });

        if (uri) {
          savePath = uri.fsPath;
        } else {
          return;
        }
      }

      const content = this.state.spec.raw;
      await vscode.workspace.fs.writeFile(
        vscode.Uri.file(savePath),
        Buffer.from(content, 'utf8')
      );

      this.state.specPath = savePath;
      this.appendLog(`Spec saved to ${savePath}`);
      vscode.window.showInformationMessage(`Specification saved to ${savePath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to save: ${message}`);
    }
  }

  /**
   * Handle copy spec request
   */
  private async handleCopySpec(): Promise<void> {
    if (!this.state.spec) {
      vscode.window.showWarningMessage('No specification to copy');
      return;
    }

    await vscode.env.clipboard.writeText(this.state.spec.raw);
    vscode.window.showInformationMessage('Specification copied to clipboard');
  }

  /**
   * Handle answer question request
   */
  private async handleAnswerQuestion(questionId: string, answer: string): Promise<void> {
    if (!this.state.spec) return;

    const question = this.state.spec.openQuestions.find(q => q.id === questionId);
    if (question) {
      question.answered = true;
      question.answer = answer;
      this.appendLog(`Answered: ${question.question.substring(0, 50)}...`);
      this.updateWebview();

      // Notify extension
      await vscode.commands.executeCommand('isl.answerQuestion', questionId, answer);
    }
  }

  /**
   * Update the webview HTML content
   */
  private updateWebview(): void {
    const webview = this.panel.webview;
    const nonce = this.getNonce();
    const cspSource = webview.cspSource;

    this.panel.webview.html = buildStudioHtml(this.state, nonce, cspSource);
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
export class StudioPanelSerializer implements vscode.WebviewPanelSerializer {
  constructor(private readonly extensionUri: vscode.Uri) {}

  async deserializeWebviewPanel(
    webviewPanel: vscode.WebviewPanel,
    state: StudioState
  ): Promise<void> {
    StudioPanel.revive(webviewPanel, this.extensionUri, state);
  }
}
