/**
 * Error reference website generator
 */

import * as path from 'path';
import type { ErrorCatalog } from '../catalog.js';
import type {
  ErrorDefinition,
  ErrorGroup,
  GeneratorOutput,
  WebsiteConfig,
} from '../types.js';

/**
 * Website generator class
 */
export class WebsiteGenerator {
  private config: WebsiteConfig;

  constructor(config: WebsiteConfig) {
    this.config = {
      title: 'Error Reference',
      description: 'API Error Documentation',
      includeSearch: true,
      theme: 'auto',
      ...config,
    };
  }

  /**
   * Generate website files
   */
  async generate(catalog: ErrorCatalog): Promise<GeneratorOutput[]> {
    const outputs: GeneratorOutput[] = [];
    const errors = catalog.getAllErrors();
    const groups = catalog.getGroups();
    const stats = catalog.getStats();

    // Generate index.html
    outputs.push({
      path: path.join(this.config.outputDir, 'index.html'),
      content: this.generateIndexHtml(groups, stats),
      type: 'html',
    });

    // Generate individual error pages
    for (const error of errors) {
      outputs.push({
        path: path.join(this.config.outputDir, 'errors', `${error.id.toLowerCase()}.html`),
        content: this.generateErrorHtml(error, groups),
        type: 'html',
      });
    }

    // Generate domain pages
    for (const group of groups) {
      outputs.push({
        path: path.join(this.config.outputDir, 'domains', `${group.id}.html`),
        content: this.generateDomainHtml(group, groups),
        type: 'html',
      });
    }

    // Generate CSS
    outputs.push({
      path: path.join(this.config.outputDir, 'styles.css'),
      content: this.generateCss(),
      type: 'css',
    });

    // Generate JavaScript
    outputs.push({
      path: path.join(this.config.outputDir, 'app.js'),
      content: this.generateJs(errors),
      type: 'js',
    });

    // Generate search index
    if (this.config.includeSearch) {
      outputs.push({
        path: path.join(this.config.outputDir, 'search-index.json'),
        content: JSON.stringify(this.generateSearchIndex(errors)),
        type: 'json',
      });
    }

    return outputs;
  }

