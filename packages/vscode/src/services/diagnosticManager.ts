import * as vscode from 'vscode';
import * as path from 'path';

export class DiagnosticManager {
  private inlineCollection: vscode.DiagnosticCollection;
  private scanCollection: vscode.DiagnosticCollection;
  private deepCollection: vscode.DiagnosticCollection;

  constructor() {
    this.inlineCollection = vscode.languages.createDiagnosticCollection('shipgate-inline');
    this.scanCollection = vscode.languages.createDiagnosticCollection('shipgate-scan');
    this.deepCollection = vscode.languages.createDiagnosticCollection('shipgate-deep');
  }

  getInlineCollection(): vscode.DiagnosticCollection {
    return this.inlineCollection;
  }

  getScanCollection(): vscode.DiagnosticCollection {
    return this.scanCollection;
  }

  getDeepCollection(): vscode.DiagnosticCollection {
    return this.deepCollection;
  }

  updateScanFindings(findings: Array<{ file: string; line: number; message: string; severity: string; engine: string; code?: string }>, cwd: string): void {
    const grouped = new Map<string, vscode.Diagnostic[]>();

    for (const f of findings) {
      const fullPath = path.resolve(cwd, f.file);
      if (!grouped.has(fullPath)) grouped.set(fullPath, []);

      const line = Math.max(0, (f.line || 1) - 1);
      const severity = f.severity === 'error' ? vscode.DiagnosticSeverity.Error
        : f.severity === 'warning' ? vscode.DiagnosticSeverity.Warning
        : vscode.DiagnosticSeverity.Information;

      const diag = new vscode.Diagnostic(
        new vscode.Range(line, 0, line, 200),
        f.message,
        severity
      );
      diag.source = `ShipGate (${f.engine})`;
      if (f.code) {
        diag.code = {
          value: f.code,
          target: vscode.Uri.parse(`https://shipgate.dev/docs/rules/${f.code}`),
        };
      }

      grouped.get(fullPath)!.push(diag);
    }

    this.scanCollection.clear();
    for (const [file, diags] of grouped) {
      this.scanCollection.set(vscode.Uri.file(file), diags);
    }
  }

  clearAll(): void {
    this.inlineCollection.clear();
    this.scanCollection.clear();
    this.deepCollection.clear();
  }

  dispose(): void {
    this.inlineCollection.dispose();
    this.scanCollection.dispose();
    this.deepCollection.dispose();
  }
}
