# Incident Response Policy

**Internal Reference — ShipGate**

*Draft for review by legal/compliance. Aligns with SOC 2 CC7. Last updated: 2026-03-01.*

---

## 1. Purpose

This policy establishes procedures for detecting, responding to, and recovering from security and privacy incidents to minimise impact and support compliance obligations.

---

## 2. Definitions

- **Security incident**: Unauthorised access, misuse, or compromise of systems or data
- **Privacy incident**: Unauthorised disclosure, loss, or alteration of Personal Data
- **Severity**: Critical / High / Medium / Low (based on impact and scope)

---

## 3. Roles

- **Incident commander**: Leads response; coordinates communications
- **Technical lead**: Investigates root cause; implements containment
- **Communications**: Notifies affected parties; manages external messaging

---

## 4. Phases

### 4.1 Detection and Reporting

- **Sources**: Monitoring, user reports, vendor notifications
- **Report to**: security@shipgate.dev
- **Acknowledgment**: Within 48 hours (as per SECURITY.md for vulnerabilities)

### 4.2 Triage and Classification

- Assess scope, impact, and severity
- Determine if incident affects customer data
- Assign incident commander

### 4.3 Containment

- Isolate affected systems
- Revoke compromised credentials
- Preserve evidence for analysis

### 4.4 Eradication and Recovery

- Remove cause of incident
- Restore services from known-good state
- Verify integrity before full restoration

### 4.5 Post-Incident

- Document timeline, root cause, and corrective actions
- Update controls to prevent recurrence
- Notify affected customers and regulators as required by law

---

## 5. Notification Obligations

- **Customers**: Notify affected customers without undue delay when Personal Data is compromised
- **Regulators**: Notify supervisory authorities per GDPR (72 hours where applicable) and other applicable law
- **Internal**: Communicate to leadership and relevant personnel

---

## 6. Contact

- **Report incidents**: security@shipgate.dev
- **External vulnerability reports**: See [SECURITY.md](/SECURITY.md)

---

## 7. Review

This policy and associated playbooks are reviewed at least annually and after significant incidents.
