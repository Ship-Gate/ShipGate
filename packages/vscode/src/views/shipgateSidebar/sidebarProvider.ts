/**
 * Shipgate Sidebar — WebviewView Provider
 *
 * Renders self-contained HTML (Overview, Claims, Files tabs) and pushes
 * normalized results via postMessage. Also supports legacy state format.
 */

import * as vscode from 'vscode';
import type { ScanResult } from '../../model/types';
import type { FirewallState } from '../../services/firewallService';
import type { GitHubConnectionState } from '../../services/githubService';
import { buildSidebarState, type SidebarUiState } from '../../model/uiState';
import {
  getWebviewContent,
  stateToResults,
  type SidebarResultsData,
} from './sidebarContent';

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
  heal?: {
    phase: 'idle' | 'running' | 'done';
    message: string | null;
    error: string | null;
    iterations: number;
    finalScore: number | null;
    finalVerdict: string | null;
    patchedFiles: string[];
  };
  pro?: {
    active: boolean;
    email: string | null;
    plan: 'free' | 'pro';
    checking: boolean;
    error: string | null;
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

    webviewView.webview.html = getWebviewContent(webviewView.webview);

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

  /** Public: push scan results directly (e.g. after a scan completes). */
  updateResults(data: SidebarResultsData | null): void {
    this.webviewRef?.webview.postMessage({ type: 'results', data });
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
      heal: raw.heal,
      pro: raw.pro,
      workspaceRoot: this.workspaceRoot,
    });
    const hasScan = raw.scan?.result && uiState.phase === 'complete';
    const scanning = uiState.phase === 'running';
    const results: SidebarResultsData | null = hasScan
      ? stateToResults(uiState, {
          fullFiles: raw.scan?.result?.files?.map((f) => ({
            file: f.file,
            status: f.status,
            score: f.score,
          })),
          workspaceRoot: this.workspaceRoot,
        })
      : scanning
        ? stateToResults(uiState, { workspaceRoot: this.workspaceRoot })
        : null;
    this.webviewRef.webview.postMessage({ type: 'results', data: results, scanning });
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
      case 'healAll':
        vscode.commands.executeCommand('shipgate.heal');
        break;
      case 'healFile':
        if (msg.payload && typeof msg.payload === 'object' && 'file' in msg.payload) {
          const { file, intent } = msg.payload as { file: string; intent?: string };
          vscode.commands.executeCommand('shipgate.healFile', file, intent || '');
        }
        break;
      case 'openFile': {
        const path = typeof msg.payload === 'string' ? msg.payload : (msg.payload as { file?: string })?.file;
        const line = (msg.payload as { line?: number })?.line ?? 1;
        if (path) {
          const fileUri = vscode.Uri.file(
            require('path').resolve(this.workspaceRoot, path)
          );
          vscode.window.showTextDocument(fileUri, {
            preview: true,
            selection: new vscode.Range(line - 1, 0, line - 1, 0),
          });
        }
        break;
      }
      case 'rerun':
        vscode.commands.executeCommand('shipgate.runScan');
        break;
      case 'autofix':
        vscode.commands.executeCommand('shipgate.heal');
        break;
      case 'openPR':
        if (typeof msg.payload === 'string') {
          vscode.env.openExternal(vscode.Uri.parse(msg.payload));
        }
        break;
      case 'viewLogs':
        vscode.commands.executeCommand('shipgate.openReport');
        break;
      case 'upgradePro':
        vscode.commands.executeCommand('shipgate.upgradePro');
        break;
      case 'activatePro':
        vscode.commands.executeCommand('shipgate.activatePro');
        break;
      case 'signOut':
        vscode.commands.executeCommand('shipgate.signOut');
        break;
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
