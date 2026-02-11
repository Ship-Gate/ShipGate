/* ============================================================================
 * Shipgate Sidebar — Webview Script
 *
 * Renders the sidebar from normalized SidebarUiState received via postMessage.
 * All user data rendered via textContent (no innerHTML with untrusted data).
 * Keyboard accessible: all interactive elements focusable, Enter/Space activate.
 * ============================================================================ */

(function () {
  // @ts-ignore
  const vscode = acquireVsCodeApi();

  // ── DOM refs ──────────────────────────────────────────────────

  const root = document.getElementById('sg-root');

  // ── Message posting helpers ───────────────────────────────────

  function post(type, payload) {
    vscode.postMessage({ type: type, payload: payload });
  }

  // ── Render ────────────────────────────────────────────────────

  function render(state) {
    if (!root || !state) return;
    root.innerHTML = '';

    // Welcome banner (idle only)
    if (state.phase === 'idle') {
      root.appendChild(buildWelcome());
    }

    // Scan section
    root.appendChild(buildScanSection(state));

    // Intent Drift
    root.appendChild(buildDriftSection(state));

    // Ship
    root.appendChild(buildShipSection(state));

    // GitHub
    root.appendChild(buildGitHubSection(state));

    // CI / Workflows
    root.appendChild(buildWorkflowsSection(state));

    // Live Firewall
    root.appendChild(buildFirewallSection(state));

    // Code to ISL
    root.appendChild(buildCodeToIslSection(state));

    // Findings preview (complete only)
    if (state.phase === 'complete' && state.findingsPreview.length > 0) {
      root.appendChild(buildFindingsPreview(state));
    }
  }

  // ── Section builders ──────────────────────────────────────────

  function buildWelcome() {
    var el = createElement('div', 'sg-welcome');
    el.textContent = 'New to Shipgate? ';
    var link = createElement('a', 'sg-link');
    link.textContent = 'Get started';
    link.setAttribute('href', '#');
    link.setAttribute('role', 'button');
    link.setAttribute('tabindex', '0');
    link.addEventListener('click', function (e) { e.preventDefault(); post('openWalkthrough'); });
    link.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); post('openWalkthrough'); } });
    el.appendChild(link);
    var rest = document.createTextNode(' — or run a scan to verify your code.');
    el.appendChild(rest);
    return el;
  }

  function buildScanSection(state) {
    var section = createSection('Scan');
    section.setAttribute('title', 'Verify workspace against ISL specs');

    // Badge
    var badge = createBadge(
      state.phase === 'running' ? 'Scanning...' : state.verdict || 'Idle',
      state.phase === 'running' ? 'checking' : verdictToClass(state.verdict)
    );
    if (state.phase === 'running') {
      var spinner = createElement('span', 'sg-spinner');
      spinner.setAttribute('aria-label', 'Running scan');
      badge.prepend(spinner);
    }
    section.appendChild(badge);

    // Summary
    var summary = createElement('div', 'sg-summary');
    if (state.phase === 'idle') {
      summary.textContent = 'Run a scan to verify your workspace.';
    } else if (state.phase === 'running') {
      summary.textContent = 'Analyzing files...';
    } else {
      var scorePart = state.score !== null ? 'Score: ' + state.score + '%' : '';
      var filePart = state.counts.total + ' files';
      var failPart = state.counts.fail > 0 ? state.counts.fail + ' failed' : '';
      summary.textContent = [scorePart, filePart, failPart].filter(Boolean).join(' | ');
    }
    section.appendChild(summary);

    // Stats (complete only)
    if (state.phase === 'complete') {
      section.appendChild(buildStats(state.counts));
    }

    // Buttons
    var runBtn = createButton('Run Scan', 'sg-btn sg-btn--primary', function () { post('runScan'); });
    runBtn.setAttribute('aria-label', 'Run verification scan');
    runBtn.setAttribute('title', 'Verify workspace against intent specs');
    if (state.phase === 'running') runBtn.disabled = true;
    section.appendChild(runBtn);

    if (state.phase === 'complete') {
      section.appendChild(createButton('Open Report', 'sg-btn', function () { post('openReport'); }));
      section.appendChild(createButton('Copy Summary', 'sg-btn', function () { post('copySummary'); }));
    }

    return section;
  }

  function buildDriftSection(state) {
    var section = createSection('Intent Drift');
    section.setAttribute('title', 'How much your code matches declared intent');
    section.style.cursor = 'pointer';
    section.addEventListener('click', function () { post('openReport'); });

    var gauge = createElement('div', 'sg-gauge');
    var inner = createElement('div', 'sg-gauge-inner');

    if (state.drift) {
      gauge.style.setProperty('--sg-gauge-pct', String(state.drift.pct));
      gauge.style.setProperty('--sg-gauge-color', state.drift.color);
      inner.textContent = state.drift.pct + '%';
    } else {
      gauge.style.setProperty('--sg-gauge-pct', '0');
      inner.textContent = '\u2014';
    }

    gauge.appendChild(inner);
    section.appendChild(gauge);

    var summary = createElement('div', 'sg-summary');
    if (state.drift) {
      summary.textContent = state.drift.pct >= 80 ? 'Code matches your spec.' : state.drift.pct >= 50 ? 'Some drift detected.' : 'Significant drift from spec.';
    } else {
      summary.textContent = 'Run a scan to measure drift.';
    }
    section.appendChild(summary);

    if (state.drift && state.drift.failedFiles.length > 0) {
      var list = createElement('div', 'sg-summary sg-mt-8');
      list.textContent = state.drift.failedFiles.map(function (f) { return f.split(/[/\\]/).pop(); }).join(', ');
      section.appendChild(list);
    }

    return section;
  }

  function buildShipSection(state) {
    var section = createSection('Ship');
    section.setAttribute('title', 'Ship verified code to GitHub');
    var summary = createElement('div', 'sg-summary');
    summary.textContent = 'Commit, push, and open a PR \u2014 gated by scan verdict.';
    section.appendChild(summary);
    section.appendChild(createButton('Ship to GitHub', 'sg-btn sg-btn--primary', function () { post('ship'); }));
    return section;
  }

  function buildGitHubSection(state) {
    var section = createSection('GitHub');
    section.setAttribute('title', 'Link repo to see PRs and workflow runs');

    var badge = createBadge(
      state.github.connected ? 'Connected' : 'Disconnected',
      state.github.connected ? 'connected' : 'disconnected'
    );
    section.appendChild(badge);

    var summary = createElement('div', 'sg-summary');
    if (state.github.connected && state.github.owner) {
      summary.textContent = state.github.owner + '/' + state.github.repo;
    } else {
      summary.textContent = state.github.error || 'Connect to view PRs and workflows.';
    }
    section.appendChild(summary);

    var btnLabel = state.github.connected ? 'Refresh' : 'Connect';
    section.appendChild(createButton(btnLabel, 'sg-btn', function () { post('githubConnect'); }));

    // PRs
    if (state.github.pulls.length > 0) {
      var prs = createElement('div', 'sg-mt-8');
      state.github.pulls.forEach(function (pr) {
        var item = createElement('div', 'sg-item');
        var link = createElement('a', 'sg-link');
        link.textContent = '#' + pr.number + ' ' + pr.title;
        link.setAttribute('href', '#');
        link.setAttribute('role', 'button');
        link.setAttribute('tabindex', '0');
        link.addEventListener('click', function (e) { e.preventDefault(); post('openPr', pr.htmlUrl); });
        link.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); post('openPr', pr.htmlUrl); } });
        item.appendChild(link);
        prs.appendChild(item);
      });
      section.appendChild(prs);
    }

    return section;
  }

  function buildWorkflowsSection(state) {
    var section = createSection('CI / Workflows');
    section.setAttribute('title', 'Workflows from .github/workflows');

    if (state.workflows.length === 0) {
      var empty = createElement('div', 'sg-summary');
      empty.textContent = 'No workflows in .github/workflows';
      section.appendChild(empty);
    } else {
      state.workflows.forEach(function (w) {
        var item = createElement('div', 'sg-item');
        item.textContent = w.name;
        section.appendChild(item);
      });
    }

    // Runs
    if (state.github.runs.length > 0) {
      var title = createElement('div', 'sg-section-title sg-mt-8');
      title.textContent = 'Recent runs';
      section.appendChild(title);
      state.github.runs.forEach(function (r) {
        var item = createElement('div', 'sg-item');
        var link = createElement('a', 'sg-link');
        link.textContent = r.name + ' (' + (r.conclusion || r.status) + ')';
        link.setAttribute('href', '#');
        link.setAttribute('role', 'button');
        link.setAttribute('tabindex', '0');
        link.addEventListener('click', function (e) { e.preventDefault(); post('openWorkflow', r.htmlUrl); });
        link.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); post('openWorkflow', r.htmlUrl); } });
        item.appendChild(link);
        section.appendChild(item);
      });
    }

    return section;
  }

  function buildFirewallSection(state) {
    var section = createSection('Live Firewall');
    section.setAttribute('title', 'Blocks ghost routes, env vars, imports on save');

    var fw = state.firewall;
    var label = fw.status === 'checking' ? '...' : fw.status === 'allowed' ? 'ALLOWED' : fw.status === 'blocked' ? 'BLOCKED' : 'Idle';
    var cls = fw.status === 'allowed' ? 'ship' : fw.status === 'blocked' ? 'noship' : fw.status === 'checking' ? 'checking' : 'idle';
    section.appendChild(createBadge(label, cls));

    var summary = createElement('div', 'sg-summary');
    if (fw.status === 'checking') {
      summary.textContent = 'Checking...';
    } else if (fw.violationCount > 0) {
      summary.textContent = fw.violationCount + ' violation(s)';
    } else if (fw.lastFile) {
      summary.textContent = 'Last: ' + fw.lastFile.split(/[/\\]/).pop();
    } else {
      summary.textContent = 'Runs on save for .ts/.js files.';
    }
    section.appendChild(summary);
    return section;
  }

  function buildCodeToIslSection(state) {
    var section = createSection('Code to ISL');
    section.setAttribute('title', 'Generate intent specs from code');
    var summary = createElement('div', 'sg-summary');
    summary.textContent = state.islGeneratePath || 'Select a file or folder.';
    section.appendChild(summary);
    section.appendChild(createButton('Generate ISL from Code', 'sg-btn sg-btn--primary', function () { post('codeToIsl'); }));
    return section;
  }

  function buildFindingsPreview(state) {
    var section = createSection('Top Issues');
    var list = createElement('div', 'sg-findings');
    state.findingsPreview.forEach(function (f) {
      var row = createElement('div', 'sg-finding');
      row.setAttribute('tabindex', '0');
      row.setAttribute('role', 'button');
      row.setAttribute('aria-label', f.status + ' ' + f.file);
      row.addEventListener('click', function () { post('openFinding', { file: f.file }); });
      row.addEventListener('keydown', function (e) { if (e.key === 'Enter') { post('openFinding', { file: f.file }); } });

      var dot = createElement('span', 'sg-dot sg-dot--' + (f.status === 'PASS' ? 'pass' : f.status === 'WARN' ? 'warn' : 'fail'));
      row.appendChild(dot);

      var body = createElement('div', 'sg-flex-1');
      var fileEl = createElement('div', 'sg-finding-file');
      fileEl.textContent = f.file;
      body.appendChild(fileEl);

      var msgs = f.blockers.concat(f.errors);
      if (msgs.length > 0) {
        var msg = createElement('div', 'sg-finding-msg');
        msg.textContent = msgs[0];
        body.appendChild(msg);
      }

      row.appendChild(body);

      var score = createElement('span', 'sg-finding-score');
      score.textContent = Math.round(f.score * 100) + '%';
      row.appendChild(score);

      list.appendChild(row);
    });
    section.appendChild(list);
    return section;
  }

  // ── Stat cards ────────────────────────────────────────────────

  function buildStats(counts) {
    var grid = createElement('div', 'sg-stats');
    grid.appendChild(buildStat(counts.total, 'Files'));
    grid.appendChild(buildStat(counts.pass, 'Passed'));
    grid.appendChild(buildStat(counts.warn, 'Warn'));
    grid.appendChild(buildStat(counts.fail, 'Failed'));
    return grid;
  }

  function buildStat(value, label) {
    var el = createElement('div', 'sg-stat');
    var v = createElement('div', 'sg-stat-value');
    v.textContent = String(value);
    var l = createElement('div', 'sg-stat-label');
    l.textContent = label;
    el.appendChild(v);
    el.appendChild(l);
    return el;
  }

  // ── Primitive helpers ─────────────────────────────────────────

  function createElement(tag, className) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    return el;
  }

  function createSection(title) {
    var section = createElement('div', 'sg-section');
    var t = createElement('div', 'sg-section-title');
    t.textContent = title;
    section.appendChild(t);
    return section;
  }

  function createBadge(text, variant) {
    var el = createElement('span', 'sg-badge sg-badge--' + variant);
    el.textContent = text;
    return el;
  }

  function createButton(text, className, onClick) {
    var btn = createElement('button', className);
    btn.textContent = text;
    btn.setAttribute('type', 'button');
    btn.addEventListener('click', onClick);
    return btn;
  }

  function verdictToClass(verdict) {
    if (verdict === 'SHIP') return 'ship';
    if (verdict === 'WARN') return 'warn';
    if (verdict === 'NO_SHIP') return 'noship';
    return 'idle';
  }

  // ── Message handling ──────────────────────────────────────────

  window.addEventListener('message', function (event) {
    var msg = event.data;
    if (msg.type === 'state') {
      render(msg.payload);
    }
  });

  // Request state on load (handles webview restore)
  post('requestState');
})();
