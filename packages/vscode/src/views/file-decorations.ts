import * as vscode from 'vscode';

export interface FileVerificationStatus {
  file: string;
  status: 'proven' | 'partial' | 'failed' | 'unverified';
  trustScore?: number;
  propertiesVerified?: number;
  totalProperties?: number;
}

export class FileDecorationProvider implements vscode.FileDecorationProvider, vscode.Disposable {
  private _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[]>();
  readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

  private fileStatusMap: Map<string, FileVerificationStatus> = new Map();

  updateFileStatus(statuses: FileVerificationStatus[]) {
    this.fileStatusMap.clear();
    const changedUris: vscode.Uri[] = [];

    for (const status of statuses) {
      const normalized = this.normalizeFilePath(status.file);
      this.fileStatusMap.set(normalized, status);
      
      try {
        changedUris.push(vscode.Uri.file(status.file));
      } catch {
        // Invalid file path
      }
    }

    if (changedUris.length > 0) {
      this._onDidChangeFileDecorations.fire(changedUris);
    }
  }

  provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    const filePath = this.normalizeFilePath(uri.fsPath);
    const status = this.fileStatusMap.get(filePath);

    if (!status) {
      return undefined;
    }

    let badge: string;
    let color: vscode.ThemeColor;
    let tooltip: string;

    switch (status.status) {
      case 'proven':
        badge = '✓';
        color = new vscode.ThemeColor('testing.iconPassed');
        tooltip = `Verification: PROVEN (${status.trustScore || 100}%)`;
        if (status.propertiesVerified && status.totalProperties) {
          tooltip += `\n${status.propertiesVerified}/${status.totalProperties} properties verified`;
        }
        break;

      case 'partial':
        badge = '⚠';
        color = new vscode.ThemeColor('testing.iconQueued');
        tooltip = `Verification: PARTIAL (${status.trustScore || 50}%)`;
        if (status.propertiesVerified && status.totalProperties) {
          tooltip += `\n${status.propertiesVerified}/${status.totalProperties} properties verified`;
        }
        break;

      case 'failed':
        badge = '✗';
        color = new vscode.ThemeColor('testing.iconFailed');
        tooltip = `Verification: FAILED (${status.trustScore || 0}%)`;
        if (status.propertiesVerified && status.totalProperties) {
          tooltip += `\n${status.propertiesVerified}/${status.totalProperties} properties verified`;
        }
        break;

      case 'unverified':
        badge = '○';
        color = new vscode.ThemeColor('testing.iconUnset');
        tooltip = 'Not verified yet';
        break;

      default:
        return undefined;
    }

    return {
      badge,
      color,
      tooltip,
    };
  }

  clear() {
    const allUris = Array.from(this.fileStatusMap.keys()).map(f => vscode.Uri.file(f));
    this.fileStatusMap.clear();
    if (allUris.length > 0) {
      this._onDidChangeFileDecorations.fire(allUris);
    }
  }

  private normalizeFilePath(filePath: string): string {
    return filePath.replace(/\\/g, '/').toLowerCase();
  }

  dispose() {
    this._onDidChangeFileDecorations.dispose();
  }
}
