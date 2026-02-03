# ISL GitHub App

GitHub App for org-wide ISL policy enforcement, moving beyond copy/paste YAML to centralized policy management.

## Features

- ✅ **Org-wide Policy Enforcement**: Pin policy bundles per organization
- ✅ **Automatic Check Configuration**: Required checks configured automatically
- ✅ **PR Annotations**: Inline error and warning annotations
- ✅ **SARIF Upload**: Upload results to GitHub Code Scanning
- ✅ **Policy Bundle Distribution**: Versioned, org-pinned policy bundles

## Architecture

See [DESIGN.md](../../docs/github-app/DESIGN.md) for detailed architecture.

## Quick Start

### Installation

1. Install the GitHub App on your organization
2. Grant required permissions (see [DESIGN.md](../../docs/github-app/DESIGN.md))
3. Pin a policy bundle to your org
4. The App automatically creates check runs for PRs

### Configuration

```typescript
import { createApp } from '@isl-lang/github-app';

const app = createApp({
  appId: process.env.GITHUB_APP_ID!,
  privateKey: process.env.GITHUB_APP_PRIVATE_KEY!,
  webhookSecret: process.env.GITHUB_WEBHOOK_SECRET!,
  port: 3000,
});

app.start();
```

## Policy Bundles

Policy bundles define which ISL policy packs are enforced. See [POLICY_BUNDLE_DISTRIBUTION.md](../../docs/github-app/POLICY_BUNDLE_DISTRIBUTION.md) for details.

## Migration

Migrating from GitHub Action? See [MIGRATION_GUIDE.md](../../docs/github-app/MIGRATION_GUIDE.md).

## Security

Security review checklist: [SECURITY_CHECKLIST.md](../../docs/github-app/SECURITY_CHECKLIST.md).

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Start dev server
pnpm dev
```

## License

MIT
