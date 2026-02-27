/**
 * ISL Vibe Panel — WebviewView Provider
 *
 * Dedicated sidebar panel for the ISL Vibe workflow:
 * - Prompt input with framework/database pickers
 * - Pipeline progress (5 stages)
 * - Results (file tree, trust score, certificate)
 * - Actions (run tests, dev server, heal, regenerate)
 */

import * as vscode from 'vscode';
import { resolve } from 'path';
import { getWebviewHtml } from '../webviewHelpers';
import type {
  VibePanelUiState,
  VibePanelWebviewMessage,
  VibeFramework,
  VibeDatabase,
} from './vibePanelState';

const STORAGE_KEYS = {
  recentPrompts: 'vibe.recentPrompts',
  lastFramework: 'vibe.lastFramework',
  lastDatabase: 'vibe.lastDatabase',
};

const MAX_RECENT_PROMPTS = 10;

export interface VibePanelState {
  phase: 'idle' | 'running' | 'done';
  prompt: string | null;
  message: string | null;
  error: string | null;
  verdict: 'SHIP' | 'NO_SHIP' | 'WARN' | null;
  score: number | null;
  outputDir: string | null;
  files: Array<{ path: string; type: string; size: number }>;
  stages: Array<{
    id: number;
    name: string;
    status: 'pending' | 'running' | 'done' | 'failed';
    duration?: number;
    tokenCount?: number;
    error?: string;
  }>;
  overallProgress: number;
  etaSeconds: number | null;
  certificate: {
    verdict: 'SHIP' | 'NO_SHIP' | 'WARN';
    testResults?: { passed: number; failed: number };
    securityFindings?: string[];
    raw?: Record<string, unknown>;
  } | null;
}

export class VibePanelProvider implements vscode.WebviewViewProvider {
  private webviewRef: vscode.WebviewView | null = null;
  private disposables: vscode.Disposable[] = [];
  private pushTimer: ReturnType<typeof setTimeout> | null = null;

  private static readonly DEBOUNCE_MS = 50;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly context: vscode.ExtensionContext,
    private getState: () => VibePanelState,
    private workspaceRoot: string
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
        cssFile: 'vibe-panel.css',
        jsFile: 'vibe-panel.js',
        title: 'ISL Vibe',
        bodyClass: 'vibe-panel',
        bodyHtml: '<div id="vibe-root"></div>',
      }
    );

    this.disposables.push(
      webviewView.webview.onDidReceiveMessage((msg: VibePanelWebviewMessage) =>
        this.handleMessage(msg)
      )
    );

    this.disposables.push(
      webviewView.onDidChangeVisibility(() => {
        if (webviewView.visible) this.pushState();
      })
    );

    webviewView.onDidDispose(() => this.dispose());
    this.pushState();
  }

  refresh(): void {
    this.pushState();
  }

  private pushState(): void {
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      this.pushImmediate();
    }, VibePanelProvider.DEBOUNCE_MS);
  }

  private pushImmediate(): void {
    if (!this.webviewRef) return;
    const raw = this.getState();
    const recentPrompts = this.context.workspaceState.get<string[]>(
      STORAGE_KEYS.recentPrompts
    ) ?? [];
    const lastFramework = (this.context.workspaceState.get<string>(
      STORAGE_KEYS.lastFramework
    ) ?? 'nextjs') as VibeFramework;
    const lastDatabase = (this.context.workspaceState.get<string>(
      STORAGE_KEYS.lastDatabase
    ) ?? 'sqlite') as VibeDatabase;

    const uiState: VibePanelUiState = {
      phase: raw.phase,
      prompt: raw.prompt,
      message: raw.message,
      error: raw.error,
      verdict: raw.verdict,
      score: raw.score,
      outputDir: raw.outputDir,
      files: raw.files,
      stages: raw.stages,
      overallProgress: raw.overallProgress,
      etaSeconds: raw.etaSeconds,
      certificate: raw.certificate,
      recentPrompts,
      lastFramework,
      lastDatabase,
    };
    this.webviewRef.webview.postMessage({ type: 'state', payload: uiState });
  }

  private async handleMessage(msg: VibePanelWebviewMessage): Promise<void> {
    switch (msg.type) {
      case 'requestState':
        this.pushImmediate();
        break;
      case 'generate': {
        const { prompt, framework, database } = msg.payload;
        this.addRecentPrompt(prompt);
        this.context.workspaceState.update(STORAGE_KEYS.lastFramework, framework);
        this.context.workspaceState.update(STORAGE_KEYS.lastDatabase, database);
        await vscode.commands.executeCommand('shipgate.vibeFromPanel', {
          prompt,
          framework,
          database,
        });
        break;
      }
      case 'selectOutputDir':
        await vscode.commands.executeCommand('shipgate.vibeSelectOutputDir');
        break;
      case 'openFile':
        if (msg.payload) {
          const raw = this.getState();
          const baseDir = raw.outputDir || this.workspaceRoot;
          const fullPath = baseDir ? resolve(baseDir, msg.payload) : msg.payload;
          const uri = vscode.Uri.file(fullPath);
          const doc = await vscode.workspace.openTextDocument(uri);
          await vscode.window.showTextDocument(doc, {
            viewColumn: vscode.ViewColumn.Active,
            preview: false,
          });
        }
        break;
      case 'runTests':
        await vscode.commands.executeCommand('shipgate.vibeRunTests');
        break;
      case 'startDevServer':
        await vscode.commands.executeCommand('shipgate.vibeStartDevServer');
        break;
      case 'heal':
        await vscode.commands.executeCommand('shipgate.heal');
        break;
      case 'regenerateFile':
        await vscode.commands.executeCommand(
          'shipgate.vibeRegenerateFile',
          msg.payload
        );
        break;
      case 'openCertificate':
        await vscode.commands.executeCommand('shipgate.vibeOpenCertificate');
        break;
      case 'retryStage':
        await vscode.commands.executeCommand(
          'shipgate.vibeRetryStage',
          msg.payload
        );
        break;
      case 'selectRecentPrompt':
        // WebView will update its own input; we just need to push state
        this.pushImmediate();
        break;
    }
  }

  private addRecentPrompt(prompt: string): void {
    const current = this.context.workspaceState.get<string[]>(
      STORAGE_KEYS.recentPrompts
    ) ?? [];
    const trimmed = prompt.trim();
    if (!trimmed) return;
    const filtered = current.filter((p) => p !== trimmed);
    const updated = [trimmed, ...filtered].slice(0, MAX_RECENT_PROMPTS);
    this.context.workspaceState.update(STORAGE_KEYS.recentPrompts, updated);
  }

  private dispose(): void {
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this.webviewRef = null;
  }
}
