/**
 * Shipgate Sidebar — WebviewView Provider
 *
 * Thin shell: builds the HTML via shared helpers, delegates rendering
 * to media/sidebar.js, and pushes normalized SidebarUiState via postMessage.
 */

import * as vscode from 'vscode';
import { getWebviewHtml } from '../webviewHelpers';
import type { ScanResult } from '../../model/types';
import type { FirewallState } from '../../services/firewallService';
import type { GitHubConnectionState } from '../../services/githubService';
import { buildSidebarState, type SidebarUiState } from '../../model/uiState';

// ============================================================================
// State shape consumed by getState()
// ============================================================================

export interface SidebarState {
  scan: ScanResult | null;
  github: GitHubConnectionState;
  workflows: { name: string; path?: string }[];
  islGeneratePath: string | null;
  firewall: FirewallState;
}

// ============================================================================
// Provider
// ============================================================================

export class ShipgateSidebarProvider implements vscode.WebviewViewProvider {
  private webviewRef: vscode.WebviewView | null = null;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private getState: () => SidebarState,
    private workspaceRoot: string = ''
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.webviewRef = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = getWebviewHtml(
      webviewView.webview,
      this.extensionUri,
      {
        cssFile: 'shipgate.css',
        jsFile: 'sidebar.js',
        title: 'Shipgate',
        bodyClass: 'sg-panel',
        bodyHtml: '<div id="sg-root"></div>',
      }
    );

    // ── Incoming messages from webview ──
    webviewView.webview.onDidReceiveMessage(
      (msg: { type: string; payload?: unknown }) => {
        this.handleMessage(msg);
      }
    );

    // Send initial state once sidebar is ready
    const onReady = () => this.pushState();
    onReady();

    // Refresh on config changes
    const sub = vscode.workspace.onDidChangeConfiguration(() => this.pushState());
    webviewView.onDidDispose(() => {
      this.webviewRef = null;
      sub.dispose();
    });
  }

  /** Push latest state to the webview. */
  refresh(): void {
    this.pushState();
  }

  // ── Private ─────────────────────────────────────────────────

  private pushState(): void {
    const raw = this.getState();
    const uiState = buildSidebarState({
      scan: raw.scan,
      firewall: raw.firewall,
      github: raw.github,
      workflows: raw.workflows,
      islGeneratePath: raw.islGeneratePath,
      workspaceRoot: this.workspaceRoot,
    });
    this.webviewRef?.webview.postMessage({ type: 'state', payload: uiState });
  }

  private handleMessage(msg: { type: string; payload?: unknown }): void {
    switch (msg.type) {
      case 'requestState':
        this.pushState();
        break;
      case 'runScan':
        vscode.commands.executeCommand('shipgate.runScan');
        break;
      case 'openReport':
        vscode.commands.executeCommand('shipgate.openReport');
        break;
      case 'openSettings':
        vscode.commands.executeCommand('workbench.action.openSettings', 'shipgate');
        break;
      case 'githubConnect':
      case 'githubRefresh':
        vscode.commands.executeCommand('shipgate.githubConnect');
        break;
      case 'openPr':
      case 'openWorkflow':
        if (typeof msg.payload === 'string') {
          vscode.env.openExternal(vscode.Uri.parse(msg.payload));
        }
        break;
      case 'openFinding':
        if (msg.payload && typeof msg.payload === 'object' && 'file' in msg.payload) {
          const finding = msg.payload as { file: string; line?: number };
          vscode.commands.executeCommand('shipgate.openReport');
        }
        break;
      case 'codeToIsl':
        vscode.commands.executeCommand('shipgate.codeToIsl');
        break;
      case 'openWalkthrough':
        vscode.commands.executeCommand('shipgate.openWalkthrough');
        break;
      case 'ship':
        vscode.commands.executeCommand('shipgate.ship');
        break;
      case 'copySummary': {
        const state = this.getState();
        const text = this.buildMarkdownSummary(state);
        vscode.env.clipboard.writeText(text);
        vscode.window.showInformationMessage('Summary copied to clipboard.');
        break;
      }
    }
  }

  private buildMarkdownSummary(state: SidebarState): string {
    if (!state.scan) return 'Shipgate: No scan data.';
    const r = state.scan.result;
    const lines = [
      `## Shipgate Scan`,
      `- **Verdict:** ${r.verdict}`,
      `- **Score:** ${Math.round(r.score * 100)}%`,
      `- **Files:** ${r.files.length}`,
      `- **Passed:** ${r.files.filter((f) => f.status === 'PASS').length}`,
      `- **Failed:** ${r.files.filter((f) => f.status === 'FAIL').length}`,
    ];
    if (r.blockers.length > 0) {
      lines.push('', '### Blockers');
      r.blockers.forEach((b) => lines.push(`- ${b}`));
    }
    return lines.join('\n');
  }
}
