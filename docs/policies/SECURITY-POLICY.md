# Information Security Policy

**Internal Reference — ShipGate**

*Draft for review by legal/compliance. Last updated: 2026-03-01.*

---

## 1. Purpose

This policy establishes information security requirements for ShipGate to protect company and customer data, ensure availability of services, and support compliance obligations (e.g., SOC 2, GDPR).

---

## 2. Scope

Applies to:
- All ShipGate personnel (employees, contractors)
- All systems, applications, and data used to deliver ShipGate services
- Third-party systems under ShipGate’s control (e.g., hosted infrastructure)

---

## 3. Roles and Responsibilities

- **Leadership**: Allocate resources for security, approve exceptions, oversee incident response
- **Engineering**: Implement security controls, follow secure development practices
- **Operations**: Maintain secure infrastructure, monitor for anomalies
- **All personnel**: Protect credentials, report incidents, complete training

---

## 4. Security Principles

1. **Local-first** — Verification runs on the customer’s machine; source code is not uploaded.
2. **Least privilege** — Access granted only as needed for role.
3. **Defense in depth** — Multiple layers of controls (auth, encryption, audit).
4. **Encryption** — Data encrypted in transit (TLS) and at rest where appropriate.
5. **Auditability** — Actions logged for review and compliance.

---

## 5. Technical Controls

### 5.1 Authentication and Access
- OAuth (GitHub, Google) for user authentication; no password storage
- RBAC (admin, member, viewer) enforced on all API routes
- Personal access tokens hashed (SHA-256) and revocable

### 5.2 Data Protection
- HTTPS (TLS 1.3) for all traffic
- AES-256-GCM for stored OAuth tokens (GitHub, Slack)
- Stripe for payments; no card data stored by ShipGate

### 5.3 Audit and Monitoring
- Audit log with IP, user agent, request ID, session ID
- Admin-only audit export (CSV/JSON)
- Signed proof bundles (HMAC-SHA256) for tamper detection

### 5.4 Integrations
- Webhook signatures verified (Vercel, Railway)
- Subprocessors vetted; DPAs or equivalent where required

---

## 6. Incident Management

Security incidents are handled per the Incident Response Policy. All personnel must report suspected incidents to security@shipgate.dev promptly.

---

## 7. Vendor and Subprocessor Management

Subprocessors are selected with due regard for security and compliance. A subprocessor list is maintained and updated. Standard contract terms (DPA, security requirements) are applied where applicable.

---

## 8. Review and Updates

This policy is reviewed at least annually and updated when material changes occur. Changes are communicated to relevant personnel.

---

## 9. Exceptions

Exceptions require documented approval from leadership. Temporary exceptions are reviewed and removed as soon as practicable.
