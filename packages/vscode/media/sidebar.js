/* ============================================================================
 * Shipgate Sidebar — Mission Control Renderer
 *
 * Features:
 *  - SVG ring gauge with glow trail + animated stroke
 *  - Animated number counting on stat changes
 *  - Ambient status aura via data-status attributes
 *  - Big score display with color-coded verdict
 *  - Shimmer progress for running scan
 *  - Staggered entrance with blur-in
 *  - All user data via textContent (XSS-safe)
 *  - Full keyboard accessibility (Enter/Space activate)
 * ============================================================================ */

(function () {
  // @ts-ignore — provided by VS Code
  var vscode = acquireVsCodeApi();
  var root = document.getElementById('sg-root');
  var prevState = null;

  // ── Messaging ───────────────────────────────────────────────

  function post(type, payload) {
    vscode.postMessage({ type: type, payload: payload });
  }

  // ── Render ──────────────────────────────────────────────────

  function render(state) {
    if (!root || !state) return;
    root.innerHTML = '';

    root.appendChild(buildDriftSection(state));
    root.appendChild(buildScanSection(state));
    root.appendChild(buildHealSection(state));
    root.appendChild(buildShipSection(state));
    root.appendChild(buildGitHubSection(state));
    root.appendChild(buildWorkflowsSection(state));
    root.appendChild(buildFirewallSection(state));
    root.appendChild(buildCodeToIslSection(state));

    if (state.phase === 'complete' && state.findingsPreview && state.findingsPreview.length > 0) {
      root.appendChild(buildFindingsPreview(state));
    }

    // Animate after paint
    requestAnimationFrame(function () {
      animateGauge(state);
      animateNumbers();
    });

    prevState = state;
  }

  // ── Scan ────────────────────────────────────────────────────

  function buildScanSection(state) {
    var status = state.phase === 'running' ? 'running'
      : state.verdict === 'SHIP' ? 'ship'
      : state.verdict === 'WARN' ? 'warn'
      : state.verdict === 'NO_SHIP' ? 'noship'
      : '';

    var section = createSection('Scan', status);

    // Badge
    var badgeText = state.phase === 'running' ? 'Scanning…' : state.verdict || 'Idle';
    var badgeClass = state.phase === 'running' ? 'checking' : verdictToClass(state.verdict);
    sectionHeader(section).appendChild(createBadge(badgeText, badgeClass, state.phase === 'running'));

    // Big score display (complete only)
    if (state.phase === 'complete' && state.score !== null && state.score !== undefined) {
      var scoreRow = h('div', 'sg-score-row');
      var scoreVal = h('div', 'sg-score-value sg-score-value--' + verdictToClass(state.verdict));
      scoreVal.setAttribute('data-count-to', String(state.score));
      scoreVal.textContent = '0';
      scoreRow.appendChild(scoreVal);

      var scoreUnit = h('span', 'sg-score-unit');
      scoreUnit.textContent = '%';
      scoreRow.appendChild(scoreUnit);

      var scoreLabel = h('span', 'sg-score-label');
      var filePart = state.counts ? state.counts.total + ' files scanned' : '';
      scoreLabel.textContent = filePart;
      scoreRow.appendChild(scoreLabel);

      section.appendChild(scoreRow);
    }

    // Summary
    var summary = h('div', 'sg-summary');
    if (state.phase === 'idle') {
      summary.textContent = 'Run a scan to verify your workspace against intent specs.';
    } else if (state.phase === 'running') {
      summary.textContent = 'Analyzing files…';
    } else if (state.phase === 'complete') {
      var parts = [];
      if (state.counts) {
        if (state.counts.pass > 0) parts.push(state.counts.pass + ' passed');
        if (state.counts.fail > 0) parts.push(state.counts.fail + ' failed');
        if (state.counts.warn > 0) parts.push(state.counts.warn + ' warnings');
      }
      summary.textContent = parts.join(' · ') || 'Scan complete.';
      summary.classList.add('sg-summary-mono');
    }
    section.appendChild(summary);

    // Progress shimmer
    if (state.phase === 'running') {
      var progress = h('div', 'sg-progress');
      progress.appendChild(h('div', 'sg-progress-bar'));
      section.appendChild(progress);
    }

    // Stats grid
    if (state.phase === 'complete' && state.counts) {
      section.appendChild(buildStats(state.counts));
    }

    // Buttons
    var runBtn = createButton('Run Scan', 'sg-btn sg-btn--primary', function () { post('runScan'); });
    runBtn.setAttribute('aria-label', 'Run verification scan');
    if (state.phase === 'running') setButtonLoading(runBtn, 'Scanning…');
    section.appendChild(runBtn);

    if (state.phase === 'complete') {
      var btnRow = h('div', 'sg-btn-row');
      btnRow.appendChild(createButton('Open Report', 'sg-btn', function () { post('openReport'); }));
      btnRow.appendChild(createButton('Copy Summary', 'sg-btn', function () { post('copySummary'); }));
      section.appendChild(btnRow);
    }

    return section;
  }

  // ── Heal ─────────────────────────────────────────────────────

  function buildHealSection(state) {
    var heal = state.heal || {};
    var phase = heal.phase || 'idle';
    var hasFailures = heal.failedFiles && heal.failedFiles.length > 0;
    var scanDone = state.phase === 'complete';

    var status = phase === 'running' ? 'running'
      : phase === 'done' && heal.finalVerdict === 'SHIP' ? 'ship'
      : phase === 'done' ? 'noship'
      : hasFailures ? 'noship'
      : '';

    var section = createSection('Heal', status);

    // Badge
    var badgeText = phase === 'running' ? 'Healing…'
      : phase === 'done' ? (heal.finalVerdict || 'Done')
      : hasFailures ? heal.failedFiles.length + ' issue(s)'
      : 'Ready';
    var badgeClass = phase === 'running' ? 'checking'
      : phase === 'done' && heal.finalVerdict === 'SHIP' ? 'ship'
      : hasFailures ? 'blocked'
      : 'idle';
    sectionHeader(section).appendChild(createBadge(badgeText, badgeClass, phase === 'running'));

    // Summary
    var summary = h('div', 'sg-summary');
    if (phase === 'running') {
      summary.textContent = heal.message || 'AI is analyzing and fixing code…';
    } else if (phase === 'done') {
      var scoreText = heal.finalScore != null ? Math.round(heal.finalScore * 100) + '%' : '—';
      summary.textContent = heal.finalVerdict === 'SHIP'
        ? 'All issues resolved! Score: ' + scoreText
        : 'Healed ' + (heal.patchedFiles || []).length + ' file(s). Score: ' + scoreText;
    } else if (!scanDone) {
      summary.textContent = 'Run a scan first, then heal any failures with AI.';
    } else if (hasFailures) {
      summary.textContent = 'AI can automatically fix ' + heal.failedFiles.length + ' failing file(s), or choose a file to heal manually.';
    } else {
      summary.textContent = 'All files passing — nothing to heal.';
    }
    section.appendChild(summary);

    // Progress shimmer while healing
    if (phase === 'running') {
      var progress = h('div', 'sg-progress');
      progress.appendChild(h('div', 'sg-progress-bar'));
      section.appendChild(progress);
    }

    // Error
    if (heal.error) {
      var err = h('div', 'sg-summary sg-mt-4');
      err.style.color = 'var(--sg-red)';
      err.textContent = heal.error;
      section.appendChild(err);
    }

    // Patched files result
    if (phase === 'done' && heal.patchedFiles && heal.patchedFiles.length > 0) {
      var patchList = h('div', 'sg-heal-patches sg-mt-4');
      var patchTitle = h('div', 'sg-sub-title');
      patchTitle.textContent = 'Patched Files';
      patchList.appendChild(patchTitle);
      heal.patchedFiles.forEach(function (f) {
        var item = h('div', 'sg-list-item sg-list-item--clickable');
        var dot = h('span', 'sg-dot sg-dot--pass');
        item.appendChild(dot);
        var name = h('span', 'sg-finding-file');
        name.textContent = f.split(/[/\\]/).pop();
        name.setAttribute('title', f);
        item.appendChild(name);
        item.addEventListener('click', function () { post('openFile', f); });
        patchList.appendChild(item);
      });
      section.appendChild(patchList);
    }

    // ── Auto Heal button ──
    if (scanDone && hasFailures) {
      var healBtn = createButton('', 'sg-btn sg-btn--primary sg-mt-4', function () { post('healAll'); });
      if (phase === 'running') {
        setButtonLoading(healBtn, 'Healing…');
      } else {
        healBtn.innerHTML = '\u26a1 Heal All (' + heal.failedFiles.length + ' files)';
      }
      healBtn.setAttribute('aria-label', 'AI auto-fix all failing files');
      section.appendChild(healBtn);
    }

    // ── Manual Heal: file picker + intent ──
    if (scanDone && hasFailures && phase !== 'running') {
      section.appendChild(h('div', 'sg-divider sg-mt-4'));

      var manualTitle = h('div', 'sg-sub-title');
      manualTitle.textContent = 'Manual Heal';
      section.appendChild(manualTitle);

      var manualDesc = h('div', 'sg-summary');
      manualDesc.textContent = 'Pick a file, describe your correct intent, and heal it.';
      section.appendChild(manualDesc);

      // File selector
      var selectWrap = h('div', 'sg-select-wrap sg-mt-4');
      var selectLabel = h('label', 'sg-select-label');
      selectLabel.textContent = 'File';
      selectLabel.setAttribute('for', 'sg-heal-file-select');
      selectWrap.appendChild(selectLabel);

      var select = h('select', 'sg-select');
      select.setAttribute('id', 'sg-heal-file-select');
      var defaultOpt = h('option', '');
      defaultOpt.textContent = 'Choose a file…';
      defaultOpt.setAttribute('value', '');
      select.appendChild(defaultOpt);

      heal.failedFiles.forEach(function (f) {
        var opt = h('option', '');
        opt.setAttribute('value', f.file);
        var shortName = f.file.split(/[/\\]/).pop();
        var scorePct = Math.round(f.score * 100);
        opt.textContent = shortName + ' (' + scorePct + '% — ' + (f.blockers[0] || 'failing') + ')';
        select.appendChild(opt);
      });
      selectWrap.appendChild(select);
      section.appendChild(selectWrap);

      // Blockers preview for selected file
      var blockersDiv = h('div', 'sg-heal-blockers sg-mt-4');
      blockersDiv.setAttribute('id', 'sg-heal-blockers');
      blockersDiv.style.display = 'none';
      section.appendChild(blockersDiv);

      // Intent textarea
      var intentWrap = h('div', 'sg-input-wrap sg-mt-4');
      var intentLabel = h('label', 'sg-select-label');
      intentLabel.textContent = 'Your Intent (optional)';
      intentLabel.setAttribute('for', 'sg-heal-intent');
      intentWrap.appendChild(intentLabel);

      var intentArea = h('textarea', 'sg-textarea');
      intentArea.setAttribute('id', 'sg-heal-intent');
      intentArea.setAttribute('rows', '3');
      intentArea.setAttribute('placeholder', 'Describe what this file should do, e.g. "Transfer money between accounts, validate balance before debit, return transaction ID on success"');
      intentWrap.appendChild(intentArea);
      section.appendChild(intentWrap);

      // Update blockers when file selection changes
      select.addEventListener('change', function () {
        var selectedFile = select.value;
        var bd = document.getElementById('sg-heal-blockers');
        if (!bd) return;
        if (!selectedFile) {
          bd.style.display = 'none';
          bd.innerHTML = '';
          return;
        }
        var entry = null;
        for (var i = 0; i < heal.failedFiles.length; i++) {
          if (heal.failedFiles[i].file === selectedFile) {
            entry = heal.failedFiles[i];
            break;
          }
        }
        if (!entry || !entry.blockers || entry.blockers.length === 0) {
          bd.style.display = 'none';
          bd.innerHTML = '';
          return;
        }
        bd.style.display = 'block';
        bd.innerHTML = '';
        var bt = h('div', 'sg-sub-title');
        bt.textContent = 'Current Blockers';
        bd.appendChild(bt);
        entry.blockers.forEach(function (b) {
          var bItem = h('div', 'sg-heal-blocker-item');
          bItem.textContent = '• ' + b;
          bd.appendChild(bItem);
        });
      });

      // Heal File button
      var healFileBtn = createButton('', 'sg-btn sg-btn--primary sg-mt-4', function () {
        var selEl = document.getElementById('sg-heal-file-select');
        var intentEl = document.getElementById('sg-heal-intent');
        var file = selEl ? selEl.value : '';
        var intent = intentEl ? intentEl.value : '';
        if (!file) {
          return;
        }
        post('healFile', { file: file, intent: intent.trim() });
      });
      healFileBtn.innerHTML = '🔧 Heal Selected File';
      healFileBtn.setAttribute('aria-label', 'Heal selected file with AI');
      section.appendChild(healFileBtn);
    }

    return section;
  }

  // ── Intent Drift (SVG Ring Gauge) ───────────────────────────

  function buildDriftSection(state) {
    var section = createSection('Intent Drift');

    var container = h('div', 'sg-gauge-container');
    container.setAttribute('role', 'button');
    container.setAttribute('tabindex', '0');
    container.setAttribute('aria-label', 'View drift report');
    container.addEventListener('click', function () { post('openReport'); });
    onActivate(container, function () { post('openReport'); });

    // SVG gauge
    var ring = h('div', 'sg-gauge-ring');
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'sg-gauge-svg');
    svg.setAttribute('viewBox', '0 0 64 64');
    svg.setAttribute('aria-hidden', 'true');

    var R = 26;
    var C = 2 * Math.PI * R; // ~163.36

    // Background ring
    var bg = document.createElementNS(NS, 'circle');
    bg.setAttribute('class', 'sg-gauge-bg');
    bg.setAttribute('cx', '32'); bg.setAttribute('cy', '32'); bg.setAttribute('r', String(R));
    svg.appendChild(bg);

    var pct = state.drift ? state.drift.pct : 0;
    var color = state.drift ? state.drift.color : 'green';

    // Glow trail (blurred copy)
    var trail = document.createElementNS(NS, 'circle');
    trail.setAttribute('class', 'sg-gauge-trail');
    trail.setAttribute('id', 'sg-gauge-trail');
    trail.setAttribute('cx', '32'); trail.setAttribute('cy', '32'); trail.setAttribute('r', String(R));
    trail.setAttribute('data-color', color);
    trail.style.strokeDasharray = String(C);
    trail.style.strokeDashoffset = String(C);
    svg.appendChild(trail);

    // Main arc
    var fill = document.createElementNS(NS, 'circle');
    fill.setAttribute('class', 'sg-gauge-fill');
    fill.setAttribute('id', 'sg-gauge-fill');
    fill.setAttribute('cx', '32'); fill.setAttribute('cy', '32'); fill.setAttribute('r', String(R));
    fill.setAttribute('data-color', color);
    fill.style.strokeDasharray = String(C);
    fill.style.strokeDashoffset = String(C);
    svg.appendChild(fill);

    ring.appendChild(svg);

    // Center label
    var label = h('div', 'sg-gauge-label');
    label.textContent = state.drift ? pct + '%' : '—';
    ring.appendChild(label);

    container.appendChild(ring);

    // Meta
    var meta = h('div', 'sg-gauge-meta');
    var title = h('div', 'sg-gauge-title');
    if (state.drift) {
      title.textContent = pct >= 80 ? 'Code matches spec' : pct >= 50 ? 'Some drift detected' : 'Significant drift';
    } else {
      title.textContent = 'No data yet';
    }
    meta.appendChild(title);

    var desc = h('div', 'sg-gauge-desc');
    desc.textContent = state.drift ? 'Alignment with your ISL intent specifications.' : 'Run a scan to measure drift.';
    meta.appendChild(desc);

    if (state.drift && state.drift.failedFiles && state.drift.failedFiles.length > 0) {
      var files = h('div', 'sg-gauge-files');
      files.textContent = state.drift.failedFiles.map(function (f) {
        return f.split(/[/\\]/).pop();
      }).join(', ');
      meta.appendChild(files);
    }

    container.appendChild(meta);
    section.appendChild(container);
    return section;
  }

  function animateGauge(state) {
    if (!state.drift) return;
    var C = 163.36;
    var offset = C - (C * state.drift.pct / 100);

    var fill = document.getElementById('sg-gauge-fill');
    var trail = document.getElementById('sg-gauge-trail');
    if (fill)  fill.style.strokeDashoffset = String(offset);
    if (trail) trail.style.strokeDashoffset = String(offset);
  }

  // ── Ship ────────────────────────────────────────────────────

  function buildShipSection(state) {
    var section = createSection('Ship');
    var summary = h('div', 'sg-summary');
    summary.textContent = 'Commit, push, and open a PR — gated by scan verdict.';
    section.appendChild(summary);

    var btnRow = h('div', 'sg-btn-row');
    var shipBtn = createButton('', 'sg-btn sg-btn--ship', function () { post('ship'); });
    shipBtn.innerHTML = '🚀 SHIP';
    shipBtn.setAttribute('aria-label', 'Ship verified code');
    btnRow.appendChild(shipBtn);

    var pullBtn = createButton('', 'sg-btn', function () { post('ship'); });
    pullBtn.innerHTML = ghIcon(14) + ' Pull Request';
    pullBtn.setAttribute('aria-label', 'Create pull request');
    btnRow.appendChild(pullBtn);

    if (state.shipping) {
      setButtonLoading(shipBtn, 'Shipping…');
      setButtonLoading(pullBtn, 'Shipping…');
    }

    section.appendChild(btnRow);
    return section;
  }

  // ── GitHub ──────────────────────────────────────────────────

  function buildGitHubSection(state) {
    var gh = state.github;
    var section = createSection('GitHub');

    sectionHeader(section).appendChild(
      createBadge(gh.connected ? 'Connected' : 'Disconnected', gh.connected ? 'connected' : 'disconnected')
    );

    var summary = h('div', 'sg-summary');
    if (gh.connected && gh.owner) {
      summary.textContent = gh.owner + '/' + gh.repo;
      summary.classList.add('sg-summary-mono');
    } else {
      summary.textContent = gh.error || 'Connect to view PRs and workflows.';
    }
    section.appendChild(summary);

    var ghBtn = createButton('', 'sg-btn', function () { post('githubConnect'); });
    ghBtn.innerHTML = ghIcon(16) + ' ' + (gh.connected ? 'Refresh' : 'Connect');
    ghBtn.setAttribute('aria-label', gh.connected ? 'Refresh GitHub connection' : 'Connect to GitHub');
    if (gh.connecting) setButtonLoading(ghBtn, 'Connecting…');
    section.appendChild(ghBtn);

    // Pull requests
    if (gh.pulls && gh.pulls.length > 0) {
      section.appendChild(h('div', 'sg-divider'));
      var sub = h('div', 'sg-sub-title');
      sub.textContent = 'Pull Requests';
      section.appendChild(sub);
      gh.pulls.forEach(function (pr) {
        var item = h('div', 'sg-list-item');
        var link = h('a', 'sg-link');
        link.textContent = '#' + pr.number + '  ' + pr.title;
        link.setAttribute('href', '#');
        link.setAttribute('role', 'button');
        link.setAttribute('tabindex', '0');
        link.addEventListener('click', function (e) { e.preventDefault(); post('openPr', pr.htmlUrl); });
        onActivate(link, function () { post('openPr', pr.htmlUrl); });
        item.appendChild(link);
        section.appendChild(item);
      });
    }

    return section;
  }

  // ── Workflows ───────────────────────────────────────────────

  function buildWorkflowsSection(state) {
    var section = createSection('CI / Workflows');

    if (!state.workflows || state.workflows.length === 0) {
      var empty = h('div', 'sg-empty');
      var icon = h('div', 'sg-empty-icon');
      icon.textContent = '⚙';
      empty.appendChild(icon);
      var msg = h('div');
      msg.textContent = 'No workflows detected';
      empty.appendChild(msg);
      section.appendChild(empty);
    } else {
      state.workflows.forEach(function (w) {
        var item = h('div', 'sg-list-item');
        item.textContent = w.name;
        section.appendChild(item);
      });
    }

    // Recent runs
    if (state.github && state.github.runs && state.github.runs.length > 0) {
      section.appendChild(h('div', 'sg-divider'));
      var sub = h('div', 'sg-sub-title');
      sub.textContent = 'Recent Runs';
      section.appendChild(sub);
      state.github.runs.forEach(function (r) {
        var item = h('div', 'sg-list-item');
        var conclusion = (r.conclusion || r.status || '').toLowerCase();
        var dot = h('span', 'sg-run-dot');
        if (conclusion === 'success')      dot.classList.add('sg-run-dot--success');
        else if (conclusion === 'failure') dot.classList.add('sg-run-dot--failure');
        else                               dot.classList.add('sg-run-dot--pending');
        item.appendChild(dot);

        var link = h('a', 'sg-link');
        link.textContent = r.name;
        link.setAttribute('href', '#');
        link.setAttribute('role', 'button');
        link.setAttribute('tabindex', '0');
        link.addEventListener('click', function (e) { e.preventDefault(); post('openWorkflow', r.htmlUrl); });
        onActivate(link, function () { post('openWorkflow', r.htmlUrl); });
        item.appendChild(link);
        section.appendChild(item);
      });
    }

    return section;
  }

  // ── Firewall ────────────────────────────────────────────────

  function buildFirewallSection(state) {
    var fw = state.firewall;
    var enabled = fw.enabled !== false;
    var status = enabled ? (fw.status || 'idle') : 'idle';
    var sectionStatus = status === 'blocked' ? 'noship' : status === 'allowed' ? 'ship' : '';
    var section = createSection('Live Firewall', sectionStatus);

    // Toggle switch
    var toggle = h('label', 'sg-toggle');
    toggle.setAttribute('title', enabled ? 'Disable firewall' : 'Enable firewall');
    var checkbox = h('input', '');
    checkbox.setAttribute('type', 'checkbox');
    checkbox.className = 'sg-toggle-input';
    if (enabled) checkbox.setAttribute('checked', '');
    checkbox.addEventListener('change', function () { post('firewallToggle'); });
    toggle.appendChild(checkbox);
    toggle.appendChild(h('span', 'sg-toggle-slider'));
    sectionHeader(section).appendChild(toggle);

    var badgeText = !enabled ? 'Off' : status === 'checking' ? '…' : status === 'allowed' ? 'ALLOWED' : status === 'blocked' ? 'BLOCKED' : 'Idle';
    var badgeClass = !enabled ? 'idle' : status === 'allowed' ? 'allowed' : status === 'blocked' ? 'blocked' : status === 'checking' ? 'checking' : 'idle';
    sectionHeader(section).appendChild(createBadge(badgeText, badgeClass, status === 'checking'));

    var summary = h('div', 'sg-summary');
    if (!enabled) {
      summary.textContent = 'Firewall is disabled. Toggle to activate.';
    } else if (status === 'checking') {
      summary.textContent = 'Checking…';
    } else if (fw.violationCount > 0) {
      summary.textContent = fw.violationCount + ' violation(s) detected.';
    } else if (fw.lastFile) {
      summary.textContent = 'Last checked: ' + fw.lastFile.split(/[/\\]/).pop();
      summary.classList.add('sg-summary-mono');
    } else {
      summary.textContent = 'Intercepts ghost routes, env vars, and imports on save.';
    }
    section.appendChild(summary);

    return section;
  }

  // ── Intent Builder ─────────────────────────────────────────

  function buildCodeToIslSection(state) {
    var section = createSection('Intent Builder');
    var ib = state.intentBuilder || {};
    var hasKey = !!ib.hasApiKey;

    // ── API Key gate ──────────────────────────────────────────
    if (!hasKey) {
      var keyDesc = h('div', 'sg-summary');
      keyDesc.textContent = 'Enter your AI API key to unlock the Intent Builder. Your key is stored securely in VS Code\'s secret storage.';
      section.appendChild(keyDesc);

      var keyWrap = h('div', 'sg-apikey-wrap');

      var keyInput = h('input', 'sg-apikey-input');
      keyInput.setAttribute('type', 'password');
      keyInput.setAttribute('placeholder', 'sk-... or your API key');
      keyInput.setAttribute('id', 'sg-apikey-input');
      keyWrap.appendChild(keyInput);

      var keyBtn = createButton('Save Key', 'sg-btn sg-btn--primary', function () {
        var el = document.getElementById('sg-apikey-input');
        var val = el ? el.value : '';
        if (val.trim()) {
          post('setApiKey', { key: val.trim() });
        }
      });
      keyWrap.appendChild(keyBtn);
      section.appendChild(keyWrap);

      var keyNote = h('div', 'sg-apikey-note');
      keyNote.textContent = 'Supports Anthropic and OpenAI keys.';
      section.appendChild(keyNote);

      // Still show Code→ISL button (doesn't need API key)
      var codeBtnRow = h('div', 'sg-btn-row sg-mt-4');
      codeBtnRow.appendChild(createButton('Code \u2192 ISL', 'sg-btn', function () { post('codeToIsl'); }));
      section.appendChild(codeBtnRow);

      return section;
    }

    // ── Build UI (revealed once API key is set) ───────────────

    var summary = h('div', 'sg-summary');
    summary.textContent = 'Describe what you want to build. Shipgate generates ISL, verifies it, then writes code.';
    section.appendChild(summary);

    // Prompt input
    var inputWrap = h('div', 'sg-input-wrap');
    var textarea = h('textarea', 'sg-textarea');
    textarea.setAttribute('placeholder', 'e.g. "Create a login with Google and GitHub credentials"');
    textarea.setAttribute('rows', '3');
    textarea.setAttribute('id', 'sg-intent-prompt');
    if (ib.prompt) textarea.value = ib.prompt;
    inputWrap.appendChild(textarea);
    section.appendChild(inputWrap);

    // Pipeline steps indicator
    var phase = ib.phase || 'idle';
    if (phase !== 'idle') {
      var pipeline = h('div', 'sg-pipeline');
      var steps = [
        { key: 'generating', label: 'Generate ISL' },
        { key: 'scanning', label: 'Verify' },
        { key: 'codegen', label: 'Write Code' },
        { key: 'done', label: 'Done' }
      ];
      var stepOrder = ['generating', 'scanning', 'codegen', 'done'];
      var currentIdx = stepOrder.indexOf(phase);

      for (var i = 0; i < steps.length; i++) {
        var step = h('div', 'sg-pipeline-step');
        var dot = h('span', 'sg-pipeline-dot');
        if (i < currentIdx) {
          dot.classList.add('sg-pipeline-dot--done');
          dot.textContent = '✓';
        } else if (i === currentIdx) {
          dot.classList.add('sg-pipeline-dot--active');
          if (phase === 'done') {
            dot.textContent = '✓';
            dot.classList.add('sg-pipeline-dot--done');
          }
        }
        step.appendChild(dot);
        var label = h('span', 'sg-pipeline-label');
        label.textContent = steps[i].label;
        if (i === currentIdx) label.classList.add('sg-pipeline-label--active');
        step.appendChild(label);
        pipeline.appendChild(step);

        if (i < steps.length - 1) {
          var line = h('span', 'sg-pipeline-line');
          if (i < currentIdx) line.classList.add('sg-pipeline-line--done');
          pipeline.appendChild(line);
        }
      }
      section.appendChild(pipeline);
    }

    // Status message
    if (ib.message) {
      var msg = h('div', 'sg-summary sg-summary-mono sg-mt-4');
      msg.textContent = ib.message;
      section.appendChild(msg);
    }

    // Error
    if (ib.error) {
      var err = h('div', 'sg-summary sg-mt-4');
      err.style.color = 'var(--sg-red)';
      err.textContent = ib.error;
      section.appendChild(err);
    }

    // Score result
    if (ib.score != null) {
      var scoreRow = h('div', 'sg-summary sg-mt-4');
      scoreRow.innerHTML = 'Ship Score: <strong>' + ib.score + '%</strong> — ' +
        (ib.verdict === 'SHIP' ? '<span style="color:var(--sg-green)">SHIP</span>' :
         ib.verdict === 'WARN' ? '<span style="color:var(--sg-amber)">WARN</span>' :
         '<span style="color:var(--sg-red)">NO_SHIP</span>');
      section.appendChild(scoreRow);
    }

    // Buttons
    var btnRow = h('div', 'sg-btn-row sg-mt-4');
    var isBuilding = phase !== 'idle' && phase !== 'done' && !ib.error;
    var buildBtn = createButton('Build', 'sg-btn sg-btn--primary', function () {
      var promptEl = document.getElementById('sg-intent-prompt');
      var promptText = promptEl ? promptEl.value : '';
      if (promptText.trim()) {
        post('intentBuild', { prompt: promptText.trim() });
      }
    });
    if (isBuilding) {
      var phaseLabel = phase === 'generating' ? 'Generating\u2026' : phase === 'scanning' ? 'Verifying\u2026' : phase === 'codegen' ? 'Writing Code\u2026' : 'Building\u2026';
      setButtonLoading(buildBtn, phaseLabel);
    }
    btnRow.appendChild(buildBtn);

    // Code→ISL button + clear key
    btnRow.appendChild(createButton('Code → ISL', 'sg-btn', function () { post('codeToIsl'); }));
    btnRow.appendChild(createButton('Clear Key', 'sg-btn sg-btn--ghost', function () { post('clearApiKey'); }));
    section.appendChild(btnRow);

    return section;
  }

  // ── Findings ────────────────────────────────────────────────

  function buildFindingsPreview(state) {
    var section = createSection('Top Issues');
    var list = h('div', 'sg-findings');

    state.findingsPreview.forEach(function (f) {
      var row = h('div', 'sg-finding');
      row.setAttribute('tabindex', '0');
      row.setAttribute('role', 'button');
      row.setAttribute('aria-label', f.status + ' — ' + f.file);
      row.addEventListener('click', function () { post('openFinding', { file: f.file }); });
      onActivate(row, function () { post('openFinding', { file: f.file }); });

      var dotClass = f.status === 'PASS' ? 'pass' : f.status === 'WARN' ? 'warn' : 'fail';
      row.appendChild(h('span', 'sg-dot sg-dot--' + dotClass));

      var body = h('div', 'sg-finding-body');
      var fileEl = h('div', 'sg-finding-file');
      fileEl.textContent = f.file;
      body.appendChild(fileEl);

      var msgs = (f.blockers || []).concat(f.errors || []);
      if (msgs.length > 0) {
        var msg = h('div', 'sg-finding-msg');
        msg.textContent = msgs[0];
        body.appendChild(msg);
      }
      row.appendChild(body);

      var score = h('span', 'sg-finding-score');
      score.textContent = Math.round(f.score * 100) + '%';
      row.appendChild(score);

      list.appendChild(row);
    });

    section.appendChild(list);
    return section;
  }

  // ── Stats Grid ──────────────────────────────────────────────

  function buildStats(counts) {
    var grid = h('div', 'sg-stats');
    grid.appendChild(buildStat(counts.total, 'Files', ''));
    grid.appendChild(buildStat(counts.pass, 'Passed', 'pass'));
    grid.appendChild(buildStat(counts.warn, 'Warn', 'warn'));
    grid.appendChild(buildStat(counts.fail, 'Failed', 'fail'));
    return grid;
  }

  function buildStat(value, label, variant) {
    var el = h('div', 'sg-stat' + (variant ? ' sg-stat--' + variant : ''));
    var v = h('div', 'sg-stat-value');
    v.setAttribute('data-count-to', String(value));
    v.textContent = '0';

    // Trigger pop animation if changed
    if (prevState && prevState.counts) {
      var key = label.toLowerCase();
      var old = key === 'files' ? prevState.counts.total : prevState.counts[key === 'passed' ? 'pass' : key];
      if (old !== undefined && old !== value) {
        v.setAttribute('data-animate', '');
      }
    }

    el.appendChild(v);
    var l = h('div', 'sg-stat-label');
    l.textContent = label;
    el.appendChild(l);
    return el;
  }

  // ── Number Count-Up Animation ───────────────────────────────

  function animateNumbers() {
    var elements = root.querySelectorAll('[data-count-to]');
    elements.forEach(function (el) {
      var target = parseInt(el.getAttribute('data-count-to'), 10);
      if (isNaN(target) || target === 0) {
        el.textContent = String(target || 0);
        return;
      }
      var duration = Math.min(600, Math.max(200, target * 15));
      var start = performance.now();

      function tick(now) {
        var elapsed = now - start;
        var progress = Math.min(elapsed / duration, 1);
        // Ease-out quad
        var eased = 1 - (1 - progress) * (1 - progress);
        var current = Math.round(eased * target);
        el.textContent = String(current);
        if (progress < 1) {
          requestAnimationFrame(tick);
        }
      }

      requestAnimationFrame(tick);
    });
  }

  // ── Primitives ──────────────────────────────────────────────

  function h(tag, className) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    return el;
  }

  function createSection(title, dataStatus) {
    var section = h('div', 'sg-section');
    if (dataStatus) section.setAttribute('data-status', dataStatus);
    var header = h('div', 'sg-section-header');
    var t = h('div', 'sg-section-title');
    t.textContent = title;
    header.appendChild(t);
    section.appendChild(header);
    return section;
  }

  function sectionHeader(section) {
    return section.querySelector('.sg-section-header');
  }

  function createBadge(text, variant, showSpinner) {
    var el = h('span', 'sg-badge sg-badge--' + variant);
    if (showSpinner) {
      var spinner = h('span', 'sg-spinner');
      spinner.setAttribute('aria-label', 'Processing');
      el.appendChild(spinner);
    }
    el.appendChild(document.createTextNode(text));
    return el;
  }

  function createButton(text, className, onClick) {
    var btn = h('button', className);
    btn.textContent = text;
    btn.setAttribute('type', 'button');
    btn.addEventListener('click', onClick);
    return btn;
  }

  function setButtonLoading(btn, loadingText) {
    btn.classList.add('sg-btn--loading');
    btn.disabled = true;
    btn.innerHTML = '';
    var spinner = h('span', 'sg-btn-spinner');
    btn.appendChild(spinner);
    btn.appendChild(document.createTextNode(' ' + loadingText));
  }

  function verdictToClass(verdict) {
    if (verdict === 'SHIP')    return 'ship';
    if (verdict === 'WARN')    return 'warn';
    if (verdict === 'NO_SHIP') return 'noship';
    return 'idle';
  }

  function onActivate(el, fn) {
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
    });
  }

  /** Official GitHub Invertocat SVG mark (monochrome, scales to any size) */
  function ghIcon(size) {
    var s = size || 16;
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 16 16" fill="currentColor" style="vertical-align:middle;margin-right:4px">' +
      '<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.65 7.65 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>' +
      '</svg>';
  }

  // ── Message handling ────────────────────────────────────────

  window.addEventListener('message', function (event) {
    if (event.data && event.data.type === 'state') {
      render(event.data.payload);
    }
  });

  // ── Onboarding Wizard ───────────────────────────────────────

  var onboardingSteps = [
    {
      title: 'Welcome to Shipgate',
      desc: 'Shipgate verifies your code against intent specifications (ISL). This panel is your mission control — let\'s walk through each section.'
    },
    {
      title: '1. Intent Drift',
      desc: 'The ring gauge shows how closely your code matches your ISL specs. Green = aligned, red = significant drift. Click it to open the full report.'
    },
    {
      title: '2. Run Scan',
      desc: 'Hit "Run Scan" to verify every file in your workspace. You\'ll see a score, pass/fail counts, and top issues. Scans are gated — NO_SHIP means violations need fixing.'
    },
    {
      title: '3. SHIP / Pull Request',
      desc: 'Once your scan passes, use SHIP to commit, push, and open a pull request — all from this panel. The PR is gated by your scan verdict.'
    },
    {
      title: '4. GitHub',
      desc: 'Connect to GitHub with one click (OAuth magic link). Once connected you\'ll see your repo, open PRs, and recent CI runs right here.'
    },
    {
      title: '5. CI / Workflows',
      desc: 'Detected GitHub Actions workflows and their recent run status appear here. Green dot = success, red = failure, yellow = pending.'
    },
    {
      title: '6. Live Firewall',
      desc: 'The firewall checks every file on save for ghost routes, leaked env vars, and bad imports. Toggle it on/off with the switch. Violations appear as diagnostics in your editor.'
    },
    {
      title: '7. Code → ISL',
      desc: 'Select any file or folder and click "Generate ISL" to reverse-engineer intent specs from your existing code. Great for onboarding existing projects.'
    },
    {
      title: 'You\'re all set!',
      desc: 'Start by running a scan. If you need help again, click the (?) button anytime. Happy shipping!'
    }
  ];

  var onboardingStep = 0;
  var onboardingEl = document.getElementById('sg-onboarding');
  var helpBtn = document.getElementById('sg-help-btn');

  function renderOnboardingStep() {
    if (!onboardingEl) return;
    var step = onboardingSteps[onboardingStep];
    var total = onboardingSteps.length;

    var html = '<div class="sg-onboarding-step">';
    html += '<div class="sg-onboarding-title">' + step.title + '</div>';
    html += '<div class="sg-onboarding-desc">' + step.desc + '</div>';
    html += '<div class="sg-onboarding-nav">';

    // Back button
    if (onboardingStep > 0) {
      html += '<button class="sg-onboarding-btn" id="sg-ob-back">Back</button>';
    } else {
      html += '<span></span>';
    }

    // Dots
    html += '<div class="sg-onboarding-dots">';
    for (var i = 0; i < total; i++) {
      html += '<span class="sg-onboarding-dot' + (i === onboardingStep ? ' sg-onboarding-dot--active' : '') + '"></span>';
    }
    html += '</div>';

    // Next / Done
    if (onboardingStep < total - 1) {
      html += '<button class="sg-onboarding-btn sg-onboarding-btn--primary" id="sg-ob-next">Next</button>';
    } else {
      html += '<button class="sg-onboarding-btn sg-onboarding-btn--primary" id="sg-ob-done">Done</button>';
    }

    html += '</div></div>';
    onboardingEl.innerHTML = html;

    // Wire buttons
    var backBtn = document.getElementById('sg-ob-back');
    var nextBtn = document.getElementById('sg-ob-next');
    var doneBtn = document.getElementById('sg-ob-done');
    if (backBtn) backBtn.addEventListener('click', function () { onboardingStep--; renderOnboardingStep(); });
    if (nextBtn) nextBtn.addEventListener('click', function () { onboardingStep++; renderOnboardingStep(); });
    if (doneBtn) doneBtn.addEventListener('click', function () { closeOnboarding(); });
  }

  function openOnboarding() {
    if (!onboardingEl) return;
    onboardingStep = 0;
    onboardingEl.classList.remove('sg-hidden');
    renderOnboardingStep();
  }

  function closeOnboarding() {
    if (!onboardingEl) return;
    onboardingEl.classList.add('sg-hidden');
    onboardingEl.innerHTML = '';
  }

  if (helpBtn) {
    helpBtn.addEventListener('click', function () {
      if (onboardingEl && !onboardingEl.classList.contains('sg-hidden')) {
        closeOnboarding();
      } else {
        openOnboarding();
      }
    });
  }

  // ── Flowing Wave Gradient Background ────────────────────────

  (function initWaveBackground() {
    var canvas = document.getElementById('sg-bg-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var w = 0, h = 0;
    var t = 0;

    function resize() {
      w = canvas.width = canvas.offsetWidth || 300;
      h = canvas.height = canvas.offsetHeight || 800;
    }

    function render() {
      t += 0.003;

      // Dark blue base
      ctx.fillStyle = '#0a1628';
      ctx.fillRect(0, 0, w, h);

      // Draw 4 layered waves, back to front
      var waves = [
        { amp: 30, freq: 0.008, speed: 0.7, yOff: 0.25, r: 15, g: 40, b: 80, a: 0.4 },
        { amp: 25, freq: 0.012, speed: 1.0, yOff: 0.40, r: 20, g: 60, b: 120, a: 0.35 },
        { amp: 20, freq: 0.015, speed: 1.4, yOff: 0.55, r: 40, g: 100, b: 170, a: 0.3 },
        { amp: 15, freq: 0.020, speed: 1.9, yOff: 0.70, r: 80, g: 160, b: 220, a: 0.25 }
      ];

      for (var i = 0; i < waves.length; i++) {
        var wv = waves[i];
        ctx.beginPath();
        ctx.moveTo(0, h);

        for (var x = 0; x <= w; x += 2) {
          var y = h * wv.yOff
            + Math.sin(x * wv.freq + t * wv.speed) * wv.amp
            + Math.sin(x * wv.freq * 0.5 + t * wv.speed * 0.7) * wv.amp * 0.5;
          ctx.lineTo(x, y);
        }

        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fillStyle = 'rgba(' + wv.r + ',' + wv.g + ',' + wv.b + ',' + wv.a + ')';
        ctx.fill();
      }

      window.requestAnimationFrame(render);
    }

    resize();
    render();
    window.addEventListener('resize', resize, false);
  })();

  post('requestState');
})();
