# Shipgate Architecture

This document describes the architecture of Shipgate's open-source + paid tier system.

## Design Principles

1. **Open Core Model**: Shipgate follows the open core model, providing maximum value in the free tier while maintaining viable paid tiers
2. **Graceful Degradation**: Expired licenses fall back to free tier, no breaking changes
3. **Offline-Friendly**: License validation cached locally, re-validated weekly
4. **Source-Available**: Paid packages viewable for education, not redistributable

## Package Structure

```
packages/
├── shared/              # MIT - License validation, storage, types
├── core/                # MIT - Tier 1 provers, CLI, proof bundles
├── runtime/             # License-gated - Tier 2/3 provers
├── compliance/          # License-gated - Report generators
├── action/              # License-gated - GitHub Action
└── dashboard/           # License-gated - Web UI (future)
```

## License System

### License Key Format

License keys are JWTs signed with HS256:

```typescript
interface LicenseKey {
  tier: 'free' | 'team' | 'enterprise';
  email: string;
  expiresAt: string;          // ISO 8601
  repoCount: number;          // Max repos
  features: string[];          // ['tier2', 'tier3', 'github-action', ...]
  issuer: 'shipgate';
  issuedAt: string;
}
```

### Storage Location

- **Local**: `~/.shipgate/license.json`
- **CI/CD**: `SHIPGATE_LICENSE` environment variable

### Validation Flow

```
┌─────────────┐
│ User runs   │
│ tier2/tier3 │
└──────┬──────┘
       │
       v
┌─────────────────────┐
│ LicenseGate.check() │
└──────┬──────────────┘
       │
       v
┌──────────────────────────┐    ┌────────────────┐
│ License in ~/.shipgate │───>│ Load + Decode  │
└──────────────────────────┘    └────────┬───────┘
       │                                  │
       │ Not found                        v
       v                         ┌────────────────┐
┌──────────────────┐             │ Check expiry   │
│ Check env var    │             └────────┬───────┘
│ SHIPGATE_LICENSE│                     │
└──────┬───────────┘                      │
       │                                  │
       v                                  │
┌──────────────────┐                      │
│ JWT.verify()     │<─────────────────────┘
└──────┬───────────┘
       │
       v
┌─────────────────────┐
│ Check tier & expiry │
└──────┬──────────────┘
       │
       v
┌───────────────┐
│ Allow/Deny    │
└───────────────┘
```

### Caching Strategy

- **Cache Duration**: 7 days
- **Revalidation**: On-demand via `shipgate license` or forced in code
- **Offline Tolerance**: Valid cached license works offline

## Tier Boundaries

### Tier 1 (Free)

**7 Static Properties**:
- Null safety
- Bounds checking
- Type safety
- Unused code
- Error handling
- Input validation
- Resource leaks

**Implementation**: Regex + AST-lite pattern matching in `@shipgate/core`

### Tier 2 (Team)

**5 Runtime Properties**:
- API contracts (request/response schemas)
- Auth enforcement (middleware presence)
- Data leakage (sensitive data in logs/responses)
- Rate limiting
- Session management (secure cookies)

**Implementation**: Advanced AST analysis + runtime instrumentation in `@shipgate/runtime`

**License Gate**: `LicenseGate.checkTier('tier2')` at prover entry point

### Tier 3 (Team/Enterprise)

**4 Adversarial Properties**:
- Property-based testing (fast-check integration)
- Mutation testing (stryker integration)
- Fuzzing (custom input generation)
- Concurrency testing (race condition detection)

**Implementation**: Full execution environment in `@shipgate/runtime`

**License Gate**: `LicenseGate.checkTier('tier3')` at prover entry point

## CLI Implementation

### Core Commands (Free)

```bash
shipgate verify [pattern]     # Run Tier 1 verification
isl-verify init                  # Create .shipgate.json config
isl-verify diff <commit>         # Show verification diff
isl-verify explain <finding-id>  # Explain a finding
```

