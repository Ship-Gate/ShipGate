# @isl-lang/feature-flags

> Deterministic, testable, and auditable feature flag system for ISL

A production-ready feature flag system that provides:
- **Boolean flags**: Simple on/off toggles
- **Multivariate flags**: Multiple variants with weighted distribution
- **Percentage rollouts**: Gradual feature rollouts with deterministic bucketing
- **Deterministic bucketing**: Same user/org consistently gets same decision
- **Audit logging**: Complete trail of why flags evaluated a certain way

## Installation

```bash
pnpm add @isl-lang/feature-flags
```

## Quick Start

```typescript
import { FeatureFlagProvider } from '@isl-lang/feature-flags';

// Initialize provider
const provider = new FeatureFlagProvider({
  source: 'local',
  localFlags: [
    {
      key: 'new-feature',
      name: 'New Feature',
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
});

await provider.initialize();

// Evaluate flag
const context = { userId: 'user-123' };
const isEnabled = provider.isEnabled('new-feature', context);
```

## Core Concepts

### Boolean Flags

Simple on/off toggles for feature gating:

```typescript
const flag: FeatureFlag = {
  key: 'enable-new-ui',
  name: 'Enable New UI',
  enabled: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const result = provider.evaluate('enable-new-ui', { userId: 'user-1' });
console.log(result.enabled); // true or false
```

### Multivariate Flags

Multiple variants with different values:

```typescript
const flag: FeatureFlag = {
  key: 'button-color',
  name: 'Button Color',
  enabled: true,
  variants: [
    { key: 'blue', name: 'Blue', value: '#0066cc' },
    { key: 'green', name: 'Green', value: '#00cc66' },
    { key: 'red', name: 'Red', value: '#cc0000' },
  ],
  defaultVariant: 'blue',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const result = provider.evaluate('button-color', { userId: 'user-1' });
console.log(result.variant); // 'blue', 'green', or 'red'
console.log(result.value); // '#0066cc', '#00cc66', or '#cc0000'
```

### Percentage Rollout

Gradually roll out features to a percentage of users:

```typescript
const flag: FeatureFlag = {
  key: 'new-checkout',
  name: 'New Checkout Flow',
  enabled: true,
  rollout: {
    type: 'percentage',
    percentage: 25, // 25% of users
  },
  variants: [
    { key: 'enabled', name: 'Enabled', value: true },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const result = provider.evaluate('new-checkout', { userId: 'user-123' });
// Deterministic: same user always gets same result
```

### Deterministic Bucketing

The system uses stable hashing to ensure consistency:

- **Same user** → Same bucket → Same decision
- **Same org** → Same bucket → Same decision (when using orgId)
- Bucket range: **0-100** (inclusive)

```typescript
// User-based stickiness (default)
const context1 = { userId: 'user-123' };
const result1 = provider.evaluate('flag', context1);

// Same user, same result
const result2 = provider.evaluate('flag', context1);
expect(result1.enabled).toBe(result2.enabled);

// Org-based stickiness
const context2 = { userId: 'user-1', orgId: 'org-123' };
const context3 = { userId: 'user-2', orgId: 'org-123' };
// Both users in same org get same decision
```

**Stickiness Priority:**
1. Custom stickiness attribute (if specified in rollout config)
2. `orgId` (if available)
3. `userId` (fallback)

### Audit Logging

Every flag evaluation is logged with detailed reasoning:

```typescript
// Evaluate a flag
provider.evaluate('my-flag', { userId: 'user-123' });

// Get audit log
const auditLog = provider.getAuditLog();
const lastEvent = auditLog[0];

console.log(lastEvent.reasoning);
// {
//   bucket: 42,
//   stickinessKey: 'userId',
//   stickinessValue: 'user-123',
//   rolloutPercentage: 50,
//   hashValue: 1234567890
// }
```

**Audit Event Structure:**
- `timestamp`: When the evaluation occurred
- `flagKey`: Which flag was evaluated
- `action`: Type of action (`evaluate`, `update`, `create`, `delete`)
- `context`: User/org context used
- `result`: Evaluation result
- `reasoning`: Detailed explanation of why the decision was made

## API Reference

### FeatureFlagProvider

#### Constructor

```typescript
new FeatureFlagProvider(config: FlagProviderConfig)
```

**Config Options:**
- `source`: `'local' | 'remote' | 'hybrid'` - Flag source
- `localFlags`: Array of local flags
- `remoteUrl`: URL for remote flag fetching
- `apiKey`: API key for remote requests
- `refreshInterval`: How often to refresh flags (ms)
- `cacheEnabled`: Enable result caching
- `cacheTTL`: Cache TTL (ms)
- `defaultOnError`: Default value when flag not found

#### Methods

**`initialize(): Promise<void>`**
Initialize the provider and load flags.

**`evaluate(flagKey: string, context: EvaluationContext): EvaluationResult`**
Evaluate a flag for a given context.

**`isEnabled(flagKey: string, context: EvaluationContext): boolean`**
Simple boolean check if flag is enabled.

**`getVariant(flagKey: string, context: EvaluationContext): string | undefined`**
Get the variant key for a flag.

**`getValue<T>(flagKey: string, context: EvaluationContext, defaultValue: T): T`**
Get the variant value with a default fallback.

**`getAuditLog(limit?: number): FlagAuditEvent[]`**
Get audit log entries (most recent first).

**`updateFlag(flag: FeatureFlag): void`**
Update a flag locally.

