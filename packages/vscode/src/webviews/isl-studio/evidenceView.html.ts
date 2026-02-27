/**
 * Evidence View HTML Template
 * 
 * Main HTML template builder for the evidence display webview.
 */

import type { EvidenceViewState } from './evidenceViewState';
import {
  buildScoreCard,
  buildResultsList,
  buildAssumptionsList,
  buildOpenQuestionsList,
  buildActionBar,
  buildStyles
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
 * Build loading state HTML
 */
function buildLoading(): string {
  return `
    <div class="loading">
      <div class="spinner"></div>
      <div>Loading evidence...</div>
    </div>
  `;
}

/**
 * Build error state HTML
 */
function buildError(error: string): string {
  return `
    <div class="error">
      <div class="error-title">Error</div>
      <div>${escapeHtml(error)}</div>
    </div>
  `;
}

/**
 * Build header icon SVG
 */
function buildHeaderIcon(): string {
  return `
    <svg class="header-icon" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8.186 1.113a.5.5 0 00-.372 0L1.846 3.5l2.404.961L10.404 2l-2.218-.887zm3.564 1.426L5.596 5 8 5.961 14.154 3.5l-2.404-.961zm3.25 1.7l-6.5 2.6v7.922l6.5-2.6V4.24zM7.5 14.762V6.838L1 4.239v7.923l6.5 2.6zM7.443.184a1.5 1.5 0 011.114 0l7.129 2.852A.5.5 0 0116 3.5v8.662a1 1 0 01-.629.928l-7.185 2.874a.5.5 0 01-.372 0L.63 13.09a1 1 0 01-.629-.928V3.5a.5.5 0 01.314-.464L7.443.184z"/>
    </svg>
  `;
}

/**
 * Build metadata footer HTML
 */
function buildMetadata(state: EvidenceViewState): string {
  const { metadata } = state;
  const shortFingerprint = metadata.fingerprint.length > 16 
    ? `${metadata.fingerprint.slice(0, 8)}...${metadata.fingerprint.slice(-8)}`
    : metadata.fingerprint;

  return `
    <div class="metadata">
      <div class="metadata-row">
        <span>Spec:</span>
        <span>${escapeHtml(metadata.specFile.path)}</span>
      </div>
      <div class="metadata-row">
        <span>Fingerprint:</span>
        <span class="fingerprint" title="${escapeHtml(metadata.fingerprint)}">${escapeHtml(shortFingerprint)}</span>
      </div>
      <div class="metadata-row">
        <span>Verified:</span>
        <span>${formatTimestamp(metadata.timestamp)}</span>
      </div>
      <div class="metadata-row">
        <span>Duration:</span>
        <span>${formatDuration(metadata.duration)}</span>
      </div>
    </div>
  `;
}

/**
 * Build the complete HTML content
 */
function buildContent(state: EvidenceViewState): string {
  return `
    <div class="header">
      <h1>${buildHeaderIcon()} Evidence Report</h1>
      ${buildActionBar(!!state.metadata.reportFile)}
    </div>

    ${state.error ? buildError(state.error) : ''}

    ${buildScoreCard(state.score, state.results, state.breakdown)}
    
    ${buildResultsList(state.results)}
    
    ${buildAssumptionsList(state.assumptions)}
    
    ${buildOpenQuestionsList(state.openQuestions)}
    
    ${buildMetadata(state)}
  `;
}

/**
 * Build the complete evidence view HTML
 */
export function buildEvidenceViewHtml(
  state: EvidenceViewState,
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
  <div class="evidence-container">
    ${state.isLoading ? buildLoading() : buildContent(state)}
  </div>

  <script nonce="${nonce}">
    (function() {
      const vscode = acquireVsCodeApi();

      // State management
      let currentState = ${JSON.stringify(state)};

      // Save state for webview persistence
      vscode.setState(currentState);

      // Send message to extension
      window.sendMessage = function(message) {
        vscode.postMessage(message);
      };

      // Handle messages from extension
      window.addEventListener('message', event => {
        const message = event.data;
        switch (message.type) {
          case 'updateState':
            currentState = message.state;
            vscode.setState(currentState);
            updateUI(currentState);
            break;
          case 'setLoading':
            currentState.isLoading = message.isLoading;
            vscode.setState(currentState);
            updateUI(currentState);
            break;
          case 'setError':
            currentState.error = message.error;
            currentState.isLoading = false;
            vscode.setState(currentState);
            updateUI(currentState);
            break;
        }
      });

      // Restore state on reload
      const previousState = vscode.getState();
      if (previousState) {
        currentState = previousState;
      }

      // Update UI dynamically (would require DOM manipulation)
      function updateUI(state) {
        // For now, refresh the entire panel
        // In production, use targeted DOM updates
        location.reload();
      }
    })();
  </script>
</body>
</html>`;
}
