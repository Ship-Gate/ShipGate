/**
 * Upsell Card - Reusable Pro upgrade card component
 * 
 * A styled card component for Pro feature promotion.
 * Uses VS Code CSS variables for theme compatibility.
 */

import {
  type GateReason,
  type FeatureName,
  getHeadline,
  getCTA,
  getGateMessage,
  ValueProps,
} from './proCopy';

// ============================================================================
// Types
// ============================================================================

export interface UpsellCardOptions {
  /** The reason for showing the upsell */
  reason: GateReason;
  /** The feature being gated */
  featureName: string;
  /** Optional custom headline */
  headline?: string;
  /** Optional custom description */
  description?: string;
  /** Optional custom CTA text */
  ctaText?: string;
  /** Whether to show the secondary CTA */
  showSecondary?: boolean;
  /** Compact mode for inline display */
  compact?: boolean;
}

// ============================================================================
// Styles
// ============================================================================

export function buildUpsellStyles(): string {
  return `
    .upsell-card {
      background: linear-gradient(135deg, 
        var(--vscode-editor-background) 0%, 
        var(--vscode-sideBar-background) 100%);
      border: 1px solid var(--vscode-focusBorder);
      border-radius: 8px;
      padding: 24px;
      text-align: center;
      max-width: 400px;
      margin: 0 auto;
    }

    .upsell-card.compact {
      padding: 16px;
      max-width: 320px;
    }

    .upsell-icon {
      width: 48px;
      height: 48px;
      margin: 0 auto 16px;
      background: var(--vscode-button-background);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .upsell-card.compact .upsell-icon {
      width: 36px;
      height: 36px;
      margin-bottom: 12px;
    }

    .upsell-icon svg {
      width: 24px;
      height: 24px;
      fill: var(--vscode-button-foreground);
    }

    .upsell-card.compact .upsell-icon svg {
      width: 18px;
      height: 18px;
    }

    .upsell-headline {
      font-size: 1.25em;
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--vscode-foreground);
    }

    .upsell-card.compact .upsell-headline {
      font-size: 1.1em;
    }

    .upsell-feature {
      font-size: 0.9em;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 4px;
    }

    .upsell-description {
      font-size: 0.95em;
      color: var(--vscode-foreground);
      margin-bottom: 20px;
      line-height: 1.5;
    }

    .upsell-card.compact .upsell-description {
      font-size: 0.85em;
      margin-bottom: 16px;
    }

    .upsell-cta {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 24px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      font-size: 0.95em;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s ease;
      text-decoration: none;
    }

    .upsell-cta:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .upsell-card.compact .upsell-cta {
      padding: 8px 20px;
      font-size: 0.9em;
    }

    .upsell-secondary {
      display: block;
      margin-top: 12px;
      font-size: 0.85em;
      color: var(--vscode-textLink-foreground);
      text-decoration: none;
      cursor: pointer;
    }

    .upsell-secondary:hover {
      text-decoration: underline;
    }

    .upsell-badge {
      display: inline-block;
      padding: 2px 8px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      border-radius: 10px;
      font-size: 0.75em;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }
  `;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Render an upsell card HTML snippet
 */
export function renderUpsellCard(options: UpsellCardOptions): string {
  const {
    reason,
    featureName,
    headline = getHeadline(reason),
    description = getValueProp(reason),
    ctaText = getCTA(reason),
    showSecondary = true,
    compact = false,
  } = options;

  const compactClass = compact ? ' compact' : '';
  const gateMessage = getGateMessage(reason);

  return `
    <div class="upsell-card${compactClass}">
      <div class="upsell-icon">
        ${getProIcon()}
      </div>
      <div class="upsell-badge">Pro</div>
      <div class="upsell-headline">${escapeHtml(headline)}</div>
      <div class="upsell-feature">${escapeHtml(gateMessage)}: ${escapeHtml(featureName)}</div>
      <div class="upsell-description">${escapeHtml(description)}</div>
      <button class="upsell-cta" onclick="openBilling()">
        ${escapeHtml(ctaText)}
        ${getArrowIcon()}
      </button>
      ${showSecondary ? `
        <a class="upsell-secondary" onclick="openPlans()">
          Compare plans
        </a>
      ` : ''}
    </div>
  `;
}

// ============================================================================
// Helpers
// ============================================================================

function getValueProp(reason: GateReason): string {
  switch (reason) {
    case 'limit_reached':
      return ValueProps.UNLIMITED;
    case 'team_required':
      return ValueProps.TEAMS;
    default:
      return ValueProps.VERIFICATION;
  }
}

function getProIcon(): string {
  return `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
    </svg>
  `;
}

function getArrowIcon(): string {
  return `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M6 3l5 5-5 5V3z"/>
    </svg>
  `;
}

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
