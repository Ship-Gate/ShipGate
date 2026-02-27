// ============================================================================
// HTML Documentation Generator
// ============================================================================

import type { Domain, DocOptions, GeneratedFile } from '../types';

export function generateHTML(domain: Domain, options: DocOptions): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const { outputDir, title = domain.name, theme = 'light' } = options;

  // Main HTML file
  files.push({
    path: `${outputDir}/index.html`,
    content: generateHTMLPage(domain, title, theme),
  });

  // CSS
  files.push({
    path: `${outputDir}/styles.css`,
    content: generateCSS(theme),
  });

  // JavaScript for interactivity
  files.push({
    path: `${outputDir}/app.js`,
    content: generateJS(),
  });

  return files;
}

function generateHTMLPage(domain: Domain, title: string, theme: string): string {
  return `<!DOCTYPE html>
<html lang="en" data-theme="${theme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - API Documentation</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="layout">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="logo">
        <h1>${domain.name}</h1>
        ${domain.version ? `<span class="version">v${domain.version}</span>` : ''}
      </div>
      
      <nav class="nav">
        <div class="nav-section">
          <h2>Overview</h2>
          <a href="#overview" class="nav-link active">Getting Started</a>
        </div>
        
        ${domain.types.length > 0 ? `
        <div class="nav-section">
          <h2>Types</h2>
          ${domain.types.map(t => `<a href="#type-${t.name.toLowerCase()}" class="nav-link">${t.name}</a>`).join('\n          ')}
        </div>
        ` : ''}
        
        ${domain.entities.length > 0 ? `
        <div class="nav-section">
          <h2>Entities</h2>
          ${domain.entities.map(e => `<a href="#entity-${e.name.toLowerCase()}" class="nav-link">${e.name}</a>`).join('\n          ')}
        </div>
        ` : ''}
        
        ${domain.behaviors.length > 0 ? `
        <div class="nav-section">
          <h2>Behaviors</h2>
          ${domain.behaviors.map(b => `<a href="#behavior-${b.name.toLowerCase()}" class="nav-link">${b.name}</a>`).join('\n          ')}
        </div>
        ` : ''}
      </nav>
    </aside>
    
    <!-- Main Content -->
    <main class="content">
      <section id="overview" class="section">
        <h1>${title} API Documentation</h1>
        ${domain.description ? `<p class="description">${domain.description}</p>` : ''}
        
        <div class="stats">
          <div class="stat">
            <span class="stat-value">${domain.types.length}</span>
            <span class="stat-label">Types</span>
          </div>
          <div class="stat">
            <span class="stat-value">${domain.entities.length}</span>
            <span class="stat-label">Entities</span>
          </div>
          <div class="stat">
            <span class="stat-value">${domain.behaviors.length}</span>
            <span class="stat-label">Behaviors</span>
          </div>
          <div class="stat">
            <span class="stat-value">${domain.invariants.length}</span>
            <span class="stat-label">Invariants</span>
          </div>
        </div>
      </section>
      
      ${domain.types.length > 0 ? `
      <section class="section">
        <h2>Types</h2>
        ${domain.types.map(t => `
        <article id="type-${t.name.toLowerCase()}" class="card">
          <header class="card-header">
            <h3>${t.name}</h3>
            <span class="badge">Type</span>
          </header>
          <div class="card-body">
            ${t.description ? `<p>${t.description}</p>` : ''}
            <div class="field-row">
              <span class="field-label">Base Type:</span>
              <code class="type">${t.baseType}</code>
            </div>
            ${t.constraints.length > 0 ? `
            <div class="constraints">
              <h4>Constraints</h4>
              <ul>
                ${t.constraints.map(c => `<li><code>${c}</code></li>`).join('\n                ')}
              </ul>
            </div>
            ` : ''}
          </div>
        </article>
        `).join('\n')}
      </section>
      ` : ''}
      
      ${domain.entities.length > 0 ? `
      <section class="section">
        <h2>Entities</h2>
        ${domain.entities.map(e => `
        <article id="entity-${e.name.toLowerCase()}" class="card">
          <header class="card-header">
            <h3>${e.name}</h3>
            <span class="badge badge-entity">Entity</span>
          </header>
          <div class="card-body">
            ${e.description ? `<p>${e.description}</p>` : ''}
            
            <h4>Fields</h4>
            <table class="fields-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Type</th>
                  <th>Required</th>
                  <th>Annotations</th>
                </tr>
              </thead>
              <tbody>
                ${e.fields.map(f => `
                <tr>
                  <td><code>${f.name}</code></td>
                  <td><code class="type">${f.type}</code></td>
                  <td>${f.optional ? '❌' : '✓'}</td>
                  <td>${f.annotations.join(', ') || '-'}</td>
                </tr>
                `).join('\n                ')}
              </tbody>
            </table>
            
            ${e.invariants.length > 0 ? `
            <div class="invariants">
              <h4>Invariants</h4>
              <pre><code>${e.invariants.join('\n')}</code></pre>
            </div>
            ` : ''}
          </div>
        </article>
        `).join('\n')}
      </section>
      ` : ''}
      
      ${domain.behaviors.length > 0 ? `
      <section class="section">
        <h2>Behaviors</h2>
        ${domain.behaviors.map(b => `
        <article id="behavior-${b.name.toLowerCase()}" class="card">
          <header class="card-header">
            <h3>${b.name}</h3>
            <span class="badge badge-behavior">Behavior</span>
          </header>
          <div class="card-body">
            ${b.description ? `<p>${b.description}</p>` : ''}
            
            <div class="behavior-signature">
              <span class="keyword">input</span>
              (${b.inputs.map(i => `<code>${i.name}: ${i.type}</code>`).join(', ')})
              <span class="keyword">→</span>
              <code class="type">${b.outputType}</code>
            </div>
            
            ${b.errors.length > 0 ? `
            <div class="errors">
              <h4>Possible Errors</h4>
              <div class="error-list">
                ${b.errors.map(e => `<span class="badge badge-error">${e}</span>`).join(' ')}
              </div>
            </div>
            ` : ''}
            
            ${b.preconditions.length > 0 ? `
            <div class="conditions">
              <h4>Preconditions</h4>
              <pre><code>${b.preconditions.join('\n')}</code></pre>
            </div>
            ` : ''}
            
            ${b.postconditions.length > 0 ? `
            <div class="conditions">
              <h4>Postconditions</h4>
              <pre><code>${b.postconditions.join('\n')}</code></pre>
            </div>
            ` : ''}
          </div>
        </article>
        `).join('\n')}
      </section>
      ` : ''}
    </main>
  </div>
  
  <script src="app.js"></script>
</body>
</html>`;
}

