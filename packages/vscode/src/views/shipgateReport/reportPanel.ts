/**
 * Shipgate Report Panel
 *
 * Thin shell: delegates HTML to webviewHelpers, state to uiState.
 * State-driven rendering via postMessage.
 */

import * as vscode from 'vscode';
import { getWebviewHtml } from '../webviewHelpers';
import { buildReportState, type ReportUiState } from '../../model/uiState';
import type { ScanResult } from '../../model/types';
import { resolveWorkspacePath } from '../../utils/paths';

export class ShipgateReportPanel {
  static readonly viewType = 'shipgate.reportPanel';

  private static currentPanel: ShipgateReportPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private workspaceRoot: string = '';
  private scanResult: ScanResult | null = null;
  private configPath: string | null = null;

  public static createOrShow(
    extensionUri: vscode.Uri,
    scanResult: ScanResult | null,
    workspaceRoot: string,
    configPath?: string | null
  ): ShipgateReportPanel {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.Two;

    if (ShipgateReportPanel.currentPanel) {
      ShipgateReportPanel.currentPanel.panel.reveal(column);
      ShipgateReportPanel.currentPanel.workspaceRoot = workspaceRoot;
      ShipgateReportPanel.currentPanel.configPath = configPath ?? null;
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
      panel,
      extensionUri,
      scanResult,
      workspaceRoot,
      configPath ?? null
    );
    return ShipgateReportPanel.currentPanel;
  }

  /**
   * Refresh the current report panel if it exists (e.g. after scan completes).
   */
  public static refreshCurrent(
    scanResult: ScanResult | null,
    workspaceRoot: string,
    configPath?: string | null
  ): void {
    if (ShipgateReportPanel.currentPanel) {
      ShipgateReportPanel.currentPanel.workspaceRoot = workspaceRoot;
      ShipgateReportPanel.currentPanel.configPath = configPath ?? null;
      ShipgateReportPanel.currentPanel.update(scanResult);
    }
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
    this.workspaceRoot = workspaceRoot;
    this.scanResult = scanResult;
    this.configPath = configPath;

    this.panel.webview.html = this.getHtml();

    this.panel.webview.onDidReceiveMessage(
      async (msg: { type: string; file?: string; line?: number; payload?: unknown }) => {
        if (msg.type === 'openFile' && msg.file) {
          const absPath = resolveWorkspacePath(this.workspaceRoot, msg.file);
          const uri = vscode.Uri.file(absPath);
          const doc = await vscode.workspace.openTextDocument(uri);
          const editor = await vscode.window.showTextDocument(doc);
          const line = (msg.line ?? 1) - 1;
          if (line >= 0) {
            editor.revealRange(new vscode.Range(line, 0, line, 0));
            editor.selection = new vscode.Selection(line, 0, line, 0);
          }
        } else if (msg.type === 'requestState') {
          this.postState();
        } else if (msg.type === 'runScan') {
          vscode.commands.executeCommand('shipgate.runScan');
        } else if (msg.type === 'copySummary') {
          this.copySummary();
        } else if (msg.type === 'exportJson') {
          this.exportJson();
        }
      }
    );

    this.panel.onDidDispose(() => {
      ShipgateReportPanel.currentPanel = undefined;
    });

    this.postState();
  }

  public update(scanResult: ScanResult | null): void {
    this.scanResult = scanResult;
    this.postState();
  }

  private postState(): void {
    const reportState = buildReportState(
      this.scanResult,
      this.workspaceRoot,
      this.configPath
    );
    this.panel.webview.postMessage({
      type: 'state',
      payload: reportState,
    });
  }

  private copySummary(): void {
    const state = buildReportState(
      this.scanResult,
      this.workspaceRoot,
      this.configPath
    );
    const text = formatReportSummaryMarkdown(state);
    vscode.env.clipboard.writeText(text);
    vscode.window.showInformationMessage('Copied summary to clipboard.');
  }

  private exportJson(): void {
    const state = buildReportState(
      this.scanResult,
      this.workspaceRoot,
      this.configPath
    );
    const json = JSON.stringify(state, null, 2);
    vscode.env.clipboard.writeText(json);
    vscode.window.showInformationMessage('Exported report JSON to clipboard.');
  }

  private getHtml(): string {
    return getWebviewHtml(this.panel.webview, this.extensionUri, {
      cssFile: 'shipgate.css',
      jsFile: 'report.js',
      title: 'Shipgate Report',
      bodyHtml: '<div id="root"></div>',
    });
  }
}

function formatReportSummaryMarkdown(s: ReportUiState): string {
  const lines: string[] = [];
  lines.push('# Shipgate Report');
  lines.push('');
  lines.push(`**Verdict:** ${s.verdict ?? 'No data'}`);
  if (s.score != null) lines.push(`**Score:** ${s.score}%`);
  if (s.coverage?.total) {
    const pct = Math.round((s.coverage.specced / s.coverage.total) * 100);
    lines.push(`**Coverage:** ${pct}%`);
  }
  if (s.counts) {
    lines.push(`**Files:** ${s.counts.total} total | ${s.counts.pass} pass | ${s.counts.warn} warn | ${s.counts.fail} fail`);
  }
  if (s.metadata?.timestamp) lines.push(`**Timestamp:** ${s.metadata.timestamp}`);
  lines.push('');
  if (s.findings?.length) {
    lines.push('## Findings');
    lines.push('');
    for (const f of s.findings) {
      lines.push(`- **${f.file}** (${f.status}): ${[...(f.blockers || []), ...(f.errors || [])].join('; ')}`);
    }
  }
  return lines.join('\n');
}
