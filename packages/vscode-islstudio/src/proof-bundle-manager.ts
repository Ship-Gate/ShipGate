/**
 * Proof Bundle Manager
 * 
 * Manages proof bundles from ISL verification
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface ProofBundle {
  id: string;
  path: string;
  verdict: string;
  score: number;
  timestamp: string;
}

/**
 * Find proof bundles in workspace
 */
export async function findProofBundles(): Promise<ProofBundle[]> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return [];
  }

  const proofDir = path.join(workspaceFolder.uri.fsPath, '.islstudio', 'proofs');
  
  try {
    await fs.access(proofDir);
  } catch {
    return [];
  }

  const bundles: ProofBundle[] = [];
  
  try {
    const files = await fs.readdir(proofDir);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const bundlePath = path.join(proofDir, file);
        try {
          const content = await fs.readFile(bundlePath, 'utf-8');
          const data = JSON.parse(content);
          
          bundles.push({
            id: data.id || path.basename(file, '.json'),
            path: bundlePath,
            verdict: data.verdict || 'unknown',
            score: data.score || 0,
            timestamp: data.timestamp || new Date().toISOString(),
          });
        } catch {
          // Skip invalid bundles
        }
      }
    }
  } catch (error) {
    // Directory might not exist or be readable
  }

  return bundles.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/**
 * View proof bundle in webview
 */
export async function viewProofBundle(bundlePath: string): Promise<void> {
  try {
    const content = await fs.readFile(bundlePath, 'utf-8');
    const data = JSON.parse(content);

    const panel = vscode.window.createWebviewPanel(
      'islstudioProofBundle',
      `Proof Bundle: ${data.id || path.basename(bundlePath)}`,
      vscode.ViewColumn.Beside,
      {}
    );

    panel.webview.html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: var(--vscode-font-family); padding: 20px; }
          pre { background: var(--vscode-editor-background); padding: 10px; border-radius: 4px; overflow-x: auto; }
          h1 { color: var(--vscode-editor-foreground); }
          .verdict { font-size: 24px; font-weight: bold; margin: 20px 0; }
          .verdict.SHIP { color: var(--vscode-successForeground); }
          .verdict.NO_SHIP { color: var(--vscode-errorForeground); }
        </style>
      </head>
      <body>
        <h1>Proof Bundle</h1>
        <div class="verdict ${data.verdict || 'unknown'}">${data.verdict || 'Unknown'}</div>
        <div>Score: ${data.score || 0}/100</div>
        <div>Timestamp: ${data.timestamp || 'Unknown'}</div>
        <h2>Details</h2>
        <pre>${JSON.stringify(data, null, 2)}</pre>
      </body>
      </html>
    `;
  } catch (error: any) {
    vscode.window.showErrorMessage(`Failed to view proof bundle: ${error.message}`);
  }
}
