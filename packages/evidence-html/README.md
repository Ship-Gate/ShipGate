# @isl-lang/evidence-html

HTML renderer for ISL verification evidence reports. Generates clean, readable, embeddable HTML.

## Installation

```bash
pnpm add @isl-lang/evidence-html
```

## Features

- **Score Banner**: Visual SHIP/NO_SHIP verdict with pass rate
- **Clause Table**: PASS/PARTIAL/FAIL status with file/line evidence
- **Assumptions & Questions**: Documented assumptions and open questions
- **Repro Commands**: Commands to reproduce verification
- **Self-Contained**: CSS included, works standalone or embedded
- **Theme Support**: Light/dark mode via CSS custom properties

## Usage

### Generate HTML Report

```typescript
import { render } from '@isl-lang/evidence-html';
import type { EvidenceReport } from '@isl-lang/evidence';

// Render an embeddable fragment (includes styles)
const html = render(report);

// Render a complete HTML document
const document = render(report, { fullDocument: true });

// Render without styles (for custom styling)
const unstyled = render(report, { includeStyles: false });

// Use minimal styles for embedded contexts
const minimal = render(report, { styleVariant: 'minimal' });
```

### Save to File

```typescript
import { render } from '@isl-lang/evidence-html';
import { writeFileSync } from 'node:fs';

const html = render(report, {
  fullDocument: true,
  title: 'Verification Report - UserService',
});

writeFileSync('report.html', html);
```

### Embed in Web Page

```typescript
import { render } from '@isl-lang/evidence-html';

// Get embeddable HTML with styles
const html = render(report);

// Insert into page
document.getElementById('report-container').innerHTML = html;
```

### Render Partial Components

```typescript
import { renderBannerOnly, renderClausesOnly } from '@isl-lang/evidence-html';

// Just the score banner
const banner = renderBannerOnly(report);

// Just the clause table
const table = renderClausesOnly(report.clauses);
```

### Custom Styling

```typescript
import { render, getStyles } from '@isl-lang/evidence-html';

// Add custom styles
const html = render(report, {
  customStyles: `
    .evidence-banner { border-radius: 16px; }
    .evidence-status { font-size: 0.875rem; }
  `,
});

// Get styles separately
const styles = getStyles('default'); // or 'minimal'
```

## Render Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `includeStyles` | boolean | `true` | Include CSS in output |
| `styleVariant` | `'default' \| 'minimal'` | `'default'` | CSS variant |
| `fullDocument` | boolean | `false` | Generate complete HTML document |
| `title` | string | Contract name | Document title (fullDocument only) |
| `customStyles` | string | `''` | Additional CSS to include |

## HTML Structure

```html
<div class="evidence-report">
  <!-- Score Banner -->
  <div class="evidence-banner evidence-banner--ship">
    <div class="evidence-banner__verdict">✓ SHIP</div>
    <div class="evidence-banner__stats">100% Pass Rate</div>
  </div>

  <!-- Clause Results -->
  <section class="evidence-section">
    <h2 class="evidence-section__title">Clause Results</h2>
    <table class="evidence-clauses">...</table>
  </section>

  <!-- Assumptions -->
  <section class="evidence-section">
    <h2 class="evidence-section__title">Assumptions</h2>
    <ul class="evidence-list">...</ul>
  </section>

  <!-- Open Questions -->
  <section class="evidence-section">
    <h2 class="evidence-section__title">Open Questions</h2>
    <ul class="evidence-list">...</ul>
  </section>

  <!-- Reproduction Commands -->
  <section class="evidence-section">
    <h2 class="evidence-section__title">Reproduction Commands</h2>
    <div class="evidence-command">...</div>
  </section>

  <!-- Metadata Footer -->
  <div class="evidence-metadata">...</div>
</div>
```

## CSS Custom Properties

The default styles use CSS custom properties for theming:

```css
:root {
  --evidence-font-family: system-ui, sans-serif;
  --evidence-bg: #ffffff;
  --evidence-text: #1a1a2e;
  --evidence-ship: #059669;
  --evidence-no-ship: #dc2626;
  --evidence-pass: #059669;
  --evidence-partial: #d97706;
  --evidence-fail: #dc2626;
}
```

Override these in your CSS for custom themes.

## Dark Mode

The default styles include automatic dark mode support via `prefers-color-scheme`:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --evidence-bg: #1a1a2e;
    --evidence-text: #f3f4f6;
  }
}
```

## Examples

### CI/CD Integration

```typescript
// Generate report after verification
import { render } from '@isl-lang/evidence-html';
import { validateEvidenceReport } from '@isl-lang/evidence';

const report = validateEvidenceReport(verificationResult);
const html = render(report, { fullDocument: true });

// Upload as artifact or publish to dashboard
await uploadArtifact('evidence-report.html', html);
```

### Email Summary

```typescript
import { renderBannerOnly, getStyles } from '@isl-lang/evidence-html';

const banner = renderBannerOnly(report);
const styles = getStyles('minimal');

const emailHtml = `
  <style>${styles}</style>
  ${banner}
  <p>View full report: ${reportUrl}</p>
`;
```

## API Reference

### Rendering

| Function | Description |
|----------|-------------|
| `render(report, options?)` | Render full evidence report |
| `renderBannerOnly(report)` | Render just the score banner |
| `renderClausesOnly(clauses)` | Render just the clause table |

### Styles

| Function | Description |
|----------|-------------|
| `getStyles(variant)` | Get CSS styles ('default' or 'minimal') |
| `defaultStyles` | Full CSS with custom properties |
| `minimalStyles` | Compact CSS without custom properties |

## License

MIT
