(function () {
  const vs = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
  const root = document.getElementById('root');
  if (!root) return;

  let state = null;
  let filter = 'all';
  let groupBy = 'file';
  let selectedIndex = -1;
  let filteredFindings = [];

  function escapeText(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function escapeAttr(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function getVerdictBadgeClass(verdict) {
    if (!verdict) return 'idle';
    if (verdict === 'SHIP') return 'ship';
    if (verdict === 'WARN') return 'warn';
    return 'noship';
  }

  function getStatusDotClass(status) {
    if (status === 'PASS') return 'sg-dot--info';
    if (status === 'WARN') return 'sg-dot--warning';
    return 'sg-dot--error';
  }

  function applyFilter() {
    const s = state;
    if (!s?.findings?.length) {
      filteredFindings = [];
      return;
    }
    if (filter === 'all') {
      filteredFindings = s.findings;
    } else {
      filteredFindings = s.findings.filter(f => f.status === filter);
    }
  }

  function renderHeader() {
    const s = state;
    const hasData = s && (s.verdict || s.findings?.length);
    const verdictLabel = s?.verdict ?? 'No data';
    const meta = hasData
      ? `Score: ${s.score ?? 0}% | Coverage: ${s.coverage?.total ? Math.round((s.coverage.specced / s.coverage.total) * 100) : 0}% | ${s.counts?.total ?? 0} files | ${s.metadata?.timestamp ?? ''}`
      : 'Run a scan to see results.';

    return `
      <div class="sg-header">
        <div class="sg-badge sg-badge-${getVerdictBadgeClass(s?.verdict)}" id="verdict">${escapeText(verdictLabel)}</div>
        <div class="sg-meta" id="meta">${escapeText(meta)}</div>
        <div style="margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="sg-btn" id="run-scan" style="width: auto;">Run Scan</button>
          <button class="sg-btn" id="copy-summary" style="width: auto;">Copy Summary</button>
          <button class="sg-btn" id="export-json" style="width: auto;">Export JSON</button>
        </div>
      </div>
    `;
  }

  function renderFilters() {
    if (!state?.findings?.length) return '';
    return `
      <div class="sg-mb-16" style="display: flex; flex-wrap: wrap; gap: 8px;">
        <button class="sg-filter-chip ${filter === 'all' ? 'active' : ''}" data-filter="all" aria-label="Show all">All</button>
        <button class="sg-filter-chip ${filter === 'FAIL' ? 'active' : ''}" data-filter="FAIL" aria-label="Show failures">Failures</button>
        <button class="sg-filter-chip ${filter === 'WARN' ? 'active' : ''}" data-filter="WARN" aria-label="Show warnings">Warnings</button>
        <button class="sg-filter-chip ${filter === 'PASS' ? 'active' : ''}" data-filter="PASS" aria-label="Show passes">Passed</button>
      </div>
    `;
  }

  function renderFindings() {
    if (!filteredFindings.length) {
      return '<div class="sg-p-32" style="text-align: center; color: var(--vscode-descriptionForeground);">' +
        (state?.findings?.length ? 'No findings match the current filter.' : 'Run a scan to see results.') +
        '</div>';
    }

    return `
      <div class="sg-card" id="findings-list" role="list">
        ${filteredFindings.map((f, i) => {
          const statusClass = f.status === 'PASS' ? 'pass' : f.status === 'WARN' ? 'warn' : 'fail';
          const msgs = [...(f.blockers || []), ...(f.errors || [])];
          const msgHtml = msgs.length > 0
            ? '<div class="sg-finding-msg">' + msgs.map(m => escapeText(m)).join('<br>') + '</div>'
            : '';
          const selected = i === selectedIndex ? ' style="background: var(--vscode-list-hoverBackground);"' : '';
          return `
            <div class="sg-finding sg-row" data-index="${i}" data-file="${escapeAttr(f.file)}" tabindex="0" role="listitem"${selected}>
              <span class="sg-dot ${getStatusDotClass(f.status)}"></span>
              <span class="sg-finding-status ${statusClass}">${escapeText(f.status)}</span>
              <div class="sg-finding-body">
                <a class="sg-finding-file" href="#" data-file="${escapeAttr(f.file)}" data-line="1" role="button" tabindex="-1">${escapeText(f.file)}</a>
                ${msgHtml}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function render() {
    applyFilter();
    root.innerHTML = `
      <div style="padding: 16px;">
        ${renderHeader()}
        ${renderFilters()}
        ${renderFindings()}
      </div>
    `;
    attachEventListeners();
  }

  function attachEventListeners() {
    const runScan = document.getElementById('run-scan');
    const copySummary = document.getElementById('copy-summary');
    const exportJson = document.getElementById('export-json');

    if (runScan) runScan.addEventListener('click', () => vs && vs.postMessage({ type: 'runScan' }));
    if (copySummary) copySummary.addEventListener('click', () => vs && vs.postMessage({ type: 'copySummary' }));
    if (exportJson) exportJson.addEventListener('click', () => vs && vs.postMessage({ type: 'exportJson' }));

    document.querySelectorAll('.sg-filter-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        filter = btn.dataset.filter || 'all';
        selectedIndex = -1;
        render();
      });
    });

    const list = document.getElementById('findings-list');
    if (list) {
      list.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          selectedIndex = Math.min(selectedIndex + 1, filteredFindings.length - 1);
          render();
          const item = list.querySelector(`[data-index="${selectedIndex}"]`);
          if (item) item.focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          selectedIndex = Math.max(selectedIndex - 1, -1);
          render();
          if (selectedIndex >= 0) {
            const item = list.querySelector(`[data-index="${selectedIndex}"]`);
            if (item) item.focus();
          }
        } else if (e.key === 'Enter' && selectedIndex >= 0 && filteredFindings[selectedIndex]) {
          e.preventDefault();
          const f = filteredFindings[selectedIndex];
          vs && vs.postMessage({ type: 'openFile', file: f.file, line: 1 });
        }
      });
    }

    document.querySelectorAll('.sg-finding-file').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const file = a.dataset.file;
        const line = a.dataset.line ? parseInt(a.dataset.line, 10) : undefined;
        if (file && vs) vs.postMessage({ type: 'openFile', file, line });
      });
      a.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          a.click();
        }
      });
    });

    document.querySelectorAll('.sg-finding.sg-row').forEach((row, i) => {
      row.addEventListener('click', () => {
        selectedIndex = i;
        const f = filteredFindings[i];
        if (f && vs) vs.postMessage({ type: 'openFile', file: f.file, line: 1 });
      });
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          row.click();
        }
      });
    });
  }

  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (msg.type === 'state' || msg.type === 'update') {
      state = msg.payload ?? null;
      selectedIndex = -1;
      render();
    }
  });

  if (vs) vs.postMessage({ type: 'requestState' });
})();
