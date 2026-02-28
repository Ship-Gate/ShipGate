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
    @keyframes slideUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
    @keyframes ringDraw { from{stroke-dashoffset:var(--ring-circ)} to{stroke-dashoffset:var(--ring-offset)} }
    @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
    @keyframes glowPulse { 0%,100%{opacity:.25} 50%{opacity:.45} }

    :root {
      --bg-base: #08080c;
      --bg-raised: #0f0f15;
      --bg-surface: #16161f;
      --bg-hover: #1c1c28;
      --bg-active: #222230;
      --border-dim: rgba(255,255,255,.04);
      --border-default: rgba(255,255,255,.07);
      --border-bright: rgba(255,255,255,.12);
      --text-primary: #eeeef2;
      --text-secondary: #a0a0b8;
      --text-tertiary: #6a6a80;
      --text-ghost: #44445a;
      --green: #00dc82;
      --green-dim: rgba(0,220,130,.06);
      --green-mid: rgba(0,220,130,.12);
      --green-glow: rgba(0,220,130,.35);
      --amber: #f5a623;
      --amber-dim: rgba(245,166,35,.06);
      --amber-mid: rgba(245,166,35,.12);
      --amber-glow: rgba(245,166,35,.35);
      --red: #ef4444;
      --red-dim: rgba(239,68,68,.06);
      --red-mid: rgba(239,68,68,.12);
      --red-glow: rgba(239,68,68,.35);
      --indigo: #818cf8;
      --indigo-dim: rgba(129,140,248,.06);
      --indigo-mid: rgba(129,140,248,.12);
      --cyan: #22d3ee;
      --cyan-dim: rgba(34,211,238,.06);
      --radius-sm: 4px;
      --radius-md: 8px;
      --radius-lg: 12px;
      --ease: cubic-bezier(.16,1,.3,1);
    }

    * { margin:0; padding:0; box-sizing:border-box; }

    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
      background: var(--bg-base);
      color: var(--text-secondary);
      font-size: 12px;
      line-height: 1.5;
      overflow-x: hidden;
    }

    .mono { font-family: var(--vscode-editor-font-family, 'SF Mono', Consolas, 'Courier New', monospace); }
    #root { display:flex; flex-direction:column; height:100vh; }

    /* ---- HEADER ---- */
    .hdr {
      position: sticky; top: 0; z-index: 100;
      background: var(--bg-base);
      border-bottom: 1px solid var(--border-dim);
      backdrop-filter: blur(12px);
    }
    .hdr-bar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px 8px;
    }
    .hdr-brand { display:flex; align-items:center; gap:9px; }
    .hdr-logo {
      width: 26px; height: 26px; border-radius: 6px;
      background: linear-gradient(135deg, var(--green), var(--indigo));
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 800; color: #000; letter-spacing: -1px;
    }
    .hdr-title { font-size:13px; font-weight:700; color:var(--text-primary); letter-spacing:-.3px; }
    .hdr-sub { font-size:10px; color:var(--text-ghost); margin-top:1px; }
    .hdr-btns { display:flex; gap:4px; }
    .ib {
      width:26px; height:26px; border-radius:var(--radius-sm);
      background: var(--bg-surface); border:1px solid var(--border-dim);
      display:flex; align-items:center; justify-content:center;
      cursor:pointer; color:var(--text-tertiary); font-size:12px;
      transition: all 80ms var(--ease);
    }
    .ib:hover { background:var(--bg-hover); border-color:var(--border-bright); color:var(--text-primary); }

    /* ---- TABS ---- */
    .tabs {
      display:flex; gap:0; padding:0 10px;
      border-bottom: 1px solid var(--border-dim);
    }
    .tab {
      padding: 7px 12px; font-size:11px; font-weight:500;
      color: var(--text-ghost); cursor:pointer;
      border-bottom: 2px solid transparent;
      transition: color 120ms, border-color 120ms;
      white-space: nowrap;
    }
    .tab:hover { color:var(--text-tertiary); }
    .tab.on { color:var(--text-primary); border-bottom-color:var(--green); }

    /* ---- SCROLL CONTENT ---- */
    .body { flex:1; overflow-y:auto; padding:14px; }
    .body::-webkit-scrollbar { width:4px; }
    .body::-webkit-scrollbar-thumb { background:var(--border-default); border-radius:2px; }
    .sect { margin-bottom:14px; animation: slideUp 140ms var(--ease) both; }
    .sect-lbl {
      font-size:9px; font-weight:700; text-transform:uppercase;
      letter-spacing:.06em; color:var(--text-ghost); margin-bottom:6px;
    }

    /* ---- CARD ---- */
    .c {
      background: var(--bg-raised);
      border: 1px solid var(--border-dim);
      border-radius: var(--radius-md);
      padding: 12px 14px;
      transition: border-color 100ms, background 100ms;
    }
    .c:hover { border-color:var(--border-default); }
    .c+.c { margin-top:6px; }

    /* ---- VERDICT CARD ---- */
    .vc {
      position:relative; overflow:hidden;
      padding: 16px 14px;
    }
    .vc.ship { background:var(--green-dim); border-color:var(--green-mid); }
    .vc.warn { background:var(--amber-dim); border-color:var(--amber-mid); }
    .vc.noship { background:var(--red-dim); border-color:var(--red-mid); }
    .vc-row { display:flex; align-items:center; gap:14px; position:relative; z-index:1; }
    .vc-ring { position:relative; flex-shrink:0; width:56px; height:56px; }
    .vc-score {
      position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
      font-size:17px; font-weight:800; letter-spacing:-1px;
    }
    .vc h2 { font-size:22px; font-weight:800; letter-spacing:-.5px; }
    .vc p { font-size:11px; color:var(--text-secondary); margin-top:2px; }
    .vc-glow {
      position:absolute; top:-24px; right:-24px;
      width:80px; height:80px; border-radius:50%;
      filter:blur(32px); pointer-events:none;
      animation: glowPulse 4s ease infinite;
    }

    /* ---- STATS GRID ---- */
    .sg { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
    .sc {
      background:var(--bg-raised); border:1px solid var(--border-dim);
      border-radius: var(--radius-md); padding:10px 12px;
    }
    .sc-lbl { font-size:9px; color:var(--text-ghost); text-transform:uppercase; letter-spacing:.04em; margin-bottom:4px; }
    .sc-val { font-size:18px; font-weight:800; color:var(--text-primary); letter-spacing:-1px; }

    /* ---- BADGE ---- */
    .b {
      display:inline-flex; align-items:center; padding:1px 7px;
      border-radius:3px; font-size:9px; font-weight:700;
      text-transform:uppercase; letter-spacing:.02em;
    }
    .b.ship { background:var(--green-dim); color:var(--green); border:1px solid var(--green-mid); }
    .b.warn { background:var(--amber-dim); color:var(--amber); border:1px solid var(--amber-mid); }
    .b.noship { background:var(--red-dim); color:var(--red); border:1px solid var(--red-mid); }
    .b.info { background:var(--indigo-dim); color:var(--indigo); border:1px solid var(--indigo-mid); }
    .b.muted { background:var(--bg-surface); color:var(--text-ghost); border:1px solid var(--border-dim); }

    /* ---- DOT ---- */
    .dot { width:7px; height:7px; border-radius:50%; display:inline-block; flex-shrink:0; }
    .dot.green { background:var(--green); }
    .dot.amber { background:var(--amber); }
    .dot.red { background:var(--red); }
    .dot.cyan { background:var(--cyan); }
    .dot.dim { background:var(--text-ghost); }
    .dot.pulse { animation:pulse 2s infinite; }

    /* ---- BUTTON ---- */
    .btn {
      display:inline-flex; align-items:center; justify-content:center; gap:5px;
      padding:7px 14px; border-radius:var(--radius-sm);
      font-size:11px; font-weight:600; cursor:pointer;
      transition: all 80ms var(--ease); border:none;
    }
    .btn-go {
      background: var(--green); color:#000;
      box-shadow: 0 0 12px var(--green-glow), inset 0 1px 0 rgba(255,255,255,.15);
    }
    .btn-go:hover { filter:brightness(1.12); transform:scale(1.01); }
    .btn-sec {
      background:var(--bg-surface); color:var(--text-primary);
      border:1px solid var(--border-default);
    }
    .btn-sec:hover { background:var(--bg-hover); border-color:var(--border-bright); }
    .btn-heal {
      background:var(--amber-dim); color:var(--amber);
      border:1px solid var(--amber-mid);
    }
    .btn-heal:hover { background:var(--amber-mid); }
    .btn-sm { padding:3px 8px; font-size:9px; }

    /* ---- ACTION ROW ---- */
    .ar {
      display:flex; align-items:center; gap:10px;
      padding:9px 10px; border-radius:var(--radius-md);
      border:1px solid var(--border-dim); background:var(--bg-raised);
      cursor:pointer; transition: border-color 80ms, background 80ms;
      margin-bottom:4px;
    }
    .ar:hover { border-color:var(--border-bright); background:var(--bg-hover); }
    .ar:active { background:var(--bg-active); }
    .ar-icon { font-size:14px; width:22px; text-align:center; flex-shrink:0; }
    .ar-body { flex:1; min-width:0; }
    .ar-label { font-size:12px; font-weight:500; color:var(--text-primary); }
    .ar-desc { font-size:10px; color:var(--text-ghost); margin-top:1px; }
    .ar-right { font-size:13px; color:var(--text-ghost); flex-shrink:0; }
    .ar-kbd {
      font-size:9px; color:var(--text-ghost); background:var(--bg-base);
      border:1px solid var(--border-dim); border-radius:3px; padding:1px 5px;
      flex-shrink:0;
    }

    /* ---- PROGRESS BAR ---- */
    .pb { width:100%; height:3px; background:var(--bg-active); border-radius:2px; overflow:hidden; }
    .pb-fill { height:100%; transition: width .8s var(--ease); border-radius:2px; }

    /* ---- INPUT ---- */
    input[type="text"] {
      width:100%; padding:7px 10px; background:var(--bg-surface);
      border:1px solid var(--border-dim); border-radius:var(--radius-sm);
      color:var(--text-primary); font-size:12px; font-family:inherit;
    }
    input[type="text"]:focus { outline:none; border-color:var(--border-bright); }
    input[type="text"]::placeholder { color:var(--text-ghost); }

    /* ---- FOOTER ---- */
    .ftr {
      position:sticky; bottom:0; background:var(--bg-base);
      border-top:1px solid var(--border-dim);
      padding:10px 14px; display:flex; align-items:center; justify-content:space-between;
    }
    .ftr-status { display:flex; align-items:center; gap:6px; font-size:10px; color:var(--text-ghost); }

    /* ---- EMPTY STATE ---- */
    .empty { text-align:center; padding:48px 18px; }
    .empty h2 { font-size:16px; font-weight:700; color:var(--text-primary); margin-bottom:6px; }
    .empty p { font-size:12px; color:var(--text-tertiary); margin-bottom:16px; line-height:1.6; }

    /* ---- CLAIM ---- */
    .claim-detail { max-height:0; overflow:hidden; transition:max-height 200ms ease; }
    .claim-detail.show { max-height:200px; }

    /* ---- GEN GRID ---- */
    .gen-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:4px; }
    .gen-grid .btn { font-size:10px; padding:7px 4px; }

    /* ---- UTILITY ---- */
    .fade { animation: slideUp 140ms var(--ease) both; }
    .trunc { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .gap-6 > *+* { margin-top:6px; }
    .gap-4 > *+* { margin-top:4px; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
  (function(){
    var vsc = acquireVsCodeApi();
    var S = {
      tab: 'overview',
      data: null,
      scanning: false,
      err: null,
      expandClaim: -1,
      fileSort: 'verdict',
      fileQ: '',
      sevFilter: { critical:true, high:true, medium:true, low:true },
    };

    window.addEventListener('message', function(e){
      var m = e.data;
      if (m.type === 'results') { S.data = m.data; S.scanning = false; S.err = null; }
      if (m.type === 'scanning') { S.scanning = true; }
      if (m.type === 'error') { S.scanning = false; S.err = m.message; }
      draw();
    });

    function vc(v) {
      if (v==='SHIP'||v==='PASS'||v==='pass') return 'var(--green)';
      if (v==='WARN'||v==='pending') return 'var(--amber)';
      if (v==='NO_SHIP'||v==='FAIL'||v==='fail') return 'var(--red)';
      if (v==='running') return 'var(--cyan)';
      return 'var(--text-ghost)';
    }
    function vb(v) {
      if (v==='SHIP'||v==='PASS') return 'ship';
      if (v==='WARN') return 'warn';
      if (v==='NO_SHIP'||v==='FAIL') return 'noship';
      return 'muted';
    }
    function sc(s) {
      if (s==='critical') return 'var(--red)';
      if (s==='high') return 'var(--amber)';
      if (s==='medium') return 'var(--amber)';
      return 'var(--text-ghost)';
    }

    function ring(val, sz, col) {
      var r = (sz-6)/2, circ = 2*Math.PI*r;
      var off = circ - (val/100)*circ;
      return '<svg width="'+sz+'" height="'+sz+'" style="transform:rotate(-90deg);display:block;">' +
        '<circle cx="'+sz/2+'" cy="'+sz/2+'" r="'+r+'" fill="none" stroke="var(--bg-active)" stroke-width="4"/>' +
        '<circle cx="'+sz/2+'" cy="'+sz/2+'" r="'+r+'" fill="none" stroke="'+col+'" stroke-width="4" ' +
        'stroke-dasharray="'+circ+'" stroke-dashoffset="'+off+'" stroke-linecap="round" ' +
        'style="--ring-circ:'+circ+';--ring-offset:'+off+';animation:ringDraw .8s var(--ease) both;"/>' +
        '</svg>';
    }

    function draw() {
      document.getElementById('root').innerHTML = hdr() + content() + ftr();
      bind();
    }

    function hdr() {
      var d = S.data || {};
      var name = d.projectName || 'workspace';
      var branch = d.branch || 'main';
      return '<div class="hdr">' +
        '<div class="hdr-bar">' +
          '<div class="hdr-brand">' +
            '<div class="hdr-logo">SG</div>' +
            '<div><div class="hdr-title">ShipGate</div><div class="hdr-sub">' + name + ' / ' + branch + '</div></div>' +
          '</div>' +
          '<div class="hdr-btns">' +
            '<button class="ib" data-cmd="verify" title="Re-scan">&#x21bb;</button>' +
            '<button class="ib" data-cmd="openSettings" title="Settings">&#x2699;</button>' +
          '</div>' +
        '</div>' +
        '<div class="tabs">' +
          tab('overview','Overview') + tab('actions','Actions') + tab('findings','Findings') + tab('files','Files') +
        '</div>' +
      '</div>';
    }
    function tab(id,label) {
      return '<div class="tab'+(S.tab===id?' on':'')+'" data-tab="'+id+'">'+label+'</div>';
    }

    function content() {
      if (S.scanning) return '<div class="body fade">' + scanningView() + '</div>';
      if (S.err && S.tab !== 'actions') return '<div class="body fade">' + errorView() + '</div>';
      var c = '';
      if (S.tab==='overview') c = S.data ? overviewView() : emptyView();
      else if (S.tab==='actions') c = actionsView();
      else if (S.tab==='findings') c = S.data ? findingsView() : noDataView('Findings', 'Run a scan to see verification findings');
      else if (S.tab==='files') c = S.data ? filesView() : noDataView('Files', 'Run a scan to see per-file results');
      return '<div class="body fade">' + c + '</div>';
    }

    function ftr() {
      var txt = S.scanning ? 'Scanning...' : (S.data ? 'Last scan: '+timeSince(S.data.timestamp) : 'Ready');
      var dot = S.scanning ? 'cyan pulse' : (S.data ? 'green' : 'dim');
      return '<div class="ftr">' +
        '<div class="ftr-status"><span class="dot '+dot+'"></span><span>'+txt+'</span></div>' +
        '<button class="btn btn-go" id="btn-go">'+(S.scanning?'...':'&#9654; Verify')+'</button>' +
      '</div>';
    }

    function timeSince(ts) {
      if (!ts) return 'never';
      var s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
      if (s < 5) return 'just now';
      if (s < 60) return s + 's ago';
      if (s < 3600) return Math.floor(s/60) + 'm ago';
      return Math.floor(s/3600) + 'h ago';
    }

    /* ---- EMPTY ---- */
    function emptyView() {
      return '<div class="empty">' +
        '<div class="hdr-logo" style="width:40px;height:40px;font-size:18px;margin:0 auto 16px;border-radius:10px;">SG</div>' +
        '<h2>ShipGate</h2>' +
        '<p>Behavioral verification for AI-generated code.<br>Scan, verify, and ship with confidence.</p>' +
        '<div style="text-align:left;max-width:220px;margin:0 auto 18px;" class="gap-6">' +
          step(1,'Initialize','Detect project & generate ISL specs') +
          step(2,'Verify','Check code against behavioral contracts') +
          step(3,'Ship','SHIP / NO_SHIP verdict with evidence') +
        '</div>' +
        '<button class="btn btn-go" data-cmd="goCommand" style="font-size:12px;padding:9px 20px;">&#9654; shipgate go</button>' +
        '<div style="margin-top:10px;font-size:10px;color:var(--text-ghost);"><kbd class="ar-kbd">&#8984;&#8679;&#8629;</kbd></div>' +
      '</div>';
    }
    function step(n,title,desc) {
      return '<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:8px;">' +
        '<span style="width:18px;height:18px;border-radius:50%;background:var(--indigo-dim);border:1px solid var(--indigo-mid);color:var(--indigo);font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">'+n+'</span>' +
        '<span style="font-size:11px;color:var(--text-secondary);line-height:1.4;"><strong style="color:var(--text-primary);">'+title+'</strong> &mdash; '+desc+'</span>' +
      '</div>';
    }

    function scanningView() {
      return '<div class="empty">' +
        '<div style="width:28px;height:28px;border:3px solid var(--border-default);border-top-color:var(--green);border-radius:50%;animation:spin .7s linear infinite;margin:0 auto 18px;"></div>' +
        '<h2>Verifying</h2>' +
        '<p>Scanning files against behavioral contracts</p>' +
        '<div class="pb" style="width:180px;margin:0 auto;"><div class="pb-fill" style="width:65%;background:var(--green);animation:shimmer 1.5s infinite;background-size:200% 100%;background-image:linear-gradient(90deg,var(--green) 25%,var(--green-glow) 50%,var(--green) 75%);"></div></div>' +
      '</div>';
    }

    function errorView() {
      return '<div class="empty">' +
        '<h2 style="color:var(--red);">Scan Error</h2>' +
        '<p style="color:var(--red);">'+(S.err||'Unknown error')+'</p>' +
        '<button class="btn btn-sec" data-cmd="verify">Retry</button>' +
      '</div>';
    }

    function noDataView(title, desc) {
      return '<div class="empty">' +
        '<div style="font-size:22px;margin-bottom:10px;opacity:.35;">&#9638;</div>' +
        '<h2>' + title + '</h2>' +
        '<p>' + desc + '</p>' +
        '<button class="btn btn-go" data-cmd="verify" style="margin-top:14px;font-size:11px;padding:8px 18px;">&#9654; Run Scan</button>' +
      '</div>';
    }

    /* ---- OVERVIEW ---- */
    function overviewView() {
      var d = S.data, v = d.verdict||'UNKNOWN', sc = d.score||0;
      var cls = v==='SHIP'?'ship':v==='WARN'?'warn':'noship';
      var col = vc(v);
      var files = d.files||[];
      var total = files.length;
      var pass = files.filter(function(f){return f.status==='PASS'}).length;
      var fail = files.filter(function(f){return f.status==='FAIL'}).length;
      var warns = files.filter(function(f){return f.status==='WARN'}).length;
      var issues = files.reduce(function(s,f){return s+(f.blockers?f.blockers.length:0)+(f.errors?f.errors.length:0)},0);
      var covPct = d.coverage&&d.coverage.total ? Math.round((d.coverage.specced/d.coverage.total)*100) : 0;
      var dur = d.duration ? (d.duration < 1000 ? d.duration+'ms' : (d.duration/1000).toFixed(1)+'s') : '--';

      var o = '';

      // Verdict card
      o += '<div class="sect">' +
        '<div class="c vc '+cls+'">' +
          '<div class="vc-row">' +
            '<div class="vc-ring">' + ring(sc,56,col) +
              '<div class="vc-score mono" style="color:'+col+';">'+sc+'</div>' +
            '</div>' +
            '<div>' +
              '<h2 style="color:'+col+';">'+v+'</h2>' +
              '<p>'+pass+' passed &middot; '+fail+' failed &middot; '+warns+' warnings</p>' +
            '</div>' +
          '</div>' +
          '<div class="vc-glow" style="background:'+col+';"></div>' +
        '</div>' +
      '</div>';

      // Stats
      o += '<div class="sect"><div class="sg">' +
        statCard('Pass Rate', pass+'/'+total) +
        statCard('Coverage', covPct+'%') +
        statCard('Files', total.toString()) +
        statCard('Issues', issues.toString()) +
      '</div></div>';

      // Duration
      o += '<div class="sect"><div class="c" style="padding:8px 12px;display:flex;align-items:center;justify-content:space-between;">' +
        '<span style="font-size:10px;color:var(--text-ghost);text-transform:uppercase;letter-spacing:.04em;">Duration</span>' +
        '<span class="mono" style="font-size:13px;font-weight:700;color:var(--text-primary);">'+dur+'</span>' +
      '</div></div>';

      // Findings preview
      if (issues > 0) {
        o += '<div class="sect"><div class="sect-lbl">Top Issues</div>';
        var shown = 0;
        for (var i=0;i<files.length&&shown<3;i++) {
          var f = files[i];
          var all = (f.blockers||[]).concat(f.errors||[]);
          for (var j=0;j<all.length&&shown<3;j++) {
            var dotCls = f.status==='FAIL'?'red':'amber';
            o += '<div class="c" style="padding:8px 10px;cursor:pointer;margin-bottom:4px;" data-file="'+f.file+'" data-line="1">' +
              '<div style="display:flex;gap:8px;align-items:flex-start;">' +
                '<span class="dot '+dotCls+'" style="margin-top:3px;"></span>' +
                '<div style="flex:1;min-width:0;">' +
                  '<div style="font-size:11px;color:var(--text-secondary);line-height:1.3;" class="trunc">'+esc(all[j])+'</div>' +
                  '<div class="mono" style="font-size:9px;color:var(--text-ghost);margin-top:2px;">'+f.file+'</div>' +
                '</div>' +
              '</div>' +
            '</div>';
            shown++;
          }
        }
        o += '<div style="text-align:center;margin-top:6px;"><a href="#" style="font-size:10px;color:var(--indigo);text-decoration:none;" id="link-findings">View all '+issues+' findings &#8594;</a></div></div>';
      }

      // Quick actions
      o += '<div class="sect"><div class="sect-lbl">Quick Actions</div>' +
        '<div style="display:flex;gap:6px;">' +
          '<button class="btn btn-sec" data-cmd="verify" style="flex:1;font-size:10px;">&#9654; Re-scan</button>' +
          (issues>0 ? '<button class="btn btn-heal" data-cmd="autofixAll" style="flex:1;font-size:10px;">&#9889; Heal All</button>' : '') +
          '<button class="btn btn-sec" data-cmd="viewProofBundle" style="flex:1;font-size:10px;">&#9638; Proof</button>' +
        '</div></div>';

      return o;
    }

    function statCard(lbl,val) {
      return '<div class="sc"><div class="sc-lbl">'+lbl+'</div><div class="sc-val mono">'+val+'</div></div>';
    }

    /* ---- ACTIONS ---- */
    function actionsView() {
      var o = '';

      // Hero
      o += '<div style="background:linear-gradient(145deg,var(--green-dim),var(--indigo-dim));border:1px solid var(--green-mid);border-radius:var(--radius-lg);padding:20px 16px;text-align:center;margin-bottom:14px;position:relative;overflow:hidden;">' +
        '<div class="hdr-logo" style="width:36px;height:36px;font-size:16px;margin:0 auto 10px;border-radius:8px;">SG</div>' +
        '<div style="font-size:15px;font-weight:800;color:var(--text-primary);letter-spacing:-.3px;">Ship with confidence</div>' +
        '<div style="font-size:11px;color:var(--text-tertiary);margin:4px 0 14px;max-width:200px;margin-left:auto;margin-right:auto;">Scan, infer specs, verify, and gate&mdash;one command.</div>' +
        '<button class="btn btn-go" data-cmd="goCommand" style="font-size:12px;padding:8px 22px;">&#9654; shipgate go</button>' +
        '<div style="margin-top:8px;"><kbd class="ar-kbd">&#8984;&#8679;&#8629;</kbd></div>' +
      '</div>';

      var groups = [
        { label: 'Workflows', items: [
          { icon:'\u2726', label:'Vibe &rarr; Ship', desc:'English &rarr; ISL &rarr; verified code', cmd:'vibeGenerate', col:'var(--indigo)', kbd:'\u2318\u21e7V' },
          { icon:'\u26a1', label:'Go + Auto-Heal', desc:'Scan then auto-fix violations', cmd:'goFix', col:'var(--green)' },
          { icon:'\u25ce', label:'Deep Scan', desc:'Thorough analysis, higher coverage', cmd:'goDeep', col:'var(--cyan)' },
        ]},
        { label: 'Analyze', items: [
          { icon:'\u25b6', label:'Quick Scan', desc:'Scan & gate verdict', cmd:'scanProject', col:'var(--cyan)' },
          { icon:'\u25c8', label:'Infer ISL Specs', desc:'AI-generate specs from code', cmd:'inferSpecs', col:'var(--indigo)' },
          { icon:'\u26a1', label:'Heal All', desc:'Auto-fix across project', cmd:'autofixAll', col:'var(--amber)' },
        ]},
        { label: 'Verification', items: [
          { icon:'\u25b6', label:'Verify Workspace', desc:'Full scan of all files', cmd:'verify', col:'var(--green)' },
          { icon:'\u25b6', label:'Verify Current File', desc:'Scan the active editor', cmd:'verifyFile', col:'var(--green)' },
          { icon:'\u2691', label:'Ship Check', desc:'CI gate \u2014 SHIP or block', cmd:'ship', col:'var(--indigo)' },
        ]},
        { label: 'Spec Tools', items: [
          { icon:'\u270e', label:'Code &rarr; ISL', desc:'Generate spec from current file', cmd:'codeToIsl', col:'var(--cyan)' },
          { icon:'\u270e', label:'Generate ISL Spec', desc:'Scaffold spec from source', cmd:'genSpec', col:'var(--indigo)' },
          { icon:'\u21bb', label:'Format & Lint', desc:'Auto-format all .isl files', cmd:'fmtSpecs', col:'var(--green)' },
        ]},
        { label: 'Reports', items: [
          { icon:'\u25ce', label:'Trust Score', desc:'Detailed trust breakdown', cmd:'trustScore', col:'var(--green)' },
          { icon:'\u25c8', label:'Coverage Report', desc:'Spec coverage % per file', cmd:'coverage', col:'var(--cyan)' },
          { icon:'\u26a0', label:'Security Report', desc:'Secrets, auth, injection scan', cmd:'securityReport', col:'var(--red)' },
          { icon:'\ud83d\udee1', label:'SOC 2 Audit', desc:'Full compliance check', cmd:'compliance', col:'var(--green)' },
        ]},
      ];

      for (var g=0; g<groups.length; g++) {
        o += '<div class="sect"><div class="sect-lbl">'+groups[g].label+'</div>';
        for (var i=0; i<groups[g].items.length; i++) {
          var it = groups[g].items[i];
          o += '<div class="ar" data-cmd="'+it.cmd+'">' +
            '<div class="ar-icon" style="color:'+it.col+';">'+it.icon+'</div>' +
            '<div class="ar-body"><div class="ar-label">'+it.label+'</div><div class="ar-desc">'+it.desc+'</div></div>' +
            (it.kbd ? '<div class="ar-kbd">'+it.kbd+'</div>' : '<div class="ar-right">&rsaquo;</div>') +
          '</div>';
        }
        o += '</div>';
      }

      // Gen grid
      o += '<div class="sect"><div class="sect-lbl">Generate from ISL</div><div class="gen-grid">' +
        '<button class="btn btn-sec" data-cmd="genTypescript">TS</button>' +
        '<button class="btn btn-sec" data-cmd="genPython">Python</button>' +
        '<button class="btn btn-sec" data-cmd="genRust">Rust</button>' +
        '<button class="btn btn-sec" data-cmd="genGo">Go</button>' +
        '<button class="btn btn-sec" data-cmd="genGraphql">GQL</button>' +
        '<button class="btn btn-sec" data-cmd="genOpenapi">OpenAPI</button>' +
      '</div></div>';

      return o;
    }

    /* ---- FINDINGS ---- */
    function findingsView() {
      var d = S.data||{};
      var findings = [];
      if (d.files) {
        d.files.forEach(function(f) {
          if (f.blockers) f.blockers.forEach(function(msg) {
            findings.push({ sev: f.status==='FAIL'?'high':'medium', msg:msg, file:f.file, line:1, eng:f.mode||'shipgate', fix:false });
          });
          if (f.errors) f.errors.forEach(function(msg) {
            findings.push({ sev:'critical', msg:msg, file:f.file, line:1, eng:f.mode||'shipgate', fix:false });
          });
        });
      }

      var o = '<div class="sect">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">' +
          '<div style="display:flex;align-items:center;gap:6px;">' +
            '<span style="font-size:11px;font-weight:600;color:var(--text-primary);">Findings</span>' +
            '<span class="b noship">'+findings.length+'</span>' +
          '</div>' +
          (findings.length>0 ? '<button class="btn btn-heal btn-sm" data-cmd="autofixAll">&#9889; Heal</button>' : '') +
        '</div>';

      if (findings.length === 0) {
        o += '<div class="c" style="text-align:center;padding:28px 14px;">' +
          '<div style="font-size:20px;margin-bottom:8px;">&#10003;</div>' +
          '<div style="font-size:13px;font-weight:600;color:var(--green);">No issues found</div>' +
          '<div style="font-size:11px;color:var(--text-ghost);margin-top:4px;">All files pass verification</div>' +
        '</div>';
      } else {
        for (var i=0; i<findings.length; i++) {
          var f = findings[i];
          var dotCol = f.sev==='critical'?'red':f.sev==='high'?'amber':'amber';
          var glowStyle = f.sev==='critical'?'box-shadow:0 0 5px var(--red-glow);':'';
          o += '<div class="c" style="padding:9px 10px;cursor:pointer;margin-bottom:5px;" data-file="'+f.file+'" data-line="'+f.line+'">' +
            '<div style="display:flex;gap:8px;align-items:flex-start;">' +
              '<span class="dot '+dotCol+'" style="margin-top:3px;'+glowStyle+'"></span>' +
              '<div style="flex:1;min-width:0;">' +
                '<div style="font-size:11px;color:var(--text-secondary);line-height:1.35;">'+esc(f.msg)+'</div>' +
                '<div style="display:flex;gap:6px;align-items:center;margin-top:3px;">' +
                  '<span class="mono" style="font-size:9px;color:var(--text-ghost);">'+f.file+':'+f.line+'</span>' +
                  '<span style="font-size:9px;color:var(--text-ghost);">&middot;</span>' +
                  '<span style="font-size:9px;color:var(--text-ghost);">'+f.eng+'</span>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>';
        }
      }
      o += '</div>';
      return o;
    }

    /* ---- FILES ---- */
    function filesView() {
      var d = S.data||{};
      var files = (d.files||[]).map(function(f) {
        return {
          name: f.file,
          verdict: f.status==='PASS'?'SHIP':f.status==='FAIL'?'NO_SHIP':'WARN',
          score: f.score||0,
          issues: (f.blockers?f.blockers.length:0)+(f.errors?f.errors.length:0)
        };
      });

      // Sort
      if (S.fileSort==='name') files.sort(function(a,b){return a.name.localeCompare(b.name)});
      else if (S.fileSort==='score') files.sort(function(a,b){return a.score-b.score});
      else files.sort(function(a,b){
        var order = {NO_SHIP:0,WARN:1,SHIP:2};
        return (order[a.verdict]||0) - (order[b.verdict]||0);
      });

      // Filter
      if (S.fileQ) files = files.filter(function(f){return f.name.toLowerCase().indexOf(S.fileQ)!==-1});

      var o = '<div class="sect">' +
        '<input type="text" id="file-search" placeholder="Filter files..." style="margin-bottom:8px;" value="'+S.fileQ+'">' +
        '<div style="display:flex;gap:4px;margin-bottom:10px;">' +
          sortBtn('verdict','Verdict') + sortBtn('name','Name') + sortBtn('score','Score') +
        '</div>';

      if (files.length===0) {
        o += '<div style="text-align:center;padding:20px;font-size:11px;color:var(--text-ghost);">No files match</div>';
      } else {
        for (var i=0; i<files.length; i++) {
          var f = files[i];
          var badge = vb(f.verdict);
          var issueBadge = f.issues>0 ? '<span style="min-width:16px;height:16px;border-radius:50%;background:var(--red);color:#fff;font-size:8px;display:flex;align-items:center;justify-content:center;font-weight:700;">'+f.issues+'</span>' : '';
          o += '<div class="c" style="padding:8px 10px;cursor:pointer;margin-bottom:4px;" data-file="'+f.name+'">' +
            '<div style="display:flex;align-items:center;gap:8px;">' +
              '<span class="b '+badge+'" style="font-size:8px;padding:1px 5px;">'+f.verdict+'</span>' +
              '<span class="mono trunc" style="flex:1;font-size:11px;color:var(--text-secondary);">'+f.name+'</span>' +
              issueBadge +
              '<span class="mono" style="font-size:10px;color:var(--text-ghost);">'+f.score+'</span>' +
            '</div>' +
          '</div>';
        }
      }
      o += '</div>';
      return o;
    }

    function sortBtn(key,label) {
      var cls = S.fileSort===key ? 'b info' : 'b muted';
      return '<span class="'+cls+'" style="cursor:pointer;padding:3px 8px;" data-sort="'+key+'">'+label+'</span>';
    }

    function esc(s) {
      return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    /* ---- EVENT BINDING ---- */
    function bind() {
      // Tabs
      document.querySelectorAll('[data-tab]').forEach(function(el) {
        el.onclick = function() { S.tab = el.dataset.tab; draw(); };
      });
      // Commands
      document.querySelectorAll('[data-cmd]').forEach(function(el) {
        el.onclick = function(e) {
          e.stopPropagation();
          vsc.postMessage({ command: el.dataset.cmd });
        };
      });
      // File clicks
      document.querySelectorAll('[data-file]').forEach(function(el) {
        el.onclick = function() {
          vsc.postMessage({ command:'openFile', file:el.dataset.file, line:parseInt(el.dataset.line||'1') });
        };
      });
      // Verify button
      var goBtn = document.getElementById('btn-go');
      if (goBtn) goBtn.onclick = function() { vsc.postMessage({ command:'verify' }); };
      // Findings link
      var fl = document.getElementById('link-findings');
      if (fl) fl.onclick = function(e) { e.preventDefault(); S.tab='findings'; draw(); };
      // File search
      var fs = document.getElementById('file-search');
      if (fs) fs.oninput = function(e) { S.fileQ = e.target.value.toLowerCase(); draw(); };
      // Sort buttons
      document.querySelectorAll('[data-sort]').forEach(function(el) {
        el.onclick = function() { S.fileSort = el.dataset.sort; draw(); };
      });
    }

    draw();
  })();
  </script>
</body>
</html>`;
}
