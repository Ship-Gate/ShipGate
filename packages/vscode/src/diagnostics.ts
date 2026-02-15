import * as vscode from 'vscode';

export class ShipGateDiagnostics implements vscode.Disposable {
  private collection: vscode.DiagnosticCollection;

  constructor() {
    this.collection = vscode.languages.createDiagnosticCollection('shipgate');
  }

  update(findings: any[], rootPath: string) {
    this.collection.clear();
    const grouped = new Map<string, vscode.Diagnostic[]>();

    for (const f of findings) {
      const uri = vscode.Uri.file(`${rootPath}/${f.file}`);
      const key = uri.toString();
      if (!grouped.has(key)) grouped.set(key, []);

      const line = Math.max(0, (f.line || 1) - 1);
      const range = new vscode.Range(line, 0, line, 999);
      const severity = f.severity === 'critical' || f.severity === 'high'
        ? vscode.DiagnosticSeverity.Error
        : f.severity === 'medium'
        ? vscode.DiagnosticSeverity.Warning
        : vscode.DiagnosticSeverity.Information;

      const diag = new vscode.Diagnostic(range, f.message, severity);
      diag.source = 'ShipGate';
      diag.code = f.engine;
      grouped.get(key)!.push(diag);
    }

    for (const [key, diags] of grouped) {
      this.collection.set(vscode.Uri.parse(key), diags);
    }
  }

  dispose() { 
    this.collection.dispose(); 
  }
}
