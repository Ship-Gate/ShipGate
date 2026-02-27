# Pricing & Monetization Model

## Principle

shipgate CLI is open source forever. The specification layer (ISL) is the moat. Monetization comes from the infrastructure around it — storage, history, team collaboration, and compliance features that individual developers don't need but organizations do.

---

## Free Tier (Always Free)

Everything a solo developer or small team needs to gate AI-generated code:

- shipgate CLI (all commands: init, verify, gate, vibe, scan, policy list, open)
- ISL language (parser, typechecker, codegen for all languages)
- Truthpack extraction and drift detection
- All 27 policy rules
- Evidence bundle generation (local JSON)
- GitHub Actions integration (bring your own CI)
- MCP server for Cursor/Copilot (local)
- Multi-language codegen (TypeScript, Python, Rust, Go)
- Community Discord support

**No limits on**: number of files scanned, number of specs, number of gate runs, number of generated projects.

---

## Pro Tier — $29/month per seat (or $19/seat annual)

For teams that need history, dashboards, and shared policies.

| Feature | Description |
|---------|-------------|
| **Ship Score History** | Track Ship Score over time per project. See trends. Get alerts when score drops below threshold. |
| **Cloud Evidence Storage** | Evidence bundles stored in the cloud (encrypted, immutable). No more losing local JSON files. 90-day retention. |
| **Team Dashboard** | Web UI showing all projects, latest verdicts, score trends, and team member activity. |
| **Private Policy Packs** | Create custom policy rules specific to your organization. Share across repos. |
| **PR Comment Bot** | Automatic PR comments with verdict, score, and evidence link. (Enhanced version — free tier uses GitHub Actions script.) |
| **Slack/Teams Notifications** | Get notified on NO_SHIP verdicts in your team channel. |
| **Priority Support** | Dedicated Discord channel. 24-hour response SLA on bugs. |
| **SSO (Google/GitHub)** | Sign in with org credentials. |

**The "aha moment" before the paywall:**
A team runs `shipgate verify` 50 times across 3 repos. They want to see "what's our overall Ship Score this week?" and "which repo has the most NO_SHIP verdicts?" That's when they hit the dashboard paywall.

---

## Enterprise Tier — Custom pricing (starting $499/month)

For regulated industries, large engineering orgs, and air-gapped environments.

| Feature | Description |
|---------|-------------|
| **Air-Gapped Deployment** | Self-hosted shipgate server. No cloud dependencies. Runs behind corporate firewall. |
| **SSO (SAML/OIDC)** | Integrate with Okta, Azure AD, etc. |
| **SOC 2 Compliance Exports** | Generate compliance reports from evidence bundles. Mapped to SOC 2 controls. |
| **Custom Policy Packs** | Co-developed with the ShipGate team. Tailored to your regulatory environment (HIPAA, PCI DSS, GDPR). |
| **Evidence Immutability SLA** | Guaranteed tamper-proof storage with cryptographic proof chains. 7-year retention. |
| **Audit Log API** | Programmatic access to all verification decisions, user actions, and policy changes. |
| **Dedicated Support** | Named support engineer. 4-hour response SLA. Quarterly architecture reviews. |
| **Training** | ISL workshop for your engineering team. Half-day or full-day. |
| **Custom Codegen** | Custom codegen adapters for internal frameworks (e.g., your internal Go toolkit). |
| **Volume Licensing** | Flat-rate pricing for 100+ seats. |

---

## Pricing Psychology

**$29/seat/month is the "no-brainer" zone** for developer tools at companies. It's below the threshold that requires procurement approval at most orgs. A 5-person team pays $145/month — less than one hour of a senior engineer debugging a production issue caused by AI-generated code.

**The aha moment is visual.** Developers use the free CLI. It works. They trust it. Then the engineering lead asks: "What's our Ship Score across all repos?" That question can't be answered by local JSON files. That's the upgrade trigger.

**Annual pricing ($19/seat)** rewards commitment and reduces churn. The 34% discount feels meaningful.

---

## OSS → Paid Conversion Funnel

```
Install (npm install -g shipgate)
  ↓
First verdict (shipgate verify) — free
  ↓
Team adoption (multiple repos, multiple devs) — free
  ↓
"What's our score this week?" → Ship Score History → Pro
  ↓
"Can we see all verdicts in one place?" → Dashboard → Pro
  ↓
"We need SOC 2 compliance reports" → Enterprise
```

**The CLI never nags.** No "upgrade to Pro" banners in terminal output. The upgrade path is organic: when the team asks questions that local files can't answer, the dashboard answers them.

The only touch point: `shipgate verify --verbose` output ends with a one-line footer:
```
Dashboard: https://app.shipgate.dev (sign up for team Ship Score tracking)
```

This appears only in verbose mode, only after 10+ runs, and is not shown in CI.

---

## Competitive Moat

**ISL is the moat, not the gate.**

Anyone can build a CI gate. Exit 0 or exit 1. That's trivial. What's hard to replicate:

1. **ISL as a standard** — The more teams write ISL specs, the more valuable the ecosystem becomes. Specs are portable, versionable, and composable. Switching away means rewriting all your behavioral contracts.

2. **Truthpack fidelity** — The auto-extraction of routes, env vars, auth rules, and API contracts from live codebases is hard to get right. Every framework has different patterns. Years of adapter work.

3. **Policy rule library** — 27 rules today, growing. Each rule is tuned for false-positive rates across 4 languages. This corpus takes time to build and validate.

4. **Evidence bundle format** — If evidence bundles become the standard for "proof of verification," the compliance story creates lock-in at the enterprise level. Auditors learn to trust the format.

5. **NL → ISL quality** — The retry+repair loop, confidence scoring, and domain-specific prompt engineering are hard-won optimizations. The gap between "AI generates something" and "AI generates something that passes formal validation" is where the value lives.

Competitors would need to: create a spec language, build a parser and typechecker, implement 4 codegen backends, build a policy engine with 27+ rules, create a Truthpack extractor, and write adapters for every major framework. That's 2+ years of engineering, which is our head start.
