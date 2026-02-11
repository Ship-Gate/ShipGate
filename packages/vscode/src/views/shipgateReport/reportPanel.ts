/**
 * Shipgate Report Panel
 *
 * Thin shell: creates a WebviewPanel, links to shared CSS/JS,
 * and pushes normalized ReportUiState via postMessage.
 */

import * as vscode from 'vscode';
import type { ScanResult } from '../../model/types';
import { buildReportState, type ReportUiState } from '../../model/uiState';
import { getWebviewHtml, escapeHtml } from '../webviewHelpers';
import { resolveWorkspacePath } from '../../utils/paths';

export class ShipgateReportPanel {
  static readonly viewType = 'shipgate.reportPanel';

  private static currentPanel: ShipgateReportPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private workspaceRoot: string;
  private scanResult: ScanResult | null;
  private configPath: string | null;

  public static createOrShow(
    extensionUri: vscode.Uri,
    scanResult: ScanResult | null,
    workspaceRoot: string,
    configPath: string | null = null
  ): ShipgateReportPanel {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.Two;

    if (ShipgateReportPanel.currentPanel) {
      ShipgateReportPanel.currentPanel.panel.reveal(column);
      ShipgateReportPanel.currentPanel.workspaceRoot = workspaceRoot;
      ShipgateReportPanel.currentPanel.configPath = configPath;
      ShipgateReportPanel.currentPanel.update(scanResult);
      return ShipgateReportPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      ShipgateReportPanel.viewType,
      'Shipgate Report',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      }
    );

    ShipgateReportPanel.currentPanel = new ShipgateReportPanel(
      panel, extensionUri, scanResult, workspaceRoot, configPath
    );
    return ShipgateReportPanel.currentPanel;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    scanResult: ScanResult | null,
    workspaceRoot: string,
    configPath: string | null
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.scanResult = scanResult;
    this.workspaceRoot = workspaceRoot;
    this.configPath = configPath;

    this.panel.webview.html = getWebviewHtml(
      this.panel.webview,
      this.extensionUri,
      {
        cssFile: 'shipgate.css',
        jsFile: 'report.js',
        title: 'Shipgate Report',
        bodyClass: 'sg-panel sg-panel--report',
        bodyHtml: '<div id="sg-root"></div>',
      }
    );

    // Send initial state once the webview JS loads
    setTimeout(() => this.pushState(), 50);

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage(
      (msg: { type: string; payload?: unknown }) => this.handleMessage(msg)
    );

    this.panel.onDidDispose(() => {
      ShipgateReportPanel.currentPanel = undefined;
    });
  }

  public update(scanResult: ScanResult | null): void {
    this.scanResult = scanResult;
    this.pushState();
  }

  // ── Private ─────────────────────────────────────────────────

  private pushState(): void {
    const state = buildReportState(this.scanResult, this.workspaceRoot, this.configPath);
    this.panel.webview.postMessage({ type: 'state', payload: state });
  }

  private handleMessage(msg: { type: string; payload?: unknown }): void {
    switch (msg.type) {
      case 'requestState':
        this.pushState();
        break;

      case 'openFile': {
        const p = msg.payload as { file: string; line?: number } | undefined;
        if (p?.file) {
          const absPath = resolveWorkspacePath(this.workspaceRoot, p.file);
          const uri = vscode.Uri.file(absPath);
          vscode.workspace.openTextDocument(uri).then((doc) => {
            vscode.window.showTextDocument(doc).then((editor) => {
              const line = (p.line ?? 1) - 1;
              if (line >= 0) {
                editor.revealRange(new vscode.Range(line, 0, line, 0));
                editor.selection = new vscode.Selection(line, 0, line, 0);
              }
            });
          });
        }
        break;
      }

      case 'runScan':
        vscode.commands.executeCommand('shipgate.runScan');
        break;

      case 'copySummary': {
        const text = this.buildMarkdownSummary();
        vscode.env.clipboard.writeText(text);
        vscode.window.showInformationMessage('Report summary copied to clipboard.');
        break;
      }

      case 'exportJson': {
        const state = buildReportState(this.scanResult, this.workspaceRoot, this.configPath);
        const json = JSON.stringify(state, null, 2);
        vscode.workspace.openTextDocument({ content: json, language: 'json' }).then((doc) => {
          vscode.window.showTextDocument(doc);
        });
        break;
      }
    }
  }

  private buildMarkdownSummary(): string {
    if (!this.scanResult) return 'Shipgate: No scan data.';
    const r = this.scanResult.result;
    const lines = [
      '## Shipgate Report',
      '',
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Verdict | ${r.verdict} |`,
      `| Score | ${Math.round(r.score * 100)}% |`,
      `| Files | ${r.files.length} |`,
      `| Passed | ${r.files.filter((f) => f.status === 'PASS').length} |`,
      `| Warnings | ${r.files.filter((f) => f.status === 'WARN').length} |`,
      `| Failed | ${r.files.filter((f) => f.status === 'FAIL').length} |`,
    ];
    if (r.blockers.length > 0) {
      lines.push('', '### Blockers');
      r.blockers.forEach((b) => lines.push(`- ${b}`));
    }
    return lines.join('\n');
  }
}
