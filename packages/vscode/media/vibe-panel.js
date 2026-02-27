/* ============================================================================
 * ISL Vibe Panel — WebView renderer
 *
 * Renders: Prompt Input, Pipeline Progress, Results, Actions
 * Communicates with extension host via postMessage
 * ============================================================================ */

(function () {
  const vscode = acquireVsCodeApi();
  const root = document.getElementById('vibe-root');

  function post(type, payload) {
    vscode.postMessage({ type, payload });
  }

  function el(tag, className, content) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (typeof content === 'string') e.textContent = content;
    else if (Array.isArray(content)) content.forEach((c) => e.appendChild(c));
    return e;
  }

  function trustBadgeClass(score) {
    if (score == null) return 'vibe-trust-badge';
    const pct = Math.round(score * 100);
    if (pct >= 80) return 'vibe-trust-badge vibe-trust-badge--green';
    if (pct >= 50) return 'vibe-trust-badge vibe-trust-badge--yellow';
    return 'vibe-trust-badge vibe-trust-badge--red';
  }

  function stageIcon(stage) {
    const icon = el('span', 'vibe-stage-icon');
    if (stage.status === 'running') {
      icon.appendChild(el('span', 'vibe-spinner'));
    } else if (stage.status === 'done') {
      icon.textContent = '✓';
    } else if (stage.status === 'failed') {
      icon.textContent = '✗';
    } else {
      icon.textContent = '○';
    }
    return icon;
  }

  function render(state) {
    if (!root || !state) return;
    root.innerHTML = '';

    root.appendChild(renderPromptSection(state));
    root.appendChild(renderProgressSection(state));
    root.appendChild(renderResultsSection(state));
    root.appendChild(renderActionsSection(state));
  }

  function renderPromptSection(state) {
    const section = el('div', 'vibe-section');
    section.appendChild(el('div', 'vibe-section-title', 'Prompt Input'));

    const body = el('div', 'vibe-section-body');
    const textarea = el('textarea', 'vibe-textarea');
    textarea.placeholder = 'Describe the app you want to build...';
    textarea.value = state.prompt || '';
    textarea.addEventListener('input', () => {
      // Local state only; sent on Generate
    });

    const row = el('div', 'vibe-row');
    const frameworkSelect = el('select', 'vibe-select');
    ['nextjs', 'express', 'fastify'].forEach((f) => {
      const opt = document.createElement('option');
      opt.value = f;
      opt.textContent = f === 'nextjs' ? 'Next.js' : f === 'express' ? 'Express' : 'Fastify';
      if (f === (state.lastFramework || 'nextjs')) opt.selected = true;
      frameworkSelect.appendChild(opt);
    });

    const dbSelect = el('select', 'vibe-select');
    ['sqlite', 'postgresql'].forEach((d) => {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d === 'sqlite' ? 'SQLite' : 'PostgreSQL';
      if (d === (state.lastDatabase || 'sqlite')) opt.selected = true;
      dbSelect.appendChild(opt);
    });

    const genBtn = el('button', 'vibe-btn', 'Generate');
    genBtn.disabled = state.phase === 'running';
    genBtn.addEventListener('click', () => {
      const prompt = textarea.value.trim();
      if (!prompt) return;
      post('generate', {
        prompt,
        framework: frameworkSelect.value,
        database: dbSelect.value,
      });
    });

    const outputBtn = el('button', 'vibe-btn vibe-btn--secondary', 'Select output folder');
    outputBtn.title = 'Choose where to generate the project';
    outputBtn.addEventListener('click', () => post('selectOutputDir'));

    row.appendChild(frameworkSelect);
    row.appendChild(dbSelect);
    row.appendChild(genBtn);
    row.appendChild(outputBtn);
    body.appendChild(textarea);
    body.appendChild(row);

    if (state.recentPrompts && state.recentPrompts.length > 0) {
      const recent = el('div', 'vibe-recent');
      const recentLabel = el('div');
      recentLabel.style.fontSize = '10px';
      recentLabel.style.color = 'var(--vibe-text-muted)';
      recentLabel.style.marginTop = '8px';
      recentLabel.textContent = 'Recent prompts';
      recent.appendChild(recentLabel);
      state.recentPrompts.slice(0, 5).forEach((p) => {
        const btn = el('button', 'vibe-recent-item', p);
        btn.title = p;
        btn.addEventListener('click', () => {
          textarea.value = p;
        });
        recent.appendChild(btn);
      });
      body.appendChild(recent);
    }

    section.appendChild(body);
    return section;
  }

  function renderProgressSection(state) {
    const section = el('div', 'vibe-section');
    section.appendChild(el('div', 'vibe-section-title', 'Pipeline Progress'));

    const body = el('div', 'vibe-section-body');
    const stageNames = [
      'Convert to ISL spec',
      'Validate spec',
      'Generate code',
      'Write files',
      'Verify',
    ];
    const stages = state.stages && state.stages.length > 0
      ? state.stages
      : stageNames.map((name, i) => ({
          id: i + 1,
          name: stageNames[i],
          status: state.phase === 'running' && i === 0 ? 'running' : 'pending',
        }));

    const container = el('div', 'vibe-stages');
    stages.forEach((s) => {
      const stageEl = el('div', `vibe-stage vibe-stage--${s.status}`);
      stageEl.appendChild(stageIcon(s));
      const info = el('div');
      info.appendChild(el('span', 'vibe-stage-name', s.name));
      if (s.duration != null) {
        info.appendChild(el('span', 'vibe-stage-meta', ` ${s.duration}ms`));
      }
      if (s.tokenCount != null) {
        info.appendChild(el('span', 'vibe-stage-meta', ` · ${s.tokenCount} tokens`));
      }
      stageEl.appendChild(info);
      if (s.error) {
        stageEl.appendChild(el('div', 'vibe-stage-error', s.error));
        const retry = el('button', 'vibe-btn vibe-btn--secondary', 'Retry');
        retry.addEventListener('click', () => post('retryStage', s.id));
        stageEl.appendChild(retry);
      }
      container.appendChild(stageEl);
    });
    body.appendChild(container);

    if (state.phase === 'running' || state.phase === 'done') {
      const progress = el('div', 'vibe-progress-bar');
      const fill = el('div', 'vibe-progress-fill');
      fill.style.width = `${state.overallProgress ?? 0}%`;
      progress.appendChild(fill);
      body.appendChild(progress);
      if (state.etaSeconds != null && state.phase === 'running') {
        body.appendChild(el('div', 'vibe-eta', `ETA: ~${state.etaSeconds}s`));
      }
    }

    section.appendChild(body);
    return section;
  }

  function renderResultsSection(state) {
    const section = el('div', 'vibe-section');
    section.appendChild(el('div', 'vibe-section-title', 'Results'));

    const body = el('div', 'vibe-section-body');
    if (state.phase === 'done' && state.files && state.files.length > 0) {
      const tree = el('div', 'vibe-file-tree');
      state.files.forEach((f) => {
        const item = el('div', 'vibe-file-item', f.path);
        item.title = f.path;
        item.addEventListener('click', () => post('openFile', f.path));
        tree.appendChild(item);
      });
      body.appendChild(tree);

      if (state.score != null) {
        const badge = el('span', trustBadgeClass(state.score), `${Math.round(state.score * 100)}% Trust`);
        body.appendChild(badge);
      }

      if (state.certificate) {
        const cert = state.certificate;
        const summary = el('div', 'vibe-cert-summary');
        summary.textContent = `Verdict: ${cert.verdict}`;
        if (cert.testResults) {
          summary.textContent += ` · Tests: ${cert.testResults.passed} passed, ${cert.testResults.failed} failed`;
        }
        if (cert.securityFindings && cert.securityFindings.length > 0) {
          summary.textContent += ` · ${cert.securityFindings.length} security finding(s)`;
        }
        body.appendChild(summary);
        const openCert = el('button', 'vibe-btn vibe-btn--secondary', 'Open Certificate');
        openCert.addEventListener('click', () => post('openCertificate'));
        body.appendChild(openCert);
      }
    } else if (state.phase === 'done' && state.error) {
      body.appendChild(el('div', 'vibe-stage-error', state.error));
    } else {
      body.appendChild(el('div', 'vibe-cert-summary', 'No results yet. Run Generate to create files.'));
    }

    section.appendChild(body);
    return section;
  }

  function renderActionsSection(state) {
    const section = el('div', 'vibe-section');
    section.appendChild(el('div', 'vibe-section-title', 'Actions'));

    const body = el('div', 'vibe-section-body');
    const actions = el('div', 'vibe-actions');

    const runTests = el('button', 'vibe-btn vibe-btn--secondary', 'Run Tests');
    runTests.addEventListener('click', () => post('runTests'));
    runTests.disabled = state.phase !== 'done' || !state.outputDir;

    const devServer = el('button', 'vibe-btn vibe-btn--secondary', 'Start Dev Server');
    devServer.addEventListener('click', () => post('startDevServer'));
    devServer.disabled = state.phase !== 'done' || !state.outputDir;

    const heal = el('button', 'vibe-btn vibe-btn--secondary', 'Heal');
    heal.addEventListener('click', () => post('heal'));
    heal.disabled = state.phase !== 'done';

    actions.appendChild(runTests);
    actions.appendChild(devServer);
    actions.appendChild(heal);
    body.appendChild(actions);
    section.appendChild(body);
    return section;
  }

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg.type === 'state') render(msg.payload);
  });

  post('requestState');
})();
