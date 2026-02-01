/**
 * Pro Gate - Feature gating UI component
 * 
 * Provides a consistent way to gate Pro features in the VS Code extension.
 * Returns HTML snippets that can be embedded in webviews.
 */

import {
  type GateReason,
  getHeadline,
  getCTA,
  getGateMessage,
  FeatureDescriptions,
  ValueProps,
} from './proCopy';
import { buildUpsellStyles, renderUpsellCard } from './UpsellCard';

// ============================================================================
// Types
// ============================================================================

export interface ProGateOptions {
  /** The reason the feature is gated */
  reason: GateReason;
  /** The name of the feature being gated */
  featureName: string;
  /** Optional custom message */
  customMessage?: string;
  /** Show feature list */
  showFeatures?: boolean;
  /** Inline mode (minimal UI) */
  inline?: boolean;
}

// ============================================================================
// Styles
// ============================================================================

export function buildProGateStyles(): string {
  return `
    ${buildUpsellStyles()}

    .pro-gate {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      padding: 32px;
      text-align: center;
    }

    .pro-gate.inline {
      padding: 16px;
      border-radius: 4px;
      display: inline-flex;
      align-items: center;
      gap: 16px;
      text-align: left;
    }

    .pro-gate-lock {
      width: 64px;
      height: 64px;
      margin: 0 auto 20px;
      background: var(--vscode-badge-background);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .pro-gate.inline .pro-gate-lock {
      width: 40px;
      height: 40px;
      margin: 0;
      flex-shrink: 0;
    }

    .pro-gate-lock svg {
      width: 32px;
      height: 32px;
      fill: var(--vscode-badge-foreground);
    }

    .pro-gate.inline .pro-gate-lock svg {
      width: 20px;
      height: 20px;
    }

    .pro-gate-content {
      flex: 1;
    }

    .pro-gate-title {
      font-size: 1.4em;
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--vscode-foreground);
    }

    .pro-gate.inline .pro-gate-title {
      font-size: 1em;
      margin-bottom: 4px;
    }

    .pro-gate-subtitle {
      font-size: 0.95em;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 24px;
    }

    .pro-gate.inline .pro-gate-subtitle {
      font-size: 0.85em;
      margin-bottom: 0;
    }

    .pro-gate-features {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px;
      margin-bottom: 24px;
    }

    .pro-gate-feature {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      border-radius: 16px;
      font-size: 0.85em;
    }

    .pro-gate-feature svg {
      width: 14px;
      height: 14px;
      fill: currentColor;
    }

    .pro-gate-cta {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 32px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      font-size: 1em;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s ease;
      text-decoration: none;
    }

    .pro-gate-cta:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .pro-gate.inline .pro-gate-cta {
      padding: 8px 16px;
      font-size: 0.9em;
    }

    .pro-gate-link {
      display: block;
      margin-top: 16px;
      font-size: 0.85em;
      color: var(--vscode-textLink-foreground);
      text-decoration: none;
    }

    .pro-gate-link:hover {
      text-decoration: underline;
    }
  `;
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Render a Pro gate HTML snippet
 * 
 * @param reason - Why the feature is gated
 * @param featureName - Name of the gated feature
 * @param options - Additional rendering options
 * @returns HTML string to embed in a webview
 */
export function renderProGate(
  reason: GateReason,
  featureName: string,
  options: Partial<ProGateOptions> = {}
): string {
  const {
    customMessage,
    showFeatures = false,
    inline = false,
  } = options;

  const headline = getHeadline(reason);
  const subtitle = customMessage ?? getGateMessage(reason);
  const ctaText = getCTA(reason);
  const inlineClass = inline ? ' inline' : '';

  return `
    <div class="pro-gate${inlineClass}">
      <div class="pro-gate-lock">
        ${getLockIcon()}
      </div>
      <div class="pro-gate-content">
        <div class="pro-gate-title">${escapeHtml(headline)}</div>
        <div class="pro-gate-subtitle">
          ${escapeHtml(subtitle)}: <strong>${escapeHtml(featureName)}</strong>
        </div>
        ${!inline && showFeatures ? renderFeatureList() : ''}
        ${!inline ? `
          <button class="pro-gate-cta" onclick="openBilling()">
            ${escapeHtml(ctaText)}
            ${getArrowIcon()}
          </button>
          <a class="pro-gate-link" onclick="openPlans()">Compare all plans</a>
        ` : `
          <button class="pro-gate-cta" onclick="openBilling()">
            ${escapeHtml(ctaText)}
          </button>
        `}
      </div>
    </div>
  `;
}

/**
 * Render a compact inline Pro gate
 */
export function renderInlineProGate(reason: GateReason, featureName: string): string {
  return renderProGate(reason, featureName, { inline: true });
}

/**
 * Render a full-page Pro gate with feature showcase
 */
export function renderFullProGate(reason: GateReason, featureName: string): string {
  return renderProGate(reason, featureName, { showFeatures: true });
}

// ============================================================================
// Feature List
// ============================================================================

const PRO_FEATURES = [
  { name: 'Unlimited specs', icon: 'infinity' },
  { name: 'Advanced verification', icon: 'shield' },
  { name: 'Team collaboration', icon: 'users' },
  { name: 'CI integration', icon: 'workflow' },
];

function renderFeatureList(): string {
  const features = PRO_FEATURES.map(f => `
    <span class="pro-gate-feature">
      ${getFeatureIcon(f.icon)}
      ${escapeHtml(f.name)}
    </span>
  `).join('');

  return `<div class="pro-gate-features">${features}</div>`;
}

// ============================================================================
// Icons
// ============================================================================

function getLockIcon(): string {
  return `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 1C9.24 1 7 3.24 7 6V8H6C4.9 8 4 8.9 4 10V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V10C20 8.9 19.1 8 18 8H17V6C17 3.24 14.76 1 12 1ZM12 3C13.66 3 15 4.34 15 6V8H9V6C9 4.34 10.34 3 12 3ZM12 13C13.1 13 14 13.9 14 15C14 16.1 13.1 17 12 17C10.9 17 10 16.1 10 15C10 13.9 10.9 13 12 13Z"/>
    </svg>
  `;
}

function getArrowIcon(): string {
  return `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8.7 1.3L15.4 8l-6.7 6.7-1.4-1.4L11.6 9H1V7h10.6L7.3 2.7l1.4-1.4z"/>
    </svg>
  `;
}

function getFeatureIcon(type: string): string {
  const icons: Record<string, string> = {
    infinity: '<svg viewBox="0 0 24 24"><path d="M18.6 6.62C17.16 6.62 15.8 7.18 14.83 8.15L12 10.98L9.17 8.15C8.2 7.18 6.84 6.62 5.4 6.62C2.42 6.62 0 9.04 0 12C0 14.96 2.42 17.38 5.4 17.38C6.84 17.38 8.2 16.82 9.17 15.85L12 13.02L14.83 15.85C15.8 16.82 17.16 17.38 18.6 17.38C21.58 17.38 24 14.96 24 12C24 9.04 21.58 6.62 18.6 6.62ZM5.4 15.38C3.53 15.38 2 13.85 2 12C2 10.15 3.53 8.62 5.4 8.62C6.27 8.62 7.09 8.97 7.71 9.59L9.88 11.76L7.71 13.93C7.09 14.55 6.27 14.9 5.4 15.38ZM18.6 15.38C17.73 15.38 16.91 15.03 16.29 14.41L14.12 12.24L16.29 10.07C16.91 9.45 17.73 9.1 18.6 8.62C20.47 8.62 22 10.15 22 12C22 13.85 20.47 15.38 18.6 15.38Z"/></svg>',
    shield: '<svg viewBox="0 0 24 24"><path d="M12 1L3 5V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V5L12 1ZM12 11.99H19C18.47 16.11 15.72 19.78 12 20.93V12H5V6.3L12 3.19V11.99Z"/></svg>',
    users: '<svg viewBox="0 0 24 24"><path d="M16 11C17.66 11 18.99 9.66 18.99 8C18.99 6.34 17.66 5 16 5C14.34 5 13 6.34 13 8C13 9.66 14.34 11 16 11ZM8 11C9.66 11 10.99 9.66 10.99 8C10.99 6.34 9.66 5 8 5C6.34 5 5 6.34 5 8C5 9.66 6.34 11 8 11ZM8 13C5.67 13 1 14.17 1 16.5V19H15V16.5C15 14.17 10.33 13 8 13ZM16 13C15.71 13 15.38 13.02 15.03 13.05C16.19 13.89 17 15.02 17 16.5V19H23V16.5C23 14.17 18.33 13 16 13Z"/></svg>',
    workflow: '<svg viewBox="0 0 24 24"><path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM17 13H13V17H11V13H7V11H11V7H13V11H17V13Z"/></svg>',
  };
  return icons[type] ?? '';
}

// ============================================================================
// Helpers
// ============================================================================

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, m => map[m] ?? m);
}

// ============================================================================
// Exports
// ============================================================================

export {
  renderUpsellCard,
  buildUpsellStyles,
  type GateReason,
};
