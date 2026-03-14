# Vendor and Subprocessor Management

**Internal Reference — ShipGate**

*Supports SOC 2 CC9 (Risk Mitigation), GDPR Art 28. Last updated: 2026-03-01.*

---

## 1. Purpose

This document defines the process for selecting, reviewing, and managing third-party vendors and subprocessors that process data on behalf of ShipGate or its customers.

---

## 2. Current Subprocessors

| Vendor | Purpose | Data processed | DPA / terms | Last reviewed |
|--------|---------|----------------|-------------|---------------|
| **Stripe** | Payment processing | Billing metadata (no card data stored) | Stripe DPA | [TBD] |
| **GitHub** | OAuth identity, repo metadata | OAuth token (encrypted), public repo info | GitHub ToS / DPA | [TBD] |
| **Google** | OAuth identity | OAuth token (encrypted), email, name | Google DPA | [TBD] |
| **Slack** | Workspace notifications | OAuth token (encrypted), channel metadata | Slack DPA | [TBD] |
| **Vercel** | Deployment webhooks, hosting | Deployment metadata | Vercel DPA | [TBD] |
| **Railway** | Deployment webhooks | Deployment metadata | Railway ToS | [TBD] |
| **[Hosting provider]** | Dashboard + API hosting | Application data (transit) | [TBD] | [TBD] |
| **[Database provider]** | PostgreSQL hosting | All application data | [TBD] | [TBD] |

---

## 3. Vendor Selection Criteria

Before engaging a new vendor that processes customer data:

1. **Security posture** — Does the vendor have SOC 2 / ISO 27001 or equivalent?
2. **Data handling** — What data does the vendor access? Is encryption supported?
3. **Contractual terms** — DPA available? GDPR-compliant? Subprocessor transparency?
4. **Jurisdiction** — Where is data stored? Are adequate transfer mechanisms in place?
5. **Business continuity** — What is the vendor's uptime track record?

---

## 4. Review Process

| Activity | Frequency | Owner |
|----------|-----------|-------|
| Review subprocessor list for accuracy | Quarterly | Engineering |
| Review vendor security posture | Annually | Engineering / Leadership |
| Update DPA / contract terms | As needed | Legal |
| Notify customers of subprocessor changes | Before material changes | Product |

---

## 5. Change Management

When adding or replacing a subprocessor:

1. Evaluate against selection criteria (Section 3)
2. Obtain or confirm DPA or equivalent terms
3. Update subprocessor list (this document + public Security page)
4. Notify enterprise customers per DPA obligations
5. Log change in this document

---

## 6. Customer Objection Process

Per the DPA, customers may object to a new subprocessor on reasonable grounds. ShipGate will:

1. Acknowledge objection within 10 business days
2. Work in good faith to address the concern (e.g., alternative processing, data residency)
3. If unresolvable, customer may terminate affected services per the Agreement

---

## 7. Change Log

| Date | Change | Approved by |
|------|--------|-------------|
| 2026-03-01 | Initial version created | [TBD] |

---

## 8. Review

This document is reviewed at least annually and updated when vendors are added, removed, or changed.
