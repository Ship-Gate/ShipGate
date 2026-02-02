/**
 * CSS Styles for Evidence HTML Reports
 *
 * Self-contained CSS that works standalone or embedded.
 * Uses CSS custom properties for theming.
 */

/**
 * Default CSS styles for evidence reports
 */
export const defaultStyles = `
/* Evidence Report Styles */
:root {
  --evidence-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  --evidence-font-mono: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace;
  
  /* Colors */
  --evidence-bg: #ffffff;
  --evidence-text: #1a1a2e;
  --evidence-text-muted: #6b7280;
  --evidence-border: #e5e7eb;
  
  /* Status colors */
  --evidence-ship: #059669;
  --evidence-ship-bg: #d1fae5;
  --evidence-no-ship: #dc2626;
  --evidence-no-ship-bg: #fee2e2;
  --evidence-pass: #059669;
  --evidence-pass-bg: #d1fae5;
  --evidence-partial: #d97706;
  --evidence-partial-bg: #fef3c7;
  --evidence-fail: #dc2626;
  --evidence-fail-bg: #fee2e2;
  
  /* Risk colors */
  --evidence-risk-low: #059669;
  --evidence-risk-medium: #d97706;
  --evidence-risk-high: #dc2626;
  
  /* Spacing */
  --evidence-spacing-xs: 0.25rem;
  --evidence-spacing-sm: 0.5rem;
  --evidence-spacing-md: 1rem;
  --evidence-spacing-lg: 1.5rem;
  --evidence-spacing-xl: 2rem;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  :root {
    --evidence-bg: #1a1a2e;
    --evidence-text: #f3f4f6;
    --evidence-text-muted: #9ca3af;
    --evidence-border: #374151;
    --evidence-ship-bg: #064e3b;
    --evidence-no-ship-bg: #7f1d1d;
    --evidence-pass-bg: #064e3b;
    --evidence-partial-bg: #78350f;
    --evidence-fail-bg: #7f1d1d;
  }
}

.evidence-report {
  font-family: var(--evidence-font-family);
  color: var(--evidence-text);
  background: var(--evidence-bg);
  line-height: 1.6;
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--evidence-spacing-lg);
}

/* Score Banner */
.evidence-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--evidence-spacing-lg);
  border-radius: 8px;
  margin-bottom: var(--evidence-spacing-xl);
}

.evidence-banner--ship {
  background: var(--evidence-ship-bg);
  border: 2px solid var(--evidence-ship);
}

.evidence-banner--no-ship {
  background: var(--evidence-no-ship-bg);
  border: 2px solid var(--evidence-no-ship);
}

.evidence-banner__verdict {
  font-size: 2rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: var(--evidence-spacing-sm);
}

.evidence-banner--ship .evidence-banner__verdict {
  color: var(--evidence-ship);
}

.evidence-banner--no-ship .evidence-banner__verdict {
  color: var(--evidence-no-ship);
}

.evidence-banner__stats {
  text-align: right;
}

.evidence-banner__pass-rate {
  font-size: 1.5rem;
  font-weight: 600;
}

.evidence-banner__details {
  font-size: 0.875rem;
  color: var(--evidence-text-muted);
}

/* Section Headers */
.evidence-section {
  margin-bottom: var(--evidence-spacing-xl);
}

.evidence-section__title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: var(--evidence-spacing-md);
  padding-bottom: var(--evidence-spacing-sm);
  border-bottom: 2px solid var(--evidence-border);
}

/* Clause Table */
.evidence-clauses {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.evidence-clauses th,
.evidence-clauses td {
  padding: var(--evidence-spacing-sm) var(--evidence-spacing-md);
  text-align: left;
  border-bottom: 1px solid var(--evidence-border);
}

.evidence-clauses th {
  background: var(--evidence-border);
  font-weight: 600;
}

.evidence-clauses tr:hover {
  background: rgba(0, 0, 0, 0.02);
}

/* Status Badges */
.evidence-status {
  display: inline-flex;
  align-items: center;
  padding: var(--evidence-spacing-xs) var(--evidence-spacing-sm);
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
}

.evidence-status--pass {
  background: var(--evidence-pass-bg);
  color: var(--evidence-pass);
}

.evidence-status--partial {
  background: var(--evidence-partial-bg);
  color: var(--evidence-partial);
}

.evidence-status--fail {
  background: var(--evidence-fail-bg);
  color: var(--evidence-fail);
}

/* Evidence Details */
.evidence-details {
  margin-top: var(--evidence-spacing-sm);
  padding: var(--evidence-spacing-sm);
  background: rgba(0, 0, 0, 0.02);
  border-radius: 4px;
  font-size: 0.8125rem;
}

.evidence-location {
  font-family: var(--evidence-font-mono);
  color: var(--evidence-text-muted);
  font-size: 0.75rem;
}

.evidence-snippet {
  font-family: var(--evidence-font-mono);
  background: var(--evidence-border);
  padding: var(--evidence-spacing-sm);
  border-radius: 4px;
  overflow-x: auto;
  font-size: 0.8125rem;
  margin-top: var(--evidence-spacing-xs);
}

/* Assumptions & Open Questions */
.evidence-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.evidence-list__item {
  padding: var(--evidence-spacing-md);
  border: 1px solid var(--evidence-border);
  border-radius: 4px;
  margin-bottom: var(--evidence-spacing-sm);
}

.evidence-list__item-header {
  display: flex;
  align-items: center;
  gap: var(--evidence-spacing-sm);
  margin-bottom: var(--evidence-spacing-xs);
}

.evidence-list__item-id {
  font-family: var(--evidence-font-mono);
  font-size: 0.75rem;
  color: var(--evidence-text-muted);
}

.evidence-risk {
  font-size: 0.75rem;
  padding: 2px 6px;
  border-radius: 3px;
}

.evidence-risk--low {
  background: var(--evidence-pass-bg);
  color: var(--evidence-risk-low);
}

.evidence-risk--medium {
  background: var(--evidence-partial-bg);
  color: var(--evidence-risk-medium);
}

.evidence-risk--high {
  background: var(--evidence-fail-bg);
  color: var(--evidence-risk-high);
}

.evidence-priority--low {
  background: var(--evidence-pass-bg);
  color: var(--evidence-risk-low);
}

.evidence-priority--medium {
  background: var(--evidence-partial-bg);
  color: var(--evidence-risk-medium);
}

.evidence-priority--high {
  background: var(--evidence-fail-bg);
  color: var(--evidence-risk-high);
}

/* Repro Commands */
.evidence-command {
  margin-bottom: var(--evidence-spacing-md);
}

.evidence-command__description {
  font-weight: 500;
  margin-bottom: var(--evidence-spacing-xs);
}

.evidence-command__code {
  font-family: var(--evidence-font-mono);
  background: #1e293b;
  color: #e2e8f0;
  padding: var(--evidence-spacing-md);
  border-radius: 4px;
  overflow-x: auto;
  font-size: 0.875rem;
}

.evidence-command__meta {
  font-size: 0.75rem;
  color: var(--evidence-text-muted);
  margin-top: var(--evidence-spacing-xs);
}

/* Metadata Footer */
.evidence-metadata {
  font-size: 0.75rem;
  color: var(--evidence-text-muted);
  border-top: 1px solid var(--evidence-border);
  padding-top: var(--evidence-spacing-md);
  margin-top: var(--evidence-spacing-xl);
}

.evidence-metadata dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--evidence-spacing-xs) var(--evidence-spacing-md);
  margin: 0;
}

.evidence-metadata dt {
  font-weight: 500;
}

.evidence-metadata dd {
  margin: 0;
  font-family: var(--evidence-font-mono);
}

/* Empty state */
.evidence-empty {
  color: var(--evidence-text-muted);
  font-style: italic;
  padding: var(--evidence-spacing-md);
  text-align: center;
}
`;

