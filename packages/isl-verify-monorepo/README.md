# Shipgate

**Formal Verification for TypeScript & JavaScript (powered by ISL)**

Shipgate provides formal verification for JavaScript and TypeScript codebases with a clear separation between open-source capabilities and premium features.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Shipgate Ecosystem                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  FREE (Open Source - MIT)                             │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  • Tier 1 Static Provers (7 properties)              │  │
│  │  • CLI (verify, init, diff, explain)                 │  │
│  │  • Proof Bundle Generation                           │  │
│  │  • Config File Support                               │  │
│  │  • Inline Suppression Comments                       │  │
│  │  • JSON + Terminal Output                            │  │
│  │  • Custom Rule API                                   │  │
│  │  • JS + TS Support                                   │  │
│  │  • Pre-commit Hook                                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  TEAM (Paid)                                          │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  • All Free features                                 │  │
│  │  • Tier 2 Runtime Provers                            │  │
│  │  • Tier 3 Adversarial Provers                        │  │
│  │  • GitHub Action with PR comments                    │  │
│  │  • Proof Bundle History + Trends                     │  │
│  │  • Compliance Reports (SOC 2, HIPAA, PCI-DSS, etc.)  │  │
│  │  • Dashboard (Web UI)                                │  │
│  │  • Priority Support                                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  ENTERPRISE (Paid)                                    │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  • All Team features                                 │  │
│  │  • SSO / SAML Integration                            │  │
│  │  • Custom Prover Development                         │  │
│  │  • Dedicated Slack Channel                           │  │
│  │  • SLA (99.9% Action Uptime)                         │  │
│  │  • Audit Export (compliance archives)                │  │
│  │  • On-Premise Deployment                             │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Packages

### Open Source (MIT)

- **`@shipgate/core`** - Core verification engine with Tier 1 static provers
- **`@shipgate/shared`** - Shared utilities and license validation

### Source-Available (License Required)

- **`@shipgate/runtime`** - Tier 2/3 provers (API contracts, property-based testing)
- **`@shipgate/compliance`** - Compliance report generators
- **`@shipgate/action`** - GitHub Action with PR comments

## Installation

### Free Tier (Open Source)

```bash
npm install -g shipgate
```

### Paid Tiers

Purchase a license at https://shipgate.dev/pricing

```bash
npm install -g shipgate
shipgate activate <license-key>
```

## Usage

### Basic Verification (Free)

```bash
# Verify all TypeScript/JavaScript files
shipgate verify

# Verify specific pattern
shipgate verify "src/**/*.ts"

# JSON output
shipgate verify --json
```

### Advanced Verification (Team/Enterprise)

```bash
# Tier 2 runtime provers
shipgate verify --tier tier2

# Tier 3 adversarial provers
shipgate verify --tier tier3

# Generate compliance report
shipgate compliance --framework soc2
```

### GitHub Action (Team/Enterprise)

```yaml
# .github/workflows/verify.yml
name: Shipgate

on: [pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: shipgate/action@v1
        with:
          tier: tier2
          license: ${{ secrets.SHIPGATE_LICENSE }}
          comment-pr: true
```

## License Management

### Activate License

```bash
shipgate activate <license-key>
```

### Check License Status

```bash
shipgate license
```

### Deactivate License

```bash
shipgate deactivate
```

### CI/CD Usage

Set the `SHIPGATE_LICENSE` environment variable:

```bash
export SHIPGATE_LICENSE=<your-license-key>
shipgate verify --tier tier2
```

## Development

### Setup

```bash
pnpm install
pnpm build
```

### Run Tests

```bash
pnpm test
```

### Publish

```bash
# Publish open-source core only
pnpm publish:core
```

## License

- **Core packages** (`@shipgate/core`, `@shipgate/shared`): MIT License
- **Runtime packages** (`@shipgate/runtime`, `@shipgate/compliance`, `@shipgate/action`): Source-available, requires license for production use

See individual package LICENSE files for details.

## Support

- **Community**: GitHub Issues
- **Team**: Email support (support@shipgate.com)
- **Enterprise**: Dedicated Slack channel

## Links

- Website: https://shipgate.com
- Documentation: https://docs.shipgate.com
- Pricing: https://shipgate.dev/pricing
- GitHub: https://github.com/shipgate/shipgate
