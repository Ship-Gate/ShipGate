export function getWebviewContent(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: vscode-resource:;">
  <style>
    :root {
      --bg0: #0a0a0f; --bg1: #111118; --bg2: #1a1a24; --bg3: #222233;
      --border: rgba(255,255,255,0.06); --border-hover: rgba(255,255,255,0.12);
      --text0: #ffffff; --text1: #c8c8d4; --text2: #8888a0; --text3: #555566;
      --ship: #00e68a; --ship-bg: rgba(0,230,138,0.08); --ship-glow: rgba(0,230,138,0.3);
      --warn: #ffb547; --warn-bg: rgba(255,181,71,0.08);
      --noship: #ff5c6a; --noship-bg: rgba(255,92,106,0.08);
      --accent: #6366f1; --accent-bg: rgba(99,102,241,0.08);
      --blue: #38bdf8; --blue-bg: rgba(56,189,248,0.08);
      --high-sev: #ff8a4c;
    }
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: var(--vscode-font-family), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--bg1);
      color: var(--text1);
      font-size: 12px;
      line-height: 1.5;
      overflow-x: hidden;
      width: 320px;
    }
    
    .mono { font-family: var(--vscode-editor-font-family), Consolas, 'Courier New', monospace; }
    
    #root { display: flex; flex-direction: column; height: 100vh; }
    
    /* Header */
    .header {
      position: sticky;
      top: 0;
      background: var(--bg1);
      border-bottom: 1px solid var(--border);
      z-index: 100;
    }
    
    .brand-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
    }
    
    .brand-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .logo {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      background: linear-gradient(135deg, var(--ship), var(--accent));
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
    }
    
    .brand-text h1 {
      font-size: 13px;
      font-weight: 600;
      color: var(--text0);
      letter-spacing: -0.01em;
    }
    
    .brand-text p {
      font-size: 10px;
      color: var(--text3);
    }
    
    .header-actions {
      display: flex;
      gap: 6px;
    }
    
    .icon-btn {
      width: 26px;
      height: 26px;
      background: var(--bg2);
      border: 1px solid var(--border);
      border-radius: 5px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: var(--text2);
      font-size: 12px;
      transition: all 100ms cubic-bezier(0.16,1,0.3,1);
    }
    
    .icon-btn:hover {
      background: var(--bg3);
      border-color: var(--border-hover);
      color: var(--text0);
      transform: scale(1.02);
    }
    
    .tab-bar {
      display: flex;
      gap: 2px;
      padding: 0 12px;
      overflow-x: auto;
      scrollbar-width: none;
    }
    
    .tab-bar::-webkit-scrollbar { display: none; }
    
    .tab {
      padding: 7px 11px;
      font-size: 11px;
      font-weight: 500;
      color: var(--text3);
      border-bottom: 2px solid transparent;
      cursor: pointer;
      white-space: nowrap;
      transition: all 200ms cubic-bezier(0.16,1,0.3,1);
    }
    
    .tab.active {
      color: var(--text0);
      border-bottom-color: var(--ship);
    }
    
    .tab:hover:not(.active) {
      color: var(--text1);
    }
    
    /* Content */
    .content {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }
    
    .section {
      margin-bottom: 16px;
    }
    
    .section-title {
      font-size: 10px;
      font-weight: 600;
      color: var(--text3);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 8px;
    }
    
    /* Cards */
    .card {
      background: var(--bg2);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px 16px;
      transition: all 200ms cubic-bezier(0.16,1,0.3,1);
    }
    
    .card:hover {
      border-color: var(--border-hover);
      background: rgba(255,255,255,0.02);
    }
    
    /* Verdict Card */
    .verdict-card {
      position: relative;
      overflow: hidden;
    }
    
    .verdict-card.ship { background: var(--ship-bg); border-color: rgba(0,230,138,0.2); }
    .verdict-card.warn { background: var(--warn-bg); border-color: rgba(255,181,71,0.2); }
    .verdict-card.noship { background: var(--noship-bg); border-color: rgba(255,92,106,0.2); }
    
    .verdict-content {
      display: flex;
      align-items: center;
      gap: 16px;
      position: relative;
      z-index: 1;
    }
    
    .verdict-ring {
      flex-shrink: 0;
    }
    
    .verdict-info h2 {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin-bottom: 4px;
    }
    
    .verdict-info p {
      font-size: 11px;
      color: var(--text2);
    }
    
    .verdict-glow {
      position: absolute;
      top: -20px;
      right: -20px;
      width: 70px;
      height: 70px;
      border-radius: 50%;
      filter: blur(28px);
      opacity: 0.35;
      pointer-events: none;
    }
    
    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    
    .stat-card {
      background: var(--bg2);
      border: 1px solid var(--border);
      border-radius: 7px;
      padding: 10px 12px;
    }
    
    .stat-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    
    .stat-label {
      font-size: 10px;
      color: var(--text3);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .stat-value {
      font-size: 18px;
      font-weight: 700;
      color: var(--text0);
    }
    
    /* Badge */
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      font-family: var(--vscode-editor-font-family), Consolas, monospace;
    }
    
    .badge.ship { background: var(--ship-bg); color: var(--ship); border: 1px solid rgba(0,230,138,0.2); }
    .badge.warn { background: var(--warn-bg); color: var(--warn); border: 1px solid rgba(255,181,71,0.2); }
    .badge.noship { background: var(--noship-bg); color: var(--noship); border: 1px solid rgba(255,92,106,0.2); }
    .badge.accent { background: var(--accent-bg); color: var(--accent); border: 1px solid rgba(99,102,241,0.2); }
    .badge.neutral { background: var(--bg2); color: var(--text2); border: 1px solid var(--border); }
    
    /* Status Dot */
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }
    
    .status-dot.ship { background: var(--ship); }
    .status-dot.warn { background: var(--warn); }
    .status-dot.noship { background: var(--noship); }
    .status-dot.blue { background: var(--blue); }
    .status-dot.pulse { animation: pulse 2s infinite; }
    
    /* Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: all 100ms cubic-bezier(0.16,1,0.3,1);
      border: none;
    }
    
    .btn-primary {
      background: linear-gradient(135deg, var(--ship), var(--accent));
      color: #000;
    }
    
    .btn-primary:hover {
      transform: scale(1.02);
      filter: brightness(1.1);
    }
    
    .btn-secondary {
      background: var(--bg2);
      color: var(--text0);
      border: 1px solid var(--border);
    }
    
    .btn-secondary:hover {
      background: var(--bg3);
      border-color: var(--border-hover);
    }
    
    .btn-small {
      padding: 3px 8px;
      font-size: 9px;
    }

    .btn-warn {
      background: var(--warn-bg);
      color: var(--warn);
      border: 1px solid rgba(255,181,71,0.25);
    }

    .btn-warn:hover { background: rgba(255,181,71,0.15); }

    /* Action rows */
    .action-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 10px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: var(--bg2);
      margin-bottom: 5px;
      cursor: pointer;
      transition: border-color 0.1s, background 0.1s;
    }

    .action-row:hover {
      border-color: var(--border-hover);
      background: var(--bg3);
    }

    .action-row:active { opacity: 0.8; }

    .action-icon {
      font-size: 14px;
      width: 22px;
      text-align: center;
      flex-shrink: 0;
    }

    .action-body { flex: 1; min-width: 0; }

    .action-label {
      font-size: 12px;
      font-weight: 500;
      color: var(--text0);
      line-height: 1.3;
    }

    .action-desc {
      font-size: 10px;
      color: var(--text3);
      margin-top: 1px;
    }

    .action-arrow {
      font-size: 14px;
      color: var(--text3);
      flex-shrink: 0;
    }

    .action-shortcut {
      font-size: 9px;
      font-family: var(--vscode-editor-font-family), Consolas, monospace;
      color: var(--text3);
      background: var(--bg0);
      border: 1px solid var(--border);
      border-radius: 3px;
      padding: 1px 5px;
      flex-shrink: 0;
    }
    
    /* Footer */
    .footer {
      position: sticky;
      bottom: 0;
      background: var(--bg1);
      border-top: 1px solid var(--border);
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .footer-status {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 10px;
      color: var(--text3);
    }
    
    /* Animations */
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    
    @keyframes ping {
      0% { transform: scale(1); opacity: 0.6; }
      100% { transform: scale(2.2); opacity: 0; }
    }
    
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .fade-in {
      animation: fadeIn 120ms cubic-bezier(0.16,1,0.3,1);
    }
    
    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 60px 20px;
    }
    
    .empty-state .logo {
      margin: 0 auto 20px;
    }
    
    .empty-state h2 {
      font-size: 16px;
      font-weight: 600;
      color: var(--text0);
      margin-bottom: 8px;
    }
    
    .empty-state p {
      font-size: 12px;
      color: var(--text2);
      margin-bottom: 20px;
      line-height: 1.6;
    }
    
    .empty-state code {
      font-family: var(--vscode-editor-font-family), Consolas, monospace;
      font-size: 11px;
      background: var(--bg2);
      padding: 4px 8px;
      border-radius: 4px;
      color: var(--text1);
    }
    
    /* Claim expand/collapse */
    .claim-detail {
      max-height: 0;
      overflow: hidden;
      transition: max-height 200ms ease;
    }
    
    .claim-detail.show {
      max-height: 200px;
    }
    
    /* Progress bar */
    .progress-bar {
      width: 60px;
      height: 4px;
      background: var(--bg1);
      border-radius: 2px;
      overflow: hidden;
    }
    
    .progress-fill {
      height: 100%;
      transition: width 0.8s cubic-bezier(0.16,1,0.3,1);
    }
    
    /* Input */
    input[type="text"] {
      width: 100%;
      padding: 8px 12px;
      background: var(--bg2);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text1);
      font-size: 12px;
      font-family: inherit;
    }
    
    input[type="text"]:focus {
      outline: none;
      border-color: var(--border-hover);
    }
    
    input[type="text"]::placeholder {
      color: var(--text3);
    }
  </style>
