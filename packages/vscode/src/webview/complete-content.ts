export function getWebviewContent(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: vscode-resource:;">
  <style>
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
    @keyframes spin { to{transform:rotate(360deg)} }
    @keyframes slideUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes ringDraw { from{stroke-dashoffset:var(--ring-circ)} to{stroke-dashoffset:var(--ring-offset)} }
    @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
    @keyframes glowPulse { 0%,100%{opacity:.2} 50%{opacity:.4} }
    @keyframes toastIn { from{opacity:0;transform:translateY(-10px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
    @keyframes toastOut { from{opacity:1} to{opacity:0;transform:translateY(-6px) scale(.98)} }
    @keyframes progressPulse { 0%{box-shadow:0 0 4px var(--accent)} 50%{box-shadow:0 0 14px var(--accent)} 100%{box-shadow:0 0 4px var(--accent)} }
    @keyframes dotBounce { 0%,80%,100%{transform:scale(0)} 40%{transform:scale(1)} }
    @keyframes fadeBody { from{opacity:0} to{opacity:1} }

    :root {
      --bg-0: #09090d;
      --bg-1: #0e0e14;
      --bg-2: #14141c;
      --bg-3: #1a1a24;
      --bg-4: #21212e;
      --border-1: rgba(255,255,255,.04);
      --border-2: rgba(255,255,255,.07);
      --border-3: rgba(255,255,255,.12);
      --tx-1: #ededf0;
      --tx-2: #a2a2b6;
      --tx-3: #6c6c82;
      --tx-4: #464660;
      --green: #00dc82;
      --green-bg: rgba(0,220,130,.06);
      --green-border: rgba(0,220,130,.14);
      --green-glow: rgba(0,220,130,.3);
      --amber: #f5a623;
      --amber-bg: rgba(245,166,35,.06);
      --amber-border: rgba(245,166,35,.14);
      --amber-glow: rgba(245,166,35,.3);
      --red: #ef4444;
      --red-bg: rgba(239,68,68,.06);
      --red-border: rgba(239,68,68,.14);
      --red-glow: rgba(239,68,68,.3);
      --indigo: #818cf8;
      --indigo-bg: rgba(129,140,248,.06);
      --indigo-border: rgba(129,140,248,.14);
      --cyan: #22d3ee;
      --cyan-bg: rgba(34,211,238,.06);
      --accent: var(--green);
      --r-sm: 4px;
      --r-md: 8px;
      --r-lg: 12px;
      --ease: cubic-bezier(.16,1,.3,1);
    }

    * { margin:0; padding:0; box-sizing:border-box; }

    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
      background: var(--bg-0);
      color: var(--tx-2);
      font-size: 12px;
      line-height: 1.5;
      overflow-x: hidden;
      -webkit-font-smoothing: antialiased;
    }

    .mono { font-family: var(--vscode-editor-font-family, 'SF Mono', Consolas, 'Courier New', monospace); }
    .trunc { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

    #root { display:flex; flex-direction:column; height:100vh; }

    /* ---- Header ---- */
    .header {
      position: sticky; top: 0; z-index: 100;
      background: var(--bg-0);
      border-bottom: 1px solid var(--border-1);
    }
    .header-top {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px 6px;
    }
    .header-brand { display:flex; align-items:center; gap:8px; }
    .header-logo {
      width: 24px; height: 24px; border-radius: 6px;
      background: linear-gradient(135deg, var(--green), var(--indigo));
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 800; color: #000; letter-spacing: -0.5px;
    }
    .header-title { font-size:12px; font-weight:700; color:var(--tx-1); letter-spacing:-.2px; }
    .header-context { font-size:10px; color:var(--tx-4); margin-top:1px; }
    .header-actions { display:flex; gap:3px; }
    .icon-btn {
      width:24px; height:24px; border-radius:var(--r-sm);
      background: transparent; border:1px solid transparent;
      display:flex; align-items:center; justify-content:center;
      cursor:pointer; color:var(--tx-3); font-size:12px;
      transition: all 80ms var(--ease);
    }
    .icon-btn:hover { background:var(--bg-3); border-color:var(--border-2); color:var(--tx-1); }

    /* ---- Tabs ---- */
    .nav {
      display:flex; gap:0; padding:0 14px;
    }
    .nav-tab {
      padding: 7px 14px; font-size:11px; font-weight:600;
      color: var(--tx-4); cursor:pointer;
      border-bottom: 2px solid transparent;
      transition: color 100ms, border-color 100ms;
      white-space: nowrap; position: relative;
    }
    .nav-tab:hover { color:var(--tx-3); }
    .nav-tab.active { color:var(--tx-1); border-bottom-color:var(--green); }
    .nav-badge {
      position: absolute; top: 4px; right: 4px;
      width: 6px; height: 6px; border-radius: 50%;
      background: var(--red);
    }
    .nav-count {
      font-size: 9px; margin-left: 4px; font-weight: 700;
      opacity: .6;
    }

    /* ---- Body ---- */
    .body { flex:1; overflow-y:auto; padding:14px; animation: fadeBody 150ms var(--ease); }
    .body::-webkit-scrollbar { width:4px; }
    .body::-webkit-scrollbar-thumb { background:var(--border-2); border-radius:2px; }

    /* ---- Section ---- */
    .section { margin-bottom:16px; animation: slideUp 120ms var(--ease) both; }
    .section-label {
      font-size:9px; font-weight:700; text-transform:uppercase;
      letter-spacing:.08em; color:var(--tx-4); margin-bottom:8px;
      display:flex; align-items:center; gap:6px;
    }

    /* ---- Cards ---- */
    .card {
      background: var(--bg-1);
      border: 1px solid var(--border-1);
      border-radius: var(--r-md);
      padding: 12px;
      transition: border-color 100ms;
    }
    .card:hover { border-color:var(--border-2); }
    .card + .card { margin-top:6px; }

    /* ---- Verdict Hero ---- */
    .verdict-hero {
      position: relative; overflow: hidden;
      background: var(--bg-1);
      border: 1px solid var(--border-1);
      border-radius: var(--r-lg);
      padding: 20px 16px;
    }
    .verdict-hero.ship { background:var(--green-bg); border-color:var(--green-border); }
    .verdict-hero.warn { background:var(--amber-bg); border-color:var(--amber-border); }
    .verdict-hero.fail { background:var(--red-bg); border-color:var(--red-border); }
    .verdict-layout { display:flex; align-items:center; gap:16px; position:relative; z-index:1; }
    .verdict-ring { position:relative; flex-shrink:0; width:52px; height:52px; }
    .verdict-score {
      position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
      font-size:16px; font-weight:800; letter-spacing:-1px;
    }
    .verdict-info h2 { font-size:20px; font-weight:800; letter-spacing:-.5px; line-height:1.1; }
    .verdict-info p { font-size:11px; color:var(--tx-2); margin-top:3px; }
    .verdict-glow {
      position:absolute; top:-20px; right:-20px;
      width:72px; height:72px; border-radius:50%;
      filter:blur(28px); pointer-events:none;
      animation: glowPulse 4s ease infinite;
    }

    /* ---- Stat Grid ---- */
    .stat-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
    .stat-card {
      background:var(--bg-1); border:1px solid var(--border-1);
      border-radius: var(--r-md); padding:10px 12px;
    }
    .stat-label { font-size:9px; color:var(--tx-4); text-transform:uppercase; letter-spacing:.04em; margin-bottom:2px; }
    .stat-value { font-size:16px; font-weight:800; color:var(--tx-1); letter-spacing:-.5px; }

    /* ---- Badges ---- */
    .badge {
      display:inline-flex; align-items:center; padding:1px 7px;
      border-radius:3px; font-size:9px; font-weight:700;
      text-transform:uppercase; letter-spacing:.02em;
    }
    .badge.ship { background:var(--green-bg); color:var(--green); border:1px solid var(--green-border); }
    .badge.warn { background:var(--amber-bg); color:var(--amber); border:1px solid var(--amber-border); }
    .badge.fail { background:var(--red-bg); color:var(--red); border:1px solid var(--red-border); }
    .badge.info { background:var(--indigo-bg); color:var(--indigo); border:1px solid var(--indigo-border); }
    .badge.muted { background:var(--bg-2); color:var(--tx-4); border:1px solid var(--border-1); }

    /* ---- Dots ---- */
    .dot { width:7px; height:7px; border-radius:50%; display:inline-block; flex-shrink:0; }
    .dot.green { background:var(--green); }
    .dot.amber { background:var(--amber); }
    .dot.red { background:var(--red); }
    .dot.cyan { background:var(--cyan); }
    .dot.dim { background:var(--tx-4); }
    .dot.pulse { animation:pulse 2s infinite; }

    /* ---- Buttons ---- */
    .btn {
      display:inline-flex; align-items:center; justify-content:center; gap:5px;
      padding:7px 14px; border-radius:var(--r-sm);
      font-size:11px; font-weight:600; cursor:pointer;
      transition: all 80ms var(--ease); border:none;
      font-family: inherit;
    }
    .btn-primary {
      background: var(--green); color:#000;
      box-shadow: 0 0 10px var(--green-glow), inset 0 1px 0 rgba(255,255,255,.12);
    }
    .btn-primary:hover { filter:brightness(1.1); transform:translateY(-1px); }
    .btn-primary:active { transform:translateY(0); }
    .btn-secondary {
      background:var(--bg-2); color:var(--tx-1);
      border:1px solid var(--border-2);
    }
    .btn-secondary:hover { background:var(--bg-3); border-color:var(--border-3); }
    .btn-sm { padding:4px 8px; font-size:10px; }

    /* ---- Action Row ---- */
    .action-row {
      display:flex; align-items:center; gap:10px;
      padding:9px 12px; border-radius:var(--r-md);
      border:1px solid var(--border-1); background:var(--bg-1);
      cursor:pointer; transition: border-color 80ms, background 80ms;
      margin-bottom:4px;
    }
    .action-row:hover { border-color:var(--border-3); background:var(--bg-2); }
    .action-row:active { background:var(--bg-3); }
    .action-icon { font-size:14px; width:20px; text-align:center; flex-shrink:0; }
    .action-body { flex:1; min-width:0; }
    .action-label { font-size:12px; font-weight:500; color:var(--tx-1); }
    .action-desc { font-size:10px; color:var(--tx-4); margin-top:1px; }
    .action-chevron { font-size:12px; color:var(--tx-4); flex-shrink:0; }
    .action-status {
      width:6px; height:6px; border-radius:50%; flex-shrink:0;
    }
    .action-status.idle { background:var(--border-2); }
    .action-status.running { background:var(--cyan); animation:pulse 1s infinite; }
    .action-status.done { background:var(--green); }
    .action-status.error { background:var(--red); }

    /* ---- Issue Item ---- */
    .issue-item {
      display:flex; gap:8px; align-items:flex-start;
      padding:8px 10px; border-radius:var(--r-md);
      border:1px solid var(--border-1); background:var(--bg-1);
      cursor:pointer; transition: border-color 80ms, background 80ms;
      margin-bottom:4px;
    }
    .issue-item:hover { border-color:var(--border-2); background:var(--bg-2); }
    .issue-dot { margin-top:4px; flex-shrink:0; }
    .issue-body { flex:1; min-width:0; }
    .issue-msg { font-size:11px; color:var(--tx-2); line-height:1.35; }
    .issue-meta { font-size:9px; color:var(--tx-4); margin-top:2px; display:flex; gap:6px; align-items:center; }

    /* ---- Filter Chips ---- */
    .filter-bar { display:flex; gap:4px; margin-bottom:8px; flex-wrap:wrap; }
    .filter-chip {
      padding:3px 8px; font-size:9px; font-weight:600;
      border-radius:3px; cursor:pointer; border:1px solid var(--border-1);
      background:var(--bg-2); color:var(--tx-4);
      transition: all 80ms; font-family: inherit;
    }
    .filter-chip.active { color:var(--tx-1); border-color:var(--border-3); background:var(--bg-3); }

    /* ---- File Row ---- */
    .file-row {
      background:var(--bg-1); border:1px solid var(--border-1);
      border-radius:var(--r-md); margin-bottom:4px; overflow:hidden;
    }
    .file-row-header {
      padding:8px 10px; cursor:pointer; display:flex; align-items:center; gap:8px;
      transition: background 80ms;
    }
    .file-row-header:hover { background:var(--bg-2); }
    .file-row-detail {
      overflow:hidden; max-height:0; opacity:0;
      transition: max-height 250ms var(--ease), opacity 200ms, padding 200ms;
      padding:0 10px; background:var(--bg-2); border-top:1px solid var(--border-1);
    }
    .file-row-detail.open { max-height:240px; opacity:1; padding:8px 10px; overflow-y:auto; }

    /* ---- Progress ---- */
    .progress-card {
      background: var(--bg-1); border: 1px solid var(--border-1);
      border-radius: var(--r-lg); padding: 24px 16px; text-align: center;
    }
    .progress-spinner {
      width:28px; height:28px; border:2.5px solid var(--border-2);
      border-top-color:var(--green); border-radius:50%;
      animation:spin .7s linear infinite; margin:0 auto 14px;
    }
    .progress-track {
      width:100%; height:5px; background:var(--bg-4);
      border-radius:3px; overflow:hidden; margin:14px 0 8px;
    }
    .progress-fill {
      height:100%; border-radius:3px;
      background: linear-gradient(90deg, var(--green), var(--cyan));
      transition: width .5s var(--ease);
      animation: progressPulse 2s infinite;
    }
    .progress-phases {
      display:flex; gap:6px; justify-content:center; margin-top:12px;
    }
    .progress-phase-item {
      display:flex; align-items:center; gap:3px;
      font-size:9px; color:var(--tx-4);
    }
    .progress-phase-item.active { color:var(--green); }
    .progress-phase-item.done { color:var(--tx-3); }
    .progress-dots { display:inline-flex; gap:3px; margin-left:4px; }
    .progress-dots span {
      width:3px; height:3px; border-radius:50%; background:var(--tx-3);
      display:inline-block; animation:dotBounce 1.4s infinite ease-in-out both;
    }
    .progress-dots span:nth-child(1) { animation-delay:-.32s; }
    .progress-dots span:nth-child(2) { animation-delay:-.16s; }
    .progress-dots span:nth-child(3) { animation-delay:0s; }

    /* ---- Plan Card ---- */
    .plan-card {
      background: linear-gradient(145deg, var(--indigo-bg), var(--bg-1));
      border: 1px solid var(--indigo-border);
      border-radius: var(--r-lg); padding: 12px 14px;
    }
    .plan-usage-bar {
      flex:1; height:3px; background:var(--bg-4);
      border-radius:2px; overflow:hidden;
    }
    .plan-usage-fill { height:100%; border-radius:2px; background:var(--indigo); transition:width 400ms var(--ease); }

    /* ---- Gen Grid ---- */
    .gen-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:4px; }
    .gen-grid .btn { font-size:10px; padding:6px 4px; }

    /* ---- Toast ---- */
    .toast {
      position:fixed; top:56px; left:50%; transform:translateX(-50%);
      z-index:200; padding:8px 16px; border-radius:var(--r-md);
      font-size:12px; font-weight:700;
      animation: toastIn 250ms var(--ease) both;
      pointer-events:none; display:flex; align-items:center; gap:6px;
    }
    .toast.out { animation: toastOut 250ms var(--ease) both; }
    .toast.ship { background:var(--green-bg); border:1px solid var(--green-border); color:var(--green); }
    .toast.warn { background:var(--amber-bg); border:1px solid var(--amber-border); color:var(--amber); }
    .toast.fail { background:var(--red-bg); border:1px solid var(--red-border); color:var(--red); }

    /* ---- Trend Bar ---- */
    .trend-bar { display:flex; gap:3px; align-items:flex-end; height:20px; }
    .trend-col {
      flex:1; border-radius:2px 2px 0 0; min-width:5px;
      transition: height 300ms var(--ease);
    }

    /* ---- Heatmap ---- */
    .heatmap { display:flex; flex-wrap:wrap; gap:2px; }
    .hm-dot {
      width:6px; height:6px; border-radius:1px;
      transition: transform 100ms;
    }
    .hm-dot:hover { transform:scale(2); }
    .hm-dot.pass { background:var(--green); }
    .hm-dot.warn { background:var(--amber); }
    .hm-dot.fail { background:var(--red); }

    /* ---- Finding Group ---- */
    .finding-group { margin-bottom:6px; }
    .finding-group-hdr {
      display:flex; align-items:center; gap:6px; cursor:pointer;
      padding:6px 10px; border-radius:var(--r-sm);
      background:var(--bg-2); border:1px solid var(--border-1);
      font-size:10px; font-weight:600; color:var(--tx-2);
      margin-bottom:3px; transition: background 80ms;
    }
    .finding-group-hdr:hover { background:var(--bg-3); }
    .finding-group-items {
      overflow:hidden; transition: max-height 250ms var(--ease), opacity 200ms;
    }
    .finding-group-items.collapsed { max-height:0; opacity:0; }
    .finding-group-items.expanded { max-height:2000px; opacity:1; }

    /* ---- Upgrade CTA ---- */
    .upgrade-cta {
      background: linear-gradient(135deg, var(--green-bg), var(--indigo-bg));
      border: 1px solid var(--green-border);
      border-radius: var(--r-lg); padding: 14px; text-align: center;
    }

    /* ---- Watch Toggle ---- */
    .watch-toggle {
      display:inline-flex; align-items:center; gap:4px;
      padding:3px 8px; border-radius:4px; font-size:9px; font-weight:600;
      cursor:pointer; transition: all 80ms;
    }
    .watch-toggle.on { background:var(--cyan-bg); color:var(--cyan); border:1px solid rgba(34,211,238,.15); }
    .watch-toggle.off { background:var(--bg-2); color:var(--tx-4); border:1px solid var(--border-1); }
    .watch-toggle:hover { border-color:var(--border-3); }

    /* ---- Keyboard Hint ---- */
    .kbd {
      font-size:8px; color:var(--tx-4);
      background:var(--bg-0); border:1px solid var(--border-1);
      border-radius:3px; padding:1px 4px;
      font-family: var(--vscode-editor-font-family, monospace);
    }

    /* ---- Empty State ---- */
    .empty-state { text-align:center; padding:36px 16px; }
    .empty-state-icon { font-size:24px; margin-bottom:10px; opacity:.25; }
    .empty-state h3 { font-size:14px; font-weight:700; color:var(--tx-1); margin-bottom:4px; }
    .empty-state p { font-size:11px; color:var(--tx-3); line-height:1.5; margin-bottom:14px; }

    /* ---- Footer ---- */
    .footer {
      position:sticky; bottom:0; background:var(--bg-0);
      border-top:1px solid var(--border-1);
      padding:8px 14px; display:flex; align-items:center; justify-content:space-between;
    }
    .footer-status { display:flex; align-items:center; gap:5px; font-size:10px; color:var(--tx-4); }
    .elapsed { font-size:10px; color:var(--cyan); font-weight:600; }

    /* ---- Search ---- */
    .search-input {
      width:100%; padding:6px 10px; background:var(--bg-2);
      border:1px solid var(--border-1); border-radius:var(--r-sm);
      color:var(--tx-1); font-size:11px; font-family:inherit;
    }
    .search-input:focus { outline:none; border-color:var(--border-3); }
    .search-input::placeholder { color:var(--tx-4); }

    /* ---- Sort Pill ---- */
    .sort-pill {
      padding:3px 8px; font-size:9px; font-weight:600;
      border-radius:3px; cursor:pointer; transition: all 80ms;
    }

    /* ---- View Toggle ---- */
    .view-toggle {
      display:flex; background:var(--bg-2); border-radius:var(--r-sm);
      border:1px solid var(--border-1); overflow:hidden;
    }
    .view-toggle-btn {
      padding:4px 10px; font-size:9px; font-weight:600;
      color:var(--tx-4); cursor:pointer; border:none;
      background:transparent; transition: all 80ms; font-family:inherit;
    }
    .view-toggle-btn.active { background:var(--bg-3); color:var(--tx-1); }

    /* ---- Donut ---- */
    .donut-legend { display:flex; gap:8px; flex-wrap:wrap; }
    .donut-legend-item { display:flex; align-items:center; gap:4px; font-size:9px; color:var(--tx-2); }
    .donut-legend-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }

    /* ---- Tooltip ---- */
    .tip { position:relative; }
    .tip::after {
      content:attr(data-tip);
      position:absolute; bottom:calc(100% + 5px); left:50%;
      transform:translateX(-50%); padding:3px 7px;
      background:var(--bg-4); color:var(--tx-1);
      font-size:9px; border-radius:3px; white-space:nowrap;
      pointer-events:none; opacity:0; transition:opacity 120ms;
      border:1px solid var(--border-3); z-index:50;
    }
    .tip:hover::after { opacity:1; }

    /* ---- Feature Panel ---- */
    .fp { border:1px solid var(--border-1); border-radius:var(--r-lg); background:var(--bg-1); margin-bottom:6px; overflow:hidden; transition:border-color 200ms var(--ease),box-shadow 200ms var(--ease); }
    .fp:hover { border-color:var(--border-2); }
    .fp.fp-open { border-color:var(--border-3); box-shadow:0 0 0 1px var(--border-2); }
    .fp.fp-active { border-color:var(--cyan); box-shadow:0 0 14px rgba(34,211,238,.06); }
    .fp-hd { display:flex; align-items:center; gap:10px; padding:10px 14px; cursor:pointer; transition:background 80ms; }
    .fp-hd:hover { background:var(--bg-2); }
    .fp-ico { width:28px; height:28px; border-radius:var(--r-md); display:flex; align-items:center; justify-content:center; font-size:13px; flex-shrink:0; transition:transform 200ms var(--ease); }
    .fp.fp-open .fp-ico { transform:scale(1.1); }
    .fp-name { font-size:12px; font-weight:600; color:var(--tx-1); }
    .fp-tagline { font-size:9px; color:var(--tx-4); margin-top:1px; transition:opacity 150ms; }
    .fp.fp-open .fp-tagline { opacity:0; height:0; margin:0; overflow:hidden; }
    .fp-arr { font-size:8px; color:var(--tx-4); transition:transform 200ms var(--ease); margin-left:auto; flex-shrink:0; }
    .fp.fp-open .fp-arr { transform:rotate(180deg); }
    .fp-bd { max-height:0; opacity:0; overflow:hidden; transition:max-height 350ms var(--ease),opacity 250ms,padding 250ms; padding:0 14px; }
    .fp.fp-open .fp-bd { max-height:500px; opacity:1; padding:0 14px 14px; }
    .fp-divider { height:1px; background:var(--border-1); margin:0 -14px 12px; }
    .fp-why { padding:10px 12px; background:var(--bg-2); border-radius:var(--r-md); margin-bottom:10px; border-left:2px solid; }
    .fp-why-lbl { font-size:8px; font-weight:800; text-transform:uppercase; letter-spacing:.08em; margin-bottom:3px; }
    .fp-why-txt { font-size:11px; color:var(--tx-2); line-height:1.5; }
    .fp-steps { margin-bottom:10px; }
    .fp-steps-hd { font-size:8px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:var(--tx-4); margin-bottom:8px; }
    .fp-stp { display:flex; align-items:flex-start; gap:8px; margin-bottom:6px; }
    .fp-stp-n { width:16px; height:16px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:8px; font-weight:700; flex-shrink:0; margin-top:1px; }
    .fp-stp-t { font-size:11px; color:var(--tx-2); line-height:1.4; }
    .fp-foot { display:flex; align-items:center; gap:8px; padding-top:2px; }
    .fp-last { font-size:9px; color:var(--tx-4); display:flex; align-items:center; gap:4px; margin-left:auto; }
    .fp-prog { padding:8px 10px; background:var(--bg-2); border-radius:var(--r-md); margin-bottom:8px; }
  </style>
</head>
<body>
  <div id="root"></div>
  <div id="toast-container"></div>
  <script>
  (function(){
    var vsc = acquireVsCodeApi();

    var S = {
      tab: 'status',
      data: null,
      scanning: false,
      err: null,
      progress: null,
      proStatus: null,
      toastVisible: false,
      scanStart: null,
      fileSort: 'verdict',
      fileQ: '',
      fileFilter: 'all',
      expandedFile: -1,
      actionHistory: [],
      runningAction: null,
      scanHistory: [],
      sevFilter: 'all',
      newResults: false,
      collapsedGroups: {},
      watchMode: false,
      lastWatchFile: '',
      lastWatchTime: 0,
      resultsView: 'findings',
      expandedAction: null,
    };

    var elapsedInterval = null;
    var tabOrder = ['status','results','actions'];
    var isMac = navigator.platform.indexOf('Mac') > -1;
    var mod = isMac ? '\\u2318' : 'Ctrl';

    document.addEventListener('keydown', function(e) {
      var m = isMac ? e.metaKey : e.ctrlKey;
      if (m && e.shiftKey && e.key === 'S') { e.preventDefault(); vsc.postMessage({ command:'verify' }); }
      if (m && e.shiftKey && e.key === 'G') { e.preventDefault(); vsc.postMessage({ command:'goCommand' }); }
      if (m && e.key === 'ArrowRight') {
        e.preventDefault();
        var ci = tabOrder.indexOf(S.tab);
        S.tab = tabOrder[(ci + 1) % tabOrder.length];
        S.newResults = false; draw();
      }
      if (m && e.key === 'ArrowLeft') {
        e.preventDefault();
        var ci = tabOrder.indexOf(S.tab);
        S.tab = tabOrder[(ci - 1 + tabOrder.length) % tabOrder.length];
        S.newResults = false; draw();
      }
    });

    window.addEventListener('message', function(e){
      var m = e.data;
      if (m.type === 'results') {
        S.data = m.data;
        S.scanning = false;
        S.err = null;
        S.progress = null;
        S.scanStart = null;
        if (elapsedInterval) { clearInterval(elapsedInterval); elapsedInterval = null; }
        if (S.runningAction) { addHistory(S.runningAction, 'done'); S.runningAction = null; }
        if (m.data.watchMode !== undefined) S.watchMode = !!m.data.watchMode;
        S.scanHistory.unshift({ verdict:m.data.verdict||'UNKNOWN', score:m.data.score||0, time:Date.now() });
        if (S.scanHistory.length > 5) S.scanHistory.pop();
        if (S.tab !== 'status') S.newResults = true;
        showToast(m.data.verdict || 'UNKNOWN', m.data.score || 0);
      }
      if (m.type === 'scanning') {
        S.scanning = true;
        S.progress = { percent:5, phase:'Initializing...' };
        S.scanStart = Date.now();
        startTimer();
        if (m.action) { S.runningAction = m.action; S.expandedAction = m.action; }
      }
      if (m.type === 'progress') {
        S.progress = { percent:m.percent||0, phase:m.phase||'' };
      }
      if (m.type === 'error') {
        S.scanning = false; S.err = m.message; S.progress = null; S.scanStart = null;
        if (elapsedInterval) { clearInterval(elapsedInterval); elapsedInterval = null; }
        if (S.runningAction) { addHistory(S.runningAction, 'error'); S.runningAction = null; }
      }
      if (m.type === 'proStatus') {
        S.proStatus = { active:m.active, plan:m.plan||'free', email:m.email, scansUsed:m.scansUsed||0, scansLimit:m.scansLimit||25 };
      }
      if (m.type === 'watchMode') { S.watchMode = !!m.enabled; }
      if (m.type === 'watchEvent') { S.lastWatchFile = m.file||''; S.lastWatchTime = Date.now(); }
      draw();
    });

    function addHistory(action, status) {
      S.actionHistory.unshift({ action:action, status:status, time:Date.now() });
      if (S.actionHistory.length > 5) S.actionHistory.pop();
    }
    function getStatus(cmd) {
      for (var i=0; i<S.actionHistory.length; i++) {
        if (S.actionHistory[i].action === cmd) return S.actionHistory[i].status;
      }
      return 'idle';
    }
    function startTimer() {
      if (elapsedInterval) clearInterval(elapsedInterval);
      elapsedInterval = setInterval(function() {
        var el = document.getElementById('elapsed-time');
        if (el && S.scanStart) el.textContent = Math.floor((Date.now()-S.scanStart)/1000)+'s';
      }, 1000);
    }
    function showToast(verdict, score) {
      var cls = verdict==='SHIP'?'ship':verdict==='WARN'?'warn':'fail';
      var c = document.getElementById('toast-container');
      if (!c) return;
      c.innerHTML = '<div class="toast '+cls+'"><span>'+verdict+'</span><span class="mono" style="font-size:13px;">'+score+'</span></div>';
      setTimeout(function(){ var t=c.querySelector('.toast'); if(t) t.classList.add('out'); }, 2200);
      setTimeout(function(){ c.innerHTML=''; }, 2600);
    }
    function colorOf(v) {
      if (v==='SHIP'||v==='PASS'||v==='pass') return 'var(--green)';
      if (v==='WARN'||v==='pending') return 'var(--amber)';
      if (v==='NO_SHIP'||v==='FAIL'||v==='fail') return 'var(--red)';
      if (v==='running') return 'var(--cyan)';
      return 'var(--tx-4)';
    }
    function badgeOf(v) {
      if (v==='SHIP'||v==='PASS') return 'ship';
      if (v==='WARN') return 'warn';
      if (v==='NO_SHIP'||v==='FAIL') return 'fail';
      return 'muted';
    }
    function ring(val, sz, col) {
      var r=(sz-5)/2, circ=2*Math.PI*r, off=circ-(val/100)*circ;
      return '<svg width="'+sz+'" height="'+sz+'" style="transform:rotate(-90deg);display:block;">' +
        '<circle cx="'+sz/2+'" cy="'+sz/2+'" r="'+r+'" fill="none" stroke="var(--bg-4)" stroke-width="3.5"/>' +
        '<circle cx="'+sz/2+'" cy="'+sz/2+'" r="'+r+'" fill="none" stroke="'+col+'" stroke-width="3.5" ' +
        'stroke-dasharray="'+circ+'" stroke-dashoffset="'+off+'" stroke-linecap="round" ' +
        'style="--ring-circ:'+circ+';--ring-offset:'+off+';animation:ringDraw .7s var(--ease) both;"/></svg>';
    }
    function donut(segments, sz) {
      var r=(sz-7)/2, circ=2*Math.PI*r;
      var total=segments.reduce(function(s,seg){return s+seg.value},0);
      if (total===0) total=1;
      var svg='<svg width="'+sz+'" height="'+sz+'" style="transform:rotate(-90deg);display:block;">';
      svg+='<circle cx="'+sz/2+'" cy="'+sz/2+'" r="'+r+'" fill="none" stroke="var(--bg-4)" stroke-width="5"/>';
      var offset=0;
      for(var i=0;i<segments.length;i++){
        var pct=segments[i].value/total, len=pct*circ;
        svg+='<circle cx="'+sz/2+'" cy="'+sz/2+'" r="'+r+'" fill="none" stroke="'+segments[i].color+'" stroke-width="5" stroke-dasharray="'+len+' '+(circ-len)+'" stroke-dashoffset="'+(-offset)+'" stroke-linecap="round"/>';
        offset+=len;
      }
      return svg+'</svg>';
    }
    function timeSince(ts) {
      if(!ts)return'never';
      var s=Math.floor((Date.now()-new Date(ts).getTime())/1000);
      if(s<5)return'just now'; if(s<60)return s+'s ago';
      if(s<3600)return Math.floor(s/60)+'m ago';
      return Math.floor(s/3600)+'h ago';
    }
    function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

    function draw() {
      document.getElementById('root').innerHTML = renderHeader() + renderBody() + renderFooter();
      bind();
    }

    /* ===== HEADER ===== */
    function renderHeader() {
      var d = S.data || {};
      var ctx = (d.projectName||'workspace') + ' / ' + (d.branch||'main');

      var issueCount = 0;
      if (S.data && S.data.files) {
        S.data.files.forEach(function(f){ issueCount += (f.blockers?f.blockers.length:0)+(f.errors?f.errors.length:0); });
      }

      return '<div class="header">' +
        '<div class="header-top">' +
          '<div class="header-brand">' +
            '<div class="header-logo">SG</div>' +
            '<div><div class="header-title">ShipGate</div><div class="header-context">'+esc(ctx)+'</div></div>' +
          '</div>' +
          '<div class="header-actions">' +
            '<button class="icon-btn tip" data-cmd="verify" data-tip="Scan">&#x21bb;</button>' +
            '<button class="icon-btn tip" data-cmd="openDashboard" data-tip="Dashboard">&#x2197;</button>' +
            '<button class="icon-btn tip" data-cmd="openSettings" data-tip="Settings">&#x2699;</button>' +
          '</div>' +
        '</div>' +
        '<div class="nav">' +
          navTab('status', 'Status', S.newResults && S.tab !== 'status') +
          navTab('results', 'Results', false, issueCount > 0 ? issueCount : 0) +
          navTab('actions', 'Actions', false) +
        '</div>' +
      '</div>';
    }

    function navTab(id, label, hasDot, count) {
      var cls = S.tab === id ? ' active' : '';
      var badge = hasDot ? '<span class="nav-badge"></span>' : '';
      var countHtml = count > 0 ? '<span class="nav-count" style="color:var(--red);">'+count+'</span>' : '';
      return '<div class="nav-tab'+cls+'" data-tab="'+id+'">'+label+countHtml+badge+'</div>';
    }

    /* ===== BODY ===== */
    function renderBody() {
      if (S.scanning) return '<div class="body">' + scanningView() + '</div>';
      if (S.err && S.tab !== 'actions') return '<div class="body">' + errorView() + '</div>';
      var c = '';
      if (S.tab === 'status') c = S.data ? statusView() : welcomeView();
      else if (S.tab === 'results') c = S.data ? resultsView() : emptyView('No results yet', 'Run a scan to see findings and per-file verdicts.', 'verify');
      else if (S.tab === 'actions') c = actionsView();
      return '<div class="body">' + c + '</div>';
    }

    /* ===== FOOTER ===== */
    function renderFooter() {
      var txt, dot;
      if (S.scanning) {
        txt = '<span class="elapsed">Scanning <span id="elapsed-time">0s</span></span>';
        dot = 'cyan pulse';
      } else if (S.data) {
        txt = timeSince(S.data.timestamp);
        dot = 'green';
      } else {
        txt = 'Ready';
        dot = 'dim';
      }
      return '<div class="footer">' +
        '<div class="footer-status"><span class="dot '+dot+'"></span><span>'+txt+'</span></div>' +
        '<button class="btn btn-primary btn-sm" id="btn-go"'+(S.scanning?' disabled style="opacity:.5"':'')+'>' +
          (S.scanning ? '...' : '&#9654; Scan') +
        '</button>' +
      '</div>';
    }

    /* ===== WELCOME (no data) ===== */
    function welcomeView() {
      return '<div class="empty-state">' +
        '<div class="header-logo" style="width:36px;height:36px;font-size:16px;margin:0 auto 14px;border-radius:8px;">SG</div>' +
        '<h3>ShipGate</h3>' +
        '<p>Behavioral verification for AI-generated code.<br>Catch violations before they ship.</p>' +
        '<div style="text-align:left;max-width:220px;margin:0 auto 16px;">' +
          onboardStep(1, 'Scan', 'Verify .isl specs against code') +
          onboardStep(2, 'Verdict', 'SHIP / NO_SHIP with evidence') +
          onboardStep(3, 'Fix', 'Auto-heal violations with AI') +
        '</div>' +
        '<button class="btn btn-primary" data-cmd="verify" style="padding:9px 22px;">&#9654; Run first scan</button>' +
        '<div style="margin-top:8px;font-size:9px;color:var(--tx-4);">No API key required &nbsp;<span class="kbd">'+mod+'+\\u21e7+S</span></div>' +
      '</div>';
    }

    function onboardStep(n, title, desc) {
      return '<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:6px;">' +
        '<span style="width:16px;height:16px;border-radius:50%;background:var(--indigo-bg);border:1px solid var(--indigo-border);color:var(--indigo);font-size:8px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">'+n+'</span>' +
        '<span style="font-size:11px;color:var(--tx-2);line-height:1.4;"><strong style="color:var(--tx-1);">'+title+'</strong> &mdash; '+desc+'</span>' +
      '</div>';
    }

    function emptyView(title, desc, cmd) {
      return '<div class="empty-state">' +
        '<div class="empty-state-icon">&#9638;</div>' +
        '<h3>'+title+'</h3>' +
        '<p>'+desc+'</p>' +
        '<button class="btn btn-primary" data-cmd="'+(cmd||'verify')+'" style="padding:8px 18px;">&#9654; Run scan</button>' +
        '<div style="margin-top:6px;font-size:9px;color:var(--tx-4);"><span class="kbd">'+mod+'+\\u21e7+S</span></div>' +
      '</div>';
    }

    function errorView() {
      return '<div class="empty-state">' +
        '<div style="font-size:22px;margin-bottom:8px;">&#x26a0;</div>' +
        '<h3 style="color:var(--red);">Scan Error</h3>' +
        '<p style="color:var(--red);word-break:break-word;">'+(S.err||'Unknown error')+'</p>' +
        '<button class="btn btn-primary" data-cmd="verify" style="margin-top:6px;">&#9654; Retry</button>' +
      '</div>';
    }

    function scanningView() {
      var p = S.progress || { percent:15, phase:'Initializing...' };
      var elapsed = S.scanStart ? Math.floor((Date.now()-S.scanStart)/1000) : 0;
      var phases = [
        { label:'Detect', done:p.percent>15 },
        { label:'Scan', done:p.percent>50 },
        { label:'Verify', done:p.percent>80 },
        { label:'Gate', done:p.percent>=100 },
      ];
      var o = '<div class="progress-card">';
      o += '<div class="progress-spinner"></div>';
      o += '<div style="font-size:13px;font-weight:700;color:var(--tx-1);">Verifying</div>';
      o += '<div class="progress-track"><div class="progress-fill" style="width:'+p.percent+'%"></div></div>';
      o += '<div style="display:flex;justify-content:space-between;">';
      o += '<span class="mono" style="font-size:10px;color:var(--tx-3);">'+p.percent+'%</span>';
      o += '<span class="elapsed" id="elapsed-time">'+elapsed+'s</span>';
      o += '</div>';
      o += '<div style="font-size:10px;color:var(--tx-2);margin-top:8px;">';
      o += esc(p.phase) + '<span class="progress-dots"><span></span><span></span><span></span></span>';
      o += '</div>';
      o += '<div class="progress-phases">';
      for (var i=0; i<phases.length; i++) {
        var active = !phases[i].done && (i===0 || phases[i-1].done);
        o += '<div class="progress-phase-item'+(phases[i].done?' done':'')+(active?' active':'')+'">';
        o += '<span style="font-size:7px;">'+(phases[i].done?'&#10003;':active?'&#9679;':'&#9675;')+'</span>';
        o += phases[i].label + '</div>';
      }
      o += '</div></div>';
      return o;
    }

    /* ===== STATUS VIEW ===== */
    function statusView() {
      var d = S.data, v = d.verdict||'UNKNOWN', sc = d.score||0;
      var cls = v==='SHIP'?'ship':v==='WARN'?'warn':'fail';
      var col = colorOf(v);
      var files = d.files||[];
      var total = files.length;
      var pass = files.filter(function(f){return f.status==='PASS'}).length;
      var fail = files.filter(function(f){return f.status==='FAIL'}).length;
      var warns = files.filter(function(f){return f.status==='WARN'}).length;
      var issues = files.reduce(function(s,f){return s+(f.blockers?f.blockers.length:0)+(f.errors?f.errors.length:0)},0);
      var covPct = d.coverage&&d.coverage.total ? Math.round((d.coverage.specced/d.coverage.total)*100) : 0;
      var dur = d.duration ? (d.duration<1000 ? d.duration+'ms' : (d.duration/1000).toFixed(1)+'s') : '--';
      var o = '';

      o += '<div class="section">' +
        '<div class="verdict-hero '+cls+'">' +
          '<div class="verdict-layout">' +
            '<div class="verdict-ring">' + ring(sc,52,col) +
              '<div class="verdict-score mono" style="color:'+col+';">'+sc+'</div>' +
            '</div>' +
            '<div class="verdict-info">' +
              '<h2 style="color:'+col+';">'+v+'</h2>' +
              '<p>'+pass+' passed &middot; '+fail+' failed &middot; '+warns+' warn</p>' +
            '</div>' +
          '</div>' +
          '<div class="verdict-glow" style="background:'+col+';"></div>' +
        '</div>' +
      '</div>';

      o += '<div class="section"><div class="stat-grid">' +
        statBox('Pass Rate', pass+'/'+total) +
        statBox('Coverage', covPct+'%') +
        statBox('Files', ''+total) +
        statBox('Duration', dur) +
      '</div></div>';

      if (S.scanHistory.length > 1) {
        o += '<div class="section"><div class="section-label">Score Trend</div>';
        o += '<div class="trend-bar">';
        var hist = S.scanHistory.slice(0,5).reverse();
        for (var i=0; i<hist.length; i++) {
          var h = hist[i];
          var hcol = h.verdict==='SHIP'?'var(--green)':h.verdict==='WARN'?'var(--amber)':'var(--red)';
          var hpct = Math.max(h.score, 6);
          o += '<div class="trend-col tip" data-tip="'+h.verdict+' '+h.score+'" style="height:'+hpct+'%;background:'+hcol+';opacity:'+(i===hist.length-1?'1':'.45')+'"></div>';
        }
        o += '</div></div>';
      }

      if (issues > 0) {
        o += '<div class="section"><div class="section-label">Top Issues <span style="color:var(--red);font-size:8px;">'+issues+'</span></div>';
        var shown = 0;
        for (var fi=0; fi<files.length && shown<3; fi++) {
          var f = files[fi];
          var all = (f.blockers||[]).concat(f.errors||[]);
          for (var j=0; j<all.length && shown<3; j++) {
            var dc = f.status==='FAIL'?'red':'amber';
            o += '<div class="issue-item" data-file="'+f.file+'" data-line="1">' +
              '<span class="dot '+dc+' issue-dot"></span>' +
              '<div class="issue-body">' +
                '<div class="issue-msg trunc">'+esc(all[j])+'</div>' +
                '<div class="issue-meta"><span class="mono">'+esc(f.file)+'</span></div>' +
              '</div>' +
            '</div>';
            shown++;
          }
        }
        if (issues > 3) {
          o += '<div style="text-align:center;margin-top:4px;"><a href="#" style="font-size:10px;color:var(--indigo);text-decoration:none;" id="link-results">View all '+issues+' findings &#8594;</a></div>';
        }
        o += '</div>';
      }

      if (total > 0) {
        o += '<div class="section"><div class="section-label">File Health</div>';
        o += '<div class="heatmap">';
        for (var i=0; i<files.length; i++) {
          var hc = files[i].status==='PASS'?'pass':files[i].status==='FAIL'?'fail':'warn';
          o += '<div class="hm-dot '+hc+'" title="'+esc(files[i].file)+'"></div>';
        }
        o += '</div></div>';
      }

      o += '<div class="section">';
      o += '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
      o += '<button class="btn btn-secondary btn-sm" data-cmd="verify" style="flex:1;">&#9654; Re-scan</button>';
      o += '<button class="btn btn-secondary btn-sm" data-cmd="viewProofBundle" style="flex:1;">&#9638; Proof</button>';
      o += '<button class="btn btn-secondary btn-sm" data-cmd="copySummary" style="flex:1;">&#9998; Copy</button>';
      o += '</div>';
      o += '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">';
      o += '<div class="watch-toggle '+(S.watchMode?'on':'off')+'" data-cmd="toggleWatch">';
      o += '<span>'+(S.watchMode?'&#x25C9;':'&#x25CB;')+'</span> Watch '+(S.watchMode?'ON':'OFF');
      o += '</div>';
      if (S.lastWatchFile && S.watchMode) {
        o += '<span style="font-size:9px;color:var(--tx-4);">'+esc(S.lastWatchFile)+'</span>';
      }
      o += '</div></div>';

      return o;
    }

    function statBox(label, value) {
      return '<div class="stat-card"><div class="stat-label">'+label+'</div><div class="stat-value mono">'+value+'</div></div>';
    }

    /* ===== RESULTS VIEW (merged findings + files) ===== */
    function resultsView() {
      var o = '';

      o += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">';
      o += '<div class="view-toggle">';
      o += '<button class="view-toggle-btn'+(S.resultsView==='findings'?' active':'')+'" data-rview="findings">Findings</button>';
      o += '<button class="view-toggle-btn'+(S.resultsView==='files'?' active':'')+'" data-rview="files">Files</button>';
      o += '</div>';
      o += '</div>';

      if (S.resultsView === 'findings') o += findingsPanel();
      else o += filesPanel();

      return o;
    }

    function findingsPanel() {
      var d = S.data||{};
      var allFindings = [];
      if (d.files) {
        d.files.forEach(function(f) {
          if (f.blockers) f.blockers.forEach(function(msg) {
            allFindings.push({ sev:f.status==='FAIL'?'high':'medium', msg:msg, file:f.file, line:1, eng:f.mode||'shipgate' });
          });
          if (f.errors) f.errors.forEach(function(msg) {
            allFindings.push({ sev:'critical', msg:msg, file:f.file, line:1, eng:f.mode||'shipgate' });
          });
        });
      }

      var critCount = allFindings.filter(function(f){return f.sev==='critical'}).length;
      var highCount = allFindings.filter(function(f){return f.sev==='high'}).length;
      var medCount = allFindings.filter(function(f){return f.sev==='medium'}).length;
      var findings = S.sevFilter==='all' ? allFindings : allFindings.filter(function(f){return f.sev===S.sevFilter});

      var o = '<div class="section">';

      if (allFindings.length > 0) {
        o += '<div class="filter-bar">';
        o += '<button class="filter-chip'+(S.sevFilter==='all'?' active':'')+'" data-sev="all">All '+allFindings.length+'</button>';
        if (critCount) o += '<button class="filter-chip'+(S.sevFilter==='critical'?' active':'')+'" data-sev="critical" style="'+(S.sevFilter==='critical'?'color:var(--red);border-color:var(--red-border)':'')+'">Critical '+critCount+'</button>';
        if (highCount) o += '<button class="filter-chip'+(S.sevFilter==='high'?' active':'')+'" data-sev="high" style="'+(S.sevFilter==='high'?'color:var(--amber);border-color:var(--amber-border)':'')+'">High '+highCount+'</button>';
        if (medCount) o += '<button class="filter-chip'+(S.sevFilter==='medium'?' active':'')+'" data-sev="medium">Medium '+medCount+'</button>';
        o += '</div>';
      }

      if (allFindings.length === 0) {
        o += '<div class="empty-state" style="padding:24px 16px;">' +
          '<div style="font-size:20px;margin-bottom:8px;opacity:.4;">&#10003;</div>' +
          '<h3 style="font-size:13px;">All clear</h3>' +
          '<p style="font-size:11px;">Every file passes verification.</p>' +
        '</div>';
      } else if (findings.length === 0) {
        o += '<div style="text-align:center;padding:20px;font-size:11px;color:var(--tx-4);">No findings match this filter</div>';
      } else {
        var grouped = {};
        findings.forEach(function(f) { if(!grouped[f.file]) grouped[f.file]=[]; grouped[f.file].push(f); });
        var fileKeys = Object.keys(grouped);
        for (var gi=0; gi<fileKeys.length; gi++) {
          var gk = fileKeys[gi], gItems = grouped[gk];
          var isCollapsed = !!S.collapsedGroups[gk];
          o += '<div class="finding-group">';
          o += '<div class="finding-group-hdr" data-group="'+esc(gk)+'">';
          o += '<span style="font-size:7px;">'+(isCollapsed?'\\u25b6':'\\u25bc')+'</span>';
          o += '<span class="mono trunc" style="flex:1;">'+esc(gk)+'</span>';
          o += '<span class="badge '+(gItems[0].sev==='critical'?'fail':'warn')+'" style="font-size:7px;">'+gItems.length+'</span>';
          o += '</div>';
          o += '<div class="finding-group-items '+(isCollapsed?'collapsed':'expanded')+'">';
          for (var fi=0; fi<gItems.length; fi++) {
            var f = gItems[fi];
            var dotCol = f.sev==='critical'?'red':'amber';
            o += '<div class="issue-item" data-file="'+f.file+'" data-line="'+f.line+'">' +
              '<span class="dot '+dotCol+' issue-dot"></span>' +
              '<div class="issue-body">' +
                '<div class="issue-msg">'+esc(f.msg)+'</div>' +
                '<div class="issue-meta"><span>'+esc(f.eng)+'</span></div>' +
              '</div>' +
            '</div>';
          }
          o += '</div></div>';
        }
      }
      o += '</div>';
      return o;
    }

    function filesPanel() {
      var d = S.data||{};
      var rawFiles = d.files||[];
      var files = rawFiles.map(function(f,idx) {
        return {
          name:f.file,
          verdict:f.status==='PASS'?'SHIP':f.status==='FAIL'?'NO_SHIP':'WARN',
          score:f.score||0,
          issues:(f.blockers?f.blockers.length:0)+(f.errors?f.errors.length:0),
          blockers:f.blockers||[], errors:f.errors||[], idx:idx
        };
      });

      if (S.fileSort==='name') files.sort(function(a,b){return a.name.localeCompare(b.name)});
      else if (S.fileSort==='score') files.sort(function(a,b){return a.score-b.score});
      else files.sort(function(a,b){
        var order={NO_SHIP:0,WARN:1,SHIP:2};
        return (order[a.verdict]||0)-(order[b.verdict]||0);
      });

      if (S.fileFilter!=='all') {
        files = files.filter(function(f) {
          if(S.fileFilter==='fail') return f.verdict==='NO_SHIP';
          if(S.fileFilter==='warn') return f.verdict==='WARN';
          if(S.fileFilter==='pass') return f.verdict==='SHIP';
          return true;
        });
      }
      if (S.fileQ) files = files.filter(function(f){return f.name.toLowerCase().indexOf(S.fileQ)!==-1});

      var failCount=rawFiles.filter(function(f){return f.status==='FAIL'}).length;
      var warnCount=rawFiles.filter(function(f){return f.status==='WARN'}).length;
      var passCount=rawFiles.filter(function(f){return f.status==='PASS'}).length;

      var o = '<div class="section">';
      o += '<input type="text" class="search-input" id="file-search" placeholder="Filter files..." value="'+esc(S.fileQ)+'">';

      o += '<div class="filter-bar" style="margin-top:8px;">';
      o += '<button class="filter-chip'+(S.fileFilter==='all'?' active':'')+'" data-filt="all">All '+rawFiles.length+'</button>';
      if(failCount) o += '<button class="filter-chip'+(S.fileFilter==='fail'?' active':'')+'" data-filt="fail" style="color:var(--red);">Fail '+failCount+'</button>';
      if(warnCount) o += '<button class="filter-chip'+(S.fileFilter==='warn'?' active':'')+'" data-filt="warn" style="color:var(--amber);">Warn '+warnCount+'</button>';
      o += '<button class="filter-chip'+(S.fileFilter==='pass'?' active':'')+'" data-filt="pass" style="color:var(--green);">Pass '+passCount+'</button>';
      o += '</div>';

      o += '<div style="display:flex;gap:4px;margin-bottom:8px;align-items:center;">';
      o += sortPill('verdict','Verdict') + sortPill('name','Name') + sortPill('score','Score');
      if (failCount > 0) o += '<button class="btn btn-secondary btn-sm" id="open-all-fail" style="margin-left:auto;font-size:9px;">Open failing</button>';
      o += '</div>';

      if (files.length===0) {
        o += '<div style="text-align:center;padding:20px;font-size:11px;color:var(--tx-4);">No files match</div>';
      } else {
        for (var i=0; i<files.length; i++) {
          var f = files[i];
          var bg = badgeOf(f.verdict);
          var issueBdg = f.issues>0 ? '<span style="min-width:14px;height:14px;border-radius:50%;background:var(--red);color:#fff;font-size:8px;display:flex;align-items:center;justify-content:center;font-weight:700;">'+f.issues+'</span>' : '';
          var isExp = S.expandedFile===f.idx;
          o += '<div class="file-row">';
          o += '<div class="file-row-header" data-file-toggle="'+f.idx+'">' +
            '<span class="badge '+bg+'" style="font-size:8px;padding:1px 5px;">'+f.verdict+'</span>' +
            '<span class="mono trunc" style="flex:1;font-size:11px;color:var(--tx-2);">'+esc(f.name)+'</span>' +
            issueBdg +
            '<span class="mono" style="font-size:10px;color:var(--tx-4);">'+f.score+'</span>' +
            '<span style="font-size:9px;color:var(--tx-4);">'+(isExp?'\\u25b4':'\\u25be')+'</span>' +
          '</div>';
          if (isExp) {
            o += '<div class="file-row-detail open">';
            if (f.blockers.length>0 || f.errors.length>0) {
              var allIss = f.errors.concat(f.blockers);
              for (var j=0; j<allIss.length; j++) {
                var ic = j<f.errors.length?'red':'amber';
                o += '<div style="display:flex;gap:6px;align-items:flex-start;margin-bottom:4px;">' +
                  '<span class="dot '+ic+'" style="margin-top:3px;flex-shrink:0;"></span>' +
                  '<span style="font-size:10px;color:var(--tx-2);line-height:1.3;">'+esc(allIss[j])+'</span></div>';
              }
            } else {
              o += '<div style="font-size:10px;color:var(--green);">&#10003; All checks passed</div>';
            }
            o += '<button class="btn btn-secondary btn-sm" data-file="'+esc(f.name)+'" style="margin-top:6px;">Open file</button>';
            o += '</div>';
          }
          o += '</div>';
        }
      }
      o += '</div>';
      return o;
    }

    function sortPill(key, label) {
      var active = S.fileSort === key;
      return '<span class="sort-pill badge '+(active?'info':'muted')+'" style="cursor:pointer;" data-sort="'+key+'">'+label+'</span>';
    }

    /* ===== FEATURE DATA ===== */
    var FEATURES = [
      { id:'verify', icon:'\\u25b6', label:'Ship Check', color:'var(--green)', tagline:'Verify specs against code',
        why:'Make sure your code does what your specs say it should before you ship.',
        steps:['Reads .isl spec files in your project','Verifies code behavior against each spec clause','Produces a SHIP / NO_SHIP verdict with evidence'],
        kbd:mod+'+\\u21e7+S', hero:true },
      { id:'goCommand', icon:'\\u26a1', label:'shipgate go', color:'var(--indigo)', tagline:'Detect + infer + verify + gate', pro:true,
        why:'One command that does everything. Detects your project, infers specs if missing, verifies, and gates.',
        steps:['Auto-detects project structure and routes','Infers ISL specifications if none exist','Runs full verification and returns a gate verdict'],
        kbd:mod+'+\\u21e7+\\u21b5', hero:true },
      { id:'vibeGenerate', icon:'\\u2728', label:'Vibe \\u2192 Ship', color:'var(--indigo)', group:'Workflows',
        why:'Turn a plain English description into verified, spec-backed code.',
        steps:['Takes your natural language intent','Generates ISL specs from your description','Produces verified code that satisfies those specs'] },
      { id:'goFix', icon:'\\u26a1', label:'Go + Auto-Heal', color:'var(--green)', group:'Workflows',
        why:'Scan your project and automatically fix any spec violations found.',
        steps:['Runs full project scan for violations','Generates AI-powered code fixes','Applies fixes and re-verifies the project'] },
      { id:'goDeep', icon:'\\u25ce', label:'Deep Scan', color:'var(--cyan)', group:'Workflows',
        why:'Maximum coverage analysis for critical code you need to trust.',
        steps:['Runs extended verification with deeper analysis','Checks edge cases and boundary conditions','Produces detailed trust scoring per file'] },
      { id:'verifyFile', icon:'\\u25b6', label:'Verify Current File', color:'var(--green)', group:'Verify',
        why:'Quick check on just the file you are editing right now.',
        steps:['Finds the spec for your active editor file','Verifies all clauses against this single file','Shows inline diagnostics for violations'] },
      { id:'scanProject', icon:'\\u25b6', label:'Quick Scan', color:'var(--cyan)', group:'Verify',
        why:'Fast scan to get a pass/fail verdict without deep analysis.',
        steps:['Rapid project structure scan','Checks critical specs only','Returns a gate verdict in seconds'] },
      { id:'inferSpecs', icon:'\\u25c8', label:'Infer ISL Specs', color:'var(--indigo)', group:'Spec Tools',
        why:'No specs yet? AI analyzes your code and generates behavioral contracts for you.',
        steps:['Reads your source files and route structure','Infers behavioral contracts from code','Writes .isl spec files you can review and edit'] },
      { id:'codeToIsl', icon:'\\u270e', label:'Code \\u2192 ISL', color:'var(--cyan)', group:'Spec Tools',
        why:'Generate a spec directly from the file open in your editor.',
        steps:['Analyzes the active file exports and behavior','Generates ISL clauses for each function','Opens the spec in a new editor tab'] },
      { id:'genSpec', icon:'\\u270e', label:'Generate ISL Spec', color:'var(--indigo)', group:'Spec Tools',
        why:'Scaffold a new spec file from an existing source file.',
        steps:['Select a source file to analyze','Generates a spec skeleton with key clauses','Saves the .isl file adjacent to your source'] },
      { id:'fmtSpecs', icon:'\\u21bb', label:'Format & Lint', color:'var(--green)', group:'Spec Tools',
        why:'Keep your spec files clean, consistent, and error-free.',
        steps:['Scans all .isl files in your project','Auto-formats whitespace and structure','Reports any syntax or structural issues'] },
      { id:'autofixAll', icon:'\\u26a1', label:'Heal All', color:'var(--amber)', group:'Fix & Heal',
        why:'Automatically fix every spec violation across your entire project.',
        steps:['Identifies all failing spec clauses','Generates AI-powered fixes for each violation','Applies fixes and re-verifies everything'] },
      { id:'trustScore', icon:'\\u25ce', label:'Trust Score', color:'var(--green)', group:'Reports',
        why:'See exactly how trustworthy your codebase is, broken down file by file.',
        steps:['Calculates trust scores per file and overall','Breaks down by spec coverage, test quality, etc.','Shows trends compared to previous scans'] },
      { id:'coverage', icon:'\\u25c8', label:'Coverage Report', color:'var(--cyan)', group:'Reports',
        why:'Find out which parts of your code have specs and which are uncovered.',
        steps:['Maps every source file to its spec coverage','Highlights uncovered files and functions','Shows coverage percentage per directory'] },
      { id:'securityReport', icon:'\\u26a0', label:'Security Report', color:'var(--red)', group:'Reports',
        why:'Catch hardcoded secrets, auth gaps, and injection vulnerabilities.',
        steps:['Scans for hardcoded API keys and secrets','Checks authentication and authorization patterns','Detects SQL injection and XSS risks'] },
      { id:'compliance', icon:'\\ud83d\\udee1', label:'SOC 2 Audit', color:'var(--green)', group:'Reports',
        why:'Generate compliance evidence for audits and security reviews.',
        steps:['Runs full compliance framework checks','Maps findings to SOC 2 control requirements','Generates audit-ready evidence reports'] },
      { id:'exportReport', icon:'\\u2197', label:'Export Report', color:'var(--indigo)', group:'Reports',
        why:'Get a shareable report for your team, pull requests, or compliance docs.',
        steps:['Compiles all scan results and verdicts','Formats into a structured report','Exports as a file you can share or attach'] },
    ];
    function cBg(c) {
      if(c==='var(--green)')return'var(--green-bg)';if(c==='var(--indigo)')return'var(--indigo-bg)';
      if(c==='var(--cyan)')return'var(--cyan-bg)';if(c==='var(--amber)')return'var(--amber-bg)';
      if(c==='var(--red)')return'var(--red-bg)';return'var(--bg-2)';
    }
    function cBd(c) {
      if(c==='var(--green)')return'var(--green-border)';if(c==='var(--indigo)')return'var(--indigo-border)';
      if(c==='var(--cyan)')return'rgba(34,211,238,.14)';if(c==='var(--amber)')return'var(--amber-border)';
      if(c==='var(--red)')return'var(--red-border)';return'var(--border-2)';
    }
    function renderFeaturePanel(f) {
      var isOpen = S.expandedAction === f.id;
      var isRunning = S.runningAction === f.id;
      var st = isRunning ? 'running' : getStatus(f.id);
      var cls = 'fp' + (isOpen?' fp-open':'') + (isRunning?' fp-active':'');
      var o = '<div class="'+cls+'">';
      o += '<div class="fp-hd" data-fp-toggle="'+f.id+'">';
      o += '<div class="fp-ico" style="background:'+cBg(f.color)+';color:'+f.color+';">'+f.icon+'</div>';
      o += '<div style="flex:1;min-width:0;">';
      o += '<div class="fp-name">';
      if (f.pro) o += '<span class="badge info" style="font-size:7px;margin-right:4px;vertical-align:1px;">PRO</span>';
      o += f.label+'</div>';
      o += '<div class="fp-tagline">'+esc(f.tagline||f.why.substring(0,50))+'</div>';
      o += '</div>';
      if (st!=='idle') o += '<div class="action-status '+st+'"></div>';
      o += '<div class="fp-arr">\\u25be</div>';
      o += '</div>';
      o += '<div class="fp-bd">';
      o += '<div class="fp-divider"></div>';
      o += '<div class="fp-why" style="border-left-color:'+f.color+';">';
      o += '<div><div class="fp-why-lbl" style="color:'+f.color+';">Why use this</div>';
      o += '<div class="fp-why-txt">'+esc(f.why)+'</div></div>';
      o += '</div>';
      if (f.steps && f.steps.length) {
        o += '<div class="fp-steps"><div class="fp-steps-hd">What it does</div>';
        for (var si=0; si<f.steps.length; si++) {
          o += '<div class="fp-stp">';
          o += '<div class="fp-stp-n" style="background:'+cBg(f.color)+';color:'+f.color+';border:1px solid '+cBd(f.color)+';">'+(si+1)+'</div>';
          o += '<div class="fp-stp-t">'+esc(f.steps[si])+'</div>';
          o += '</div>';
        }
        o += '</div>';
      }
      if (isRunning && S.progress) {
        o += '<div class="fp-prog">';
        o += '<div class="progress-track" style="margin:0 0 6px;"><div class="progress-fill" style="width:'+S.progress.percent+'%"></div></div>';
        o += '<div style="display:flex;justify-content:space-between;">';
        o += '<span style="font-size:10px;color:var(--tx-2);">'+esc(S.progress.phase)+'<span class="progress-dots"><span></span><span></span><span></span></span></span>';
        o += '<span class="elapsed mono" style="font-size:10px;">'+(S.scanStart?Math.floor((Date.now()-S.scanStart)/1000)+'s':'')+'</span>';
        o += '</div></div>';
      }
      o += '<div class="fp-foot">';
      o += '<button class="btn btn-primary btn-sm" data-cmd="'+f.id+'"'+(S.scanning?' disabled style="opacity:.5;"':'')+'>'+(isRunning?'Running...':'\\u25b6 Run')+'</button>';
      if (f.kbd) o += '<span class="kbd">'+f.kbd+'</span>';
      if (st==='done') o += '<span class="fp-last"><span class="dot green" style="width:5px;height:5px;"></span> Completed</span>';
      else if (st==='error') o += '<span class="fp-last"><span class="dot red" style="width:5px;height:5px;"></span> Failed</span>';
      o += '</div>';
      o += '</div></div>';
      return o;
    }

    /* ===== ACTIONS VIEW (merged pro + actions) ===== */
    function actionsView() {
      var o = '';

      var ps = S.proStatus;
      if (ps) {
        var planLabel = ps.plan==='enterprise'?'ENTERPRISE':ps.active?'PRO':'FREE';
        var planBadge = ps.plan==='enterprise'?'ship':ps.active?'ship':'info';
        var isLimited = !ps.active && ps.scansUsed >= ps.scansLimit;
        o += '<div class="section"><div class="plan-card" style="padding:10px 12px;">';
        o += '<div style="display:flex;justify-content:space-between;align-items:center;">';
        o += '<div style="display:flex;align-items:center;gap:6px;">';
        o += '<span class="badge '+planBadge+'" style="font-size:8px;">'+planLabel+'</span>';
        if (ps.email) o += '<span style="font-size:9px;color:var(--tx-4);">'+esc(ps.email)+'</span>';
        o += '</div>';
        if (!ps.active) o += '<button class="btn btn-primary btn-sm" data-cmd="openDashboard">Upgrade</button>';
        o += '</div>';
        if (!ps.active) {
          var pct = ps.scansLimit>0 ? Math.round((ps.scansUsed/ps.scansLimit)*100) : 0;
          var barColor = isLimited ? 'var(--red)' : 'var(--indigo)';
          o += '<div style="display:flex;align-items:center;gap:8px;margin-top:6px;">';
          o += '<span style="font-size:9px;color:'+(isLimited?'var(--red)':'var(--tx-3)')+';">'+ps.scansUsed+'/'+ps.scansLimit+' scans'+(isLimited?' (limit reached)':'')+'</span>';
          o += '<div class="plan-usage-bar"><div class="plan-usage-fill" style="width:'+pct+'%;background:'+barColor+';"></div></div>';
          o += '</div>';
        }
        o += '</div></div>';
      }

      for (var hi=0; hi<FEATURES.length; hi++) {
        if (FEATURES[hi].hero) o += renderFeaturePanel(FEATURES[hi]);
      }

      var fGroups = ['Workflows','Verify','Spec Tools','Fix & Heal','Reports'];
      for (var gi=0; gi<fGroups.length; gi++) {
        var gn = fGroups[gi], gItems = [];
        for (var fi=0; fi<FEATURES.length; fi++) { if (FEATURES[fi].group === gn) gItems.push(FEATURES[fi]); }
        if (gItems.length === 0) continue;
        o += '<div class="section"><div class="section-label">'+gn+'</div>';
        for (var fi=0; fi<gItems.length; fi++) o += renderFeaturePanel(gItems[fi]);
        o += '</div>';
      }

      o += '<div class="section"><div class="section-label">Generate from ISL</div><div class="gen-grid">' +
        '<button class="btn btn-secondary" data-cmd="genTypescript">TS</button>' +
        '<button class="btn btn-secondary" data-cmd="genPython">Python</button>' +
        '<button class="btn btn-secondary" data-cmd="genRust">Rust</button>' +
        '<button class="btn btn-secondary" data-cmd="genGo">Go</button>' +
        '<button class="btn btn-secondary" data-cmd="genGraphql">GQL</button>' +
        '<button class="btn btn-secondary" data-cmd="genOpenapi">OpenAPI</button>' +
      '</div></div>';

      if (!ps || (!ps.active && ps.plan !== 'enterprise')) {
        o += '<div class="upgrade-cta">' +
          '<div style="font-size:12px;font-weight:700;color:var(--tx-1);">Unlock Pro</div>' +
          '<div style="font-size:10px;color:var(--tx-3);margin-top:3px;max-width:200px;margin:3px auto 0;">AI spec generation, auto-heal, deep scan, unlimited scans.</div>' +
          '<div style="font-size:16px;font-weight:800;color:var(--green);margin-top:8px;">$49<span style="font-size:10px;font-weight:400;color:var(--tx-4);">/mo</span></div>' +
          '<button class="btn btn-primary" data-cmd="openDashboard" style="margin-top:8px;font-size:11px;padding:7px 18px;">Upgrade to Pro</button>' +
        '</div>';
      }

      return o;
    }

    /* ===== BIND ===== */
    function bind() {
      document.querySelectorAll('[data-tab]').forEach(function(el) {
        el.onclick = function() {
          S.tab = el.dataset.tab;
          if (S.tab==='status') S.newResults = false;
          draw();
        };
      });
      document.querySelectorAll('[data-cmd]').forEach(function(el) {
        el.onclick = function(e) { e.stopPropagation(); vsc.postMessage({ command:el.dataset.cmd }); };
      });
      document.querySelectorAll('[data-fp-toggle]').forEach(function(el) {
        el.onclick = function(e) {
          e.stopPropagation();
          var id = el.dataset.fpToggle;
          S.expandedAction = S.expandedAction===id ? null : id;
          draw();
        };
      });
      document.querySelectorAll('[data-file]').forEach(function(el) {
        if (el.dataset.fileToggle !== undefined) return;
        el.onclick = function() {
          vsc.postMessage({ command:'openFile', file:el.dataset.file, line:parseInt(el.dataset.line||'1') });
        };
      });
      document.querySelectorAll('[data-file-toggle]').forEach(function(el) {
        el.onclick = function() {
          var idx = parseInt(el.dataset.fileToggle);
          S.expandedFile = S.expandedFile===idx ? -1 : idx;
          draw();
        };
      });
      document.querySelectorAll('[data-sev]').forEach(function(el) {
        el.onclick = function() { S.sevFilter = el.dataset.sev; draw(); };
      });
      document.querySelectorAll('[data-group]').forEach(function(el) {
        el.onclick = function() {
          var gk = el.dataset.group;
          S.collapsedGroups[gk] = !S.collapsedGroups[gk];
          draw();
        };
      });
      document.querySelectorAll('[data-rview]').forEach(function(el) {
        el.onclick = function() { S.resultsView = el.dataset.rview; draw(); };
      });
      document.querySelectorAll('[data-sort]').forEach(function(el) {
        el.onclick = function() { S.fileSort = el.dataset.sort; draw(); };
      });
      document.querySelectorAll('[data-filt]').forEach(function(el) {
        el.onclick = function() { S.fileFilter = el.dataset.filt; draw(); };
      });
      var goBtn = document.getElementById('btn-go');
      if (goBtn && !S.scanning) goBtn.onclick = function() { vsc.postMessage({ command:'verify' }); };
      var rl = document.getElementById('link-results');
      if (rl) rl.onclick = function(e) { e.preventDefault(); S.tab='results'; S.resultsView='findings'; draw(); };
      var fs = document.getElementById('file-search');
      if (fs) fs.oninput = function(e) { S.fileQ = e.target.value.toLowerCase(); draw(); };
      var oaf = document.getElementById('open-all-fail');
      if (oaf) oaf.onclick = function() { vsc.postMessage({ command:'openAllFailing' }); };
    }

    draw();
  })();
  </script>
</body>
</html>`;
}
