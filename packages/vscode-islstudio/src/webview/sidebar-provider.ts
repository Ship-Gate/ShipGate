import * as vscode from 'vscode';

export class ShipGateSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'shipgate.sidebar';
  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };
    webviewView.webview.html = this._getHtml(webviewView.webview);

    // Listen for messages from webview
    webviewView.webview.onDidReceiveMessage((msg) => {
      if (msg.command === 'verify') {
        vscode.commands.executeCommand('shipgate.verify');
      }
      if (msg.command === 'openFile') {
        vscode.workspace.openTextDocument(msg.file).then(doc => {
          vscode.window.showTextDocument(doc, { selection: new vscode.Range(msg.line - 1, 0, msg.line - 1, 0) });
        });
      }
    });
  }

  // Call this after a scan completes to update the sidebar
  public updateResults(data: any) {
    this._view?.webview.postMessage({ type: 'results', data });
  }

  private _getHtml(webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg0: #0a0a0f;
      --bg1: #111118;
      --bg2: #1a1a24;
      --bg3: #222233;
      --border: rgba(255,255,255,0.06);
      --border-hover: rgba(255,255,255,0.12);
      --text0: #ffffff;
      --text1: #c8c8d4;
      --text2: #8888a0;
      --text3: #555566;
      --ship: #00e68a;
      --ship-bg: rgba(0,230,138,0.08);
      --warn: #ffb547;
      --warn-bg: rgba(255,181,71,0.08);
      --noship: #ff5c6a;
      --noship-bg: rgba(255,92,106,0.08);
      --accent: #6366f1;
      --accent-bg: rgba(99,102,241,0.08);
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: var(--bg0);
      color: var(--text1);
      width: 320px;
      height: 100vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    /* Header */
    .header {
      padding: 16px;
      background: var(--bg1);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }

    .logo-section {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .logo-icon {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      background: linear-gradient(135deg, var(--ship), var(--accent));
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      color: white;
    }

    .logo-text {
      font-weight: 600;
      color: var(--text0);
    }

    .repo-name {
      font-size: 11px;
      color: var(--text3);
      margin-top: 2px;
    }

    .header-buttons {
      display: flex;
      gap: 8px;
    }

    .icon-btn {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      background: var(--bg2);
      border: 1px solid var(--border);
      color: var(--text2);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s;
    }

    .icon-btn:hover {
      background: var(--bg3);
      color: var(--text1);
    }

    /* Tabs */
    .tabs {
      display: flex;
      gap: 16px;
      border-bottom: 1px solid var(--border);
    }

    .tab {
      padding: 8px 0;
      font-size: 12px;
      font-weight: 500;
      color: var(--text3);
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all 0.15s;
    }

    .tab.active {
      color: var(--text0);
      border-bottom-color: var(--ship);
    }

    .tab:hover:not(.active) {
      color: var(--text2);
    }

    /* Content */
    .content {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }

    .tab-content {
      display: none;
    }

    .tab-content.active {
      display: block;
    }

    /* Verdict Card */
    .verdict-card {
      background: var(--bg1);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 16px;
      position: relative;
      overflow: hidden;
    }

    .verdict-card.ship {
      background: var(--ship-bg);
      border-color: rgba(0,230,138,0.12);
    }

    .verdict-card.warn {
      background: var(--warn-bg);
      border-color: rgba(255,181,71,0.12);
    }

    .verdict-card.noship {
      background: var(--noship-bg);
      border-color: rgba(255,92,106,0.12);
    }

    .glow {
      position: absolute;
      top: -20px;
      right: -20px;
      width: 80px;
      height: 80px;
      border-radius: 50%;
      filter: blur(30px);
      opacity: 0.2;
    }

    .glow.ship { background: var(--ship); }
    .glow.warn { background: var(--warn); }
    .glow.noship { background: var(--noship); }

    .verdict-header {
      display: flex;
      align-items: center;
      gap: 12px;
      position: relative;
      z-index: 1;
    }

    .verdict-text {
      font-weight: 600;
      font-size: 18px;
    }

    .verdict-text.ship { color: var(--ship); }
    .verdict-text.warn { color: var(--warn); }
    .verdict-text.noship { color: var(--noship); }

    .verdict-details {
      font-size: 12px;
      color: var(--text2);
      margin-top: 2px;
    }

    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 16px;
    }

    .stat-card {
      background: var(--bg1);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px;
      position: relative;
      overflow: hidden;
    }

    .stat-value {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      font-size: 18px;
      color: var(--text0);
    }

    .stat-label {
      font-size: 10px;
      text-transform: uppercase;
      color: var(--text3);
      margin-top: 2px;
    }

    .stat-sparkline {
      position: absolute;
      top: 8px;
      right: 8px;
    }

    /* Compliance */
    .compliance-section {
      margin-bottom: 16px;
    }

    .section-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--text2);
      margin-bottom: 8px;
      text-transform: uppercase;
    }

    .compliance-cards {
      display: flex;
      gap: 8px;
    }

    .compliance-card {
      flex: 1;
      background: var(--bg1);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 8px;
      text-align: center;
    }

    .compliance-value {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      font-size: 14px;
    }

    .compliance-value.soc2 { color: var(--ship); }
    .compliance-value.hipaa { color: var(--warn); }
    .compliance-value.euai { color: var(--accent); }

    .compliance-label {
      font-size: 9px;
      color: var(--text3);
      margin-top: 2px;
    }

    /* Provenance */
    .provenance-bars {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .provenance-bar {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .provenance-dot {
      width: 8px;
      height: 8px;
      border-radius: 2px;
      flex-shrink: 0;
    }

    .provenance-label {
      font-size: 11px;
      color: var(--text2);
      flex: 1;
    }

    .provenance-progress {
      height: 4px;
      background: var(--bg2);
      border-radius: 2px;
      overflow: hidden;
      flex: 2;
    }

    .provenance-fill {
      height: 100%;
      border-radius: 2px;
      transition: width 0.3s;
    }

    .provenance-value {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: var(--text2);
      margin-left: 4px;
      min-width: 30px;
      text-align: right;
    }

    /* Claims */
    .claim-item {
      background: var(--bg1);
      border: 1px solid var(--border);
      border-radius: 10px;
      margin-bottom: 8px;
      overflow: hidden;
    }

    .claim-header {
      padding: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .claim-header:hover {
      background: rgba(255,255,255,0.015);
    }

    .claim-status {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      color: white;
      flex-shrink: 0;
    }

    .claim-status.proven {
      background: var(--ship);
    }

    .claim-status.partial {
      background: var(--warn);
    }

    .claim-status.failed {
      background: var(--noship);
    }

    .claim-name {
      flex: 1;
      font-size: 12px;
      color: var(--text1);
    }

    .claim-confidence {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: var(--text2);
    }

    .claim-details {
      padding: 0 12px 12px;
      display: none;
    }

    .claim-details.expanded {
      display: block;
    }

    .claim-evidence {
      font-size: 11px;
      color: var(--text2);
      margin-bottom: 8px;
      line-height: 1.4;
    }

    .control-badge {
      display: inline-block;
      padding: 2px 8px;
      background: var(--accent-bg);
      border: 1px solid rgba(99,102,241,0.2);
      border-radius: 3px;
      font-size: 10px;
      font-family: 'JetBrains Mono', monospace;
      font-weight: 600;
      color: var(--accent);
    }

    /* Files */
    .file-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--bg1);
      border: 1px solid var(--border);
      border-radius: 10px;
      margin-bottom: 6px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .file-item:hover {
      background: rgba(255,255,255,0.015);
      border-color: var(--border-hover);
    }

    .file-name {
      flex: 1;
      font-size: 12px;
      color: var(--text1);
    }

    .file-score {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: var(--text2);
    }

    /* Footer */
    .footer {
      padding: 12px 16px;
      background: var(--bg1);
      border-top: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }

    .last-scan {
      font-size: 11px;
      color: var(--text3);
    }

    .verify-btn {
      background: linear-gradient(135deg, var(--ship), var(--accent));
      border: none;
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 11px;
      font-weight: 600;
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: all 0.15s;
    }

    .verify-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0,230,138,0.3);
    }

    /* Empty state */
    .empty-state {
      text-align: center;
      padding: 32px 16px;
      color: var(--text3);
    }

    .empty-icon {
      font-size: 32px;
      margin-bottom: 8px;
      opacity: 0.5;
    }

    .empty-text {
      font-size: 12px;
      margin-bottom: 16px;
    }

    /* Ring chart */
    .ring-chart {
      width: 64px;
      height: 64px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-section">
      <div class="logo">
        <div class="logo-icon">⚡</div>
        <div>
          <div class="logo-text">ShipGate</div>
          <div class="repo-name">my-repo</div>
        </div>
      </div>
      <div class="header-buttons">
        <button class="icon-btn" onclick="refresh()">↻</button>
        <button class="icon-btn" onclick="settings()">⚙</button>
      </div>
    </div>
    <div class="tabs">
      <div class="tab active" data-tab="overview">Overview</div>
      <div class="tab" data-tab="claims">Claims</div>
      <div class="tab" data-tab="files">Files</div>
    </div>
  </div>

  <div class="content">
    <!-- Overview Tab -->
    <div class="tab-content active" id="overview">
      <div id="overview-content">
        <div class="empty-state">
          <div class="empty-icon">📊</div>
          <div class="empty-text">Run your first scan to see results</div>
          <button class="verify-btn" onclick="verify()">
            ▶ Verify
          </button>
        </div>
      </div>
    </div>

    <!-- Claims Tab -->
    <div class="tab-content" id="claims">
      <div id="claims-content">
        <div class="empty-state">
          <div class="empty-text">No claims data available</div>
        </div>
      </div>
    </div>

    <!-- Files Tab -->
    <div class="tab-content" id="files">
      <div id="files-content">
        <div class="empty-state">
          <div class="empty-text">No files data available</div>
        </div>
      </div>
    </div>
  </div>

  <div class="footer">
    <div class="last-scan" id="last-scan">No scans yet</div>
    <button class="verify-btn" onclick="verify()">
      ▶ Verify
    </button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let currentData = null;

    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        
        // Update active tab
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
          content.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');
      });
    });

    // Message handling
    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.type === 'results') {
        currentData = msg.data;
        updateUI(msg.data);
      }
    });

    function updateUI(data) {
      if (!data) return;

      // Update overview
      updateOverview(data);
      
      // Update claims
      updateClaims(data.claims || []);
      
      // Update files
      updateFiles(data.files || []);
      
      // Update last scan time
      updateLastScan(data.lastScanTime);
    }

    function updateOverview(data) {
      const container = document.getElementById('overview-content');
      
      const verdictClass = data.verdict.toLowerCase();
      const verdictColor = {
        'ship': 'var(--ship)',
        'warn': 'var(--warn)',
        'noship': 'var(--noship)'
      }[verdictClass] || 'var(--text2)';

      container.innerHTML = \`
        <div class="verdict-card \${verdictClass}">
          <div class="glow \${verdictClass}"></div>
          <div class="verdict-header">
            <div class="ring-chart">
              \${ring(data.score || 0, 64, 4, verdictColor)}
            </div>
            <div>
              <div class="verdict-text \${verdictClass}">\${data.verdict || 'UNKNOWN'}</div>
              <div class="verdict-details">\${data.claims?.length || 0} claims verified</div>
            </div>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">\${data.stats?.verifiedClaims || 0}/\${data.stats?.totalClaims || 0}</div>
            <div class="stat-label">Claims</div>
            <div class="stat-sparkline">\${sparkline([3,5,4,6,5,7,6], 'var(--ship)')}</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">\${data.stats?.coverage || 0}%</div>
            <div class="stat-label">Coverage</div>
            <div class="stat-sparkline">\${sparkline([85,87,84,89,88,91,94], 'var(--ship)')}</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">\${data.stats?.totalFiles || 0}</div>
            <div class="stat-label">Files</div>
            <div class="stat-sparkline">\${sparkline([200,210,205,220,215,230,263], 'var(--accent)')}</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">\${data.stats?.issues || 0}</div>
            <div class="stat-label">Issues</div>
            <div class="stat-sparkline">\${sparkline([25,22,24,20,21,19,19], 'var(--noship)')}</div>
          </div>
        </div>

        <div class="compliance-section">
          <div class="section-title">Compliance</div>
          <div class="compliance-cards">
            <div class="compliance-card">
              <div class="compliance-value soc2">\${data.compliance?.soc2 || 0}%</div>
              <div class="compliance-label">SOC 2</div>
            </div>
            <div class="compliance-card">
              <div class="compliance-value hipaa">\${data.compliance?.hipaa || 0}%</div>
              <div class="compliance-label">HIPAA</div>
            </div>
            <div class="compliance-card">
              <div class="compliance-value euai">\${data.compliance?.euai || 0}%</div>
              <div class="compliance-label">EU AI</div>
            </div>
          </div>
        </div>

        <div class="compliance-section">
          <div class="section-title">AI Provenance</div>
          <div class="provenance-bars">
            <div class="provenance-bar">
              <div class="provenance-dot" style="background: var(--accent)"></div>
              <div class="provenance-label">AI-Generated</div>
              <div class="provenance-progress">
                <div class="provenance-fill" style="width: \${data.provenance?.aiGenerated || 0}%; background: var(--accent)"></div>
              </div>
              <div class="provenance-value">\${data.provenance?.aiGenerated || 0}%</div>
            </div>
            <div class="provenance-bar">
              <div class="provenance-dot" style="background: var(--ship)"></div>
              <div class="provenance-label">Human</div>
              <div class="provenance-progress">
                <div class="provenance-fill" style="width: \${data.provenance?.human || 0}%; background: var(--ship)"></div>
              </div>
              <div class="provenance-value">\${data.provenance?.human || 0}%</div>
            </div>
            <div class="provenance-bar">
              <div class="provenance-dot" style="background: var(--warn)"></div>
              <div class="provenance-label">AI-Assisted</div>
              <div class="provenance-progress">
                <div class="provenance-fill" style="width: \${data.provenance?.aiAssisted || 0}%; background: var(--warn)"></div>
              </div>
              <div class="provenance-value">\${data.provenance?.aiAssisted || 0}%</div>
            </div>
            <div class="provenance-bar">
              <div class="provenance-dot" style="background: var(--text3)"></div>
              <div class="provenance-label">Unknown</div>
              <div class="provenance-progress">
                <div class="provenance-fill" style="width: \${data.provenance?.unknown || 0}%; background: var(--text3)"></div>
              </div>
              <div class="provenance-value">\${data.provenance?.unknown || 0}%</div>
            </div>
          </div>
        </div>
      \`;
    }

    function updateClaims(claims) {
      const container = document.getElementById('claims-content');
      
      if (claims.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-text">No claims data available</div></div>';
        return;
      }

      container.innerHTML = claims.map((claim, index) => {
        const statusIcon = {
          'PROVEN': '✓',
          'PARTIAL': '◐',
          'FAILED': '✗'
        }[claim.status] || '?';
        
        const statusClass = {
          'PROVEN': 'proven',
          'PARTIAL': 'partial',
          'FAILED': 'failed'
        }[claim.status] || '';

        return \`
          <div class="claim-item">
            <div class="claim-header" onclick="toggleClaim(\${index})">
              <div class="claim-status \${statusClass}">\${statusIcon}</div>
              <div class="claim-name">\${claim.name}</div>
              <div class="claim-confidence">\${claim.confidence || 0}%</div>
            </div>
            <div class="claim-details" id="claim-\${index}">
              <div class="claim-evidence">\${claim.evidence || 'No evidence available'}</div>
              \${claim.control ? \`<div class="control-badge">SOC 2 \${claim.control}</div>\` : ''}
            </div>
          </div>
        \`;
      }).join('');
    }

    function updateFiles(files) {
      const container = document.getElementById('files-content');
      
      if (files.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-text">No files data available</div></div>';
        return;
      }

      container.innerHTML = files.map(file => {
        const verdictClass = file.status?.toLowerCase() || 'unknown';
        const verdictColor = {
          'ship': 'var(--ship)',
          'warn': 'var(--warn)',
          'noship': 'var(--noship)'
        }[verdictClass] || 'var(--text2)';

        return \`
          <div class="file-item" onclick="openFile('\${file.path}', \${file.line || 1})">
            <div class="verdict-badge" style="background: \${verdictColor}20; color: \${verdictColor}; border: 1px solid \${verdictColor}40; padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: 600;">
              \${file.status || 'UNKNOWN'}
            </div>
            <div class="file-name">\${file.name}</div>
            <div class="file-score">\${file.score || 0}</div>
          </div>
        \`;
      }).join('');
    }

    function updateLastScan(timestamp) {
      const element = document.getElementById('last-scan');
      if (!timestamp) {
        element.textContent = 'No scans yet';
        return;
      }

      const now = new Date();
      const scanTime = new Date(timestamp);
      const diffMs = now - scanTime;
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) {
        element.textContent = 'Last scan: just now';
      } else if (diffMins < 60) {
        element.textContent = \`Last scan: \${diffMins}m ago\`;
      } else {
        const hours = Math.floor(diffMins / 60);
        element.textContent = \`Last scan: \${hours}h ago\`;
      }
    }

    function toggleClaim(index) {
      const details = document.getElementById(\`claim-\${index}\`);
      details.classList.toggle('expanded');
    }

    function verify() {
      vscode.postMessage({ command: 'verify' });
    }

    function refresh() {
      verify(); // For now, refresh runs verify
    }

    function settings() {
      // TODO: Open settings
    }

    function openFile(filePath, line) {
      vscode.postMessage({ command: 'openFile', file: filePath, line });
    }

    // Utility functions
    function sparkline(data, color, w = 40, h = 16) {
      const max = Math.max(...data), min = Math.min(...data), range = max - min || 1;
      const pts = data.map((v, i) => 
        \`\${(i / (data.length - 1)) * w},\${h - ((v - min) / range) * h}\` 
      ).join(' ');
      const last = data[data.length - 1];
      const lastY = h - ((last - min) / range) * h;
      return \`
        <svg width="\${w}" height="\${h}" class="stat-sparkline">
          <polyline points="\${pts}" fill="none" stroke="\${color}" stroke-width="1.5" 
            stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="\${w}" cy="\${lastY}" r="2" fill="\${color}"/>
        </svg>
      \`;
    }

    function ring(value, size = 64, stroke = 4, color = '#00e68a') {
      const r = (size - stroke) / 2;
      const circ = 2 * Math.PI * r;
      const offset = circ - (value / 100) * circ;
      return \`
        <svg width="\${size}" height="\${size}" style="transform:rotate(-90deg)">
          <circle cx="\${size/2}" cy="\${size/2}" r="\${r}" fill="none" stroke="#222233" stroke-width="\${stroke}"/>
          <circle cx="\${size/2}" cy="\${size/2}" r="\${r}" fill="none" stroke="\${color}" stroke-width="\${stroke}"
            stroke-dasharray="\${circ}" stroke-dashoffset="\${offset}" stroke-linecap="round"
            style="transition:stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)"/>
        </svg>
      \`;
    }
  </script>
</body>
</html>`;
  }
}
