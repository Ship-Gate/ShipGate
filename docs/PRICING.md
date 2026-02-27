# Shipgate Pricing

**Free for everyone. Pay for governance.**

## Tiers

### Free (OSS)

Everything you need to ship safely.

**Included:**
- ✅ 25 built-in rules (auth, pii, payments, rate-limit, intent)
- ✅ GitHub/GitLab/Bitbucket/Azure DevOps integration
- ✅ CLI (`npx shipgate gate`)
- ✅ VS Code extension
- ✅ Evidence bundles + HTML reports
- ✅ Baseline + inline suppressions
- ✅ SARIF upload
- ✅ Unlimited repos
- ✅ Unlimited team members

**Limits:**
- Community support only
- No custom rules
- Suppressions without approval workflow

**Best for:** Solo devs, open-source projects, startups.

---

### Team — $29/user/month

Everything in Free, plus governance for teams.

**Added:**
- ✅ Custom rule authoring
- ✅ Private policy packs
- ✅ Suppressions require reason + expiry
- ✅ Exception workflow (break-glass with approval)
- ✅ Audit log export (JSON)
- ✅ Slack/Discord notifications
- ✅ Priority email support

**Limits:**
- Up to 50 users
- Self-hosted or cloud

**Best for:** Engineering teams, scale-ups, compliance-aware orgs.

---

### Enterprise — Custom

Everything in Team, plus org-wide control.

**Added:**
- ✅ Signed policy bundles (pinned per org)
- ✅ Org-wide policy management
- ✅ SSO/SAML
- ✅ Role-based access control
- ✅ Compliance packs (SOC2, HIPAA, PCI-DSS)
- ✅ Multi-repo dashboard
- ✅ Dedicated support + SLA
- ✅ Custom integrations
- ✅ On-prem deployment option

**Best for:** Large orgs, regulated industries, multi-team setups.

---

## Comparison Table

| Feature | Free | Team | Enterprise |
|---------|------|------|------------|
| Built-in rules | 25 | 25 | 25+ |
| Custom rules | ❌ | ✅ | ✅ |
| Private packs | ❌ | ✅ | ✅ |
| Compliance packs | ❌ | ❌ | ✅ |
| Baseline | ✅ | ✅ | ✅ |
| Suppressions | Basic | + Expiry | + Approval |
| Exceptions | ❌ | ✅ | ✅ |
| Policy bundles | ❌ | ❌ | ✅ (signed) |
| Audit export | ❌ | ✅ | ✅ |
| Multi-repo dashboard | ❌ | ❌ | ✅ |
| SSO/SAML | ❌ | ❌ | ✅ |
| Support | Community | Email | Dedicated |
| Users | Unlimited | 50 | Unlimited |

---

## FAQ

### Why is Free so generous?

We want Shipgate on every repo. Usage = proof. Proof = enterprise customers.

### Can I use Free forever?

Yes. The core gate is MIT licensed and always will be.

### What counts as a "user"?

Anyone who commits to a repo with Shipgate enabled. Bots don't count.

### Do I need Team for compliance?

You can achieve compliance with Free, but Team adds the audit trail and approval workflows auditors want.

### What's in compliance packs?

Pre-built rules for SOC2, HIPAA, PCI-DSS, GDPR. Coming in Enterprise tier.

### Can I self-host?

Free and Team: Yes, it's all local-first.
Enterprise: Optional cloud or on-prem.

### How do I upgrade?

Email team@shipgate.dev or use the CLI:
```bash
npx shipgate upgrade
```

---

## Pricing Philosophy

1. **Never gate-keep detection** — All 25 rules are free forever.
2. **Never require signup for CLI** — Anonymous usage is fine.
3. **Monetize governance, not security** — Teams pay for control, not protection.
4. **Solo devs are distribution** — Don't squeeze them.

---

## Coming Soon

- [ ] Compliance packs (SOC2, HIPAA, PCI-DSS)
- [ ] Multi-repo dashboard
- [ ] GitHub App (simplified setup)
- [ ] Slack bot for real-time alerts

---

## Contact

**Sales:** team@shipgate.dev
**Support:** support@shipgate.dev
**Twitter:** @shipgate