/**
 * Minimal CSS for embedded reports (no custom properties)
 */
export const minimalStyles = `
.evidence-report { font-family: system-ui, sans-serif; max-width: 1200px; margin: 0 auto; padding: 1.5rem; line-height: 1.6; }
.evidence-banner { display: flex; justify-content: space-between; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem; }
.evidence-banner--ship { background: #d1fae5; border: 2px solid #059669; }
.evidence-banner--no-ship { background: #fee2e2; border: 2px solid #dc2626; }
.evidence-banner__verdict { font-size: 2rem; font-weight: 700; }
.evidence-banner--ship .evidence-banner__verdict { color: #059669; }
.evidence-banner--no-ship .evidence-banner__verdict { color: #dc2626; }
.evidence-section { margin-bottom: 2rem; }
.evidence-section__title { font-size: 1.25rem; font-weight: 600; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.5rem; margin-bottom: 1rem; }
.evidence-clauses { width: 100%; border-collapse: collapse; }
.evidence-clauses th, .evidence-clauses td { padding: 0.5rem 1rem; text-align: left; border-bottom: 1px solid #e5e7eb; }
.evidence-clauses th { background: #f3f4f6; }
.evidence-status { display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 0.75rem; }
.evidence-status--pass { background: #d1fae5; color: #059669; }
.evidence-status--partial { background: #fef3c7; color: #d97706; }
.evidence-status--fail { background: #fee2e2; color: #dc2626; }
.evidence-command__code { font-family: monospace; background: #1e293b; color: #e2e8f0; padding: 1rem; border-radius: 4px; }
.evidence-metadata { font-size: 0.75rem; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 1rem; margin-top: 2rem; }
`;

/**
 * Get CSS styles
 * @param variant - Style variant ('default' | 'minimal')
 */
export function getStyles(variant: 'default' | 'minimal' = 'default'): string {
  return variant === 'minimal' ? minimalStyles : defaultStyles;
}
