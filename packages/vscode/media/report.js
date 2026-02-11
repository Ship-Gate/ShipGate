/* ============================================================================
 * Shipgate Report — Webview Script
 *
 * Renders full scan report from normalized ReportUiState via postMessage.
 * Supports: severity filters, search, keyboard nav, export, copy.
 * ============================================================================ */

(function () {
  // @ts-ignore
  var vscode = acquireVsCodeApi();
  var root = document.getElementById('sg-root');
  var currentState = null;
  var activeFilter = 'all';
  var searchQuery = '';
  var selectedIndex = -1;

  function post(type, payload) {
    vscode.postMessage({ type: type, payload: payload });
  }

  // ── Main render ───────────────────────────────────────────────

  function render(state) {
    if (!root || !state) return;
    currentState = state;
    root.innerHTML = '';

    if (!state.verdict) {
      root.appendChild(buildEmpty());
      return;
    }

    root.appendChild(buildHeader(state));
    root.appendChild(buildFilters(state));
    root.appendChild(buildFindingsList(state));
  }

  // ── Header ────────────────────────────────────────────────────

  function buildHeader(state) {
    var header = createElement('div', 'sg-report-header');

    // Row: badge + score
    var top = createElement('div', 'sg-flex sg-items-center sg-gap-16');
    top.appendChild(createBadge(state.verdict, verdictClass(state.verdict)));
    if (state.score !== null) {
      var scoreEl = createElement('span', '');
      scoreEl.style.fontSize = '20px';
      scoreEl.style.fontWeight = '700';
      scoreEl.textContent = state.score + '%';
      top.appendChild(scoreEl);
    }
    header.appendChild(top);

    // Meta row
    var meta = createElement('div', 'sg-report-meta');
    if (state.metadata.workspaceRoot) {
      meta.appendChild(metaItem(state.metadata.workspaceRoot.split(/[/\\]/).pop()));
    }
    if (state.metadata.timestamp) {
      var d = new Date(state.metadata.timestamp);
      meta.appendChild(metaItem(d.toLocaleString()));
    }
    if (state.metadata.duration) {
      meta.appendChild(metaItem(state.metadata.duration + 'ms'));
    }
    if (state.coverage) {
      var cov = state.coverage.total > 0
        ? Math.round((state.coverage.specced / state.coverage.total) * 100)
        : 0;
      meta.appendChild(metaItem('Coverage: ' + cov + '%'));
    }
    header.appendChild(meta);

    // Stat cards
    header.appendChild(buildStats(state.counts));

    // Action buttons
    var actions = createElement('div', 'sg-report-actions');
    actions.appendChild(createSmallBtn('Run Again', function () { post('runScan'); }));
    actions.appendChild(createSmallBtn('Export JSON', function () { post('exportJson'); }));
    actions.appendChild(createSmallBtn('Copy Markdown', function () { post('copySummary'); }));
    header.appendChild(actions);

    return header;
  }

  function metaItem(text) {
    var el = createElement('span', 'sg-report-meta-item');
    el.textContent = text;
    return el;
  }

  // ── Filters ───────────────────────────────────────────────────

  function buildFilters(state) {
    var wrap = createElement('div', 'sg-mb-16');

    // Search
    var search = createElement('input', 'sg-search');
    search.type = 'text';
    search.placeholder = 'Search files, messages...';
    search.setAttribute('aria-label', 'Search findings');
    search.value = searchQuery;
    search.addEventListener('input', function () {
      searchQuery = search.value.toLowerCase();
      refilter();
    });
    wrap.appendChild(search);

    // Chips
    var chips = createElement('div', 'sg-filters');
    var filters = [
      { id: 'all', label: 'All', count: state.counts.total },
      { id: 'FAIL', label: 'Failed', count: state.counts.fail },
      { id: 'WARN', label: 'Warn', count: state.counts.warn },
      { id: 'PASS', label: 'Passed', count: state.counts.pass },
    ];
    filters.forEach(function (f) {
      var chip = createElement('button', 'sg-chip');
      chip.setAttribute('type', 'button');
      chip.setAttribute('role', 'switch');
      chip.setAttribute('aria-pressed', activeFilter === f.id ? 'true' : 'false');
      chip.setAttribute('data-filter', f.id);

      var label = document.createTextNode(f.label + ' ');
      chip.appendChild(label);

      var count = createElement('span', 'sg-chip-count');
      count.textContent = String(f.count);
      chip.appendChild(count);

      if (activeFilter === f.id) chip.classList.add('sg-chip--active');

      chip.addEventListener('click', function () {
        activeFilter = f.id;
        render(currentState);
      });
      chips.appendChild(chip);
    });
    wrap.appendChild(chips);

    return wrap;
  }

  // ── Findings list ─────────────────────────────────────────────

  function buildFindingsList(state) {
    var filtered = state.findings.filter(function (f) {
      if (activeFilter !== 'all' && f.status !== activeFilter) return false;
      if (searchQuery) {
        var haystack = (f.file + ' ' + f.blockers.join(' ') + ' ' + f.errors.join(' ')).toLowerCase();
        if (haystack.indexOf(searchQuery) === -1) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      var empty = createElement('div', 'sg-empty');
      empty.textContent = searchQuery ? 'No matches for "' + searchQuery + '".' : 'No findings in this category.';
      return empty;
    }

    var list = createElement('div', 'sg-findings');
    list.setAttribute('role', 'list');
    list.setAttribute('aria-label', 'Scan findings');

    filtered.forEach(function (f, idx) {
      var row = createElement('div', 'sg-finding');
      row.setAttribute('tabindex', '0');
      row.setAttribute('role', 'listitem');
      row.setAttribute('aria-label', f.status + ' ' + f.file);
      row.setAttribute('data-idx', String(idx));
      row.setAttribute('data-file', f.file);

      // Click opens file
      row.addEventListener('click', function () {
        post('openFile', { file: f.file, line: 1 });
      });

      // Keyboard: Enter opens, Up/Down navigates
      row.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          post('openFile', { file: f.file, line: 1 });
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          var next = row.nextElementSibling;
          if (next) next.focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          var prev = row.previousElementSibling;
          if (prev) prev.focus();
        }
      });

      // Dot
      var dotClass = f.status === 'PASS' ? 'pass' : f.status === 'WARN' ? 'warn' : 'fail';
      row.appendChild(createElement('span', 'sg-dot sg-dot--' + dotClass));

      // Body
      var body = createElement('div', 'sg-flex-1');

      var fileEl = createElement('div', 'sg-finding-file');
      fileEl.textContent = f.file;
      body.appendChild(fileEl);

      var msgs = f.blockers.concat(f.errors);
      if (msgs.length > 0) {
        msgs.forEach(function (m) {
          var msgEl = createElement('div', 'sg-finding-msg');
          msgEl.textContent = m;
          body.appendChild(msgEl);
        });
      }

      var modeEl = createElement('div', 'sg-finding-msg');
      modeEl.textContent = f.mode;
      body.appendChild(modeEl);

      row.appendChild(body);

      // Score
      var score = createElement('span', 'sg-finding-score');
      score.textContent = Math.round(f.score * 100) + '%';
      row.appendChild(score);

      list.appendChild(row);
    });

    return list;
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

  // ── Empty state ───────────────────────────────────────────────

  function buildEmpty() {
    var el = createElement('div', 'sg-empty');
    var icon = createElement('div', 'sg-empty-icon');
    icon.textContent = '\u{1F50D}';
    el.appendChild(icon);
    var text = createElement('div', '');
    text.textContent = 'Run a scan to see results.';
    el.appendChild(text);
    var btn = createElement('button', 'sg-btn sg-btn--primary sg-btn--sm sg-mt-16');
    btn.textContent = 'Run Scan';
    btn.addEventListener('click', function () { post('runScan'); });
    el.appendChild(btn);
    return el;
  }

  // ── Refilter (search only — avoid full re-render) ─────────────

  function refilter() {
    if (currentState) render(currentState);
  }

  // ── Helpers ───────────────────────────────────────────────────

  function createElement(tag, className) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    return el;
  }

  function createBadge(text, variant) {
    var el = createElement('span', 'sg-badge sg-badge--' + variant);
    el.textContent = text;
    return el;
  }

  function createSmallBtn(text, onClick) {
    var btn = createElement('button', 'sg-btn sg-btn--sm');
    btn.textContent = text;
    btn.setAttribute('type', 'button');
    btn.addEventListener('click', onClick);
    return btn;
  }

  function verdictClass(v) {
    if (v === 'SHIP') return 'ship';
    if (v === 'WARN') return 'warn';
    if (v === 'NO_SHIP') return 'noship';
    return 'idle';
  }

  // ── Message handling ──────────────────────────────────────────

  window.addEventListener('message', function (event) {
    var msg = event.data;
    if (msg.type === 'state') {
      render(msg.payload);
    }
  });

  // Request state on load
  post('requestState');
})();
