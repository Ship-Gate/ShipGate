import * as vscode from 'vscode';
import * as path from 'path';

export interface EvidenceItem {
  file: string;
  line: number;
  status: 'proven' | 'partial' | 'failed' | 'unverified';
  propertyId: string;
  propertyName: string;
  message: string;
  suggestion?: string;
}

export class EvidenceDecorationManager implements vscode.Disposable {
  private provenDecorationType: vscode.TextEditorDecorationType;
  private partialDecorationType: vscode.TextEditorDecorationType;
  private failedDecorationType: vscode.TextEditorDecorationType;
  private unverifiedDecorationType: vscode.TextEditorDecorationType;
  
  private evidenceMap: Map<string, EvidenceItem[]> = new Map();
  private disposables: vscode.Disposable[] = [];

  constructor(private context: vscode.ExtensionContext) {
    const iconPath = context.extensionUri.fsPath;

    // Create decoration types with gutter icons
    this.provenDecorationType = vscode.window.createTextEditorDecorationType({
      gutterIconPath: path.join(iconPath, 'media', 'icons', 'proven.svg'),
      gutterIconSize: 'contain',
      overviewRulerColor: '#4caf50',
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });

    this.partialDecorationType = vscode.window.createTextEditorDecorationType({
      gutterIconPath: path.join(iconPath, 'media', 'icons', 'partial.svg'),
      gutterIconSize: 'contain',
      overviewRulerColor: '#ff9800',
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });

    this.failedDecorationType = vscode.window.createTextEditorDecorationType({
      gutterIconPath: path.join(iconPath, 'media', 'icons', 'failed.svg'),
      gutterIconSize: 'contain',
      overviewRulerColor: '#f44336',
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });

    this.unverifiedDecorationType = vscode.window.createTextEditorDecorationType({
      gutterIconPath: path.join(iconPath, 'media', 'icons', 'unverified.svg'),
      gutterIconSize: 'contain',
      overviewRulerColor: '#9e9e9e',
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });

    // Listen for active editor changes
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
          this.updateDecorations(editor);
        }
      })
    );

    // Update decorations on visible editors
    vscode.window.visibleTextEditors.forEach((editor) => {
      this.updateDecorations(editor);
    });
  }

  updateEvidence(evidence: EvidenceItem[]) {
    // Group evidence by file
    this.evidenceMap.clear();
    for (const item of evidence) {
      const normalized = this.normalizeFilePath(item.file);
      if (!this.evidenceMap.has(normalized)) {
        this.evidenceMap.set(normalized, []);
      }
      this.evidenceMap.get(normalized)!.push(item);
    }

    // Update all visible editors
    vscode.window.visibleTextEditors.forEach((editor) => {
      this.updateDecorations(editor);
    });
  }

  private updateDecorations(editor: vscode.TextEditor) {
    const filePath = this.normalizeFilePath(editor.document.uri.fsPath);
    const evidence = this.evidenceMap.get(filePath) || [];

    const proven: vscode.DecorationOptions[] = [];
    const partial: vscode.DecorationOptions[] = [];
    const failed: vscode.DecorationOptions[] = [];
    const unverified: vscode.DecorationOptions[] = [];

    for (const item of evidence) {
      const line = Math.max(0, item.line - 1);
      const range = new vscode.Range(line, 0, line, 0);
      
      const hoverMessage = new vscode.MarkdownString();
      hoverMessage.isTrusted = true;
      hoverMessage.supportHtml = true;
      
      hoverMessage.appendMarkdown(`**${item.propertyName}**\n\n`);
      hoverMessage.appendMarkdown(`Status: ${this.getStatusBadge(item.status)}\n\n`);
      hoverMessage.appendMarkdown(`${item.message}\n\n`);
      
      if (item.suggestion) {
        hoverMessage.appendMarkdown(`💡 **Suggestion:** ${item.suggestion}\n\n`);
      }
      
      hoverMessage.appendMarkdown(`[View Details](command:shipgate.showPropertyDetails?${encodeURIComponent(JSON.stringify({ propertyId: item.propertyId }))})`);

      const decoration: vscode.DecorationOptions = {
        range,
        hoverMessage,
      };

      switch (item.status) {
        case 'proven':
          proven.push(decoration);
          break;
        case 'partial':
          partial.push(decoration);
          break;
        case 'failed':
          failed.push(decoration);
          break;
        case 'unverified':
          unverified.push(decoration);
          break;
      }
    }

    editor.setDecorations(this.provenDecorationType, proven);
    editor.setDecorations(this.partialDecorationType, partial);
    editor.setDecorations(this.failedDecorationType, failed);
    editor.setDecorations(this.unverifiedDecorationType, unverified);
  }

  private getStatusBadge(status: string): string {
    switch (status) {
      case 'proven': return '✅ PROVEN';
      case 'partial': return '⚠️ PARTIAL';
      case 'failed': return '❌ FAILED';
      case 'unverified': return '⚪ UNVERIFIED';
      default: return status.toUpperCase();
    }
  }

  private normalizeFilePath(filePath: string): string {
    return filePath.replace(/\\/g, '/').toLowerCase();
  }

  clear() {
    this.evidenceMap.clear();
    vscode.window.visibleTextEditors.forEach((editor) => {
      editor.setDecorations(this.provenDecorationType, []);
      editor.setDecorations(this.partialDecorationType, []);
      editor.setDecorations(this.failedDecorationType, []);
      editor.setDecorations(this.unverifiedDecorationType, []);
    });
  }

  dispose() {
    this.provenDecorationType.dispose();
    this.partialDecorationType.dispose();
    this.failedDecorationType.dispose();
    this.unverifiedDecorationType.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}