### License Commands (Free)

```bash
shipgate activate <key>   # Store license locally
shipgate license          # Show license info
isl-verify deactivate       # Remove license
```

### Paid Commands

```bash
shipgate verify --tier tier2           # Requires Team license
shipgate verify --tier tier3           # Requires Team/Enterprise
isl-verify compliance --framework soc2   # Requires Team license
```

## GitHub Action

### action.yml

```yaml
name: 'ISL Verify'
inputs:
  pattern:
    description: 'File pattern'
    default: '**/*.{ts,js}'
  tier:
    description: 'tier1, tier2, or tier3'
    default: 'tier1'
  license:
    description: 'License key (for tier2/tier3)'
    required: false
  fail-on-error:
    description: 'Fail on findings'
    default: 'true'
  comment-pr:
    description: 'Comment results on PR'
    default: 'true'
```

### PR Comment Format

```markdown
## ⚠️ ISL Verify Found 3 Issue(s)

| File | Property | Message |
|------|----------|---------|
| `auth.ts` | auth_enforcement | Missing authentication checks |
| `api.ts` | input_validation | Missing input validation |
| `db.ts` | resource_leaks | Potential resource leak |

---
*Generated by [ISL Verify](https://isl-verify.com)*
```

## Compliance Reports

### Supported Frameworks

- **SOC 2** (CC6.1, CC6.2, CC6.3, CC7.1, CC7.2)
- **HIPAA** (164.308, 164.312)
- **PCI-DSS** (6.5.1, 6.5.3, 6.5.8)
- **EU AI Act** (Art 9, 10, 12, 15)

### Report Structure

```typescript
interface ComplianceReport {
  framework: 'soc2' | 'hipaa' | 'pci-dss' | 'eu-ai-act';
  timestamp: string;
  controls: ControlResult[];
  summary: {
    totalControls: number;
    passed: number;
    failed: number;
    partial: number;
    complianceScore: number;  // 0-100
  };
}
```

### Example Output (Markdown)

```markdown
# SOC 2 Compliance Report

Generated: 2026-02-17T16:30:00Z

## Summary

- **Compliance Score**: 75%
- **Total Controls**: 5
- **Passed**: 3
- **Failed**: 1
- **Partial**: 1

## Controls

### ✅ CC6.1 - Logical Access Controls

**Status**: pass
**Evidence**:
- tier2-runtime: Auth enforcement detected

### ❌ CC7.2 - Security Monitoring

**Status**: fail
**Recommendations**:
- Add continuous monitoring
- Implement real-time alerting
```

## Proof Bundle

### Structure

```typescript
interface ProofBundle {
  version: string;
  timestamp: string;
  tier: 'tier1' | 'tier2' | 'tier3';
  findings: Finding[];
  provers: ProverResult[];
  metadata: {
    project: string;
    repository?: string;
    commit?: string;
    branch?: string;
  };
}
```

### Storage

- **Free Tier**: Local `.isl-verify/bundles/`
- **Paid Tiers**: Local + optional cloud sync

## Build & Publish

### Building

```bash
pnpm build         # Build all packages
pnpm build:core    # Build core only
```

### Publishing

```bash
pnpm publish:core  # Publish @shipgate/core to npm
```

**Note**: Runtime, compliance, and action packages are source-available but not published to npm. Distributed via license portal.

## Security Considerations

1. **License Secret**: `SHIPGATE_LICENSE_SECRET` environment variable for JWT signing (production)
2. **Key Rotation**: License keys can be revoked server-side
3. **Offline Validation**: Uses cached validation, not phone-home
4. **No Telemetry**: Free tier has zero telemetry; paid tiers opt-in only

## Future Enhancements

1. **Dashboard Package**: Web UI for trends, history, team management
2. **SSO Integration**: SAML/OAuth for Enterprise
3. **Custom Provers**: Plugin API for team-specific rules
4. **On-Premise**: Self-hosted license validation server