function generateCSS(theme: string): string {
  const isDark = theme === 'dark';
  
  return `/* ISL Documentation Styles */
:root {
  --bg-primary: ${isDark ? '#1a1a2e' : '#ffffff'};
  --bg-secondary: ${isDark ? '#16213e' : '#f8fafc'};
  --bg-card: ${isDark ? '#0f3460' : '#ffffff'};
  --text-primary: ${isDark ? '#e2e8f0' : '#1e293b'};
  --text-secondary: ${isDark ? '#94a3b8' : '#64748b'};
  --border-color: ${isDark ? '#1e3a5f' : '#e2e8f0'};
  --accent: #3b82f6;
  --entity-color: #10b981;
  --behavior-color: #6366f1;
  --type-color: #ec4899;
  --error-color: #ef4444;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  line-height: 1.6;
}

.layout {
  display: flex;
  min-height: 100vh;
}

/* Sidebar */
.sidebar {
  width: 280px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  padding: 24px;
  position: fixed;
  height: 100vh;
  overflow-y: auto;
}

.logo h1 {
  font-size: 1.5rem;
  color: var(--accent);
}

.logo .version {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.nav {
  margin-top: 32px;
}

.nav-section {
  margin-bottom: 24px;
}

.nav-section h2 {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.nav-link {
  display: block;
  padding: 8px 12px;
  color: var(--text-primary);
  text-decoration: none;
  border-radius: 6px;
  margin-bottom: 2px;
  transition: background 0.2s;
}

.nav-link:hover,
.nav-link.active {
  background: var(--bg-card);
}

/* Main Content */
.content {
  flex: 1;
  margin-left: 280px;
  padding: 48px;
  max-width: 1200px;
}

.section {
  margin-bottom: 48px;
}

.section h1 {
  font-size: 2.5rem;
  margin-bottom: 16px;
}

.section h2 {
  font-size: 1.75rem;
  margin-bottom: 24px;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--border-color);
}

.description {
  font-size: 1.125rem;
  color: var(--text-secondary);
  margin-bottom: 32px;
}

/* Stats */
.stats {
  display: flex;
  gap: 24px;
  margin-bottom: 32px;
}

.stat {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  min-width: 120px;
}

.stat-value {
  display: block;
  font-size: 2rem;
  font-weight: bold;
  color: var(--accent);
}

.stat-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

/* Cards */
.card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  margin-bottom: 24px;
  overflow: hidden;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.card-header h3 {
  font-size: 1.25rem;
}

.card-body {
  padding: 24px;
}

.card-body h4 {
  font-size: 1rem;
  margin: 16px 0 8px;
  color: var(--text-secondary);
}

/* Badges */
.badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 500;
  background: var(--accent);
  color: white;
}

.badge-entity { background: var(--entity-color); }
.badge-behavior { background: var(--behavior-color); }
.badge-error { background: var(--error-color); }

/* Tables */
.fields-table {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0;
}

.fields-table th,
.fields-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
}

.fields-table th {
  font-weight: 600;
  color: var(--text-secondary);
}

/* Code */
code {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.875em;
  background: var(--bg-secondary);
  padding: 2px 6px;
  border-radius: 4px;
}

code.type {
  color: var(--type-color);
}

pre {
  background: var(--bg-secondary);
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
}

pre code {
  background: none;
  padding: 0;
}

/* Behavior Signature */
.behavior-signature {
  background: var(--bg-secondary);
  padding: 16px;
  border-radius: 8px;
  margin: 16px 0;
}

.keyword {
  color: var(--behavior-color);
  font-weight: 600;
}

/* Error List */
.error-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

/* Field Row */
.field-row {
  margin: 8px 0;
}

.field-label {
  color: var(--text-secondary);
  margin-right: 8px;
}

/* Responsive */
@media (max-width: 768px) {
  .sidebar {
    display: none;
  }
  
  .content {
    margin-left: 0;
    padding: 24px;
  }
  
  .stats {
    flex-wrap: wrap;
  }
}
`;
}

function generateJS(): string {
  return `// ISL Documentation Interactive Features

document.addEventListener('DOMContentLoaded', () => {
  // Smooth scroll for navigation
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (href.startsWith('#')) {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        }
        
        // Update active state
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
      }
    });
  });
  
  // Highlight active section on scroll
  const sections = document.querySelectorAll('.card[id], .section[id]');
  const navLinks = document.querySelectorAll('.nav-link');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        navLinks.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === '#' + id);
        });
      }
    });
  }, { threshold: 0.3 });
  
  sections.forEach(section => observer.observe(section));
  
  // Copy code blocks
  document.querySelectorAll('pre code').forEach(block => {
    const button = document.createElement('button');
    button.className = 'copy-btn';
    button.textContent = 'Copy';
    button.onclick = () => {
      navigator.clipboard.writeText(block.textContent);
      button.textContent = 'Copied!';
      setTimeout(() => button.textContent = 'Copy', 2000);
    };
    block.parentElement.style.position = 'relative';
    block.parentElement.appendChild(button);
  });
});
`;
}
