# ISL Studio - Pricing Strategy

## Philosophy

**Usage + credibility > money (for now)**

Keep the OSS core free forever. Monetize on enterprise/org features later.

## Tiers

### Free (OSS)

Everything needed to use ISL Studio:

- ✅ All 25 built-in rules (auth, pii, payments, rate-limit, intent)
- ✅ GitHub Action integration
- ✅ CLI (`npx islstudio gate`)
- ✅ Evidence bundles
- ✅ Baseline & suppressions
- ✅ VS Code extension
- ✅ SARIF upload
- ✅ Unlimited repos

### Pro (Future)

For teams that want more:

- Everything in Free
- 🔒 Custom rule authoring
- 🔒 Private policy packs
- 🔒 Team dashboard
- 🔒 Violation trends over time
- 🔒 Priority support

**Pricing:** $29/user/month (or $19 annual)

### Enterprise (Future)

For organizations:

- Everything in Pro
- 🔒 Org-wide policy packs
- 🔒 SSO/SAML
- 🔒 Audit logs
- 🔒 Custom integrations
- 🔒 SLA guarantees
- 🔒 Dedicated support

**Pricing:** Contact sales

## What We Don't Charge For

These stay free forever:

1. **All core rules** - The gate logic is OSS
2. **CLI usage** - No limits
3. **GitHub Action** - Free for all repos
4. **Evidence generation** - Free for all
5. **VS Code extension** - Free

## Revenue Streams

1. **Pro subscriptions** - Teams wanting dashboards
2. **Enterprise contracts** - Large orgs
3. **Private packs** - Companies wanting custom rules
4. **Consulting** - ISL spec writing, integration help

## Competitor Pricing Reference

| Tool | Free | Paid |
|------|------|------|
| Snyk | 100 tests/mo | $52/user/mo |
| SonarQube | OSS only | $150/mo |
| CodeClimate | 1 repo | $15/user/mo |

ISL Studio is more specialized (intent enforcement) and cheaper.

## Launch Strategy

1. **Phase 1 (Now):** Free everything, get 100+ repos using it
2. **Phase 2 (3 months):** Launch Pro tier, target power users
3. **Phase 3 (6 months):** Enterprise tier, target orgs

## Don't Mess It Up

- **Never gate-keep rules** - All detection is free
- **Never require signup for CLI** - Anonymous usage OK
- **Never break OSS** - The gate must always work offline
