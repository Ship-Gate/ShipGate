/**
 * Report Viewer Styles
 * 
 * CSS styles for the report viewer webview.
 * Uses VS Code CSS variables for theme compatibility.
 */

export function buildStyles(): string {
  return `
    :root {
      --status-pass: #4caf50;
      --status-partial: #ff9800;
      --status-fail: #f44336;
      --status-skip: #9e9e9e;
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
      --danger-bg: rgba(244, 67, 54, 0.15);
      --warning-bg: rgba(255, 152, 0, 0.15);
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

    .report-container {
      max-width: 900px;
      margin: 0 auto;
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--card-border);
    }

    .header-title {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .header h1 {
      font-size: 1.4em;
      font-weight: 600;
    }

    .header-icon {
      width: 24px;
      height: 24px;
      fill: currentColor;
    }

    .header-actions {
      display: flex;
      gap: 8px;
    }

    /* Summary Card */
    .summary-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
    }

    .summary-score {
      text-align: center;
      margin-bottom: 16px;
    }

    .score-value {
      font-size: 3.5em;
      font-weight: 700;
      line-height: 1;
    }

    .score-value.pass { color: var(--status-pass); }
    .score-value.partial { color: var(--status-partial); }
    .score-value.fail { color: var(--status-fail); }

    .score-label {
      font-size: 0.85em;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 4px;
    }

    .summary-stats {
      display: flex;
      justify-content: center;
      gap: 16px;
      flex-wrap: wrap;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--card-border);
    }

    .stat-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 0.9em;
      font-weight: 500;
    }

    .stat-badge.pass {
      background: rgba(76, 175, 80, 0.15);
      color: var(--status-pass);
    }

    .stat-badge.partial {
      background: rgba(255, 152, 0, 0.15);
      color: var(--status-partial);
    }

    .stat-badge.fail {
      background: var(--danger-bg);
      color: var(--status-fail);
    }

    .stat-badge.skip {
      background: rgba(158, 158, 158, 0.15);
      color: var(--status-skip);
    }

    .stat-count {
      font-weight: 700;
    }

    /* Fix Next Button */
    .fix-next-container {
      margin-bottom: 20px;
    }

    .fix-next-btn {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 14px 20px;
      background: var(--status-fail);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 1em;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .fix-next-btn:hover {
      filter: brightness(1.1);
      transform: translateY(-1px);
    }

    .fix-next-btn:disabled {
      background: var(--status-skip);
      cursor: not-allowed;
      transform: none;
    }

    .fix-next-btn svg {
      width: 20px;
      height: 20px;
    }

    .fix-next-info {
      margin-top: 8px;
      padding: 10px 14px;
      background: var(--danger-bg);
      border-radius: 6px;
      font-size: 0.85em;
    }

    .fix-next-info strong {
      color: var(--status-fail);
    }

    /* Filters */
    .filters {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .filter-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .filter-label {
      font-size: 0.85em;
      color: var(--text-secondary);
    }

    .filter-select {
      padding: 6px 12px;
      background: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border: 1px solid var(--vscode-dropdown-border);
      border-radius: 4px;
      font-size: 0.9em;
      cursor: pointer;
    }

    /* Clause List */
    .clause-list {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      overflow: hidden;
    }

    .clause-list-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: var(--vscode-sideBarSectionHeader-background);
      border-bottom: 1px solid var(--card-border);
    }

    .clause-list-title {
      font-weight: 600;
      font-size: 0.9em;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .clause-count {
      background: var(--badge-bg);
      color: var(--badge-fg);
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 0.8em;
      font-weight: 500;
    }

    .clause-list-content {
      max-height: 500px;
      overflow-y: auto;
    }

    .clause-empty {
      padding: 32px;
      text-align: center;
      color: var(--text-muted);
      font-style: italic;
    }

    /* Clause Item */
    .clause-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 16px;
      border-bottom: 1px solid var(--card-border);
      cursor: pointer;
      transition: background 0.15s;
    }

    .clause-item:last-child {
      border-bottom: none;
    }

    .clause-item:hover {
      background: var(--vscode-list-hoverBackground);
    }

    .clause-item.selected {
      background: var(--vscode-list-activeSelectionBackground);
    }

    .clause-status-icon {
      flex-shrink: 0;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: bold;
      color: white;
    }

    .clause-status-icon.pass { background: var(--status-pass); }
    .clause-status-icon.partial { background: var(--status-partial); }
    .clause-status-icon.fail { background: var(--status-fail); }
    .clause-status-icon.skip { background: var(--status-skip); }

    .clause-content {
      flex: 1;
      min-width: 0;
    }

    .clause-name {
      font-weight: 500;
      margin-bottom: 4px;
      word-break: break-word;
    }

    .clause-message {
      font-size: 0.85em;
      color: var(--text-secondary);
      margin-bottom: 6px;
    }

    .clause-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      font-size: 0.75em;
    }

    .clause-category {
      background: var(--badge-bg);
      color: var(--badge-fg);
      padding: 2px 8px;
      border-radius: 4px;
      text-transform: uppercase;
    }

    .clause-impact {
      padding: 2px 8px;
      border-radius: 4px;
      text-transform: uppercase;
      font-weight: 500;
    }

    .clause-impact.critical {
      background: var(--danger-bg);
      color: var(--status-fail);
    }

    .clause-impact.high {
      background: rgba(255, 152, 0, 0.15);
      color: var(--status-partial);
    }

    .clause-impact.medium {
      background: rgba(33, 150, 243, 0.15);
      color: #2196f3;
    }

    .clause-impact.low {
      background: rgba(158, 158, 158, 0.15);
      color: var(--status-skip);
    }

    .clause-location {
      color: var(--text-muted);
      font-family: var(--vscode-editor-font-family);
    }

    .clause-duration {
      color: var(--text-muted);
    }

    .clause-navigate {
      flex-shrink: 0;
      padding: 6px;
      background: transparent;
      border: 1px solid var(--card-border);
      border-radius: 4px;
      color: var(--link-color);
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.15s;
    }

    .clause-item:hover .clause-navigate {
      opacity: 1;
    }

    .clause-navigate:hover {
      background: var(--vscode-list-hoverBackground);
    }

    .clause-navigate svg {
      width: 16px;
      height: 16px;
    }

    /* Action Button */
    .action-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      background: var(--button-bg);
      color: var(--button-fg);
      border: none;
      border-radius: 4px;
      font-size: 0.9em;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s;
    }

    .action-btn:hover {
      background: var(--button-hover);
    }

    .action-btn.secondary {
      background: transparent;
      color: var(--link-color);
      border: 1px solid var(--card-border);
    }

    .action-btn.secondary:hover {
      background: var(--vscode-list-hoverBackground);
    }

    .action-btn svg {
      width: 16px;
      height: 16px;
    }

    /* Metadata */
    .metadata {
      margin-top: 20px;
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

    .metadata-value {
      font-family: var(--vscode-editor-font-family);
      word-break: break-all;
    }

    /* Loading State */
    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px;
      color: var(--text-muted);
    }

    .spinner {
      width: 36px;
      height: 36px;
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
      background: var(--danger-bg);
      border: 1px solid var(--status-fail);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 20px;
    }

    .error-title {
      font-weight: 600;
      color: var(--status-fail);
      margin-bottom: 4px;
    }

    .error-message {
      color: var(--text-primary);
    }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: var(--text-muted);
    }

    .empty-state-icon {
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
      opacity: 0.5;
    }

    .empty-state h2 {
      font-size: 1.2em;
      font-weight: 500;
      margin-bottom: 8px;
      color: var(--text-secondary);
    }
  `;
}
