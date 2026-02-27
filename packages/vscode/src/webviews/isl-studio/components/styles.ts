/**
 * Evidence View Styles
 * 
 * CSS styles for the evidence display webview.
 * Uses VS Code's CSS variables for theme compatibility.
 */

export function buildStyles(): string {
  return `
    :root {
      --score-pass: #4caf50;
      --score-partial: #ff9800;
      --score-fail: #f44336;
      --card-bg: var(--vscode-editor-background);
      --card-border: var(--vscode-panel-border);
      --text-primary: var(--vscode-foreground);
      --text-secondary: var(--vscode-descriptionForeground);
      --text-muted: var(--vscode-disabledForeground);
      --link-color: var(--vscode-textLink-foreground);
      --button-bg: var(--vscode-button-background);
      --button-fg: var(--vscode-button-foreground);
      --button-hover: var(--vscode-button-hoverBackground);
      --badge-bg: var(--vscode-badge-background);
      --badge-fg: var(--vscode-badge-foreground);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--text-primary);
      background: var(--vscode-editor-background);
      padding: 16px;
      line-height: 1.5;
    }

    .evidence-container {
      max-width: 800px;
      margin: 0 auto;
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--card-border);
    }

    .header h1 {
      font-size: 1.5em;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .header-icon {
      width: 24px;
      height: 24px;
    }

    /* Score Card */
    .score-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 24px;
      text-align: center;
    }

    .score-value {
      font-size: 4em;
      font-weight: 700;
      line-height: 1;
      margin-bottom: 8px;
    }

    .score-value.pass { color: var(--score-pass); }
    .score-value.partial { color: var(--score-partial); }
    .score-value.fail { color: var(--score-fail); }

    .score-label {
      font-size: 0.9em;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .score-breakdown {
      display: flex;
      justify-content: center;
      gap: 24px;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--card-border);
    }

    .breakdown-item {
      text-align: center;
    }

    .breakdown-value {
      font-size: 1.5em;
      font-weight: 600;
    }

    .breakdown-label {
      font-size: 0.75em;
      color: var(--text-muted);
      text-transform: uppercase;
    }

    /* Summary Badges */
    .summary-badges {
      display: flex;
      justify-content: center;
      gap: 12px;
      margin-top: 16px;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 0.85em;
      font-weight: 500;
    }

    .badge.pass {
      background: rgba(76, 175, 80, 0.15);
      color: var(--score-pass);
    }

    .badge.partial {
      background: rgba(255, 152, 0, 0.15);
      color: var(--score-partial);
    }

    .badge.fail {
      background: rgba(244, 67, 54, 0.15);
      color: var(--score-fail);
    }

    .badge-count {
      font-weight: 700;
    }

    /* Section */
    .section {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      margin-bottom: 16px;
      overflow: hidden;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: var(--vscode-sideBarSectionHeader-background);
      border-bottom: 1px solid var(--card-border);
    }

    .section-title {
      font-weight: 600;
      font-size: 0.9em;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .section-count {
      background: var(--badge-bg);
      color: var(--badge-fg);
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.8em;
      font-weight: 500;
    }

    .section-content {
      padding: 0;
    }

    .section-empty {
      padding: 24px;
      text-align: center;
      color: var(--text-muted);
      font-style: italic;
    }

    /* Results List */
    .result-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--card-border);
    }

    .result-item:last-child {
      border-bottom: none;
    }

    .result-item:hover {
      background: var(--vscode-list-hoverBackground);
    }

    .result-status {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: bold;
    }

    .result-status.pass {
      background: var(--score-pass);
      color: white;
    }

    .result-status.partial {
      background: var(--score-partial);
      color: white;
    }

    .result-status.fail {
      background: var(--score-fail);
      color: white;
    }

    .result-content {
      flex: 1;
      min-width: 0;
    }

    .result-name {
      font-weight: 500;
      margin-bottom: 2px;
    }

    .result-message {
      font-size: 0.85em;
      color: var(--text-secondary);
    }

    .result-meta {
      display: flex;
      gap: 12px;
      margin-top: 4px;
      font-size: 0.75em;
      color: var(--text-muted);
    }

    .result-category {
      background: var(--badge-bg);
      color: var(--badge-fg);
      padding: 1px 6px;
      border-radius: 3px;
    }

    /* Assumptions & Questions Lists */
    .list-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--card-border);
    }

    .list-item:last-child {
      border-bottom: none;
    }

    .list-icon {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-muted);
    }

    .list-content {
      flex: 1;
    }

    .list-text {
      margin-bottom: 4px;
    }

    .list-meta {
      font-size: 0.8em;
      color: var(--text-muted);
    }

    .confidence-badge,
    .priority-badge {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 3px;
      font-size: 0.75em;
      font-weight: 500;
      text-transform: uppercase;
    }

    .confidence-high, .priority-critical {
      background: rgba(244, 67, 54, 0.15);
      color: var(--score-fail);
    }

    .confidence-medium, .priority-high {
      background: rgba(255, 152, 0, 0.15);
      color: var(--score-partial);
    }

    .confidence-low, .priority-medium, .priority-low {
      background: rgba(76, 175, 80, 0.15);
      color: var(--score-pass);
    }

    /* Action Bar */
    .action-bar {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .action-button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      background: var(--button-bg);
      color: var(--button-fg);
      border: none;
      border-radius: 4px;
      font-size: 0.9em;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s;
    }

    .action-button:hover {
      background: var(--button-hover);
    }

    .action-button.secondary {
      background: transparent;
      color: var(--link-color);
      border: 1px solid var(--card-border);
    }

    .action-button.secondary:hover {
      background: var(--vscode-list-hoverBackground);
    }

    .action-button svg {
      width: 16px;
      height: 16px;
    }

    /* Metadata Footer */
    .metadata {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid var(--card-border);
      font-size: 0.8em;
      color: var(--text-muted);
    }

    .metadata-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
    }

    .fingerprint {
      font-family: var(--vscode-editor-font-family);
      font-size: 0.9em;
    }

    /* Loading State */
    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px;
      color: var(--text-muted);
    }

    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid var(--card-border);
      border-top-color: var(--link-color);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 16px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Error State */
    .error {
      background: rgba(244, 67, 54, 0.1);
      border: 1px solid var(--score-fail);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
      color: var(--score-fail);
    }

    .error-title {
      font-weight: 600;
      margin-bottom: 4px;
    }
  `;
}