  /**
   * Generate index HTML
   */
  private generateIndexHtml(
    groups: ErrorGroup[],
    stats: ReturnType<ErrorCatalog['getStats']>
  ): string {
    return `<!DOCTYPE html>
<html lang="en" data-theme="${this.config.theme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.config.title}</title>
  <meta name="description" content="${this.config.description}">
  <link rel="stylesheet" href="styles.css">
  ${this.config.customCss ? `<link rel="stylesheet" href="${this.config.customCss}">` : ''}
</head>
<body>
  <nav class="sidebar">
    ${this.config.logo ? `<img src="${this.config.logo}" alt="Logo" class="logo">` : ''}
    <h1>${this.config.title}</h1>
    ${this.config.includeSearch ? '<input type="search" id="search" placeholder="Search errors...">' : ''}
    <ul class="nav-list">
      ${groups.map((g) => `
        <li>
          <a href="domains/${g.id}.html">${g.name}</a>
          <span class="badge">${g.errors.length}</span>
        </li>
      `).join('')}
    </ul>
  </nav>
  
  <main class="content">
    <section class="stats">
      <h2>Overview</h2>
      <div class="stat-grid">
        <div class="stat-card">
          <span class="stat-value">${stats.totalErrors}</span>
          <span class="stat-label">Total Errors</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">${Object.keys(stats.byDomain).length}</span>
          <span class="stat-label">Domains</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">${stats.retriableCount}</span>
          <span class="stat-label">Retriable</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">${stats.deprecatedCount}</span>
          <span class="stat-label">Deprecated</span>
        </div>
      </div>
    </section>
    
    <section class="domains">
      <h2>Error Domains</h2>
      <div class="domain-grid">
        ${groups.map((g) => `
          <a href="domains/${g.id}.html" class="domain-card">
            <h3>${g.name}</h3>
            <p>${g.description || `${g.errors.length} errors`}</p>
            <div class="domain-errors">
              ${g.errors.slice(0, 3).map((e) => `<span class="error-badge">${e.code}</span>`).join('')}
              ${g.errors.length > 3 ? `<span class="error-badge">+${g.errors.length - 3}</span>` : ''}
            </div>
          </a>
        `).join('')}
      </div>
    </section>
    
    <section class="recent">
      <h2>All Errors</h2>
      <table class="error-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Error</th>
            <th>HTTP</th>
            <th>Retriable</th>
          </tr>
        </thead>
        <tbody>
          ${groups.flatMap((g) => g.errors).map((e) => `
            <tr>
              <td><code>${e.code}</code></td>
              <td><a href="errors/${e.id.toLowerCase()}.html">${e.id}</a></td>
              <td><span class="http-badge http-${Math.floor(e.httpStatus / 100)}xx">${e.httpStatus}</span></td>
              <td>${e.retriable ? '✓' : '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>
  </main>
  
  <div id="search-results" class="search-results hidden"></div>
  <script src="app.js"></script>
</body>
</html>`;
  }

  /**
   * Generate error detail HTML
   */
  private generateErrorHtml(error: ErrorDefinition, groups: ErrorGroup[]): string {
    return `<!DOCTYPE html>
<html lang="en" data-theme="${this.config.theme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${error.id} - ${this.config.title}</title>
  <link rel="stylesheet" href="../styles.css">
</head>
<body>
  <nav class="sidebar">
    <a href="../index.html" class="back-link">← Back to Index</a>
    <h1>${this.config.title}</h1>
    <ul class="nav-list">
      ${groups.map((g) => `
        <li>
          <a href="../domains/${g.id}.html">${g.name}</a>
        </li>
      `).join('')}
    </ul>
  </nav>
  
  <main class="content">
    <article class="error-detail">
      <header>
        <h1>${error.id}</h1>
        ${error.deprecated ? `<span class="deprecated-badge">Deprecated</span>` : ''}
      </header>
      
      <div class="error-meta">
        <div class="meta-item">
          <span class="meta-label">Code</span>
          <code class="meta-value">${error.code}</code>
        </div>
        <div class="meta-item">
          <span class="meta-label">HTTP Status</span>
          <span class="http-badge http-${Math.floor(error.httpStatus / 100)}xx">${error.httpStatus} ${this.getStatusName(error.httpStatus)}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Retriable</span>
          <span class="meta-value">${error.retriable ? 'Yes' : 'No'}</span>
        </div>
        ${error.retryAfter ? `
        <div class="meta-item">
          <span class="meta-label">Retry After</span>
          <span class="meta-value">${error.retryAfter} seconds</span>
        </div>
        ` : ''}
        <div class="meta-item">
          <span class="meta-label">Severity</span>
          <span class="severity-badge severity-${error.severity}">${error.severity}</span>
        </div>
      </div>
      
      ${error.deprecated ? `
      <div class="deprecation-notice">
        <strong>⚠️ Deprecated</strong> since ${error.deprecated.since}
        ${error.deprecated.replacement ? `<br>Use <code>${error.deprecated.replacement}</code> instead.` : ''}
        ${error.deprecated.message ? `<p>${error.deprecated.message}</p>` : ''}
      </div>
      ` : ''}
      
      <section>
        <h2>Description</h2>
        <p>${error.description || error.message}</p>
      </section>
      
      ${error.causes.length > 0 ? `
      <section>
        <h2>When This Occurs</h2>
        <ul>
          ${error.causes.map((c) => `<li>${c}</li>`).join('')}
        </ul>
      </section>
      ` : ''}
      
      ${error.resolutions.length > 0 ? `
      <section>
        <h2>Resolution</h2>
        <ul>
          ${error.resolutions.map((r) => `<li>${r}</li>`).join('')}
        </ul>
      </section>
      ` : ''}
      
      <section>
        <h2>Example Response</h2>
        <pre><code class="language-json">${JSON.stringify(
          error.example?.response.body ?? {
            error: {
              code: error.code,
              type: error.id,
              message: error.message,
              details: {},
            },
          },
          null,
          2
        )}</code></pre>
      </section>
      
      ${error.relatedErrors.length > 0 ? `
      <section>
        <h2>Related Errors</h2>
        <ul>
          ${error.relatedErrors.map((r) => `<li><a href="${r.toLowerCase()}.html">${r}</a></li>`).join('')}
        </ul>
      </section>
      ` : ''}
      
      ${error.tags.length > 0 ? `
      <section>
        <h2>Tags</h2>
        <div class="tags">
          ${error.tags.map((t) => `<span class="tag">${t}</span>`).join('')}
        </div>
      </section>
      ` : ''}
    </article>
  </main>
</body>
</html>`;
  }

  /**
   * Generate domain HTML
   */
  private generateDomainHtml(group: ErrorGroup, allGroups: ErrorGroup[]): string {
    return `<!DOCTYPE html>
<html lang="en" data-theme="${this.config.theme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${group.name} - ${this.config.title}</title>
  <link rel="stylesheet" href="../styles.css">
</head>
<body>
  <nav class="sidebar">
    <a href="../index.html" class="back-link">← Back to Index</a>
    <h1>${this.config.title}</h1>
    <ul class="nav-list">
      ${allGroups.map((g) => `
        <li class="${g.id === group.id ? 'active' : ''}">
          <a href="${g.id}.html">${g.name}</a>
          <span class="badge">${g.errors.length}</span>
        </li>
      `).join('')}
    </ul>
  </nav>
  
  <main class="content">
    <header>
      <h1>${group.name}</h1>
      ${group.description ? `<p class="description">${group.description}</p>` : ''}
    </header>
    
    <table class="error-table">
      <thead>
        <tr>
          <th>Code</th>
          <th>Error</th>
          <th>Message</th>
          <th>HTTP</th>
          <th>Retriable</th>
        </tr>
      </thead>
      <tbody>
        ${group.errors.map((e) => `
          <tr>
            <td><code>${e.code}</code></td>
            <td><a href="../errors/${e.id.toLowerCase()}.html">${e.id}</a></td>
            <td>${e.message}</td>
            <td><span class="http-badge http-${Math.floor(e.httpStatus / 100)}xx">${e.httpStatus}</span></td>
            <td>${e.retriable ? '✓' : '—'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </main>
</body>
</html>`;
  }

  /**
   * Generate CSS styles
   */
  private generateCss(): string {
    return `/* Error Catalog Styles */
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --text-primary: #1a1a1a;
  --text-secondary: #666666;
  --border-color: #e0e0e0;
  --accent-color: #3b82f6;
  --success-color: #22c55e;
  --warning-color: #f59e0b;
  --error-color: #ef4444;
  --sidebar-width: 280px;
}

[data-theme="dark"] {
  --bg-primary: #1a1a1a;
  --bg-secondary: #2d2d2d;
  --text-primary: #ffffff;
  --text-secondary: #a0a0a0;
  --border-color: #404040;
}

@media (prefers-color-scheme: dark) {
  [data-theme="auto"] {
    --bg-primary: #1a1a1a;
    --bg-secondary: #2d2d2d;
    --text-primary: #ffffff;
    --text-secondary: #a0a0a0;
    --border-color: #404040;
  }
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  line-height: 1.6;
}

.sidebar {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: var(--sidebar-width);
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  padding: 1.5rem;
  overflow-y: auto;
}

.sidebar h1 {
  font-size: 1.25rem;
  margin-bottom: 1rem;
}

.sidebar .logo {
  max-width: 100%;
  margin-bottom: 1rem;
}

#search {
  width: 100%;
  padding: 0.5rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  margin-bottom: 1rem;
}

.nav-list {
  list-style: none;
}

.nav-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
}

.nav-list li.active a {
  color: var(--accent-color);
  font-weight: 600;
}

.nav-list a {
  color: var(--text-primary);
  text-decoration: none;
}

.nav-list a:hover {
  color: var(--accent-color);
}

.badge {
  background: var(--bg-primary);
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.back-link {
  display: block;
  margin-bottom: 1rem;
  color: var(--text-secondary);
  text-decoration: none;
}

.content {
  margin-left: var(--sidebar-width);
  padding: 2rem;
  max-width: 1000px;
}

.stats {
  margin-bottom: 2rem;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.stat-card {
  background: var(--bg-secondary);
  padding: 1.5rem;
  border-radius: 8px;
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 2rem;
  font-weight: 700;
  color: var(--accent-color);
}

.stat-label {
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.domain-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.domain-card {
  background: var(--bg-secondary);
  padding: 1.5rem;
  border-radius: 8px;
  text-decoration: none;
  color: var(--text-primary);
  transition: transform 0.2s, box-shadow 0.2s;
}

.domain-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.domain-card h3 {
  margin-bottom: 0.5rem;
}

.domain-card p {
  color: var(--text-secondary);
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

.domain-errors {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.error-badge {
  background: var(--bg-primary);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-family: monospace;
}

.error-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
}

.error-table th,
.error-table td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
}

.error-table th {
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.error-table a {
  color: var(--accent-color);
  text-decoration: none;
}

.error-table a:hover {
  text-decoration: underline;
}

.http-badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.http-4xx {
  background: #fef3c7;
  color: #92400e;
}

.http-5xx {
  background: #fee2e2;
  color: #991b1b;
}

[data-theme="dark"] .http-4xx {
  background: #78350f;
  color: #fef3c7;
}

[data-theme="dark"] .http-5xx {
  background: #7f1d1d;
  color: #fee2e2;
}

.error-detail {
  max-width: 800px;
}

.error-detail header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
}

.deprecated-badge {
  background: var(--warning-color);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.error-meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
  background: var(--bg-secondary);
  padding: 1.5rem;
  border-radius: 8px;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.meta-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.meta-value {
  font-weight: 600;
}

.severity-badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.severity-critical {
  background: #fee2e2;
  color: #991b1b;
}

.severity-error {
  background: #ffedd5;
  color: #9a3412;
}

.severity-warning {
  background: #fef3c7;
  color: #92400e;
}

.severity-info {
  background: #dbeafe;
  color: #1e40af;
}

.deprecation-notice {
  background: #fef3c7;
  border: 1px solid #f59e0b;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 2rem;
}

[data-theme="dark"] .deprecation-notice {
  background: #78350f;
  border-color: #f59e0b;
}

.error-detail section {
  margin-bottom: 2rem;
}

.error-detail h2 {
  font-size: 1.25rem;
  margin-bottom: 0.75rem;
  color: var(--text-secondary);
}

.error-detail ul {
  padding-left: 1.5rem;
}

.error-detail li {
  margin-bottom: 0.5rem;
}

.error-detail pre {
  background: var(--bg-secondary);
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
}

.error-detail code {
  font-family: 'SF Mono', Monaco, Consolas, monospace;
  font-size: 0.875rem;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tag {
  background: var(--bg-secondary);
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.875rem;
}

.search-results {
  position: fixed;
  top: 80px;
  left: calc(var(--sidebar-width) + 2rem);
  right: 2rem;
  max-height: 400px;
  overflow-y: auto;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 100;
}

.search-results.hidden {
  display: none;
}

.search-result {
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.search-result:last-child {
  border-bottom: none;
}

.search-result a {
  color: var(--accent-color);
  text-decoration: none;
  font-weight: 600;
}

.search-result p {
  color: var(--text-secondary);
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

@media (max-width: 768px) {
  .sidebar {
    position: relative;
    width: 100%;
  }
  
  .content {
    margin-left: 0;
  }
  
  .search-results {
    left: 1rem;
    right: 1rem;
  }
}`;
  }

  /**
   * Generate JavaScript
   */
  private generateJs(errors: ErrorDefinition[]): string {
    return `// Error Catalog App
(function() {
  const searchInput = document.getElementById('search');
  const searchResults = document.getElementById('search-results');
  
  if (!searchInput || !searchResults) return;
  
  let searchIndex = [];
  
  // Load search index
  fetch('search-index.json')
    .then(res => res.json())
    .then(data => { searchIndex = data; })
    .catch(console.error);
  
  searchInput.addEventListener('input', function(e) {
    const query = e.target.value.toLowerCase().trim();
    
    if (query.length < 2) {
      searchResults.classList.add('hidden');
      return;
    }
    
    const results = searchIndex.filter(item =>
      item.id.toLowerCase().includes(query) ||
      item.code.toLowerCase().includes(query) ||
      item.message.toLowerCase().includes(query)
    ).slice(0, 10);
    
    if (results.length === 0) {
      searchResults.innerHTML = '<div class="search-result">No results found</div>';
    } else {
      searchResults.innerHTML = results.map(r => \`
        <div class="search-result">
          <a href="errors/\${r.id.toLowerCase()}.html">\${r.id}</a>
          <code>\${r.code}</code>
          <p>\${r.message}</p>
        </div>
      \`).join('');
    }
    
    searchResults.classList.remove('hidden');
  });
  
  // Close search on click outside
  document.addEventListener('click', function(e) {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
      searchResults.classList.add('hidden');
    }
  });
})();`;
  }

  /**
   * Generate search index
   */
  private generateSearchIndex(
    errors: ErrorDefinition[]
  ): Array<{ id: string; code: string; message: string; domain: string }> {
    return errors.map((e) => ({
      id: e.id,
      code: e.code,
      message: e.message,
      domain: e.domain,
    }));
  }

  /**
   * Get HTTP status name
   */
  private getStatusName(status: number): string {
    const names: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      408: 'Request Timeout',
      409: 'Conflict',
      422: 'Unprocessable Entity',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
      504: 'Gateway Timeout',
    };
    return names[status] ?? '';
  }
}
