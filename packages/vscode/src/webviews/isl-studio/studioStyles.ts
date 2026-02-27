/**
 * ISL Studio Styles
 * 
 * CSS styles for the ISL Studio webview panel.
 * Uses VS Code's CSS variables for theme compatibility.
 */

export function buildStudioStyles(): string {
  return `
    :root {
      --studio-primary: #007acc;
      --studio-success: #4caf50;
      --studio-warning: #ff9800;
      --studio-error: #f44336;
      --studio-bg: var(--vscode-editor-background);
      --studio-surface: var(--vscode-sideBar-background);
      --studio-border: var(--vscode-panel-border);
      --studio-text: var(--vscode-foreground);
      --studio-text-secondary: var(--vscode-descriptionForeground);
      --studio-text-muted: var(--vscode-disabledForeground);
      --studio-link: var(--vscode-textLink-foreground);
      --studio-button-bg: var(--vscode-button-background);
      --studio-button-fg: var(--vscode-button-foreground);
      --studio-button-hover: var(--vscode-button-hoverBackground);
      --studio-input-bg: var(--vscode-input-background);
      --studio-input-border: var(--vscode-input-border);
      --studio-input-fg: var(--vscode-input-foreground);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--studio-text);
      background: var(--studio-bg);
      line-height: 1.5;
      padding: 0;
      margin: 0;
      height: 100vh;
      overflow: hidden;
    }

    /* Main Layout */
    .studio-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: auto 1fr auto;
      gap: 0;
      height: 100vh;
    }

    .studio-header {
      grid-column: 1 / -1;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 20px;
      background: var(--studio-surface);
      border-bottom: 1px solid var(--studio-border);
    }

    .studio-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 1.1em;
      font-weight: 600;
    }

    .studio-logo {
      width: 24px;
      height: 24px;
      color: var(--studio-primary);
    }

    .studio-subtitle {
      font-size: 0.8em;
      color: var(--studio-text-muted);
      font-weight: normal;
    }

    /* Left Panel - Prompt & Preview */
    .left-panel {
      display: flex;
      flex-direction: column;
      border-right: 1px solid var(--studio-border);
      overflow: hidden;
    }

    /* Right Panel - Status */
    .right-panel {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* Footer */
    .studio-footer {
      grid-column: 1 / -1;
      padding: 8px 20px;
      background: var(--studio-surface);
      border-top: 1px solid var(--studio-border);
      font-size: 0.75em;
      color: var(--studio-text-muted);
      display: flex;
      justify-content: space-between;
    }

    /* Prompt Box */
    .prompt-box {
      padding: 16px;
      background: var(--studio-surface);
      border-bottom: 1px solid var(--studio-border);
    }

    .prompt-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .prompt-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.95em;
      font-weight: 600;
    }

    .prompt-icon {
      width: 18px;
      height: 18px;
      color: var(--studio-primary);
    }

    .prompt-hint {
      font-size: 0.75em;
      color: var(--studio-text-muted);
    }

    .prompt-input-container {
      position: relative;
    }

    .prompt-textarea {
      width: 100%;
      min-height: 120px;
      padding: 12px;
      background: var(--studio-input-bg);
      border: 1px solid var(--studio-input-border);
      border-radius: 6px;
      color: var(--studio-input-fg);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      line-height: 1.5;
      resize: vertical;
    }

    .prompt-textarea:focus {
      outline: none;
      border-color: var(--studio-primary);
    }

    .prompt-textarea:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .prompt-footer {
      display: flex;
      justify-content: flex-end;
      padding-top: 6px;
    }

    .char-count {
      font-size: 0.75em;
      color: var(--studio-text-muted);
    }

    /* Action Buttons */
    .action-buttons {
      display: flex;
      gap: 8px;
      margin-top: 12px;
      flex-wrap: wrap;
    }

    .action-button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border: none;
      border-radius: 4px;
      font-size: 0.85em;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .action-button.primary {
      background: var(--studio-button-bg);
      color: var(--studio-button-fg);
    }

    .action-button.primary:hover:not(:disabled) {
      background: var(--studio-button-hover);
    }

    .action-button.secondary {
      background: transparent;
      color: var(--studio-text);
      border: 1px solid var(--studio-border);
    }

    .action-button.secondary:hover:not(:disabled) {
      background: var(--vscode-list-hoverBackground);
    }

    .action-button.cancel {
      background: transparent;
      color: var(--studio-error);
      border: 1px solid var(--studio-error);
    }

    .action-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .action-button.active {
      background: var(--studio-primary);
      color: white;
    }

    .button-icon {
      width: 16px;
      height: 16px;
    }

    .spinner-small {
      width: 14px;
      height: 14px;
      border: 2px solid transparent;
      border-top-color: currentColor;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Spec Preview */
    .spec-preview {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .spec-preview.empty {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .spec-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: var(--studio-surface);
      border-bottom: 1px solid var(--studio-border);
    }

    .spec-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.9em;
      font-weight: 600;
    }

    .spec-icon {
      width: 16px;
      height: 16px;
      color: var(--studio-primary);
    }

    .spec-actions {
      display: flex;
      gap: 4px;
    }

    .icon-button {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      background: transparent;
      border: none;
      border-radius: 4px;
      color: var(--studio-text-secondary);
      cursor: pointer;
    }

    .icon-button:hover {
      background: var(--vscode-list-hoverBackground);
      color: var(--studio-text);
    }

    .icon-button svg {
      width: 16px;
      height: 16px;
    }

    /* Spec Tabs */
    .spec-tabs {
      display: flex;
      gap: 0;
      background: var(--studio-surface);
      border-bottom: 1px solid var(--studio-border);
    }

    .spec-tab {
      padding: 8px 16px;
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--studio-text-secondary);
      font-size: 0.8em;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
    }

    .spec-tab:hover {
      color: var(--studio-text);
      background: var(--vscode-list-hoverBackground);
    }

    .spec-tab.active {
      color: var(--studio-primary);
      border-bottom-color: var(--studio-primary);
    }

    .spec-tab.alert {
      color: var(--studio-warning);
    }

    .spec-tab.alert.active {
      border-bottom-color: var(--studio-warning);
    }

    .spec-content {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .spec-tab-content {
      flex: 1;
      overflow: auto;
      padding: 0;
    }

    .spec-tab-content.hidden {
      display: none;
    }

    .spec-footer {
      padding: 8px 16px;
      background: var(--studio-surface);
      border-top: 1px solid var(--studio-border);
      font-size: 0.75em;
      color: var(--studio-text-muted);
    }

    /* Code View */
    .code-view {
      height: 100%;
      overflow: auto;
    }

    .code-block {
      margin: 0;
      padding: 16px;
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
      line-height: 1.6;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    /* Syntax Highlighting */
    .keyword { color: #569cd6; }
    .type { color: #4ec9b0; }
    .method { color: #dcdcaa; }
    .string { color: #ce9178; }
    .comment { color: #6a9955; }
    .number { color: #b5cea8; }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 48px;
      color: var(--studio-text-muted);
    }

    .empty-icon {
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
      opacity: 0.5;
    }

    .empty-title {
      font-size: 1.1em;
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--studio-text-secondary);
    }

    .empty-text {
      font-size: 0.9em;
      max-width: 300px;
      margin: 0 auto;
    }

    .empty-list {
      padding: 24px;
      text-align: center;
      color: var(--studio-text-muted);
      font-style: italic;
    }

    /* Clauses List */
    .clauses-list {
      padding: 12px;
    }

    .clause-group {
      margin-bottom: 16px;
    }

    .clause-group-title {
      font-size: 0.8em;
      font-weight: 600;
      color: var(--studio-text-secondary);
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .clause-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      background: var(--studio-surface);
      border-radius: 4px;
      margin-bottom: 4px;
      font-size: 0.85em;
    }

    .clause-badge {
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 0.7em;
      font-weight: 600;
      text-transform: uppercase;
    }

    .clause-badge.precondition { background: #2d5a8833; color: #6bb3f8; }
    .clause-badge.postcondition { background: #4caf5033; color: #81c784; }
    .clause-badge.invariant { background: #9c27b033; color: #ce93d8; }
    .clause-badge.effect { background: #ff980033; color: #ffb74d; }
    .clause-badge.constraint { background: #f4433633; color: #e57373; }

    .clause-description {
      flex: 1;
    }

    .clause-status {
      font-size: 0.75em;
      color: var(--studio-text-muted);
    }

    .clause-status-verified .clause-status { color: var(--studio-success); }
    .clause-status-failed .clause-status { color: var(--studio-error); }
    .clause-status-pending .clause-status { color: var(--studio-warning); }

    /* Assumptions List */
    .assumptions-list {
      padding: 12px;
    }

    .assumption-item {
      padding: 12px;
      background: var(--studio-surface);
      border-radius: 6px;
      margin-bottom: 8px;
    }

    .assumption-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }

    .assumption-topic {
      font-weight: 600;
      font-size: 0.9em;
    }

    .confidence-badge {
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.7em;
      font-weight: 500;
      text-transform: uppercase;
    }

    .confidence-high { background: #4caf5022; color: var(--studio-success); }
    .confidence-medium { background: #ff980022; color: var(--studio-warning); }
    .confidence-low { background: #f4433622; color: var(--studio-error); }

    .assumption-value {
      font-size: 0.85em;
      margin-bottom: 4px;
    }

    .assumption-rationale {
      font-size: 0.8em;
      color: var(--studio-text-muted);
      font-style: italic;
    }

    /* Questions List */
    .questions-list {
      padding: 12px;
    }

    .question-item {
      padding: 12px;
      background: var(--studio-surface);
      border-radius: 6px;
      margin-bottom: 8px;
      border-left: 3px solid var(--studio-warning);
    }

    .question-item.answered {
      border-left-color: var(--studio-success);
      opacity: 0.8;
    }

    .question-header {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
    }

    .priority-badge {
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.7em;
      font-weight: 500;
      text-transform: uppercase;
    }

    .priority-critical { background: #f4433633; color: var(--studio-error); }
    .priority-high { background: #ff980033; color: var(--studio-warning); }
    .priority-medium { background: #2196f333; color: var(--studio-link); }
    .priority-low { background: #4caf5033; color: var(--studio-success); }

    .answered-badge {
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.7em;
      font-weight: 500;
      background: #4caf5033;
      color: var(--studio-success);
    }

    .question-text {
      font-size: 0.9em;
      margin-bottom: 10px;
    }

    .question-options {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .option-button {
      padding: 6px 12px;
      background: var(--studio-bg);
      border: 1px solid var(--studio-border);
      border-radius: 4px;
      font-size: 0.8em;
      cursor: pointer;
      transition: all 0.15s;
    }

    .option-button:hover {
      border-color: var(--studio-primary);
    }

    .option-button.selected {
      background: var(--studio-primary);
      color: white;
      border-color: var(--studio-primary);
    }

    .question-input {
      width: 100%;
      padding: 8px 12px;
      background: var(--studio-input-bg);
      border: 1px solid var(--studio-input-border);
      border-radius: 4px;
      color: var(--studio-input-fg);
      font-size: 0.85em;
    }

    /* Status Panel */
    .status-panel {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    .status-header {
      padding: 16px;
      background: var(--studio-surface);
      border-bottom: 1px solid var(--studio-border);
    }

    .status-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }

    .status-icon {
      width: 20px;
      height: 20px;
    }

    .status-icon.idle { color: var(--studio-text-muted); }
    .status-icon.progress { color: var(--studio-primary); animation: pulse 1.5s ease-in-out infinite; }
    .status-icon.success { color: var(--studio-success); }
    .status-icon.error { color: var(--studio-error); }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .status-label {
      font-weight: 600;
      font-size: 0.95em;
    }

    .status-message {
      font-size: 0.85em;
      color: var(--studio-text-secondary);
    }

    /* Error Display */
    .error-display {
      margin: 12px 16px;
      padding: 12px;
      background: #f4433615;
      border: 1px solid var(--studio-error);
      border-radius: 6px;
    }

    .error-header {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
      color: var(--studio-error);
      margin-bottom: 6px;
    }

    .error-icon {
      width: 16px;
      height: 16px;
    }

    .error-message {
      font-size: 0.85em;
      color: var(--studio-text);
    }

    /* Score Display */
    .score-display {
      padding: 20px 16px;
      text-align: center;
      border-bottom: 1px solid var(--studio-border);
    }

    .score-main {
      margin-bottom: 16px;
    }

    .score-circle {
      display: inline-flex;
      align-items: baseline;
      justify-content: center;
      width: 100px;
      height: 100px;
      border-radius: 50%;
      border: 4px solid;
      margin-bottom: 8px;
    }

    .score-circle.score-high { border-color: var(--studio-success); color: var(--studio-success); }
    .score-circle.score-medium { border-color: var(--studio-warning); color: var(--studio-warning); }
    .score-circle.score-low { border-color: var(--studio-error); color: var(--studio-error); }

    .score-value {
      font-size: 2.5em;
      font-weight: 700;
      line-height: 1;
    }

    .score-percent {
      font-size: 1em;
      font-weight: 500;
    }

    .score-label {
      font-size: 0.85em;
      color: var(--studio-text-secondary);
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .score-breakdown {
      display: flex;
      justify-content: center;
      gap: 20px;
    }

    .breakdown-item {
      text-align: center;
    }

    .breakdown-item .breakdown-value {
      font-size: 1.5em;
      font-weight: 600;
    }

    .breakdown-item .breakdown-label {
      font-size: 0.7em;
      color: var(--studio-text-muted);
      text-transform: uppercase;
    }

    .breakdown-item.passed .breakdown-value { color: var(--studio-success); }
    .breakdown-item.failed .breakdown-value { color: var(--studio-error); }
    .breakdown-item.pending .breakdown-value { color: var(--studio-warning); }

    /* Clause Breakdown */
    .clause-breakdown {
      padding: 16px;
      border-bottom: 1px solid var(--studio-border);
    }

    .breakdown-title {
      font-size: 0.85em;
      font-weight: 600;
      margin-bottom: 12px;
      color: var(--studio-text-secondary);
    }

    .breakdown-grid {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .breakdown-section h5 {
      font-size: 0.75em;
      color: var(--studio-text-muted);
      margin-bottom: 8px;
      text-transform: uppercase;
    }

    .breakdown-bars {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .breakdown-bar {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .bar-label {
      width: 40px;
      font-size: 0.75em;
      color: var(--studio-text-secondary);
    }

    .bar-track {
      flex: 1;
      height: 6px;
      background: var(--studio-border);
      border-radius: 3px;
      overflow: hidden;
    }

    .bar-fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.3s ease;
    }

    .bar-fill.type-precondition { background: #6bb3f8; }
    .bar-fill.type-postcondition { background: #81c784; }
    .bar-fill.type-invariant { background: #ce93d8; }
    .bar-fill.type-effect { background: #ffb74d; }
    .bar-fill.type-constraint { background: #e57373; }

    .bar-count {
      width: 24px;
      font-size: 0.75em;
      color: var(--studio-text-muted);
      text-align: right;
    }

    .status-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .status-badge {
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 0.75em;
      font-weight: 500;
    }

    .status-badge.verified { background: #4caf5022; color: var(--studio-success); }
    .status-badge.pending { background: #ff980022; color: var(--studio-warning); }
    .status-badge.failed { background: #f4433622; color: var(--studio-error); }
    .status-badge.skipped { background: var(--studio-border); color: var(--studio-text-muted); }

    /* Activity Log */
    .activity-log {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .log-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: var(--studio-surface);
      border-bottom: 1px solid var(--studio-border);
    }

    .log-title {
      font-size: 0.85em;
      font-weight: 600;
      color: var(--studio-text-secondary);
    }

    .log-live {
      padding: 2px 8px;
      background: var(--studio-success);
      color: white;
      border-radius: 10px;
      font-size: 0.65em;
      font-weight: 600;
      animation: blink 1s ease-in-out infinite;
    }

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }

    .log-content {
      flex: 1;
      overflow-y: auto;
      padding: 12px 16px;
      font-family: var(--vscode-editor-font-family);
      font-size: 0.8em;
    }

    .log-entry {
      padding: 4px 0;
      color: var(--studio-text-secondary);
      border-bottom: 1px solid var(--studio-border);
    }

    .log-entry:last-child {
      border-bottom: none;
    }

    .log-empty {
      color: var(--studio-text-muted);
      font-style: italic;
      text-align: center;
      padding: 20px;
    }

    /* Loading Overlay */
    .loading-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }

    .loading-spinner {
      width: 48px;
      height: 48px;
      border: 4px solid var(--studio-border);
      border-top-color: var(--studio-primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    /* Scrollbar */
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    ::-webkit-scrollbar-track {
      background: transparent;
    }

    ::-webkit-scrollbar-thumb {
      background: var(--studio-border);
      border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: var(--studio-text-muted);
    }
  `;
}
