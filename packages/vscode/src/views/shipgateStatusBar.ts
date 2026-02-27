/**
 * Shipgate Scan Status Bar
 *
 * Displays current verdict: SHIP / WARN / NO_SHIP / Idle
 * Clicking runs scan or opens report.
 */

import * as vscode from 'vscode';
import type { Verdict } from '../model/types';

export interface ShipgateScanStatusBar {
  setVerdict(verdict: Verdict | 'Idle', timestamp?: string): void;
  setRunning(): void;
  dispose(): void;
}

export function createShipgateScanStatusBar(
  context: vscode.ExtensionContext,
  onClickCommand: string
): ShipgateScanStatusBar {
  const item = vscode.window.createStatusBarItem(
    'shipgate-scan-status',
    vscode.StatusBarAlignment.Left,
    99
  );
  item.name = 'Shipgate Scan';
  item.command = onClickCommand;
  item.text = '$(shield) Shipgate: Idle';
  item.tooltip = 'Shipgate — Click to run verification scan';
  item.show();

  context.subscriptions.push(item);

  return {
    setVerdict(verdict: Verdict | 'Idle', timestamp?: string): void {
      const icon =
        verdict === 'SHIP'
          ? '$(check)'
          : verdict === 'WARN'
            ? '$(warning)'
            : verdict === 'NO_SHIP'
              ? '$(error)'
              : '$(shield)';
      item.text = `${icon} Shipgate: ${verdict}`;
      item.backgroundColor = undefined;
      if (verdict === 'NO_SHIP') {
        item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
      } else if (verdict === 'WARN') {
        item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      }
      const ts = timestamp ? ` (${formatTimestamp(timestamp)})` : '';
      item.tooltip = verdict === 'Idle'
        ? `Shipgate — Click to run verification scan`
        : `Shipgate: ${verdict}${ts}\n\nClick to open full report`;
      item.show();
    },
    setRunning(): void {
      item.text = '$(sync~spin) Shipgate: scanning...';
      item.backgroundColor = undefined;
      item.tooltip = 'Shipgate: Scan in progress...';
      item.show();
    },
    dispose(): void {
      item.dispose();
    },
  };
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}
