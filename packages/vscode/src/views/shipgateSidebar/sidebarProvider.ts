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
  intentBuilder?: {
    phase: 'idle' | 'generating' | 'scanning' | 'codegen' | 'done';
    prompt: string | null;
    message: string | null;
    error: string | null;
    score: number | null;
    verdict: string | null;
    hasApiKey: boolean;
  };
}

// ============================================================================
// Provider
// ============================================================================

export class ShipgateSidebarProvider implements vscode.WebviewViewProvider {
  private webviewRef: vscode.WebviewView | null = null;
  private disposables: vscode.Disposable[] = [];
  private pushTimer: ReturnType<typeof setTimeout> | null = null;

  private static readonly DEBOUNCE_MS = 50;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private getState: () => SidebarState,
    private workspaceRoot: string = ''
  ) {}

  // ── Lifecycle ───────────────────────────────────────────────

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
        bodyHtml: [
            '<canvas id="sg-bg-canvas"></canvas>',
            '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" class="sg-svg-hidden">',
            '  <defs>',
            '    <filter id="shadowed-goo">',
            '      <feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="10" />',
            '      <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />',
            '      <feGaussianBlur in="goo" stdDeviation="3" result="shadow" />',
            '      <feColorMatrix in="shadow" mode="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 -0.2" result="shadow" />',
            '      <feOffset in="shadow" dx="1" dy="1" result="shadow" />',
            '      <feBlend in2="shadow" in="goo" result="goo" />',
            '      <feBlend in2="goo" in="SourceGraphic" result="mix" />',
            '    </filter>',
            '  </defs>',
            '</svg>',
            '<div class="sg-content">',
            '  <div class="sg-logo-header"><span class="sg-brand">Shipgate</span><button class="sg-help-btn" id="sg-help-btn" title="Help &amp; onboarding" aria-label="Help">?</button></div>',
            '  <div id="sg-onboarding" class="sg-onboarding sg-hidden"></div>',
            '  <div id="sg-root"></div>',
            '</div>',
          ].join('\n'),
      }
    );

    // Messages from webview
    this.disposables.push(
      webviewView.webview.onDidReceiveMessage(
        (msg: { type: string; payload?: unknown }) => this.handleMessage(msg)
      )
    );

    // Initial state
    this.pushState();

    // Re-push on config change
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration(() => this.pushState())
    );

    // Re-push when sidebar becomes visible again
    this.disposables.push(
      webviewView.onDidChangeVisibility(() => {
        if (webviewView.visible) this.pushState();
      })
    );

    webviewView.onDidDispose(() => this.dispose());
  }

  /** Public: trigger a state refresh from the extension host. */
  refresh(): void {
    this.pushState();
  }

  // ── Private ─────────────────────────────────────────────────

  private pushState(): void {
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      this.pushImmediate();
    }, ShipgateSidebarProvider.DEBOUNCE_MS);
  }

  private pushImmediate(): void {
    if (!this.webviewRef) return;
    const raw = this.getState();
    const firewallEnabled = vscode.workspace.getConfiguration('shipgate').get<boolean>('firewall.enabled', true);
    const uiState = buildSidebarState({
      scan: raw.scan,
      firewall: raw.firewall,
      firewallEnabled,
      github: raw.github,
      workflows: raw.workflows,
      islGeneratePath: raw.islGeneratePath,
      intentBuilder: raw.intentBuilder,
      workspaceRoot: this.workspaceRoot,
    });
    this.webviewRef.webview.postMessage({ type: 'state', payload: uiState });
  }

  private handleMessage(msg: { type: string; payload?: unknown }): void {
    switch (msg.type) {
      case 'requestState':
        this.pushImmediate(); // bypass debounce
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
          vscode.commands.executeCommand('shipgate.openReport');
        }
        break;
      case 'codeToIsl':
        vscode.commands.executeCommand('shipgate.codeToIsl');
        break;
      case 'intentBuild':
        if (msg.payload && typeof msg.payload === 'object' && 'prompt' in msg.payload) {
          vscode.commands.executeCommand(
            'shipgate.intentBuild',
            (msg.payload as { prompt: string }).prompt
          );
        }
        break;
      case 'setApiKey':
        if (msg.payload && typeof msg.payload === 'object' && 'key' in msg.payload) {
          vscode.commands.executeCommand(
            'shipgate.setApiKey',
            (msg.payload as { key: string }).key
          );
        }
        break;
      case 'clearApiKey':
        vscode.commands.executeCommand('shipgate.clearApiKey');
        break;
      case 'openWalkthrough':
        vscode.commands.executeCommand('shipgate.openWalkthrough');
        break;
      case 'ship':
        vscode.commands.executeCommand('shipgate.ship');
        break;
      case 'firewallToggle': {
        const cfg = vscode.workspace.getConfiguration('shipgate');
        const current = cfg.get<boolean>('firewall.enabled', true);
        cfg.update('firewall.enabled', !current, vscode.ConfigurationTarget.Workspace);
        this.refresh();
        break;
      }
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

  private dispose(): void {
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this.webviewRef = null;
  }
}
