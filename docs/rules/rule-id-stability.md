# Rule ID Stability Policy

## Overview

Rule IDs in ISL Policy Packs are **immutable identifiers** that must remain stable across pack versions. This policy ensures backward compatibility and prevents breaking changes for users who reference specific rule IDs in their configurations, CI/CD pipelines, or suppression files.

## Core Principle

**Never rename a rule ID. Deprecate instead.**

## Policy Rules

### 1. Rule IDs Are Immutable

- Once a rule ID is published, it **must never change**
- Rule IDs follow the format: `<pack-id>/<rule-name>` (e.g., `auth/bypass-detected`)
- Changing a rule ID breaks all existing references and configurations

### 2. Deprecation Process

When a rule needs to be replaced or renamed:

1. **Keep the old rule ID** - Do not remove it
2. **Mark as deprecated** - Add deprecation metadata:
   ```typescript
   {
     id: 'auth/old-rule-name',
     deprecated: true,
     deprecatedSince: '1.2.0',
     replacementRuleId: 'auth/new-rule-name',
     deprecationMessage: 'Use auth/new-rule-name instead. This rule will be removed in v2.0.0.'
   }
   ```
3. **Create the new rule** - Add the replacement rule with a new ID
4. **Maintain compatibility** - The old rule continues to work but emits deprecation warnings
5. **Document migration** - Update documentation with migration guide

### 3. Versioning Strategy

- **Major version (X.0.0)**: Can remove deprecated rules (after deprecation period)
- **Minor version (x.Y.0)**: Can add new rules, deprecate existing rules
- **Patch version (x.y.Z)**: Bug fixes only, no rule changes

### 4. Deprecation Period

- **Minimum deprecation period**: 2 major versions
- **Example**: Rule deprecated in v1.2.0 can be removed in v3.0.0 at earliest
- **Exception**: Security-critical fixes may have shorter periods (documented)

### 5. Breaking Changes

Breaking changes are only allowed in:
- Major version bumps (X.0.0)
- After proper deprecation period
- With clear migration documentation

## Examples

### ✅ Correct: Deprecating a Rule

```typescript
// Version 1.1.0
export const authPolicyPack: PolicyPack = {
  id: 'auth',
  version: '1.1.0',
  rules: [
    {
      id: 'auth/bypass-detected',
      name: 'Auth Bypass Detected',
      // ... rule definition
    },
  ],
};

// Version 1.2.0 - Deprecating old rule, adding new one
export const authPolicyPack: PolicyPack = {
  id: 'auth',
  version: '1.2.0',
  rules: [
    {
      id: 'auth/bypass-detected',
      deprecated: true,
      deprecatedSince: '1.2.0',
      replacementRuleId: 'auth/security-bypass',
      deprecationMessage: 'Use auth/security-bypass instead. This rule will be removed in v3.0.0.',
      // ... old rule still works
    },
    {
      id: 'auth/security-bypass',
      name: 'Security Bypass Detected',
      // ... improved rule definition
    },
  ],
};
```

### ❌ Incorrect: Renaming a Rule

```typescript
// Version 1.1.0
{
  id: 'auth/bypass-detected',
  // ...
}

// Version 1.2.0 - WRONG: Renaming breaks compatibility
{
  id: 'auth/security-bypass', // ❌ Old ID no longer exists
  // ...
}
```

## Enforcement

### Automated Checks

- CI/CD checks prevent rule ID changes in non-major versions
- Bundle verification ensures rule IDs remain stable
- Compatibility tests verify older specs work with newer packs

### Manual Review

- All pack version bumps require review
- Deprecation PRs must include:
  - Deprecation metadata
  - Migration guide
  - Compatibility test updates

## Migration Guide Template

When deprecating a rule, include:

```markdown
## Migration from `old-rule-id` to `new-rule-id`

### What Changed
- [Brief description of why the change was made]

### How to Migrate
1. Update rule references in your configuration
2. Update suppression files
3. Review any custom integrations

### Timeline
- Deprecated: v1.2.0
- Removal: v3.0.0 (estimated)
```

## Related Documentation

- [Policy Bundle Format](./policy-bundle-format.md)
- [Pack Versioning](./pack-versioning.md)
- [Compatibility Testing](./compatibility-testing.md)
