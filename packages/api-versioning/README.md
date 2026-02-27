# @isl-lang/api-versioning

API versioning system that integrates with ISL domain versions. Provides semantic versioning rules, compatibility checking, and migration support.

## Features

- **Semantic Versioning Rules**: Automatically determine version bumps (major/minor/patch) based on API contract changes
- **Breaking Change Detection**: Identify breaking vs non-breaking changes between API versions
- **Compatibility Checking**: Check backward and forward compatibility between versions
- **Migration Suggestions**: Generate migration paths and transformer suggestions
- **Middleware Support**: Express and Fastify middleware for API versioning

## Installation

```bash
pnpm add @isl-lang/api-versioning
```

## Quick Start

### Semantic Versioning

```typescript
import { determineVersionBump } from '@isl-lang/api-versioning';

const bump = determineVersionBump(
  { name: 'User', version: '1.0.0' },
  { name: 'User', version: '2.0.0' },
  oldDomain,
  newDomain
);

console.log(`Suggested bump: ${bump.type}`); // 'major'
console.log(`New version: ${bump.toVersion}`); // '2.0.0'
```

### Compatibility Checking

```typescript
import { checkCompatibility } from '@isl-lang/api-versioning';

const result = checkCompatibility(oldDomain, newDomain);

if (!result.isCompatible) {
  console.log(`Found ${result.breakingChanges.length} breaking changes`);
  console.log(`Compatibility score: ${result.score}/100`);
}
```

### CLI Usage

```bash
# Verify evolution between two spec versions
shipgate verify evolution old-spec.isl new-spec.isl

# With version override
shipgate verify evolution old-spec.isl new-spec.isl --from 1.0.0 --to 2.0.0

# Fail CI on breaking changes
shipgate verify evolution old-spec.isl new-spec.isl --fail-on-breaking --ci
```

## Versioning Rules

The package follows semantic versioning (semver) principles:

- **Major** (X.0.0): Breaking changes
  - Removed fields, entities, or behaviors
  - Type changes
  - Added required fields
  - Constraint additions

- **Minor** (0.X.0): New features (backward compatible)
  - Added optional fields
  - New behaviors
  - New entities
  - New error types

- **Patch** (0.0.X): Fixes (backward compatible)
  - Constraint relaxations
  - Required -> optional field changes
  - Postcondition removals

## API Reference

### `determineVersionBump`

Determine the appropriate version bump between two domain versions.

```typescript
function determineVersionBump(
  from: { name: string; version: string },
  to: { name: string; version: string },
  fromDomain: Domain,
  toDomain: Domain
): VersionBump
```

### `checkCompatibility`

Check backward compatibility between two domain versions.

```typescript
function checkCompatibility(
  from: Domain,
  to: Domain
): CompatibilityResult
```

### `diffDomains`

Generate a diff between two domain versions.

```typescript
function diffDomains(
  from: Domain,
  to: Domain
): DomainDiff
```

## Examples

See `tests/versioning-rules.test.ts` for comprehensive examples.

## License

MIT
