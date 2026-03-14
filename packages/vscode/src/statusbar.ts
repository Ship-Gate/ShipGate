import * as vscode from 'vscode';

export class ShipGateStatusBar implements vscode.Disposable {
  private item: vscode.StatusBarItem;
  private watchItem: vscode.StatusBarItem;
  private lastVerdict: string | null = null;
  private lastScore: number = 0;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.command = 'shipgate.verify';
    this.item.text = '$(shield) ShipGate';
    this.item.tooltip = 'Click to run Ship check (Cmd+Shift+S)';
    this.item.show();

    this.watchItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
    this.watchItem.command = 'shipgate.toggleWatch';
    this.watchItem.tooltip = 'Toggle watch mode';
    const watchOn = vscode.workspace.getConfiguration('shipgate').get('watchMode');
    this.setWatch(!!watchOn);
  }

  setScanning() {
    this.item.text = '$(loading~spin) ShipGate: Scanning...';
    this.item.color = '#38bdf8';
    this.item.tooltip = 'Scan in progress...';
  }

  setVerdict(verdict: string, score: number) {
    this.lastVerdict = verdict;
    this.lastScore = score;
    const icon = verdict === 'SHIP' ? '$(pass)' : verdict === 'WARN' ? '$(warning)' : '$(error)';
    const color = verdict === 'SHIP' ? '#00e68a' : verdict === 'WARN' ? '#ffb547' : '#ff5c6a';
    this.item.text = `${icon} ShipGate: ${verdict} (${score})`;
    this.item.color = color;
    this.item.tooltip = `Verdict: ${verdict} — Score: ${score}/100\nClick to re-scan (Cmd+Shift+S)`;
  }

  setWatch(enabled: boolean) {
    if (enabled) {
      this.watchItem.text = '$(eye) Watch';
      this.watchItem.color = '#22d3ee';
      this.watchItem.tooltip = 'Watch mode ON — scans on save. Click to disable.';
      this.watchItem.show();
    } else {
      this.watchItem.text = '$(eye-closed) Watch';
      this.watchItem.color = undefined;
      this.watchItem.tooltip = 'Watch mode OFF. Click to enable.';
      this.watchItem.show();
    }
  }

  setError() {
    this.item.text = '$(error) ShipGate: Error';
    this.item.color = '#ff5c6a';
    this.item.tooltip = 'Last scan failed. Click to retry.';
  }

  getLastVerdict(): { verdict: string; score: number } | null {
    if (!this.lastVerdict) return null;
    return { verdict: this.lastVerdict, score: this.lastScore };
  }

  dispose() { 
    this.item.dispose();
    this.watchItem.dispose();
  }
}
