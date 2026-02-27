/**
 * Claim Graph Export
 * 
 * Export claim graphs to JSON and lightweight HTML viewer.
 * 
 * @module @isl-lang/proof/claim-export
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { ClaimGraph, UnifiedClaim } from './claim-graph.js';
import { canonicalJsonStringify } from './canonical-json.js';

// ============================================================================
// JSON Export
// ============================================================================

/**
 * Export claim graph to JSON file
 */
export async function exportClaimGraphToJson(
  graph: ClaimGraph,
  outputPath: string
): Promise<void> {
  const json = canonicalJsonStringify(graph);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, json, 'utf-8');
}

/**
 * Serialize claim graph to JSON string
 */
export function serializeClaimGraph(graph: ClaimGraph): string {
  return canonicalJsonStringify(graph);
}

// ============================================================================
// HTML Viewer Export
// ============================================================================

/**
 * Export claim graph to lightweight HTML viewer
 */
export async function exportClaimGraphToHtml(
  graph: ClaimGraph,
  outputPath: string,
  options: {
    title?: string;
    includeJson?: boolean;
  } = {}
): Promise<void> {
  const html = generateHtmlViewer(graph, options);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, html, 'utf-8');
}

/**
 * Generate lightweight HTML viewer for claim graph
 */
function generateHtmlViewer(
  graph: ClaimGraph,
  options: {
    title?: string;
    includeJson?: boolean;
  } = {}
): string {
  const title = options.title || 'Claim Graph';
  const jsonData = options.includeJson ? JSON.stringify(graph, null, 2) : '';

  // Group claims by subject for better visualization
  const claimsBySubject = new Map<string, UnifiedClaim[]>();
  for (const claim of graph.claims) {
    const subjectKey = `${claim.subject.type}:${claim.subject.identifier}`;
    if (!claimsBySubject.has(subjectKey)) {
      claimsBySubject.set(subjectKey, []);
    }
    claimsBySubject.get(subjectKey)!.push(claim);
  }

  // Generate HTML
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #f5f5f5;
      color: #333;
      line-height: 1.6;
    }
    
    .header {
      background: #2c3e50;
      color: white;
      padding: 1.5rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .header h1 {
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
    }
    
    .header .meta {
      font-size: 0.875rem;
      opacity: 0.9;
    }
    
    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 1.5rem;
    }
    
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    
    .stat-card {
      background: white;
      padding: 1rem;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    .stat-card .label {
      font-size: 0.875rem;
      color: #666;
      margin-bottom: 0.25rem;
    }
    
    .stat-card .value {
      font-size: 1.5rem;
      font-weight: 600;
      color: #2c3e50;
    }
    
    .filters {
      background: white;
      padding: 1rem;
      border-radius: 8px;
      margin-bottom: 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    .filters input,
    .filters select {
      padding: 0.5rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      margin-right: 1rem;
      font-size: 0.875rem;
    }
    
    .subject-group {
      background: white;
      border-radius: 8px;
      margin-bottom: 1rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    
    .subject-header {
      background: #ecf0f1;
      padding: 1rem;
      font-weight: 600;
      border-bottom: 2px solid #3498db;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .subject-type {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      background: #3498db;
      color: white;
      border-radius: 4px;
      font-size: 0.75rem;
      text-transform: uppercase;
      margin-right: 0.5rem;
    }
    
    .claims-list {
      padding: 0;
    }
    
    .claim {
      padding: 1rem;
      border-bottom: 1px solid #eee;
    }
    
    .claim:last-child {
      border-bottom: none;
    }
    
    .claim-header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      margin-bottom: 0.5rem;
    }
    
    .claim-id {
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 0.75rem;
      color: #666;
    }
    
    .claim-kind {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      background: #95a5a6;
      color: white;
      border-radius: 4px;
      font-size: 0.75rem;
      margin-left: 0.5rem;
    }
    
    .claim-status {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    
    .status-proven {
      background: #2ecc71;
      color: white;
    }
    
    .status-violated {
      background: #e74c3c;
      color: white;
    }
    
    .status-not_proven {
      background: #f39c12;
      color: white;
    }
    
    .status-partial {
      background: #3498db;
      color: white;
    }
    
    .status-unknown {
      background: #95a5a6;
      color: white;
    }
    
    .claim-details {
      margin-top: 0.5rem;
      font-size: 0.875rem;
      color: #666;
    }
    
    .claim-locations {
      margin-top: 0.5rem;
    }
    
    .location {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      background: #ecf0f1;
      border-radius: 4px;
      font-size: 0.75rem;
      margin-right: 0.5rem;
      font-family: 'Monaco', 'Courier New', monospace;
    }
    
    .claim-evidence {
      margin-top: 0.5rem;
    }
    
    .evidence-item {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      background: #e8f5e9;
      border-radius: 4px;
      font-size: 0.75rem;
      margin-right: 0.5rem;
      margin-bottom: 0.25rem;
    }
    
    .claim-engine {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      background: #fff3cd;
      border-radius: 4px;
      font-size: 0.75rem;
      margin-left: 0.5rem;
    }
    
    .confidence-bar {
      width: 100px;
      height: 8px;
      background: #ecf0f1;
      border-radius: 4px;
      overflow: hidden;
      display: inline-block;
      margin-left: 0.5rem;
      vertical-align: middle;
    }
    
    .confidence-fill {
      height: 100%;
      background: #3498db;
      transition: width 0.3s;
    }
    
    .relationships {
      margin-top: 0.5rem;
      font-size: 0.75rem;
      color: #666;
    }
    
    .relationship {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      background: #f0f0f0;
      border-radius: 4px;
      margin-right: 0.5rem;
      margin-bottom: 0.25rem;
    }
    
    .hidden {
      display: none;
    }
    
    .json-viewer {
      margin-top: 2rem;
      background: white;
      padding: 1rem;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    .json-viewer pre {
      background: #2c3e50;
      color: #ecf0f1;
      padding: 1rem;
      border-radius: 4px;
      overflow-x: auto;
      font-size: 0.75rem;
      font-family: 'Monaco', 'Courier New', monospace;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">
      Generated: ${new Date(graph.metadata.createdAt).toLocaleString()} | 
      Graph Hash: ${graph.metadata.graphHash.slice(0, 16)}...
    </div>
  </div>
  
  <div class="container">
    <div class="stats">
      <div class="stat-card">
        <div class="label">Total Claims</div>
        <div class="value">${graph.metadata.totalClaims}</div>
      </div>
      <div class="stat-card">
        <div class="label">Unique Subjects</div>
        <div class="value">${graph.metadata.uniqueSubjects}</div>
      </div>
      <div class="stat-card">
        <div class="label">Engines</div>
        <div class="value">${graph.metadata.engines.length}</div>
      </div>
      <div class="stat-card">
        <div class="label">Proven</div>
        <div class="value">${graph.claims.filter(c => c.status === 'proven').length}</div>
      </div>
      <div class="stat-card">
        <div class="label">Violated</div>
        <div class="value">${graph.claims.filter(c => c.status === 'violated').length}</div>
      </div>
    </div>
    
    <div class="filters">
      <input type="text" id="search" placeholder="Search claims..." style="width: 300px;">
      <select id="statusFilter">
        <option value="">All Statuses</option>
        <option value="proven">Proven</option>
        <option value="violated">Violated</option>
        <option value="not_proven">Not Proven</option>
        <option value="partial">Partial</option>
        <option value="unknown">Unknown</option>
      </select>
      <select id="engineFilter">
        <option value="">All Engines</option>
        ${graph.metadata.engines.map(e => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`).join('')}
      </select>
    </div>
    
    <div id="claimsContainer">
      ${Array.from(claimsBySubject.entries())
        .map(([subjectKey, claims]) => {
          const firstClaim = claims[0];
          return `
            <div class="subject-group" data-subject="${escapeHtml(subjectKey)}">
              <div class="subject-header">
                <div>
                  <span class="subject-type">${escapeHtml(firstClaim.subject.type)}</span>
                  <strong>${escapeHtml(firstClaim.subject.identifier)}</strong>
                  <span style="color: #666; font-size: 0.875rem; margin-left: 0.5rem;">
                    (${claims.length} claim${claims.length !== 1 ? 's' : ''})
                  </span>
                </div>
              </div>
              <div class="claims-list">
                ${claims.map(claim => renderClaim(claim)).join('')}
              </div>
            </div>
          `;
        })
        .join('')}
    </div>
    
    ${options.includeJson ? `
      <div class="json-viewer">
        <h2>JSON Data</h2>
        <pre>${escapeHtml(jsonData)}</pre>
      </div>
    ` : ''}
  </div>
  
  <script>
    const searchInput = document.getElementById('search');
    const statusFilter = document.getElementById('statusFilter');
    const engineFilter = document.getElementById('engineFilter');
    
    function filterClaims() {
      const searchTerm = searchInput.value.toLowerCase();
      const statusValue = statusFilter.value;
      const engineValue = engineFilter.value;
      
      document.querySelectorAll('.subject-group').forEach(group => {
        const claims = group.querySelectorAll('.claim');
        let visible = false;
        
        claims.forEach(claim => {
          const text = claim.textContent.toLowerCase();
          const status = claim.querySelector('.claim-status')?.className || '';
          const engine = claim.querySelector('.claim-engine')?.textContent || '';
          
          const matchesSearch = !searchTerm || text.includes(searchTerm);
          const matchesStatus = !statusValue || status.includes(statusValue);
          const matchesEngine = !engineValue || engine.includes(engineValue);
          
          if (matchesSearch && matchesStatus && matchesEngine) {
            claim.style.display = '';
            visible = true;
          } else {
            claim.style.display = 'none';
          }
        });
        
        group.style.display = visible ? '' : 'none';
      });
    }
    
    searchInput.addEventListener('input', filterClaims);
    statusFilter.addEventListener('change', filterClaims);
    engineFilter.addEventListener('change', filterClaims);
  </script>
</body>
</html>`;
}

function renderClaim(claim: UnifiedClaim): string {
  const statusClass = `status-${claim.status}`;
  
  return `
    <div class="claim" data-status="${claim.status}" data-engine="${escapeHtml(claim.engine)}">
      <div class="claim-header">
        <div>
          <span class="claim-id">${escapeHtml(claim.id)}</span>
          <span class="claim-kind">${escapeHtml(claim.kind)}</span>
          <span class="claim-status ${statusClass}">${escapeHtml(claim.status)}</span>
          <span class="claim-engine">${escapeHtml(claim.engine)}</span>
          <div class="confidence-bar">
            <div class="confidence-fill" style="width: ${claim.confidence * 100}%"></div>
          </div>
        </div>
      </div>
      ${claim.description ? `<div class="claim-details">${escapeHtml(claim.description)}</div>` : ''}
      ${claim.locations.length > 0 ? `
        <div class="claim-locations">
          ${claim.locations.map(loc => 
            `<span class="location">${escapeHtml(loc.file)}:${loc.line}${loc.column ? `:${loc.column}` : ''}</span>`
          ).join('')}
        </div>
      ` : ''}
      ${claim.evidence.length > 0 ? `
        <div class="claim-evidence">
          ${claim.evidence.map(ev => 
            `<span class="evidence-item">${escapeHtml(ev.type)} (${(ev.confidence * 100).toFixed(0)}%)</span>`
          ).join('')}
        </div>
      ` : ''}
      ${claim.relationships.length > 0 ? `
        <div class="relationships">
          Related: ${claim.relationships.map(rel => 
            `<span class="relationship">${escapeHtml(rel.type)}: ${escapeHtml(rel.targetId.slice(0, 20))}...</span>`
          ).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
