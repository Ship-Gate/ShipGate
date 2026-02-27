/**
 * ShipGate Status Bar
 *
 * Displays ISL spec coverage in the VS Code status bar:
 *   "ISL: ✓ 12/15 specced"   (all passing)
 *   "ISL: ✗ 2 violations"    (some failing)
 *   "ISL: ⟳ checking..."     (in progress)
 *
 * Clicking the status bar runs `shipgate.verifyAll`.
 */

import * as vscode from 'vscode';
import type { CoverageReport } from '../commands/coverage';

export interface ShipGateStatusBar {
  /** Update with verification/coverage results */
  updateCoverage(report: CoverageReport): void;
  /** Show a transient checking state */
  setChecking(): void;
  /** Show an error state with optional count */
  setError(count?: number): void;
  /** Show the ready/idle state */
  setReady(): void;
  /** Update LSP server version */
  setVersion(version: string): void;
  /** Dispose all resources */
  dispose(): void;
}

/**
 * Create the ShipGate status bar item.
 */
export function createShipGateStatusBar(
  context: vscode.ExtensionContext
): ShipGateStatusBar {
  // Primary status item — left-aligned, high priority
  const item = vscode.window.createStatusBarItem(
    'shipgate-status',
    vscode.StatusBarAlignment.Left,
    100
  );
  item.name = 'ShipGate ISL Status';
  item.command = 'shipgate.verifyAll';
  item.text = '$(shield) ISL';
  item.tooltip = 'ShipGate ISL — click to verify workspace';
  item.show();

  context.subscriptions.push(item);

  // Only show when there are ISL files or ISL editor is active
  const updateVisibility = () => {
    const editor = vscode.window.activeTextEditor;
    const isIsl = editor?.document.languageId === 'isl';

    // Always show if ISL — otherwise show if we have coverage data
    if (isIsl) {
      item.show();
    }
    // Keep it visible if we have coverage data (workspace-level indicator)
  };

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => updateVisibility())
  );

  let serverVersion = '';

  return {
    updateCoverage(report: CoverageReport): void {
      if (report.violations > 0) {
        item.text = `$(error) ISL: ${report.violations} violation${report.violations === 1 ? '' : 's'}`;
        item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        item.tooltip = buildTooltip(report, serverVersion);
      } else if (report.total > 0) {
        item.text = `$(check) ISL: ${report.specced}/${report.total} specced`;
        item.backgroundColor = undefined;
        item.tooltip = buildTooltip(report, serverVersion);
      } else {
        item.text = '$(shield) ISL';
        item.backgroundColor = undefined;
        item.tooltip = 'ShipGate ISL — click to verify workspace';
      }
      item.show();
    },

    setChecking(): void {
      item.text = '$(sync~spin) ISL: checking...';
      item.backgroundColor = undefined;
      item.tooltip = 'ShipGate: Verification in progress...';
    },

    setError(count?: number): void {
      const label = count !== undefined ? `${count} error${count === 1 ? '' : 's'}` : 'error';
      item.text = `$(error) ISL: ${label}`;
      item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
      item.tooltip = 'ShipGate: Errors detected — click to verify workspace';
    },

    setReady(): void {
      item.text = '$(shield) ISL';
      item.backgroundColor = undefined;
      item.tooltip = 'ShipGate ISL — click to verify workspace';
    },

    setVersion(version: string): void {
      serverVersion = version;
    },

    dispose(): void {
      item.dispose();
    },
  };
}

// ---------------------------------------------------------------------------
// Tooltip builder
// ---------------------------------------------------------------------------

function buildTooltip(report: CoverageReport, version: string): string {
  const lines = ['### ShipGate ISL Coverage'];

  if (version) {
    lines.push(`Server: v${version}`);
  }

  lines.push('');
  lines.push(`| Metric | Count |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Specced | ${report.specced} |`);
  lines.push(`| Specless | ${report.specless} |`);
  lines.push(`| Violations | ${report.violations} |`);
  lines.push(`| **Total** | **${report.total}** |`);
  lines.push('');
  lines.push('_Click to re-verify workspace_');

  return new vscode.MarkdownString(lines.join('\n')).value;
}
