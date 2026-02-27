import * as vscode from 'vscode';

export interface RouteHandlerEvidence {
  file: string;
  line: number;
  auth: 'proven' | 'partial' | 'failed' | 'unverified';
  validation: 'proven' | 'partial' | 'failed' | 'unverified';
  errorHandling: 'proven' | 'partial' | 'failed' | 'unverified';
  routePath?: string;
  method?: string;
}

export interface ImportEvidence {
  file: string;
  line: number;
  importPath: string;
  status: 'proven' | 'failed';
  message?: string;
}

export class EvidenceCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  private routeEvidence: Map<string, RouteHandlerEvidence[]> = new Map();
  private importEvidence: Map<string, ImportEvidence[]> = new Map();

  updateRouteEvidence(evidence: RouteHandlerEvidence[]) {
    this.routeEvidence.clear();
    for (const item of evidence) {
      const key = this.normalizeFilePath(item.file);
      if (!this.routeEvidence.has(key)) {
        this.routeEvidence.set(key, []);
      }
      this.routeEvidence.get(key)!.push(item);
    }
    this._onDidChangeCodeLenses.fire();
  }

  updateImportEvidence(evidence: ImportEvidence[]) {
    this.importEvidence.clear();
    for (const item of evidence) {
      const key = this.normalizeFilePath(item.file);
      if (!this.importEvidence.has(key)) {
        this.importEvidence.set(key, []);
      }
      this.importEvidence.get(key)!.push(item);
    }
    this._onDidChangeCodeLenses.fire();
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const lenses: vscode.CodeLens[] = [];
    const filePath = this.normalizeFilePath(document.uri.fsPath);

    // Route handler CodeLenses
    const routes = this.routeEvidence.get(filePath) || [];
    for (const route of routes) {
      const line = Math.max(0, route.line - 1);
      const range = new vscode.Range(line, 0, line, 0);

      const authIcon = this.getStatusIcon(route.auth);
      const validationIcon = this.getStatusIcon(route.validation);
      const errorIcon = this.getStatusIcon(route.errorHandling);

      const title = `Auth: ${authIcon} | Validation: ${validationIcon} | Errors: ${errorIcon}`;

      lenses.push(
        new vscode.CodeLens(range, {
          title,
          command: 'shipgate.showRouteEvidence',
          arguments: [route],
          tooltip: `${route.method || 'GET'} ${route.routePath || ''}\nClick to view evidence details`,
        })
      );
    }

    // Import statement CodeLenses (via decorations instead, see below)
    // We'll use TextEditorDecorationType for import underlining

    return lenses;
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'proven': return '✅';
      case 'partial': return '⚠️';
      case 'failed': return '❌';
      case 'unverified': return '⚪';
      default: return '❓';
    }
  }

  private normalizeFilePath(filePath: string): string {
    return filePath.replace(/\\/g, '/').toLowerCase();
  }

  refresh() {
    this._onDidChangeCodeLenses.fire();
  }
}

export class ImportDecorationManager implements vscode.Disposable {
  private validImportDecorationType: vscode.TextEditorDecorationType;
  private invalidImportDecorationType: vscode.TextEditorDecorationType;
  
  private importEvidence: Map<string, ImportEvidence[]> = new Map();
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.validImportDecorationType = vscode.window.createTextEditorDecorationType({
      textDecoration: 'underline',
      color: '#4caf50',
      cursor: 'pointer',
    });

    this.invalidImportDecorationType = vscode.window.createTextEditorDecorationType({
      textDecoration: 'wavy underline',
      color: '#f44336',
      cursor: 'pointer',
    });

    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
          this.updateDecorations(editor);
        }
      })
    );
  }

  updateImportEvidence(evidence: ImportEvidence[]) {
    this.importEvidence.clear();
    for (const item of evidence) {
      const key = this.normalizeFilePath(item.file);
      if (!this.importEvidence.has(key)) {
        this.importEvidence.set(key, []);
      }
      this.importEvidence.get(key)!.push(item);
    }

    vscode.window.visibleTextEditors.forEach((editor) => {
      this.updateDecorations(editor);
    });
  }

  private updateDecorations(editor: vscode.TextEditor) {
    const filePath = this.normalizeFilePath(editor.document.uri.fsPath);
    const evidence = this.importEvidence.get(filePath) || [];

    const validImports: vscode.DecorationOptions[] = [];
    const invalidImports: vscode.DecorationOptions[] = [];

    for (const item of evidence) {
      const line = Math.max(0, item.line - 1);
      const lineText = editor.document.lineAt(line).text;
      
      // Find the import path in the line
      const importMatch = lineText.match(/['"]([^'"]+)['"]/);
      if (!importMatch) continue;

      const importStart = lineText.indexOf(importMatch[1]);
      const range = new vscode.Range(
        line,
        importStart,
        line,
        importStart + importMatch[1].length
      );

      const hoverMessage = new vscode.MarkdownString();
      hoverMessage.isTrusted = true;
      
      if (item.status === 'proven') {
        hoverMessage.appendMarkdown(`✅ **Import Verified**\n\n`);
        hoverMessage.appendMarkdown(`Package: \`${item.importPath}\`\n\n`);
        hoverMessage.appendMarkdown('This import has been verified to exist and match the expected API.');
      } else {
        hoverMessage.appendMarkdown(`❌ **Import Failed Verification**\n\n`);
        hoverMessage.appendMarkdown(`Package: \`${item.importPath}\`\n\n`);
        hoverMessage.appendMarkdown(item.message || 'Package not found or API mismatch detected.');
      }

      const decoration: vscode.DecorationOptions = {
        range,
        hoverMessage,
      };

      if (item.status === 'proven') {
        validImports.push(decoration);
      } else {
        invalidImports.push(decoration);
      }
    }

    editor.setDecorations(this.validImportDecorationType, validImports);
    editor.setDecorations(this.invalidImportDecorationType, invalidImports);
  }

  private normalizeFilePath(filePath: string): string {
    return filePath.replace(/\\/g, '/').toLowerCase();
  }

  dispose() {
    this.validImportDecorationType.dispose();
    this.invalidImportDecorationType.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}
