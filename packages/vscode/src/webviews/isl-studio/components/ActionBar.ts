/**
 * Action Bar Component
 * 
 * Action buttons for Open Spec, Open Report, Copy Fingerprint.
 */

/**
 * Build file icon SVG
 */
function buildFileIcon(): string {
  return `
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M3.75 1.5a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25V6h-2.75A1.75 1.75 0 018 4.25V1.5H3.75z"/>
      <path d="M9.5 1.62V4.25c0 .138.112.25.25.25h2.688l-2.938-2.88z"/>
    </svg>
  `;
}

/**
 * Build report icon SVG
 */
function buildReportIcon(): string {
  return `
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M0 1.75A.75.75 0 01.75 1h4.253c1.227 0 2.317.59 3 1.501A3.744 3.744 0 0111.006 1h4.245a.75.75 0 01.75.75v10.5a.75.75 0 01-.75.75h-4.507a2.25 2.25 0 00-1.591.659l-.622.621a.75.75 0 01-1.06 0l-.622-.621A2.25 2.25 0 005.258 13H.75a.75.75 0 01-.75-.75V1.75zm8.755 3a2.25 2.25 0 012.25-2.25H14.5v9h-3.757c-.71 0-1.4.201-1.992.572l.004-7.322zm-1.504 7.324l.004-5.073-.002-2.253A2.25 2.25 0 005.003 2.5H1.5v9h3.757a3.75 3.75 0 011.994.574z"/>
    </svg>
  `;
}

/**
 * Build copy icon SVG
 */
function buildCopyIcon(): string {
  return `
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"/>
      <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"/>
    </svg>
  `;
}

/**
 * Build refresh icon SVG
 */
function buildRefreshIcon(): string {
  return `
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M1.705 8.005a.75.75 0 01.834.656 5.5 5.5 0 009.592 2.97l-1.204-1.204a.25.25 0 01.177-.427h3.646a.25.25 0 01.25.25v3.646a.25.25 0 01-.427.177l-1.38-1.38A7.001 7.001 0 011.05 8.84a.75.75 0 01.656-.834zM14.295 7.995a.75.75 0 01-.834-.656 5.5 5.5 0 00-9.592-2.97l1.204 1.204a.25.25 0 01-.177.427H1.25a.25.25 0 01-.25-.25V2.104a.25.25 0 01.427-.177l1.38 1.38A7.001 7.001 0 0114.95 7.16a.75.75 0 01-.656.834z"/>
    </svg>
  `;
}

/**
 * Build the action bar HTML
 */
export function buildActionBar(hasReportFile: boolean): string {
  return `
    <div class="action-bar">
      <button class="action-button" onclick="sendMessage({ type: 'openSpec' })">
        ${buildFileIcon()}
        Open Spec
      </button>
      ${hasReportFile ? `
        <button class="action-button" onclick="sendMessage({ type: 'openReport' })">
          ${buildReportIcon()}
          Open Report
        </button>
      ` : ''}
      <button class="action-button secondary" onclick="sendMessage({ type: 'copyFingerprint' })">
        ${buildCopyIcon()}
        Copy Fingerprint
      </button>
      <button class="action-button secondary" onclick="sendMessage({ type: 'refresh' })">
        ${buildRefreshIcon()}
        Refresh
      </button>
    </div>
  `;
}