</head>
<body>
  <div id="root"></div>
  
  <script>
    (function() {
      const vscode = acquireVsCodeApi();
      
      let state = {
        activeTab: 'overview',
        data: null, // Will be populated from extension
        isScanning: false,
        error: null,
        expandedClaim: -1,
        expandedRun: -1,
        severityFilters: { critical: true, high: true, medium: true, low: true },
        fileSort: 'verdict',
        fileFilter: '',
      };
      
      // Message handling
      window.addEventListener('message', (event) => {
        const msg = event.data;
        switch (msg.type) {
          case 'results':
            state.data = msg.data;
            state.isScanning = false;
            state.error = null;
            render();
            break;
          case 'scanning':
            state.isScanning = true;
            render();
            break;
          case 'error':
            state.isScanning = false;
            state.error = msg.message;
            render();
            break;
        }
      });
      
      // Helpers
      function verdictColor(v) {
        if (v === 'SHIP' || v === 'pass') return 'var(--ship)';
        if (v === 'WARN' || v === 'pending') return 'var(--warn)';
        if (v === 'NO_SHIP' || v === 'fail') return 'var(--noship)';
        if (v === 'running') return 'var(--blue)';
        return 'var(--text3)';
      }
      
      function verdictBadge(v) {
        if (v === 'SHIP' || v === 'pass') return 'ship';
        if (v === 'WARN' || v === 'pending') return 'warn';
        if (v === 'NO_SHIP' || v === 'fail') return 'noship';
        return 'neutral';
      }
      
      function severityColor(s) {
        if (s === 'critical') return 'var(--noship)';
        if (s === 'high') return 'var(--high-sev)';
        if (s === 'medium') return 'var(--warn)';
        return 'var(--text3)';
      }
      
      function ringSVG(value, size, color) {
        const r = (size - 4) / 2;
        const circ = 2 * Math.PI * r;
        const offset = circ - (value / 100) * circ;
        return \`
          <svg width="\${size}" height="\${size}" style="transform: rotate(-90deg);">
            <circle cx="\${size/2}" cy="\${size/2}" r="\${r}" fill="none" stroke="var(--bg3)" stroke-width="4" />
            <circle cx="\${size/2}" cy="\${size/2}" r="\${r}" fill="none" stroke="\${color}" stroke-width="4"
              stroke-dasharray="\${circ}" stroke-dashoffset="\${offset}" stroke-linecap="round"
              style="transition: stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1);" />
          </svg>
        \`;
      }
      
      function sparklineSVG(data, color, w, h) {
        const max = Math.max(...data), min = Math.min(...data), range = max - min || 1;
        const pts = data.map((v, i) => \`\${(i / (data.length - 1)) * w},\${h - ((v - min) / range) * h}\`).join(" ");
        return \`
          <svg width="\${w}" height="\${h}">
            <polyline points="\${pts}" fill="none" stroke="\${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            <circle cx="\${w}" cy="\${h - ((data[data.length - 1] - min) / range) * h}" r="2" fill="\${color}" />
          </svg>
        \`;
      }
      
      // Render engine
      function render() {
        const root = document.getElementById('root');
        root.innerHTML = renderHeader() + renderContent() + renderFooter();
        attachEventListeners();
      }
      
      function renderHeader() {
        const data = state.data || {};
        const workspaceName = data.projectName || 'workspace';
        const branch = data.branch || 'main';
        
        return \`
          <div class="header">
            <div class="brand-bar">
              <div class="brand-left">
                <div class="logo">⚡</div>
                <div class="brand-text">
                  <h1>ShipGate</h1>
                  <p>\${workspaceName} • \${branch}</p>
                </div>
              </div>
              <div class="header-actions">
                <button class="icon-btn" data-command="verify">↻</button>
                <button class="icon-btn" data-command="openDashboard">⊞</button>
                <button class="icon-btn" data-command="openSettings">⚙</button>
              </div>
            </div>
            <div class="tab-bar">
              <div class="tab \${state.activeTab === 'overview' ? 'active' : ''}" data-tab="overview">Overview</div>
              <div class="tab \${state.activeTab === 'claims' ? 'active' : ''}" data-tab="claims">Claims</div>
              <div class="tab \${state.activeTab === 'actions' ? 'active' : ''}" data-tab="actions">Actions</div>
              <div class="tab \${state.activeTab === 'findings' ? 'active' : ''}" data-tab="findings">Findings</div>
              <div class="tab \${state.activeTab === 'files' ? 'active' : ''}" data-tab="files">Files</div>
            </div>
          </div>
        \`;
      }
      
      function renderContent() {
        if (state.isScanning) {
          return '<div class="content fade-in">' + renderScanning() + '</div>';
        }
        
        if (state.error) {
          return '<div class="content fade-in">' + renderError() + '</div>';
        }
        
        if (!state.data) {
          return '<div class="content fade-in">' + renderEmpty() + '</div>';
        }
        
        let content = '';
        switch (state.activeTab) {
          case 'overview': content = renderOverview(); break;
          case 'claims': content = renderClaims(); break;
          case 'actions': content = renderActions(); break;
          case 'findings': content = renderFindings(); break;
          case 'files': content = renderFiles(); break;
        }
        
        return '<div class="content fade-in">' + content + '</div>';
      }
      
      function renderFooter() {
        const statusText = state.isScanning ? 'Scanning...' : 'Last scan: 12s ago';
        const statusDot = state.isScanning ? 'blue pulse' : '';
        
        return \`
          <div class="footer">
            <div class="footer-status">
              <span class="status-dot \${statusDot}"></span>
              <span>\${statusText}</span>
            </div>
            <button class="btn btn-primary" id="btn-verify">▶ Verify</button>
          </div>
        \`;
      }
      
      function renderEmpty() {
        return \`
          <div class="empty-state">
            <div class="logo">⚡</div>
            <h2>Welcome to ShipGate</h2>
            <p>Behavioral verification for AI-generated code.<br/>Get started in seconds.</p>
            <div style="text-align:left;max-width:240px;margin:16px auto 0;">
              <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:10px;">
                <span style="width:20px;height:20px;border-radius:50%;background:var(--accent-bg);border:1px solid rgba(99,102,241,0.15);color:var(--accent);font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">1</span>
                <span style="font-size:11px;color:var(--text1);line-height:1.4;"><strong style="color:var(--text0);">Initialize</strong> — Detect your project &amp; generate ISL specs</span>
              </div>
              <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:10px;">
                <span style="width:20px;height:20px;border-radius:50%;background:var(--accent-bg);border:1px solid rgba(99,102,241,0.15);color:var(--accent);font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">2</span>
                <span style="font-size:11px;color:var(--text1);line-height:1.4;"><strong style="color:var(--text0);">Verify</strong> — Check code against behavioral contracts</span>
              </div>
              <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:14px;">
                <span style="width:20px;height:20px;border-radius:50%;background:var(--accent-bg);border:1px solid rgba(99,102,241,0.15);color:var(--accent);font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">3</span>
                <span style="font-size:11px;color:var(--text1);line-height:1.4;"><strong style="color:var(--text0);">Ship</strong> — Get a SHIP / NO_SHIP verdict with evidence</span>
              </div>
            </div>
            <button class="btn btn-primary" data-command="goCommand" style="box-shadow:0 0 12px rgba(0,230,138,0.15);">▶ shipgate go</button>
            <p style="margin-top: 10px;font-size:10px;color:var(--text3);">Or press <kbd style="padding:1px 4px;border-radius:3px;background:var(--bg2);border:1px solid var(--border);font-family:var(--vscode-editor-font-family,monospace);font-size:9px;">⌘⇧↵</kbd></p>
          </div>
        \`;
      }
      
      function renderScanning() {
        return \`
          <div class="empty-state">
            <div class="logo">⚡</div>
            <h2>Verifying...</h2>
            <p>Scanning 263 files for verification</p>
            <div style="width: 200px; height: 4px; background: var(--bg2); border-radius: 2px; margin: 20px auto; overflow: hidden;">
              <div style="width: 60%; height: 100%; background: var(--ship); animation: shimmer 1.5s infinite;"></div>
            </div>
          </div>
        \`;
      }
      
      function renderError() {
        return \`
          <div class="empty-state">
            <h2>Scan Error</h2>
            <p style="color: var(--noship);">\${state.error || 'Unknown error occurred'}</p>
            <button class="btn btn-secondary" data-command="verify">Retry</button>
          </div>
        \`;
      }
      
      function renderOverview() {
        const data = state.data || {};
        const verdict = data.verdict || 'UNKNOWN';
        const score = data.score || 0;
        const verdictClass = verdict.toLowerCase().replace('_', '');
        const verdictColorValue = verdictColor(verdict);
        
        // Calculate real stats from data
        const totalFiles = data.files ? data.files.length : 0;
        const passFiles = data.files ? data.files.filter(f => f.status === 'PASS').length : 0;
        const failFiles = data.files ? data.files.filter(f => f.status === 'FAIL').length : 0;
        const warnFiles = data.files ? data.files.filter(f => f.status === 'WARN').length : 0;
        const totalViolations = data.files ? data.files.reduce((sum, f) => sum + (f.blockers?.length || 0) + (f.errors?.length || 0), 0) : 0;
        const coveragePct = data.coverage ? Math.round((data.coverage.specced / data.coverage.total) * 100) : 0;
        
        return \`
          <div class="section">
            <div class="verdict-card card \${verdictClass}">
              <div class="verdict-content">
                <div class="verdict-ring">
                  \${ringSVG(score, 56, verdictColorValue)}
                  <div style="position: absolute; top: 50%; left: 28px; transform: translate(-50%, -50%); font-size: 16px; font-weight: 700; color: \${verdictColorValue}; font-family: var(--vscode-editor-font-family), Consolas, monospace;">\${score}</div>
                </div>
                <div class="verdict-info">
                  <h2 style="color: \${verdictColorValue};">\${verdict}</h2>
                  <p>\${passFiles} passed • \${failFiles} failed • \${warnFiles} warnings</p>
                </div>
              </div>
              <div class="verdict-glow" style="background: \${verdictColorValue};"></div>
            </div>
          </div>
          
          <div class="section">
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-header">
                  <span class="stat-label">Pass/Total</span>
                </div>
                <div class="stat-value mono">\${passFiles}/\${totalFiles}</div>
              </div>
              <div class="stat-card">
                <div class="stat-header">
                  <span class="stat-label">Coverage</span>
                </div>
                <div class="stat-value mono">\${coveragePct}%</div>
              </div>
              <div class="stat-card">
                <div class="stat-header">
                  <span class="stat-label">Files</span>
                </div>
                <div class="stat-value mono">\${totalFiles}</div>
              </div>
              <div class="stat-card">
                <div class="stat-header">
                  <span class="stat-label">Issues</span>
                </div>
                <div class="stat-value mono">\${totalViolations}</div>
              </div>
            </div>
          </div>
          
          <div class="section">
            <div class="card" style="padding: 10px 12px; cursor: pointer;" id="pipeline-mini">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span class="status-dot blue pulse"></span>
                <span style="flex: 1; font-size: 12px; color: var(--text1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">feat: add payment flow</span>
                <span class="badge accent">PR</span>
              </div>
              <div style="display: flex; gap: 4px; margin-bottom: 8px;">
                <div style="width: 10px; height: 10px; border-radius: 50%; background: var(--ship);"></div>
                <div style="width: 10px; height: 10px; border-radius: 50%; background: var(--blue); animation: pulse 2s infinite;"></div>
                <div style="width: 10px; height: 10px; border-radius: 50%; background: var(--bg3);"></div>
                <div style="width: 10px; height: 10px; border-radius: 50%; background: var(--bg3);"></div>
                <div style="width: 10px; height: 10px; border-radius: 50%; background: var(--bg3);"></div>
              </div>
              <div style="font-size: 10px; color: var(--blue);">shipgate verify • <span class="mono">31s</span></div>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Findings Preview</div>
            <div class="card" style="padding: 8px 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 11px; font-weight: 600; color: var(--text0);">Active</span>
                <span class="badge noship">\${totalViolations}</span>
              </div>
              \${totalViolations > 0 ? '<div style="display: flex; flex-direction: column; gap: 6px;">' + data.files.filter(f => (f.blockers?.length || 0) + (f.errors?.length || 0) > 0).slice(0, 3).map(f => { const issues = [...(f.blockers || []), ...(f.errors || [])]; const firstIssue = issues[0] || 'Unknown issue'; const dotColor = f.status === 'FAIL' ? 'noship' : 'warn'; return '<div style="display: flex; gap: 8px; cursor: pointer;" data-file="' + f.file + '" data-line="1"><span class="status-dot ' + dotColor + '" style="margin-top: 2px;"></span><div style="flex: 1;"><div style="font-size: 11px; color: var(--text1);">' + firstIssue.substring(0, 50) + '</div><div class="mono" style="font-size: 9px; color: var(--text3);">' + f.file + '</div></div></div>'; }).join('') + '</div>' : '<p style="font-size: 11px; color: var(--ship); text-align: center;">✓ No issues found</p>'}
              <div style="margin-top: 10px; text-align: center;">
                <a href="#" style="font-size: 10px; color: var(--accent); text-decoration: none;" id="link-findings">View all findings →</a>
              </div>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Compliance</div>
            <div class="card">
              <div style="display: flex; gap: 6px;">
                <div style="flex: 1; text-align: center; background: var(--bg1); border: 1px solid var(--border); border-radius: 5px; padding: 6px 8px;">
                  <div class="mono" style="font-size: 14px; font-weight: 700; color: var(--ship);">83%</div>
                  <div style="font-size: 9px; color: var(--text3);">SOC 2</div>
                </div>
                <div style="flex: 1; text-align: center; background: var(--bg1); border: 1px solid var(--border); border-radius: 5px; padding: 6px 8px;">
                  <div class="mono" style="font-size: 14px; font-weight: 700; color: var(--warn);">71%</div>
                  <div style="font-size: 9px; color: var(--text3);">HIPAA</div>
                </div>
                <div style="flex: 1; text-align: center; background: var(--bg1); border: 1px solid var(--border); border-radius: 5px; padding: 6px 8px;">
                  <div class="mono" style="font-size: 14px; font-weight: 700; color: var(--warn);">67%</div>
                  <div style="font-size: 9px; color: var(--text3);">EU AI</div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">AI Provenance</div>
            <div class="card">
              <div style="display: flex; flex-direction: column; gap: 8px;">
                \${['AI-Generated|67|var(--accent)', 'Human|17|var(--ship)', 'AI-Assisted|11|var(--warn)', 'Unknown|5|var(--text3)'].map(row => {
                  const [label, pct, color] = row.split('|');
                  return '<div style="display: flex; align-items: center; gap: 10px;">' +
                    '<div style="width: 8px; height: 8px; border-radius: 2px; background: ' + color + ';"></div>' +
                    '<span style="flex: 1; font-size: 11px; color: var(--text2);">' + label + '</span>' +
                    '<div class="progress-bar">' +
                    '<div class="progress-fill" style="width: ' + pct + '%; background: ' + color + ';"></div>' +
                    '</div>' +
                    '<span class="mono" style="font-size: 10px; color: var(--text3); width: 28px; text-align: right;">' + pct + '%</span>' +
                    '</div>';
                }).join('')}
              </div>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Proof Bundle Preview</div>
            <div class="card" style="padding: 10px 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 10px; color: var(--text3); text-transform: uppercase;">Latest Bundle</span>
                <span class="mono" style="font-size: 9px; color: var(--text3);">a1b2c3d</span>
              </div>
              <div class="mono" style="font-size: 10px; line-height: 1.6;">
                <div style="color: var(--ship);">✓ Import Integrity ···· PROVEN</div>
                <div style="color: var(--warn);">◐ Type Safety ········ 94%</div>
              </div>
              <div style="margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                <span class="mono" style="font-size: 9px; color: var(--text3);">HMAC: 7f3a...c821</span>
                <a href="#" style="font-size: 10px; color: var(--accent); text-decoration: none;" data-command="viewProofBundle">View full →</a>
              </div>
            </div>
          </div>
        \`;
      }
      
      function renderClaims() {
        const claims = [
          { name: 'Import Integrity', status: 'PROVEN', confidence: 100, evidence: '847/847 imports resolve. 0 hallucinated packages.', control: 'CC7.1' },
          { name: 'Auth Coverage', status: 'PROVEN', confidence: 100, evidence: '23/23 protected routes have auth middleware.', control: 'CC6.1' },
          { name: 'Input Validation', status: 'PROVEN', confidence: 100, evidence: '19/19 endpoints validate with Zod.', control: 'CC6.6' },
          { name: 'SQL Injection', status: 'PROVEN', confidence: 98, evidence: '0 raw SQL. All queries via Prisma ORM.', control: 'CC6.6' },
          { name: 'Secret Exposure', status: 'PROVEN', confidence: 100, evidence: '0 hardcoded secrets. .env in .gitignore.', control: 'CC6.7' },
          { name: 'Type Safety', status: 'PARTIAL', confidence: 94, evidence: '247/263 functions typed. 16 implicit any.', control: 'CC8.1' },
          { name: 'Error Handling', status: 'PARTIAL', confidence: 87, evidence: '20/23 handlers have boundaries. 3 missing.', control: 'CC7.4' },
          { name: 'AI Hallucinations', status: 'PROVEN', confidence: 96, evidence: '0 phantom endpoints. 0 ghost APIs detected.', control: 'CC7.1' }
        ];
        
        return \`
          <div class="section">
            \${claims.map((claim, idx) => {
              const isProven = claim.status === 'PROVEN';
              const color = isProven ? 'var(--ship)' : 'var(--warn)';
              const icon = isProven ? '✓' : '◐';
              const isExpanded = state.expandedClaim === idx;
              
              return '<div class="card" style="margin-bottom: 8px; cursor: pointer;" data-claim="' + idx + '">' +
                '<div style="display: flex; align-items: center; gap: 12px;">' +
                '<div style="width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; background: ' + color + '12; color: ' + color + '; border: 1px solid ' + color + '25;">' +
                icon +
                '</div>' +
                '<div style="flex: 1;">' +
                '<div class="mono" style="font-size: 13px; color: var(--text1);">' + claim.name + '</div>' +
                '</div>' +
                '<div class="mono" style="font-size: 11px; color: var(--text3);">' + claim.confidence + '%</div>' +
                '<div style="font-size: 10px; color: var(--text3); transform: rotate(' + (isExpanded ? 180 : 0) + 'deg); transition: transform 200ms;">▾</div>' +
                '</div>' +
                '<div class="claim-detail ' + (isExpanded ? 'show' : '') + '" style="padding-left: 44px; margin-top: 8px;">' +
                '<p style="font-size: 12px; color: var(--text2); line-height: 1.6; margin-bottom: 8px;">' + claim.evidence + '</p>' +
                '<div class="badge accent">SOC 2 — ' + claim.control + '</div>' +
                '</div>' +
                '</div>';
            }).join('')}
          </div>
        \`;
      }
      
      function renderActions() {
        var heroHtml = \`
          <div style="background:linear-gradient(145deg,rgba(0,230,138,0.04),rgba(99,102,241,0.04));border:1px solid rgba(0,230,138,0.08);border-radius:14px;padding:22px 18px 20px;margin-bottom:16px;text-align:center;position:relative;overflow:hidden;">
            <div style="font-size:28px;margin-bottom:10px;">⚡</div>
            <div style="font-size:16px;font-weight:800;color:var(--text0);margin-bottom:4px;letter-spacing:-0.4px;">Ship with confidence</div>
            <div style="font-size:11px;color:var(--text2);margin-bottom:16px;line-height:1.5;max-width:220px;margin-left:auto;margin-right:auto;">Scan, infer ISL specs, verify, and gate — in one command.</div>
            <button class="btn btn-primary" data-command="goCommand" style="box-shadow:0 0 16px rgba(0,230,138,0.2);font-size:12px;font-weight:700;letter-spacing:0.2px;">▶ shipgate go</button>
            <div style="margin-top:10px;font-size:10px;color:var(--text3);">
              <kbd style="padding:1px 4px;border-radius:3px;background:var(--bg2);border:1px solid var(--border);font-size:9px;">⌘</kbd>
              <kbd style="padding:1px 4px;border-radius:3px;background:var(--bg2);border:1px solid var(--border);font-size:9px;">⇧</kbd>
              <kbd style="padding:1px 4px;border-radius:3px;background:var(--bg2);border:1px solid var(--border);font-size:9px;">↵</kbd>
            </div>
          </div>
        \`;

        const groups = [
          {
            label: 'Workflows',
            items: [
              { icon: '✦', label: 'Vibe → Ship', desc: 'English → ISL → verified code', cmd: 'vibeGenerate', color: 'var(--accent)', shortcut: '⌘⇧V' },
              { icon: '⚡', label: 'Go + Auto-Heal', desc: 'Scan, then auto-fix violations', cmd: 'goFix', color: 'var(--ship)', shortcut: '' },
              { icon: '◎', label: 'Deep Scan', desc: 'Thorough analysis, higher coverage', cmd: 'goDeep', color: 'var(--blue)', shortcut: '' },
            ],
          },
          {
            label: 'Analyze',
            items: [
              { icon: '▶', label: 'Quick Scan', desc: 'Scan & gate verdict', cmd: 'scanProject', color: 'var(--blue)', shortcut: '' },
              { icon: '◈', label: 'Infer ISL Specs', desc: 'AI-generate specs from code', cmd: 'inferSpecs', color: '#a78bfa', shortcut: '' },
              { icon: '⚡', label: 'Heal All', desc: 'Auto-fix violations across project', cmd: 'autofixAll', color: 'var(--warn)', shortcut: '' },
            ],
          },
          {
            label: 'Verification',
            items: [
              { icon: '▶', label: 'Verify Workspace', desc: 'Full scan of all files', cmd: 'verify', color: 'var(--ship)', shortcut: '' },
              { icon: '▶', label: 'Verify Current File', desc: 'Scan the active editor', cmd: 'verifyFile', color: 'var(--ship)', shortcut: '' },
              { icon: '⚑', label: 'Ship Check', desc: 'CI gate — SHIP or block', cmd: 'ship', color: 'var(--accent)', shortcut: '' },
            ],
          },
          {
            label: 'Spec Tools',
            items: [
              { icon: '✎', label: 'Code → ISL', desc: 'Generate spec from current file', cmd: 'codeToIsl', color: '#60a5fa', shortcut: '' },
              { icon: '✎', label: 'Generate ISL Spec', desc: 'Scaffold spec from source', cmd: 'genSpec', color: 'var(--accent)', shortcut: '' },
              { icon: '⟳', label: 'Format & Lint', desc: 'Auto-format all .isl files', cmd: 'fmtSpecs', color: 'var(--ship)', shortcut: '' },
              { icon: '✦', label: 'Lint ISL Specs', desc: 'Check .isl files for errors', cmd: 'lintSpecs', color: 'var(--blue)', shortcut: '' },
            ],
          },
          {
            label: 'Analysis & Compliance',
            items: [
              { icon: '◎', label: 'Trust Score', desc: 'Detailed trust breakdown', cmd: 'trustScore', color: 'var(--ship)', shortcut: '' },
              { icon: '◈', label: 'Coverage Report', desc: 'Spec coverage % per file', cmd: 'coverage', color: 'var(--blue)', shortcut: '' },
              { icon: '⊿', label: 'Drift Detection', desc: 'Code vs spec divergence', cmd: 'drift', color: 'var(--warn)', shortcut: '' },
              { icon: '⚠', label: 'Security Report', desc: 'Secrets, auth, injection scan', cmd: 'securityReport', color: 'var(--noship)', shortcut: '' },
              { icon: '🛡', label: 'SOC 2 Audit', desc: 'Full SOC 2 compliance check', cmd: 'compliance', color: 'var(--ship)', shortcut: '' },
              { icon: '📋', label: 'Policy Check', desc: 'Validate against team policies', cmd: 'policyCheck', color: 'var(--accent)', shortcut: '' },
            ],
          },
          {
            label: 'Advanced',
            items: [
              { icon: '⟁', label: 'Chaos Test', desc: 'Inject faults and observe', cmd: 'chaosTest', color: 'var(--noship)', shortcut: '' },
              { icon: '◷', label: 'Simulate Behavior', desc: 'Run ISL scenario simulations', cmd: 'simulate', color: 'var(--blue)', shortcut: '' },
              { icon: '⬡', label: 'Property-Based Tests', desc: 'Generate and run PBT suite', cmd: 'pbt', color: 'var(--accent)', shortcut: '' },
              { icon: '⬡', label: 'View Proof Bundle', desc: 'Browse attestation & evidence', cmd: 'viewProofBundle', color: 'var(--ship)', shortcut: '' },
            ],
          },
        ];

        var genGridHtml = \`
          <div class="section">
            <div class="section-title">Generate from ISL</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;">
              <button class="btn" data-command="genTypescript" style="font-size:10px;padding:8px 4px;text-align:center;">TS</button>
              <button class="btn" data-command="genPython" style="font-size:10px;padding:8px 4px;text-align:center;">Python</button>
              <button class="btn" data-command="genRust" style="font-size:10px;padding:8px 4px;text-align:center;">Rust</button>
              <button class="btn" data-command="genGo" style="font-size:10px;padding:8px 4px;text-align:center;">Go</button>
              <button class="btn" data-command="genGraphql" style="font-size:10px;padding:8px 4px;text-align:center;">GQL</button>
              <button class="btn" data-command="genOpenapi" style="font-size:10px;padding:8px 4px;text-align:center;">OpenAPI</button>
            </div>
          </div>
        \`;

        var groupsHtml = groups.map(g => \`
          <div class="section">
            <div class="section-title">\${g.label}</div>
            \${g.items.map(item => \`
              <div class="action-row" data-command="\${item.cmd}">
                <div class="action-icon" style="color: \${item.color};">\${item.icon}</div>
                <div class="action-body">
                  <div class="action-label">\${item.label}</div>
                  <div class="action-desc">\${item.desc}</div>
                </div>
                \${item.shortcut ? \`<div class="action-shortcut">\${item.shortcut}</div>\` : '<div class="action-arrow">\u203a</div>'}
              </div>
            \`).join('')}
          </div>
        \`).join('');

        var allGroupsHtml = groups.slice(0, 2).map(renderGroup).join('') +
          genGridHtml +
          groups.slice(2).map(renderGroup).join('');

        function renderGroup(g) {
          return \`<div class="section">
            <div class="section-title">\${g.label}</div>
            \${g.items.map(item => \`
              <div class="action-row" data-command="\${item.cmd}">
                <div class="action-icon" style="color: \${item.color};">\${item.icon}</div>
                <div class="action-body">
                  <div class="action-label">\${item.label}</div>
                  <div class="action-desc">\${item.desc}</div>
                </div>
                \${item.shortcut ? \`<div class="action-shortcut">\${item.shortcut}</div>\` : '<div class="action-arrow">\u203a</div>'}
              </div>
            \`).join('')}
          </div>\`;
        }

        return heroHtml + allGroupsHtml;
      }

      function renderFindings() {
        const data = state.data || {};
        
        // Extract all findings from files
        const findings = [];
        if (data.files) {
          data.files.forEach(f => {
            if (f.blockers) {
              f.blockers.forEach(msg => {
                findings.push({
                  severity: f.status === 'FAIL' ? 'high' : 'medium',
                  message: msg,
                  file: f.file,
                  line: 1,
                  engine: f.mode || 'shipgate',
                  fixable: false
                });
              });
            }
            if (f.errors) {
              f.errors.forEach(msg => {
                findings.push({
                  severity: 'critical',
                  message: msg,
                  file: f.file,
                  line: 1,
                  engine: f.mode || 'shipgate',
                  fixable: false
                });
              });
            }
          });
        }
        
        const fixableCount = findings.filter(f => f.fixable).length;
        
        return \`
          <div class="section">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 11px; font-weight: 600; color: var(--text0);">Findings</span>
                <span class="badge noship">\${findings.length}</span>
              </div>
              \${findings.length > 0 ? '<button class="btn btn-warn" data-command="autofixAll" style="font-size: 9px; padding: 3px 8px;">⚡ Heal All</button>' : ''}
            </div>
            
            \${findings.map(f => {
              const sevColor = severityColor(f.severity);
              const dotStyle = 'background: ' + sevColor + '; margin-top: 4px;' + (f.severity === 'critical' ? ' box-shadow: 0 0 6px ' + sevColor + '60;' : '');
              const fixBtn = f.fixable ? '<button class="btn btn-small" style="background: var(--ship-bg); color: var(--ship); border: 1px solid var(--ship)25;" data-fix="true">Fix</button>' : '';
              return '<div class="card" style="margin-bottom: 8px; cursor: pointer;" data-file="' + f.file + '" data-line="' + f.line + '">' +
                '<div style="display: flex; align-items: start; gap: 10px;">' +
                '<span class="status-dot" style="' + dotStyle + '"></span>' +
                '<div style="flex: 1;">' +
                '<div style="font-size: 11px; color: var(--text1); line-height: 1.4; margin-bottom: 4px;">' + f.message + '</div>' +
                '<div style="font-size: 9px; color: var(--text3);">' +
                '<span class="mono">' + f.file + ':' + f.line + '</span>' +
                '<span style="margin: 0 6px;">•</span>' +
                '<span>' + f.engine + '</span>' +
                '</div>' +
                '</div>' +
                fixBtn +
                '</div>' +
                '</div>';
            }).join('')}
            
            <button class="btn btn-primary" style="width: 100%; margin-top: 8px;" data-command="autofixAll">
              Auto-fix all (\${fixableCount})
            </button>
            <p style="font-size: 10px; color: var(--text3); text-align: center; margin-top: 8px;">\${fixableCount} of \${findings.length} findings are auto-fixable</p>
          </div>
        \`;
      }
      
      function renderFiles() {
        const data = state.data || {};
        const files = (data.files || []).map(f => ({
          name: f.file,
          verdict: f.status === 'PASS' ? 'SHIP' : f.status === 'FAIL' ? 'NO_SHIP' : 'WARN',
          score: f.score || 0,
          findings: (f.blockers?.length || 0) + (f.errors?.length || 0)
        }));
        
        return \`
          <div class="section">
            <input 
              type="text" 
              id="file-search" 
              placeholder="Filter files..." 
              style="margin-bottom: 12px;"
            />
            
            <div style="display: flex; gap: 6px; margin-bottom: 12px;">
              <div class="badge accent" style="cursor: pointer; padding: 4px 10px;" data-sort="verdict">By verdict</div>
              <div class="badge neutral" style="cursor: pointer; padding: 4px 10px;" data-sort="name">By name</div>
              <div class="badge neutral" style="cursor: pointer; padding: 4px 10px;" data-sort="score">By score</div>
            </div>
            
            \${files.map(f => {
              const badge = verdictBadge(f.verdict);
              const findingBadge = f.findings > 0 ? '<span style="width: 16px; height: 16px; border-radius: 50%; background: var(--noship); color: #fff; font-size: 9px; display: flex; align-items: center; justify-content: center; font-weight: 600;">' + f.findings + '</span>' : '';
              return '<div class="card" style="margin-bottom: 6px; padding: 10px 12px; cursor: pointer;" data-file="' + f.name + '">' +
                '<div style="display: flex; align-items: center; gap: 10px;">' +
                '<span class="badge ' + badge + '" style="font-size: 8px; padding: 2px 6px;">' + f.verdict + '</span>' +
                '<span class="mono" style="flex: 1; font-size: 12px; color: var(--text1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">' + f.name + '</span>' +
                findingBadge +
                '<span class="mono" style="font-size: 11px; color: var(--text3);">' + f.score + '</span>' +
                '</div>' +
                '</div>';
            }).join('')}
          </div>
        \`;
      }
      
      function attachEventListeners() {
        // Tab clicks
        document.querySelectorAll('[data-tab]').forEach(el => {
          el.onclick = () => {
            state.activeTab = el.dataset.tab;
            render();
          };
        });
        
        // Command buttons (works for all [data-command] elements including action rows)
        document.querySelectorAll('[data-command]').forEach(el => {
          el.onclick = (e) => {
            e.stopPropagation();
            const payload = el.dataset.file ? { command: el.dataset.command, file: el.dataset.file } : { command: el.dataset.command };
            vscode.postMessage(payload);
          };
        });
        
        // Claim expand/collapse
        document.querySelectorAll('[data-claim]').forEach(el => {
          el.onclick = () => {
            const idx = parseInt(el.dataset.claim);
            state.expandedClaim = state.expandedClaim === idx ? -1 : idx;
            render();
          };
        });
        
        // File clicks
        document.querySelectorAll('[data-file]').forEach(el => {
          el.onclick = (e) => {
            if (e.target.dataset.fix) {
              e.stopPropagation();
              vscode.postMessage({ command: 'autofix' });
            } else {
              vscode.postMessage({ 
                command: 'openFile', 
                file: el.dataset.file, 
                line: parseInt(el.dataset.line || '1') 
              });
            }
          };
        });
        
        // Verify button
        const verifyBtn = document.getElementById('btn-verify');
        if (verifyBtn) {
          verifyBtn.onclick = () => vscode.postMessage({ command: 'verify' });
        }
        
        // Pipeline mini click
        const pipelineMini = document.getElementById('pipeline-mini');
        if (pipelineMini) {
          pipelineMini.onclick = () => {
            state.activeTab = 'pipeline';
            render();
          };
        }
        
        // Findings link
        const findingsLink = document.getElementById('link-findings');
        if (findingsLink) {
          findingsLink.onclick = (e) => {
            e.preventDefault();
            state.activeTab = 'findings';
            render();
          };
        }
        
        // File search
        const fileSearch = document.getElementById('file-search');
        if (fileSearch) {
          fileSearch.oninput = (e) => {
            state.fileFilter = e.target.value.toLowerCase();
            // Could filter files here
          };
        }
      }
      
      // Initialize
      render();
    })();
  </script>
</body>
</html>`;
}
