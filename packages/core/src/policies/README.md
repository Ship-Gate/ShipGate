# ISL Policy Pack

Machine-readable policy definitions for security, privacy, and compliance constraints.

## Overview

The Policy Pack provides a structured library of policies covering:

- **PII (Personally Identifiable Information)** - Data privacy and protection rules
- **Secrets** - Credential and sensitive data management
- **Auth** - Authentication and authorization best practices
- **Logging** - Observability and audit requirements

These policies are designed to be:
- **Machine-readable** - Can be parsed and processed by tools
- **Context-injectable** - Ready for use with AI assistants and context packers
- **Filterable** - Query by stack, domain, severity, compliance framework, etc.

## Quick Start

```typescript
import {
  getDefaultPolicies,
  filterPolicies,
  getPolicyById,
} from '@isl-lang/core/policies';

// Get all policies for a Node.js healthcare application
const policies = getDefaultPolicies('node', 'healthcare');

// Get only error-level policies
const criticalPolicies = filterPolicies({
  severities: ['error'],
  enabledOnly: true,
});

// Get policies for SOC2 compliance
const soc2Policies = filterPolicies({
  compliance: 'SOC2',
});
```

## API Reference

### `getDefaultPolicies(stack, domain)`

Returns policies filtered by technology stack and business domain.

**Parameters:**
- `stack` - Technology stack (`'node'`, `'typescript'`, `'python'`, `'go'`, `'rust'`, `'java'`, `'csharp'`, `'generic'`)
- `domain` - Business domain (`'healthcare'`, `'finance'`, `'ecommerce'`, `'social'`, `'enterprise'`, `'government'`, `'generic'`)

**Example:**
```typescript
// All policies for Python finance apps
const policies = getDefaultPolicies('python', 'finance');
```

### `filterPolicies(options)`

Advanced filtering with multiple criteria.

**Options:**
- `categories` - Filter by category (`'pii'`, `'secrets'`, `'auth'`, `'logging'`)
- `severities` - Filter by severity (`'error'`, `'warning'`, `'info'`)
- `stack` - Filter by tech stack
- `domain` - Filter by business domain
- `tags` - Filter by tags (any match)
- `enabledOnly` - Only return policies enabled by default
- `compliance` - Filter by compliance framework

**Example:**
```typescript
const policies = filterPolicies({
  categories: ['pii', 'secrets'],
  severities: ['error'],
  stack: 'typescript',
  compliance: 'GDPR',
});
```

### `getPoliciesByCategory(category)`

Get all policies in a specific category.

### `getPolicyById(id)`

Get a single policy by its ID (e.g., `'PII-001'`, `'SEC-002'`).

### `getPoliciesBySeverity(severity)`

Get all policies at a specific severity level.

### `getPoliciesByCompliance(framework)`

Get all policies that help satisfy a compliance framework.

### `serializePoliciesForContext(policies)`

Serialize policies to JSON for context injection.

### `createPolicySummary(policies)`

Create a human-readable markdown summary of policies.

## Policy Structure

Each policy contains:

```typescript
interface Policy {
  id: string;              // Unique ID (e.g., 'PII-001')
  name: string;            // Human-readable name
  description: string;     // Detailed description
  category: PolicyCategory;
  severity: PolicySeverity;
  stacks: TechStack[];     // Applicable tech stacks
  domains: BusinessDomain[]; // Applicable business domains
  constraints: PolicyConstraint[]; // Specific rules
  remediation: PolicyRemediation;  // How to fix violations
  tags: string[];          // Searchable tags
  enabledByDefault: boolean;
  compliance?: string[];   // Compliance frameworks
}
```

## Default Policies

### PII Policies (3)

| ID | Name | Severity |
|----|------|----------|
| PII-001 | No PII in Logs | error |
| PII-002 | Encrypt PII at Rest | error |
| PII-003 | PII Access Audit Trail | warning |

### Secrets Policies (3)

| ID | Name | Severity |
|----|------|----------|
| SEC-001 | No Hardcoded Secrets | error |
| SEC-002 | Secrets Rotation | warning |
| SEC-003 | No Secrets in URLs | error |

### Auth Policies (4)

| ID | Name | Severity |
|----|------|----------|
| AUTH-001 | Secure Password Storage | error |
| AUTH-002 | Session Security | error |
| AUTH-003 | Multi-Factor Authentication | warning |
| AUTH-004 | Rate Limiting | error |

### Logging Policies (4)

| ID | Name | Severity |
|----|------|----------|
| LOG-001 | Structured Logging | warning |
| LOG-002 | No Console in Production | warning |
| LOG-003 | Error Context Logging | warning |
| LOG-004 | Log Retention Policy | info |

## Compliance Coverage

The policy pack includes coverage for:

- **GDPR** - EU General Data Protection Regulation
- **CCPA** - California Consumer Privacy Act
- **HIPAA** - Health Insurance Portability and Accountability Act
- **SOC2** - Service Organization Control 2
- **PCI-DSS** - Payment Card Industry Data Security Standard
- **ISO27001** - Information Security Management
- **OWASP** - Open Web Application Security Project guidelines
- **SOX** - Sarbanes-Oxley Act

## Context Injection

Policies can be serialized for use with AI assistants:

```typescript
import { getDefaultPolicies, serializePoliciesForContext } from '@isl-lang/core/policies';

const policies = getDefaultPolicies('typescript', 'healthcare');
const contextJson = serializePoliciesForContext(policies);

// Use in context packer
const context = {
  policies: contextJson,
  // ... other context
};
```

## Extending Policies

To add custom policies, create new `Policy` objects following the type definition:

```typescript
import type { Policy } from '@isl-lang/core/policies';

const customPolicy: Policy = {
  id: 'CUSTOM-001',
  name: 'My Custom Policy',
  description: 'Description of the policy',
  category: 'general',
  severity: 'warning',
  stacks: ['typescript'],
  domains: ['generic'],
  constraints: [
    {
      id: 'CUSTOM-001-A',
      description: 'Constraint description',
      goodExample: '// Good code',
      badExample: '// Bad code',
    },
  ],
  remediation: {
    action: 'How to fix',
    steps: ['Step 1', 'Step 2'],
  },
  tags: ['custom'],
  enabledByDefault: true,
};
```
