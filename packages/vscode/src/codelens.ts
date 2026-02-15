import * as vscode from 'vscode';

export class ShipGateCodeLens implements vscode.CodeLensProvider {
  private findings: any[] = [];

  updateFindings(findings: any[]) {
    this.findings = findings;
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const lenses: vscode.CodeLens[] = [];
    const fileFindings = this.findings.filter(f => document.uri.fsPath.endsWith(f.file));

    for (const f of fileFindings) {
      const line = Math.max(0, (f.line || 1) - 1);
      const range = new vscode.Range(line, 0, line, 0);

      lenses.push(new vscode.CodeLens(range, {
        title: `⚡ ShipGate: ${f.message}`,
        command: f.fixable ? 'shipgate.autofix' : '',
        tooltip: `${f.engine} — ${f.severity}`,
      }));
    }

    return lenses;
  }
}
