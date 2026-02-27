/**
 * Report Viewer HTML Template
 * 
 * Main HTML template builder for the report viewer webview.
 */

import type { ReportViewerState, ClauseStatus, ClauseCategory } from './types';
import { filterClauses } from './types';
import {
  buildStyles,
  buildSummaryCard,
  buildClauseSection,
  buildFixNextButton
} from './components';

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format timestamp for display
 */
function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString();
  } catch {
    return isoString;
  }
}

/**
 * Format duration in ms
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Build header icon SVG
 */
function buildHeaderIcon(): string {
  return `
    <svg class="header-icon" viewBox="0 0 16 16" fill="currentColor">
      <path d="M5.5 7a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zM5 9.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5z"/>
      <path d="M9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.5L9.5 0zm0 1v2A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5z"/>
    </svg>
  `;
}

/**
 * Build refresh icon SVG
 */
function buildRefreshIcon(): string {
  return `
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
      <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
    </svg>
  `;
}

/**
 * Build loading state HTML
 */
function buildLoading(): string {
  return `
    <div class="loading">
      <div class="spinner"></div>
      <div>Loading report...</div>
    </div>
  `;
}

/**
 * Build error state HTML
 */
function buildError(error: string): string {
  return `
    <div class="error">
      <div class="error-title">Error Loading Report</div>
      <div class="error-message">${escapeHtml(error)}</div>
    </div>
  `;
}

/**
 * Build empty state HTML
 */
function buildEmptyState(): string {
  return `
    <div class="empty-state">
      <svg class="empty-state-icon" viewBox="0 0 16 16" fill="currentColor">
        <path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z"/>
        <path d="M8.646 6.646a.5.5 0 0 1 .708 0l2 2a.5.5 0 0 1-.708.708L9.5 8.207V11.5a.5.5 0 0 1-1 0V8.207L7.354 9.354a.5.5 0 0 1-.708-.708l2-2z"/>
      </svg>
      <h2>No Report Loaded</h2>
      <p>Open an evidence report JSON file or run verification to see results.</p>
    </div>
  `;
}

/**
 * Build metadata section
 */
function buildMetadata(state: ReportViewerState): string {
  if (!state.report) return '';

  const { metadata } = state.report;
  const shortFingerprint = metadata.fingerprint.length > 16
    ? `${metadata.fingerprint.slice(0, 8)}...${metadata.fingerprint.slice(-8)}`
    : metadata.fingerprint;

  return `
    <div class="metadata">
      <div class="metadata-row">
        <span>Spec:</span>
        <span class="metadata-value">${escapeHtml(metadata.specPath)}</span>
      </div>
      <div class="metadata-row">
        <span>Fingerprint:</span>
        <span class="metadata-value" title="${escapeHtml(metadata.fingerprint)}">${escapeHtml(shortFingerprint)}</span>
      </div>
      <div class="metadata-row">
        <span>Generated:</span>
        <span class="metadata-value">${formatTimestamp(metadata.timestamp)}</span>
      </div>
      <div class="metadata-row">
        <span>Duration:</span>
        <span class="metadata-value">${formatDuration(metadata.duration)}</span>
      </div>
      ${metadata.islVersion ? `
      <div class="metadata-row">
        <span>ISL Version:</span>
        <span class="metadata-value">${escapeHtml(metadata.islVersion)}</span>
      </div>
      ` : ''}
    </div>
  `;
}

/**
 * Build the main content
 */
