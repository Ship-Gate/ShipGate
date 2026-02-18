import * as vscode from 'vscode';
import { getNonce } from '../utils/getNonce';

export interface ProofBundleState {
  bundle: any | null;
  history: any[];
  loading: boolean;
}

export class ProofBundlePanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'shipgate.proofBundle';
  private _view?: vscode.WebviewView;
  private _state: ProofBundleState = {
    bundle: null,
    history: [],
    loading: false,
  };

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext,
  ) {
    // Load persisted state
    const savedState = _context.workspaceState.get<ProofBundleState>('shipgate.proofBundleState');
    if (savedState) {
      this._state = savedState;
    }
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Restore state
    if (this._state.bundle) {
      webviewView.webview.postMessage({ type: 'setState', state: this._state });
    }

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.command) {
        case 'runScan':
          vscode.commands.executeCommand('shipgate.verify');
          break;
        case 'viewFullBundle':
          this.viewFullBundleJson();
          break;
        case 'viewProperty':
          this.viewPropertyDetails(msg.propertyId);
          break;
        case 'exportCompliance':
          vscode.commands.executeCommand('shipgate.exportReport');
          break;
        case 'refresh':
          this.refresh();
          break;
      }
    });
  }

  public updateBundle(bundle: any) {
    this._state.bundle = bundle;
    this._state.history.push({
      timestamp: new Date().toISOString(),
      trustScore: bundle.trustScore,
      verdict: bundle.verdict,
    });
    // Keep last 10 history entries
    if (this._state.history.length > 10) {
      this._state.history = this._state.history.slice(-10);
    }
    this._context.workspaceState.update('shipgate.proofBundleState', this._state);
    this._view?.webview.postMessage({ type: 'setState', state: this._state });
  }

  public setLoading(loading: boolean) {
    this._state.loading = loading;
    this._view?.webview.postMessage({ type: 'setLoading', loading });
  }

  private async viewFullBundleJson() {
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!cwd) return;

    const bundlePath = vscode.Uri.file(`${cwd}/.shipgate/proof-bundle.json`);
    try {
      const doc = await vscode.workspace.openTextDocument(bundlePath);
      await vscode.window.showTextDocument(doc, { preview: false });
    } catch {
      vscode.window.showWarningMessage('Proof bundle not found. Run a scan first.');
    }
  }

  private async viewPropertyDetails(propertyId: string) {
    const bundle = this._state.bundle;
    if (!bundle || !bundle.properties) return;

    const property = bundle.properties.find((p: any) => p.id === propertyId);
    if (!property) return;

    const panel = vscode.window.createWebviewPanel(
      'proofBundleProperty',
      `Property: ${property.name}`,
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    panel.webview.html = this._getPropertyDetailsHtml(property);
  }

  private async refresh() {
    vscode.commands.executeCommand('shipgate.verify');
  }

  private _getPropertyDetailsHtml(property: any): string {
    const evidenceSummary = property.evidence?.map((e: any) => `
      <div class="evidence-item ${e.status}">
        <div class="evidence-header">
          <span class="status-icon">${this._getStatusIcon(e.status)}</span>
          <span class="evidence-type">${e.type}</span>
        </div>
        <div class="evidence-body">
          <p>${e.description}</p>
          ${e.file ? `<code>${e.file}:${e.line}</code>` : ''}
        </div>
      </div>
    `).join('') || '<p>No evidence available</p>';

    return `<!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: var(--vscode-font-family); padding: 20px; }
        h1 { color: var(--vscode-foreground); }
        .status { 
          padding: 4px 12px; 
          border-radius: 4px; 
          display: inline-block;
          margin-bottom: 20px;
        }
        .status.proven { background: var(--vscode-testing-iconPassed); color: white; }
        .status.partial { background: var(--vscode-testing-iconQueued); color: white; }
        .status.failed { background: var(--vscode-testing-iconFailed); color: white; }
        .evidence-item {
          border: 1px solid var(--vscode-panel-border);
          padding: 12px;
          margin: 8px 0;
          border-radius: 4px;
        }
        .evidence-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .status-icon { font-size: 16px; }
        code { 
          background: var(--vscode-textCodeBlock-background);
          padding: 2px 6px;
          border-radius: 3px;
        }
      </style>
    </head>
    <body>
      <h1>${property.name}</h1>
      <div class="status ${property.status}">${property.status.toUpperCase()}</div>
      <p><strong>Description:</strong> ${property.description || 'N/A'}</p>
      <p><strong>Confidence:</strong> ${Math.round(property.confidence * 100)}%</p>
      
      <h2>Evidence</h2>
      ${evidenceSummary}

      ${property.suggestion ? `
        <h2>Suggestion</h2>
        <p>${property.suggestion}</p>
      ` : ''}
    </body>
    </html>`;
  }

  private _getStatusIcon(status: string): string {
    switch (status) {
      case 'proven': return '✅';
      case 'partial': return '⚠️';
      case 'failed': return '❌';
      default: return '⚪';
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = getNonce();

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
      <title>Proof Bundle</title>
      <style>
        body {
          font-family: var(--vscode-font-family);
          font-size: var(--vscode-font-size);
          color: var(--vscode-foreground);
          padding: 16px;
        }
        
        .header {
          margin-bottom: 20px;
        }
        
        .trust-score {
          font-size: 48px;
          font-weight: bold;
          text-align: center;
          margin: 20px 0;
        }
        
        .trust-score.high { color: var(--vscode-testing-iconPassed); }
        .trust-score.medium { color: var(--vscode-testing-iconQueued); }
        .trust-score.low { color: var(--vscode-testing-iconFailed); }
        
        .verdict {
          text-align: center;
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 24px;
        }
        
        .properties {
          margin: 20px 0;
        }
        
        .property {
          border: 1px solid var(--vscode-panel-border);
          border-radius: 4px;
          padding: 12px;
          margin: 8px 0;
          cursor: pointer;
          transition: background 0.2s;
        }
        
        .property:hover {
          background: var(--vscode-list-hoverBackground);
        }
        
        .property-header {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .status-icon {
          font-size: 20px;
        }
        
        .property-name {
          flex: 1;
          font-weight: 500;
        }
        
        .property-confidence {
          font-size: 12px;
          color: var(--vscode-descriptionForeground);
        }
        
        .property-summary {
          margin-top: 8px;
          font-size: 12px;
          color: var(--vscode-descriptionForeground);
        }
        
        .actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 20px;
        }
        
        button {
          background: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          padding: 8px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
        }
        
        button:hover {
          background: var(--vscode-button-hoverBackground);
        }
        
        button.secondary {
          background: var(--vscode-button-secondaryBackground);
          color: var(--vscode-button-secondaryForeground);
        }
        
        button.secondary:hover {
          background: var(--vscode-button-secondaryHoverBackground);
        }
        
        .loading {
          text-align: center;
          padding: 40px;
          color: var(--vscode-descriptionForeground);
        }
        
        .empty {
          text-align: center;
          padding: 40px;
          color: var(--vscode-descriptionForeground);
        }
        
        .trend-chart {
          height: 60px;
          margin: 20px 0;
          position: relative;
        }
        
        .trend-chart svg {
          width: 100%;
          height: 100%;
        }
        
        .trend-line {
          fill: none;
          stroke: var(--vscode-charts-blue);
          stroke-width: 2;
        }
      </style>
    </head>
    <body>
      <div id="app">
        <div class="loading">Loading proof bundle...</div>
      </div>

      <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        let state = null;

        window.addEventListener('message', event => {
          const message = event.data;
          switch (message.type) {
            case 'setState':
              state = message.state;
              render();
              break;
            case 'setLoading':
              renderLoading(message.loading);
              break;
          }
        });

        function render() {
          const app = document.getElementById('app');
          
          if (!state || !state.bundle) {
            app.innerHTML = \`
              <div class="empty">
                <p>No proof bundle available</p>
                <button onclick="runScan()">Run Scan</button>
              </div>
            \`;
            return;
          }

          const bundle = state.bundle;
          const scoreClass = bundle.trustScore >= 70 ? 'high' : bundle.trustScore >= 40 ? 'medium' : 'low';
          
          const propertiesHtml = (bundle.properties || []).map(p => \`
            <div class="property" onclick="viewProperty('\${p.id}')">
              <div class="property-header">
                <span class="status-icon">\${getStatusIcon(p.status)}</span>
                <span class="property-name">\${p.name}</span>
                <span class="property-confidence">\${Math.round(p.confidence * 100)}%</span>
              </div>
              \${p.evidenceCount ? \`<div class="property-summary">\${p.evidenceCount} evidence items</div>\` : ''}
            </div>
          \`).join('');

          const trendHtml = state.history && state.history.length > 1 ? renderTrend() : '';

          app.innerHTML = \`
            <div class="header">
              <h2>Proof Bundle</h2>
              <div class="trust-score \${scoreClass}">\${bundle.trustScore || 0}</div>
              <div class="verdict">\${bundle.verdict || 'UNKNOWN'}</div>
            </div>

            \${trendHtml}

            <div class="properties">
              <h3>Properties</h3>
              \${propertiesHtml || '<p>No properties found</p>'}
            </div>

            <div class="actions">
              <button onclick="runScan()">Run Scan</button>
              <button class="secondary" onclick="viewFullBundle()">View Full Bundle</button>
              <button class="secondary" onclick="exportCompliance()">Generate Compliance Report</button>
            </div>
          \`;
        }

        function renderTrend() {
          const history = state.history.slice(-10);
          if (history.length < 2) return '';

          const max = 100;
          const width = 300;
          const height = 60;
          const points = history.map((h, i) => {
            const x = (i / (history.length - 1)) * width;
            const y = height - (h.trustScore / max) * height;
            return \`\${x},\${y}\`;
          }).join(' ');

          return \`
            <div class="trend-chart">
              <svg viewBox="0 0 300 60">
                <polyline class="trend-line" points="\${points}" />
              </svg>
            </div>
          \`;
        }

        function renderLoading(loading) {
          if (loading && state && state.bundle) {
            // Show loading overlay
          }
        }

        function getStatusIcon(status) {
          switch (status) {
            case 'proven': return '✅';
            case 'partial': return '⚠️';
            case 'failed': return '❌';
            default: return '⚪';
          }
        }

        function runScan() {
          vscode.postMessage({ command: 'runScan' });
        }

        function viewFullBundle() {
          vscode.postMessage({ command: 'viewFullBundle' });
        }

        function viewProperty(propertyId) {
          vscode.postMessage({ command: 'viewProperty', propertyId });
        }

        function exportCompliance() {
          vscode.postMessage({ command: 'exportCompliance' });
        }

        // Initial render
        render();
      </script>
    </body>
    </html>`;
  }
}