**`getAllFlags(): FeatureFlag[]`**
Get all loaded flags.

**`getFlag(key: string): FeatureFlag | undefined`**
Get a specific flag.

**`shutdown(): void`**
Clean up resources and stop refresh timers.

### EvaluationContext

```typescript
interface EvaluationContext {
  userId?: string;      // User identifier
  orgId?: string;       // Organization identifier (preferred for stickiness)
  sessionId?: string;   // Session identifier
  attributes?: Record<string, unknown>; // Custom attributes
  environment?: string; // Environment (dev, staging, prod)
  timestamp?: number;    // Evaluation timestamp
}
```

### EvaluationResult

```typescript
interface EvaluationResult {
  flagKey: string;
  enabled: boolean;
  variant?: string;
  value?: unknown;
  reason: EvaluationReason;
  metadata?: Record<string, unknown>;
  reasoning?: EvaluationReasoning; // Detailed reasoning
}
```

**Evaluation Reasons:**
- `FLAG_DISABLED`: Flag is disabled or expired
- `DEFAULT_VARIANT`: Default variant returned
- `TARGETING_MATCH`: Matched a targeting rule
- `ROLLOUT`: Included in percentage rollout
- `OVERRIDE`: Manual override applied
- `ERROR`: Error occurred during evaluation

### EvaluationReasoning

Detailed explanation of why a flag evaluated a certain way:

```typescript
interface EvaluationReasoning {
  bucket?: number;                    // Bucket value (0-100)
  stickinessKey?: string;            // Key used for bucketing
  stickinessValue?: string;          // Value used for bucketing
  rolloutPercentage?: number;         // Rollout percentage threshold
  matchedTargetingRuleId?: string;   // Which targeting rule matched
  matchedConditions?: Array<{        // Conditions that matched
    attribute: string;
    operator: string;
    value: unknown;
  }>;
  hashValue?: number;                 // Hash used for bucketing
}
```

## Targeting Rules

Target specific users or conditions:

```typescript
const flag: FeatureFlag = {
  key: 'premium-feature',
  name: 'Premium Feature',
  enabled: true,
  variants: [
    { key: 'disabled', name: 'Disabled', value: false },
    { key: 'enabled', name: 'Enabled', value: true },
  ],
  targeting: [
    {
      id: 'premium-users',
      priority: 1, // Lower = higher priority
      conditions: [
        {
          attribute: 'userId',
          operator: 'in',
          value: ['premium-user-1', 'premium-user-2'],
        },
      ],
      variant: 'enabled',
    },
  ],
  defaultVariant: 'disabled',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
```

**Supported Operators:**
- `equals`, `notEquals`
- `contains`, `notContains`
- `startsWith`, `endsWith`
- `matches` (regex)
- `in`, `notIn`
- `greaterThan`, `lessThan`, `greaterThanOrEqual`, `lessThanOrEqual`
- `before`, `after` (dates)
- `semverEquals`, `semverGreaterThan`, `semverLessThan`

## Examples

### Gradual Rollout

```typescript
const flag: FeatureFlag = {
  key: 'gradual-feature',
  name: 'Gradual Feature',
  enabled: true,
  rollout: {
    type: 'gradual',
    schedule: {
      startAt: new Date().toISOString(),
      endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      startPercentage: 0,
      endPercentage: 100,
    },
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
```

### Weighted Variants

```typescript
const flag: FeatureFlag = {
  key: 'ab-test',
  name: 'A/B Test',
  enabled: true,
  rollout: {
    type: 'percentage',
    percentage: 100,
  },
  variants: [
    { key: 'control', name: 'Control', value: 'control', weight: 50 },
    { key: 'variant-a', name: 'Variant A', value: 'variant-a', weight: 30 },
    { key: 'variant-b', name: 'Variant B', value: 'variant-b', weight: 20 },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
```

### Custom Stickiness

```typescript
const flag: FeatureFlag = {
  key: 'custom-stickiness',
  name: 'Custom Stickiness',
  enabled: true,
  rollout: {
    type: 'percentage',
    percentage: 50,
    stickiness: 'accountId', // Use accountId attribute for bucketing
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const context = {
  userId: 'user-1',
  attributes: { accountId: 'account-123' },
};
```

## Testing

Run tests:

```bash
pnpm test
```

### Testing Consistency

```typescript
import { describe, it, expect } from 'vitest';
import { FeatureFlagProvider } from '@isl-lang/feature-flags';

describe('Consistency', () => {
  it('should return same result for same user', async () => {
    const provider = new FeatureFlagProvider({
      source: 'local',
      localFlags: [/* ... */],
    });
    await provider.initialize();

    const context = { userId: 'user-123' };
    const result1 = provider.evaluate('my-flag', context);
    const result2 = provider.evaluate('my-flag', context);

    expect(result1.enabled).toBe(result2.enabled);
    expect(result1.reasoning?.bucket).toBe(result2.reasoning?.bucket);
  });
});
```

## Best Practices

1. **Use orgId for organization-level features**: Ensures all users in an org see the same variant
2. **Always check audit logs**: Use reasoning to debug why flags evaluated a certain way
3. **Test consistency**: Verify same user/org gets same result across multiple evaluations
4. **Use targeting for specific users**: Don't rely on percentage rollouts for specific users
5. **Set expiration dates**: Prevent flags from staying enabled indefinitely
6. **Monitor audit logs**: Track flag evaluation patterns and issues

## License

MIT
