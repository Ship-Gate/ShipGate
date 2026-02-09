# Pro UI Components

Reusable UI components for Pro feature gating in the ISL VS Code extension.

## Overview

This module provides:

- **ProGate** - Feature gating UI with lock icon and upgrade CTA
- **UpsellCard** - Promotional card for Pro features
- **proCopy** - Centralized copy/messaging constants
- **openBilling** - URL handlers for billing flows

## Usage

### Rendering a Pro Gate

```typescript
import { renderProGate, buildProGateStyles } from './ui/pro';

// In your webview HTML
const html = `
  <style>${buildProGateStyles()}</style>
  ${renderProGate('pro_feature', 'Advanced Verification')}
`;
```

### Gate Reasons

| Reason | When to Use |
|--------|-------------|
| `limit_reached` | User hit their plan's usage limit |
| `pro_feature` | Feature requires Pro subscription |
| `trial_expired` | Free trial has ended |
| `team_required` | Feature requires Team plan |
| `upgrade_required` | Generic upgrade prompt |

### Inline Mode

For smaller, inline gates:

```typescript
import { renderInlineProGate } from './ui/pro';

const inlineGate = renderInlineProGate('pro_feature', 'Bulk Export');
```

### Upsell Card

For promotional contexts:

```typescript
import { renderUpsellCard } from './ui/pro';

const card = renderUpsellCard({
  reason: 'pro_feature',
  featureName: 'Custom Policies',
  compact: true,
});
```

### Opening Billing

```typescript
import { openBilling, openUpgrade } from './ui/pro';

// Open main billing page
await openBilling();

// Open upgrade with source tracking
await openUpgrade('evidence-view');
```

## Component Variants

### Full Pro Gate (with features list)

```typescript
renderFullProGate('limit_reached', 'Unlimited Specifications');
```

### Compact Upsell Card

```typescript
renderUpsellCard({
  reason: 'trial_expired',
  featureName: 'Pro Features',
  compact: true,
  showSecondary: false,
});
```

## Customization

### Custom Copy

```typescript
renderProGate('pro_feature', 'My Feature', {
  customMessage: 'Unlock this and more',
});
```

### Custom CTA

```typescript
renderUpsellCard({
  reason: 'upgrade_required',
  featureName: 'Export',
  ctaText: 'Start Free Trial',
});
```

## Webview Script Integration

Add these script handlers to your webview:

```html
<script>
  const vscode = acquireVsCodeApi();
  
  function openBilling() {
    vscode.postMessage({ type: 'openBilling' });
  }
  
  function openPlans() {
    vscode.postMessage({ type: 'openPlans' });
  }
</script>
```

Then handle in your extension:

```typescript
panel.webview.onDidReceiveMessage(async (message) => {
  switch (message.type) {
    case 'openBilling':
      await openBilling();
      break;
    case 'openPlans':
      await openPlans();
      break;
  }
});
```

## Copy Guidelines

All copy in `proCopy.ts` follows these principles:

- **Short** - Concise, scannable text
- **Premium** - Professional, not salesy
- **Value-focused** - Emphasize benefits, not features
- **Non-cringe** - No exclamation marks, no hype

## Files

| File | Purpose |
|------|---------|
| `ProGate.ts` | Main feature gate component |
| `UpsellCard.ts` | Promotional card component |
| `proCopy.ts` | Copy constants and helpers |
| `openBilling.ts` | Billing URL handlers |
| `index.ts` | Barrel exports |

## Billing URLs

All billing URLs point to `https://app.shipgateai.dev`:

- `/billing` - Main billing dashboard
- `/plans` - Plan comparison page
- `/upgrade` - Upgrade flow
- `/checkout` - Checkout with plan selection
- `/portal` - Customer portal (Stripe)
- `/contact` - Sales contact form

## Registering Commands

```typescript
import { createBillingCommand, createUpgradeCommand } from './ui/pro';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    createBillingCommand(),
    createUpgradeCommand()
  );
}
```

This registers:
- `isl.openBilling` - Opens billing page
- `isl.upgrade` - Opens upgrade flow (accepts source param)
