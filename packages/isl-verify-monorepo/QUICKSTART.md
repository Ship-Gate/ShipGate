# Shipgate - Quick Start Guide

Get Shipgate running in 5 minutes.

## Installation

```bash
npm install -g shipgate
```

## Basic Usage (Free Tier)

### 1. Verify Your Code

```bash
# Verify all TypeScript/JavaScript files
shipgate verify

# Verify specific files
shipgate verify "src/**/*.ts"

# JSON output
shipgate verify --json > report.json
```

### 2. Understanding Results

```bash
🔍 Verifying 12 files (tier1)...

src/auth.ts
  ✗ null_safety: Missing null checks
  ✗ error_handling: Async functions without error handling

src/api.ts
  ✓ All checks passed

✗ 2 issue(s) found
```

### 3. Configuration (Optional)

Create `.shipgate.json`:

```json
{
  "tier": "tier1",
  "rules": [
    {
      "rule": "null_safety",
      "severity": "error",
      "enabled": true
    }
  ],
  "suppressions": [
    "null_safety:legacy/**"
  ]
}
```

## Paid Tiers

### Purchase License

1. Visit https://shipgate.dev/pricing
2. Select Team or Enterprise tier
3. Complete payment
4. Copy license key

### Activate License

```bash
shipgate activate <your-license-key>

# Verify activation
shipgate license
```

### Use Advanced Features

```bash
# Tier 2 runtime verification
shipgate verify --tier tier2

# Tier 3 adversarial testing
shipgate verify --tier tier3

# Generate compliance report
shipgate compliance --framework soc2
```

## CI/CD Integration

### GitHub Actions

`.github/workflows/verify.yml`:

```yaml
name: ISL Verify

on: [push, pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      # Free tier
      - name: Install ISL Verify
        run: npm install -g shipgate
      
      - name: Verify code
        run: shipgate verify
```

### With License (Team/Enterprise)

```yaml
- uses: isl-verify/action@v1
  with:
    tier: tier2
    license: ${{ secrets.SHIPGATE_LICENSE }}
    comment-pr: true
    fail-on-error: true
```

Add `SHIPGATE_LICENSE` secret in repository settings.

## Pre-commit Hook

### Install

```bash
npm install --save-dev husky

# Initialize husky
npx husky-init

# Add hook
npx husky add .husky/pre-commit "shipgate verify"
```

### Skip on Commit

```bash
git commit --no-verify -m "skip verification"
```

## Examples

### Example 1: Null Safety

**Bad**:
```typescript
function getUserName(user: User) {
  return user.name.toUpperCase(); // ✗ Missing null check
}
```

**Good**:
```typescript
function getUserName(user: User) {
  if (!user || !user.name) {
    throw new Error('Invalid user');
  }
  return user.name.toUpperCase(); // ✓ Null safe
}
```

### Example 2: Error Handling

**Bad**:
```typescript
async function fetchData() {
  const response = await fetch('/api/data'); // ✗ No error handling
  return response.json();
}
```

**Good**:
```typescript
async function fetchData() {
  try {
    const response = await fetch('/api/data');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json(); // ✓ Error handled
  } catch (error) {
    console.error('Fetch failed:', error);
    throw error;
  }
}
```

### Example 3: Input Validation

**Bad**:
```typescript
function processInput(data: string) {
  return data.trim().split(','); // ✗ No validation
}
```

**Good**:
```typescript
function processInput(data: string) {
  if (!data || typeof data !== 'string') {
    throw new Error('Invalid input'); // ✓ Validated
  }
  return data.trim().split(',');
}
```

## Next Steps

- Read the [Architecture Guide](./ARCHITECTURE.md)
- Check [Deployment Guide](./DEPLOYMENT.md)
- Browse [GitHub Repository](https://github.com/shipgate/shipgate)
- Join our [Discord Community](https://discord.gg/shipgate)

## Getting Help

- **Documentation**: https://docs.shipgate.dev
- **GitHub Issues**: https://github.com/shipgate/shipgate/issues
- **Email Support**: support@shipgate.dev (Team/Enterprise)
- **Community Forum**: https://github.com/shipgate/shipgate/discussions