function buildContent(state: ReportViewerState): string {
  if (!state.report) {
    return buildEmptyState();
  }

  const { report, statusFilter = 'ALL', categoryFilter = 'ALL', selectedClauseId } = state;
  const filteredClauses = filterClauses(
    report.clauses,
    statusFilter as ClauseStatus | 'ALL',
    categoryFilter as ClauseCategory | 'ALL'
  );

  return `
    <div class="header">
      <div class="header-title">
        ${buildHeaderIcon()}
        <h1>Evidence Report</h1>
      </div>
      <div class="header-actions">
        <button class="action-btn secondary" onclick="refresh()" title="Refresh">
          ${buildRefreshIcon()}
          Refresh
        </button>
      </div>
    </div>

    ${state.error ? buildError(state.error) : ''}

    ${buildSummaryCard(report.summary)}
    
    ${buildFixNextButton(report.clauses)}
    
    ${buildClauseSection(filteredClauses, statusFilter as ClauseStatus | 'ALL', categoryFilter as ClauseCategory | 'ALL', selectedClauseId)}
    
    ${buildMetadata(state)}
  `;
}

/**
 * Build webview script
 */
function buildScript(state: ReportViewerState): string {
  return `
    (function() {
      const vscode = acquireVsCodeApi();
      
      // Current state
      let currentState = ${JSON.stringify(state)};
      vscode.setState(currentState);

      // Restore state on reload
      const previousState = vscode.getState();
      if (previousState) {
        currentState = previousState;
      }

      // Send message to extension
      window.sendMessage = function(message) {
        vscode.postMessage(message);
      };

      // Navigation functions
      window.selectClause = function(clauseId) {
        vscode.postMessage({ type: 'selectClause', clauseId });
      };

      window.navigateToClause = function(clauseId) {
        const clause = currentState.report?.clauses.find(c => c.id === clauseId);
        if (clause?.location) {
          vscode.postMessage({ type: 'openFile', location: clause.location });
        }
      };

      window.fixNext = function() {
        vscode.postMessage({ type: 'fixNext' });
      };

      window.refresh = function() {
        vscode.postMessage({ type: 'refresh' });
      };

      window.filterByStatus = function(status) {
        vscode.postMessage({ type: 'filterByStatus', status });
      };

      window.filterByCategory = function(category) {
        vscode.postMessage({ type: 'filterByCategory', category });
      };

      // Notify ready
      vscode.postMessage({ type: 'ready' });

      // Handle messages from extension
      window.addEventListener('message', event => {
        const message = event.data;
        switch (message.type) {
          case 'loadReport':
            currentState.report = message.report;
            currentState.isLoading = false;
            currentState.error = undefined;
            vscode.setState(currentState);
            location.reload();
            break;
          case 'setLoading':
            currentState.isLoading = message.isLoading;
            vscode.setState(currentState);
            location.reload();
            break;
          case 'setError':
            currentState.error = message.error;
            currentState.isLoading = false;
            vscode.setState(currentState);
            location.reload();
            break;
          case 'highlightClause':
            currentState.selectedClauseId = message.clauseId;
            vscode.setState(currentState);
            highlightClauseInList(message.clauseId);
            break;
          case 'updateFilters':
            if (message.statusFilter !== undefined) {
              currentState.statusFilter = message.statusFilter;
            }
            if (message.categoryFilter !== undefined) {
              currentState.categoryFilter = message.categoryFilter;
            }
            vscode.setState(currentState);
            location.reload();
            break;
        }
      });

      // Highlight clause without full reload
      function highlightClauseInList(clauseId) {
        document.querySelectorAll('.clause-item').forEach(el => {
          el.classList.remove('selected');
          if (el.dataset.clauseId === clauseId) {
            el.classList.add('selected');
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        });
      }
    })();
  `;
}

/**
 * Build the complete report viewer HTML
 */
export function buildReportViewerHtml(
  state: ReportViewerState,
  nonce: string,
  cspSource: string
): string {
  const styles = buildStyles();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <title>Evidence Report</title>
  <style nonce="${nonce}">
    ${styles}
  </style>
</head>
<body>
  <div class="report-container">
    ${state.isLoading ? buildLoading() : buildContent(state)}
  </div>

  <script nonce="${nonce}">
    ${buildScript(state)}
  </script>
</body>
</html>`;
}
