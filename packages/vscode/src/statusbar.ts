import * as vscode from 'vscode';

export class ShipGateStatusBar implements vscode.Disposable {
  private item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.command = 'shipgate.verify';
    this.item.text = '$(shield) ShipGate';
    this.item.tooltip = 'Click to verify';
    this.item.show();
  }

  setScanning() {
    this.item.text = '$(loading~spin) ShipGate: Scanning...';
    this.item.color = '#38bdf8';
  }

  setVerdict(verdict: string, score: number) {
    const icon = verdict === 'SHIP' ? '$(pass)' : verdict === 'WARN' ? '$(warning)' : '$(error)';
    const color = verdict === 'SHIP' ? '#00e68a' : verdict === 'WARN' ? '#ffb547' : '#ff5c6a';
    this.item.text = `${icon} ShipGate: ${verdict} (${score})`;
    this.item.color = color;
    this.item.tooltip = `Verdict: ${verdict} — Score: ${score}/100. Click to re-scan.`;
  }

  setError() {
    this.item.text = '$(error) ShipGate: Error';
    this.item.color = '#ff5c6a';
  }

  dispose() { 
    this.item.dispose(); 
  }
}
