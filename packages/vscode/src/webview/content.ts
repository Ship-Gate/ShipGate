import * as vscode from 'vscode';

export function getWebviewContent(vscodeUri: vscode.Uri): string {
  const uri = vscodeUri.toString();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
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
      --ship-glow: rgba(0,230,138,0.3);
      --warn: #ffb547;
      --warn-bg: rgba(255,181,71,0.08);
      --noship: #ff5c6a;
      --noship-bg: rgba(255,92,106,0.08);
      --accent: #6366f1;
      --accent-bg: rgba(99,102,241,0.08);
      --blue: #38bdf8;
      --blue-bg: rgba(56,189,248,0.08);
      --high-sev: #ff8a4c;
    }
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg1);
      color: var(--text1);
      font-size: 12px;
      line-height: 1.5;
      overflow-x: hidden;
      width: 320px;
    }
    
    .mono { font-family: 'JetBrains Mono', monospace; }
    
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
      background-image: url('${uri}/media/shipgate-icon.png');
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
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
      transition: all 200ms cubic-bezier(0.16,1,0.3,1);
    }
    
    .icon-btn:hover {
      background: var(--bg3);
      border-color: var(--border-hover);
      color: var(--text0);
    }
    
    .tab-bar {
      display: flex;
      gap: 4px;
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
    }
    
    /* Verdict Card */
    .verdict-card {
      position: relative;
      overflow: hidden;
    }
    
    .verdict-card.ship { background: var(--ship-bg); border-color: var(--ship); }
    .verdict-card.warn { background: var(--warn-bg); border-color: var(--warn); }
    .verdict-card.noship { background: var(--noship-bg); border-color: var(--noship); }
    
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
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    
    .badge.ship { background: var(--ship-bg); color: var(--ship); border: 1px solid var(--ship); }
    .badge.warn { background: var(--warn-bg); color: var(--warn); border: 1px solid var(--warn); }
    .badge.noship { background: var(--noship-bg); color: var(--noship); border: 1px solid var(--noship); }
    .badge.accent { background: var(--accent-bg); color: var(--accent); border: 1px solid var(--accent); }
    
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
    
    /* Button */
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
      transition: all 200ms cubic-bezier(0.16,1,0.3,1);
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
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .fade-in {
      animation: fadeIn 200ms cubic-bezier(0.16,1,0.3,1);
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
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      background: var(--bg2);
      padding: 4px 8px;
      border-radius: 4px;
      color: var(--text1);
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
        data: null,
        isScanning: false,
        error: null
      };
      
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
      
      function render() {
        const root = document.getElementById('root');
        root.innerHTML = renderHeader() + renderContent() + renderFooter();
        attachEventListeners();
      }
      
      function renderHeader() {
        return \`
          <div class="header">
            <div class="brand-bar">
              <div class="brand-left">
                <div class="logo"></div>
                <div class="brand-text">
                  <h1>ShipGate</h1>
                  <p>acme-api • main</p>
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
              <div class="tab \${state.activeTab === 'pipeline' ? 'active' : ''}" data-tab="pipeline">Pipeline</div>
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
          case 'overview':
            content = renderOverview();
            break;
          case 'claims':
            content = renderClaims();
            break;
          case 'pipeline':
            content = renderPipeline();
            break;
          case 'findings':
            content = renderFindings();
            break;
          case 'files':
            content = renderFiles();
            break;
        }
        
        return '<div class="content fade-in">' + content + '</div>';
      }
      
      function renderFooter() {
        const statusText = state.isScanning ? 'Scanning...' : 'Last scan: 12s ago';
        const statusColor = state.isScanning ? 'blue' : 'text3';
        
        return \`
          <div class="footer">
            <div class="footer-status">
              <span class="status-dot \${statusColor} \${state.isScanning ? 'pulse' : ''}"></span>
              <span>\${statusText}</span>
            </div>
            <button class="btn btn-primary" id="btn-verify">▶ Verify</button>
          </div>
        \`;
      }
      
      function renderEmpty() {
        return \`
          <div class="empty-state">
            <div class="logo"></div>
            <h2>Welcome to ShipGate</h2>
            <p>No .shipgate.yml found in this workspace.</p>
            <button class="btn btn-primary" data-command="init">Initialize Project</button>
            <p style="margin-top: 16px;">Or run: <code>npx shipgate init</code></p>
          </div>
        \`;
      }
      
      function renderScanning() {
        return \`
          <div class="empty-state">
            <div class="logo"></div>
            <h2>Verifying...</h2>
            <p>Scanning 263 files for verification</p>
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
        return \`
          <div class="section">
            <div class="verdict-card card ship">
              <div class="verdict-content">
                <div class="verdict-ring">
                  <svg width="56" height="56">
                    <circle cx="28" cy="28" r="24" fill="none" stroke="var(--ship)" stroke-width="4" stroke-dasharray="150 150" />
                    <text x="28" y="32" text-anchor="middle" fill="var(--ship)" font-size="16" font-weight="700" font-family="JetBrains Mono">96</text>
                  </svg>
                </div>
                <div class="verdict-info">
                  <h2 style="color: var(--ship);">SHIP</h2>
                  <p>8 claims verified • 2 warnings</p>
                </div>
              </div>
              <div class="verdict-glow" style="background: var(--ship);"></div>
            </div>
          </div>
          
          <div class="section">
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-header">
                  <span class="stat-label">Claims</span>
                </div>
                <div class="stat-value mono">8/8</div>
              </div>
              <div class="stat-card">
                <div class="stat-header">
                  <span class="stat-label">Coverage</span>
                </div>
                <div class="stat-value mono">94%</div>
              </div>
              <div class="stat-card">
                <div class="stat-header">
                  <span class="stat-label">Files</span>
                </div>
                <div class="stat-value mono">263</div>
              </div>
              <div class="stat-card">
                <div class="stat-header">
                  <span class="stat-label">Issues</span>
                </div>
                <div class="stat-value mono">19</div>
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
            \${claims.map((claim, idx) => \`
              <div class="card" style="margin-bottom: 8px; cursor: pointer;" data-claim="\${idx}">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <div style="width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; background: \${claim.status === 'PROVEN' ? 'var(--ship-bg)' : 'var(--warn-bg)'}; color: \${claim.status === 'PROVEN' ? 'var(--ship)' : 'var(--warn)'}; border: 1px solid \${claim.status === 'PROVEN' ? 'var(--ship)' : 'var(--warn)'};">
                    \${claim.status === 'PROVEN' ? '✓' : '◐'}
                  </div>
                  <div style="flex: 1;">
                    <div class="mono" style="font-size: 13px; color: var(--text1);">\${claim.name}</div>
                  </div>
                  <div class="mono" style="font-size: 11px; color: var(--text3);">\${claim.confidence}%</div>
                  <div style="font-size: 10px; color: var(--text3);">▾</div>
                </div>
                <div style="padding-left: 44px; margin-top: 8px; display: none;" data-claim-detail="\${idx}">
                  <p style="font-size: 12px; color: var(--text2); line-height: 1.6; margin-bottom: 8px;">\${claim.evidence}</p>
                  <div class="badge accent">SOC 2 — \${claim.control}</div>
                </div>
              </div>
            \`).join('')}
          </div>
        \`;
      }
      
      function renderPipeline() {
        return \`
          <div class="section">
            <div class="card">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                <span class="status-dot blue pulse"></span>
                <span style="font-size: 12px; font-weight: 600; color: var(--blue);">Running</span>
              </div>
              <div style="font-size: 12px; font-weight: 500; color: var(--text0); margin-bottom: 4px;">feat: add payment flow</div>
              <div style="font-size: 10px; color: var(--text3); margin-bottom: 12px;">main • PR #139</div>
              <div class="mono" style="font-size: 12px; color: var(--blue);">31s elapsed</div>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Jobs</div>
            <div class="card">
              <div style="display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span class="status-dot ship"></span>
                  <span style="flex: 1; font-size: 11px; color: var(--text1);">Install</span>
                  <span class="mono" style="font-size: 10px; color: var(--text3);">11s</span>
                </div>
                <div style="border-left: 1px solid var(--border); height: 8px; margin-left: 4px;"></div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span class="status-dot blue pulse"></span>
                  <span style="flex: 1; font-size: 11px; color: var(--blue);">shipgate verify</span>
                  <span class="mono" style="font-size: 10px; color: var(--blue);">31s</span>
                </div>
                <div style="border-left: 1px solid var(--border); height: 8px; margin-left: 4px;"></div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span class="status-dot" style="background: var(--bg3);"></span>
                  <span style="flex: 1; font-size: 11px; color: var(--text3);">shipgate ship --ci</span>
                  <span class="mono" style="font-size: 10px; color: var(--text3);">—</span>
                </div>
                <div style="border-left: 1px solid var(--border); height: 8px; margin-left: 4px;"></div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span class="status-dot" style="background: var(--bg3);"></span>
                  <span style="flex: 1; font-size: 11px; color: var(--text3);">Post PR Comment</span>
                  <span class="mono" style="font-size: 10px; color: var(--text3);">—</span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Environments</div>
            <div class="card" style="padding: 8px 12px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                <div>
                  <div style="font-size: 12px; color: var(--text0);">Production 🛡</div>
                  <div class="badge ship" style="margin-top: 2px;">protected</div>
                </div>
                <div class="mono" style="font-size: 13px; font-weight: 700; color: var(--ship);">96</div>
              </div>
            </div>
          </div>
        \`;
      }
      
      function renderFindings() {
        const findings = [
          { severity: 'critical', message: 'Hardcoded Stripe key in emailService.ts:24', file: 'emailService.ts', line: 24, engine: 'Secret Scanner', pr: 139, fixable: true },
          { severity: 'critical', message: "Package 'sendgrid-v4-next' does not exist on npm", file: 'emailService.ts', line: 12, engine: 'Hallucination', pr: 139, fixable: true },
          { severity: 'high', message: 'Route /api/email/verify has no handler', file: 'apiRouter.ts', line: 45, engine: 'Hallucination', pr: 139, fixable: false },
          { severity: 'medium', message: "Implicit 'any' on webhookPayload parameter", file: 'webhookHandler.ts', line: 18, engine: 'Type Safety', pr: 142, fixable: true },
          { severity: 'medium', message: 'Missing try/catch in async route handler', file: 'paymentRouter.ts', line: 67, engine: 'Error Handling', pr: 142, fixable: true },
          { severity: 'low', message: 'console.log left in production code', file: 'utils/helpers.ts', line: 34, engine: 'Console', pr: 142, fixable: true }
        ];
        
        return \`
          <div class="section">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 11px; font-weight: 600; color: var(--text0);">Findings</span>
                <span class="badge noship">\${findings.length}</span>
              </div>
              <div style="display: flex; gap: 4px;">
                <div class="badge noship" style="cursor: pointer; padding: 2px 6px;">C</div>
                <div class="badge" style="background: var(--high-sev); color: #fff; cursor: pointer; padding: 2px 6px;">H</div>
                <div class="badge warn" style="cursor: pointer; padding: 2px 6px;">M</div>
                <div class="badge" style="background: var(--bg2); color: var(--text3); cursor: pointer; padding: 2px 6px;">L</div>
              </div>
            </div>
            
            \${findings.map(f => \`
              <div class="card" style="margin-bottom: 8px; cursor: pointer;" data-file="\${f.file}" data-line="\${f.line}">
                <div style="display: flex; align-items: start; gap: 10px;">
                  <span class="status-dot" style="background: \${f.severity === 'critical' ? 'var(--noship)' : f.severity === 'high' ? 'var(--high-sev)' : f.severity === 'medium' ? 'var(--warn)' : 'var(--text3)'}; margin-top: 4px;"></span>
                  <div style="flex: 1;">
                    <div style="font-size: 11px; color: var(--text1); line-height: 1.4; margin-bottom: 4px;">\${f.message}</div>
                    <div style="font-size: 9px; color: var(--text3);">
                      <span class="mono">\${f.file}:\${f.line}</span>
                      <span style="margin: 0 6px;">•</span>
                      <span>\${f.engine}</span>
                      <span style="margin: 0 6px;">•</span>
                      <span style="color: var(--accent);">#\${f.pr}</span>
                    </div>
                  </div>
                  \${f.fixable ? '<button class="btn" style="padding: 3px 8px; font-size: 9px; background: var(--ship-bg); color: var(--ship);" data-fix="true">Fix</button>' : ''}
                </div>
              </div>
            \`).join('')}
            
            <button class="btn btn-primary" style="width: 100%; margin-top: 8px;" data-command="autofixAll">
              Auto-fix all (5)
            </button>
            <p style="font-size: 10px; color: var(--text3); text-align: center; margin-top: 8px;">5 of 6 findings are auto-fixable</p>
          </div>
        \`;
      }
      
      function renderFiles() {
        const files = [
          { name: 'authService.ts', verdict: 'SHIP', score: 98, findings: 0 },
          { name: 'paymentRouter.ts', verdict: 'SHIP', score: 95, findings: 0 },
          { name: 'webhookHandler.ts', verdict: 'SHIP', score: 92, findings: 1 },
          { name: 'userController.ts', verdict: 'WARN', score: 78, findings: 2 },
          { name: 'apiRouter.ts', verdict: 'WARN', score: 74, findings: 0 },
          { name: 'emailService.ts', verdict: 'NO_SHIP', score: 42, findings: 3 },
          { name: 'utils/helpers.ts', verdict: 'SHIP', score: 99, findings: 0 },
          { name: 'middleware/cors.ts', verdict: 'SHIP', score: 97, findings: 0 },
          { name: 'config/database.ts', verdict: 'WARN', score: 71, findings: 1 },
          { name: 'types/index.ts', verdict: 'SHIP', score: 100, findings: 0 }
        ];
        
        return \`
          <div class="section">
            <input 
              type="text" 
              id="file-search" 
              placeholder="Filter files..." 
              style="width: 100%; padding: 8px 12px; background: var(--bg2); border: 1px solid var(--border); border-radius: 6px; color: var(--text1); font-size: 12px; margin-bottom: 12px;"
            />
            
            <div style="display: flex; gap: 6px; margin-bottom: 12px;">
              <div class="badge accent" style="cursor: pointer; padding: 4px 10px;" data-sort="verdict">By verdict</div>
              <div class="badge" style="background: var(--bg2); color: var(--text3); cursor: pointer; padding: 4px 10px;" data-sort="name">By name</div>
              <div class="badge" style="background: var(--bg2); color: var(--text3); cursor: pointer; padding: 4px 10px;" data-sort="score">By score</div>
            </div>
            
            \${files.map(f => \`
              <div class="card" style="margin-bottom: 6px; padding: 10px 12px; cursor: pointer;" data-file="\${f.name}">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span class="badge \${f.verdict.toLowerCase().replace('_', '')}" style="font-size: 8px; padding: 2px 6px;">\${f.verdict}</span>
                  <span class="mono" style="flex: 1; font-size: 12px; color: var(--text1);">\${f.name}</span>
                  \${f.findings > 0 ? \`<span style="width: 16px; height: 16px; border-radius: 50%; background: var(--noship); color: #fff; font-size: 9px; display: flex; align-items: center; justify-content: center; font-weight: 600;">\${f.findings}</span>\` : ''}
                  <span class="mono" style="font-size: 11px; color: var(--text3);">\${f.score}</span>
                </div>
              </div>
            \`).join('')}
          </div>
        \`;
      }
      
      function attachEventListeners() {
        document.querySelectorAll('[data-tab]').forEach(el => {
          el.onclick = () => {
            state.activeTab = el.dataset.tab;
            render();
          };
        });
        
        document.querySelectorAll('[data-command]').forEach(el => {
          el.onclick = () => {
            vscode.postMessage({ command: el.dataset.command });
          };
        });
        
        document.querySelectorAll('[data-claim]').forEach(el => {
          el.onclick = () => {
            const idx = el.dataset.claim;
            const detail = document.querySelector(\`[data-claim-detail="\${idx}"]\`);
            if (detail) {
              detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
            }
          };
        });
        
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
        
        const verifyBtn = document.getElementById('btn-verify');
        if (verifyBtn) {
          verifyBtn.onclick = () => vscode.postMessage({ command: 'verify' });
        }
        
        const fileSearch = document.getElementById('file-search');
        if (fileSearch) {
          fileSearch.oninput = (e) => {
            const query = e.target.value.toLowerCase();
            document.querySelectorAll('[data-file]').forEach(fileEl => {
              const fileName = fileEl.dataset.file.toLowerCase();
              fileEl.style.display = fileName.includes(query) ? 'block' : 'none';
            });
          };
        }
      }
      
      render();
    })();
  </script>
</body>
</html>`;
}
