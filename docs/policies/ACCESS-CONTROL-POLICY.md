# Access Control Policy

**Internal Reference — ShipGate**

*Draft for review by legal/compliance. Last updated: 2026-03-01.*

---

## 1. Purpose

This policy defines access control requirements for ShipGate systems to ensure that only authorised individuals have access to resources appropriate to their role (principle of least privilege).

---

## 2. Scope

- Customer-facing dashboard and APIs
- Internal systems (repos, CI, infrastructure)
- Third-party services (GitHub, cloud providers)

---

## 3. Role-Based Access Control (RBAC)

### 3.1 Customer Dashboard Roles

| Role    | Description                                   | Permissions |
|---------|-----------------------------------------------|--------------|
| admin   | Full org control                              | All actions; billing; audit export; integrations |
| member  | Standard contributor                          | Create runs, tokens; manage findings; connect integrations |
| viewer  | Read-only                                     | View runs, findings, activity; no create/delete |

RBAC is enforced on all API routes via `requireOrgRole()` and `requireAdminOrMember()` middleware.

### 3.2 Internal Roles

- Production access limited to authorised personnel
- Access granted on need-to-know basis
- Regular access reviews (at least annually)

---

## 4. Authentication

- **Customer users**: OAuth (GitHub, Google); no passwords stored
- **CLI/API**: Personal access tokens; hashed at rest; revocable
- **Internal systems**: Strong authentication; MFA where available

---

## 5. Credential Management

- Secrets stored in environment variables or secure vaults
- `TOKEN_ENCRYPTION_KEY` required for OAuth token storage (64-char hex)
- No hardcoded secrets in code or config

---

## 6. Provisioning and De-provisioning

- Access granted when role/need is established
- Access revoked promptly upon role change or departure
- Audit trail retained for access-related actions

---

## 7. Review and Updates

This policy is reviewed at least annually. Access entitlements are reviewed periodically.
