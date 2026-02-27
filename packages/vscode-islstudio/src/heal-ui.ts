/**
 * Heal UI Webview Panel
 * 
 * Shows:
 * - Iteration progress
 * - Patch preview
 * - Final SHIP summary
 */

import * as vscode from 'vscode';
import * as path from 'path';

export class HealUIPanel {
  private static currentPanel: HealUIPanel | undefined = undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    // Set webview content
    this._update();

    // Handle messages from webview
    this._panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'applyPatches':
            this.applyPatches(message.patches);
            return;
          case 'cancel':
            this.cancel();
            return;
        }
      },
      null,
      this._disposables
    );

    // Handle panel disposal
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  public static createOrShow(extensionUri: vscode.Uri): HealUIPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If panel already exists, reveal it
    if (HealUIPanel.currentPanel) {
      HealUIPanel.currentPanel._panel.reveal(column);
      return HealUIPanel.currentPanel;
    }

    // Otherwise create new panel
    const panel = vscode.window.createWebviewPanel(
      'islstudioHeal',
      'ShipGate: Heal',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
      }
    );

    HealUIPanel.currentPanel = new HealUIPanel(panel, extensionUri);
    return HealUIPanel.currentPanel;
  }

  public updateIteration(iteration: HealIteration): void {
    this._panel.webview.postMessage({
      command: 'updateIteration',
      iteration,
    });
  }

  public updatePatches(patches: PatchPreview[]): void {
    this._panel.webview.postMessage({
      command: 'updatePatches',
      patches,
    });
  }

  public showSummary(result: HealResult): void {
    this._panel.webview.postMessage({
      command: 'showSummary',
      result,
    });
  }

  private _update(): void {
    const webview = this._panel.webview;
    this._panel.webview.html = this._getHtmlForWebview(webview);
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ShipGate: Heal</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            padding: 20px;
            margin: 0;
        }
        .header {
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .status {
            display: flex;
            align-items: center;
            gap: 10px;
            margin: 10px 0;
        }
        .status-icon {
            font-size: 24px;
        }
        .iteration {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 15px;
            margin: 10px 0;
        }
        .iteration-header {
            font-weight: bold;
            margin-bottom: 10px;
        }
        .violations {
            margin: 10px 0;
        }
        .violation {
            padding: 5px 10px;
            margin: 5px 0;
            background: var(--vscode-input-background);
            border-left: 3px solid var(--vscode-errorForeground);
        }
        .violation.warning {
            border-left-color: var(--vscode-warningForeground);
        }
        .patches {
            margin: 10px 0;
        }
        .patch {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 10px;
            margin: 10px 0;
        }
        .patch-header {
            font-weight: bold;
            margin-bottom: 5px;
        }
        .patch-diff {
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
            white-space: pre-wrap;
            background: var(--vscode-textCodeBlock-background);
            padding: 10px;
            border-radius: 4px;
            overflow-x: auto;
        }
        .diff-line.added {
            color: var(--vscode-diffEditor-insertedTextBackground);
        }
        .diff-line.removed {
            color: var(--vscode-diffEditor-removedTextBackground);
        }
        .summary {
            background: var(--vscode-editor-background);
            border: 2px solid var(--vscode-successForeground);
            border-radius: 4px;
            padding: 20px;
            margin: 20px 0;
        }
        .summary.ship {
            border-color: var(--vscode-successForeground);
        }
        .summary.no-ship {
            border-color: var(--vscode-errorForeground);
        }
        .button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            margin: 5px;
        }
        .button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .progress {
            width: 100%;
            height: 20px;
            background: var(--vscode-progressBar-background);
            border-radius: 10px;
            overflow: hidden;
            margin: 10px 0;
        }
        .progress-bar {
            height: 100%;
            background: var(--vscode-progressBar-background);
            transition: width 0.3s;
        }
        .progress-bar.running {
            background: var(--vscode-progressBar-background);
            animation: pulse 1s infinite;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>ShipGate: Heal</h1>
        <div id="status" class="status">
            <span class="status-icon">⏳</span>
            <span id="status-text">Initializing...</span>
        </div>
        <div class="progress">
            <div id="progress-bar" class="progress-bar" style="width: 0%"></div>
        </div>
    </div>
    
    <div id="iterations"></div>
    <div id="patches"></div>
    <div id="summary"></div>

    <script>
        const vscode = acquireVsCodeApi();
        
        let currentIteration = 0;
        let maxIterations = 8;
        
        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.command) {
                case 'updateIteration':
                    updateIteration(message.iteration);
                    break;
                case 'updatePatches':
                    updatePatches(message.patches);
                    break;
                case 'showSummary':
                    showSummary(message.result);
                    break;
            }
        });
        
        function updateIteration(iteration) {
            currentIteration = iteration.iteration;
            maxIterations = iteration.maxIterations || 8;
            
            const statusEl = document.getElementById('status-text');
            const statusIcon = document.querySelector('.status-icon');
            const progressBar = document.getElementById('progress-bar');
            
            if (iteration.verdict === 'SHIP') {
                statusEl.textContent = '✓ SHIP - All violations resolved!';
                statusIcon.textContent = '✓';
                progressBar.style.width = '100%';
                progressBar.classList.remove('running');
            } else {
                statusEl.textContent = \`Iteration \${iteration.iteration}/\${maxIterations} - \${iteration.violations.length} violations\`;
                statusIcon.textContent = '⏳';
                progressBar.style.width = \`\${(iteration.iteration / maxIterations) * 100}%\`;
                progressBar.classList.add('running');
            }
            
            // Add iteration to list
            const iterationsEl = document.getElementById('iterations');
            const iterationEl = document.createElement('div');
            iterationEl.className = 'iteration';
            iterationEl.innerHTML = \`
                <div class="iteration-header">Iteration \${iteration.iteration}</div>
                <div>Score: \${iteration.score}/100</div>
                <div>Verdict: \${iteration.verdict}</div>
                <div>Violations: \${iteration.violations.length}</div>
                <div>Patches Applied: \${iteration.patchesApplied.length}</div>
                <div>Duration: \${iteration.duration}ms</div>
            \`;
            iterationsEl.appendChild(iterationEl);
        }
        
        function updatePatches(patches) {
            const patchesEl = document.getElementById('patches');
            patchesEl.innerHTML = '<h2>Patch Preview</h2>';
            
            patches.forEach(patch => {
                const patchEl = document.createElement('div');
                patchEl.className = 'patch';
                patchEl.innerHTML = \`
                    <div class="patch-header">\${patch.description}</div>
                    <div>File: \${patch.file}</div>
                    <div>Rule: \${patch.ruleId}</div>
                    <div class="patch-diff">\${formatDiff(patch.diff)}</div>
                \`;
                patchesEl.appendChild(patchEl);
            });
        }
        
        function formatDiff(diff) {
            if (!diff) return 'No diff available';
            return diff.split('\\n').map(line => {
                if (line.startsWith('+')) {
                    return \`<span class="diff-line added">\${line}</span>\`;
                } else if (line.startsWith('-')) {
                    return \`<span class="diff-line removed">\${line}</span>\`;
                }
                return line;
            }).join('\\n');
        }
        
        function showSummary(result) {
            const summaryEl = document.getElementById('summary');
            summaryEl.className = \`summary \${result.ok ? 'ship' : 'no-ship'}\`;
            
            summaryEl.innerHTML = \`
                <h2>\${result.ok ? '✓ SHIP' : '✗ NO_SHIP'}</h2>
                <div>Final Score: \${result.gate.score}/100</div>
                <div>Iterations: \${result.iterations}</div>
                <div>Reason: \${result.reason}</div>
                <div>Violations Remaining: \${result.gate.violations.length}</div>
            \`;
            
            const statusEl = document.getElementById('status-text');
            const statusIcon = document.querySelector('.status-icon');
            const progressBar = document.getElementById('progress-bar');
            
            if (result.ok) {
                statusEl.textContent = '✓ Healing complete - SHIP!';
                statusIcon.textContent = '✓';
                progressBar.style.width = '100%';
                progressBar.classList.remove('running');
            } else {
                statusEl.textContent = \`Healing stopped: \${result.reason}\`;
                statusIcon.textContent = '✗';
                progressBar.classList.remove('running');
            }
        }
    </script>
</body>
</html>`;
  }

  private applyPatches(patches: PatchPreview[]): void {
    // TODO: Implement patch application
    vscode.window.showInformationMessage(`Applying ${patches.length} patches...`);
  }

  private cancel(): void {
    vscode.window.showInformationMessage('Healing cancelled');
  }

  public dispose(): void {
    HealUIPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}

// ============================================================================
// Types
// ============================================================================

export interface HealIteration {
  iteration: number;
  maxIterations?: number;
  verdict: 'SHIP' | 'NO_SHIP';
  score: number;
  violations: any[];
  patchesApplied: any[];
  duration: number;
}

export interface PatchPreview {
  ruleId: string;
  file: string;
  description: string;
  diff: string;
}

export interface HealResult {
  ok: boolean;
  reason: string;
  gate: {
    verdict: 'SHIP' | 'NO_SHIP';
    score: number;
    violations: any[];
  };
  iterations: number;
}
