# ISL Migration V2

Convert existing contract sources (OpenAPI, Zod, TypeScript) into starter ISL AST with explicit open questions tracking for unknowns.

## Features

- **Multi-format support**: OpenAPI 3.x, Zod schemas, TypeScript types
- **Open questions tracking**: Automatically identifies what needs human review
- **Entity inference**: Heuristically detects entities from type structures
- **Canonical ISL output**: Generates readable ISL code
- **Configurable**: Naming conventions, placeholder generation, strict mode

## Installation

```typescript
import { migrateToISL } from '@isl-lang/core/isl-migrate-v2';
```

## Quick Start

```typescript
import { migrateToISL } from '@isl-lang/core/isl-migrate-v2';

const result = migrateToISL([
  {
    id: 'api-spec',
    sourceType: 'openapi',
    name: 'User API',
    filePath: 'openapi.json',
    content: '{ "openapi": "3.0.3", ... }',
  },
]);

console.log(result.islOutput);     // Canonical ISL output
console.log(result.openQuestions); // Items needing review
console.log(result.stats);         // Migration statistics
```

## API

### `migrateToISL(sources, config?)`

Migrates contract sources to ISL AST.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `sources` | `MigrationSource[]` | Array of sources to migrate |
| `config` | `MigrationConfig` | Optional configuration |

#### Returns

```typescript
interface MigrationResult {
  ast: Partial<Domain>;        // Generated ISL AST
  openQuestions: OpenQuestion[]; // Questions requiring review
  stats: MigrationStats;       // Migration statistics
  processedSources: string[];  // IDs of processed sources
  islOutput?: string;          // Canonical ISL output
}
```

### Configuration Options

```typescript
interface MigrationConfig {
  domainName?: string;           // Domain name (default: inferred)
  version?: string;              // Version (default: "1.0.0")
  generatePreconditions?: boolean; // Generate placeholder preconditions
  generatePostconditions?: boolean; // Generate placeholder postconditions
  inferEntities?: boolean;       // Infer entities from types
  strict?: boolean;              // Fail on unknowns vs add questions
  naming?: 'camelCase' | 'PascalCase' | 'preserve';
}
```

## Supported Sources

### OpenAPI

```typescript
{
  id: 'my-api',
  sourceType: 'openapi',
  name: 'My API',
  filePath: 'openapi.json',
  content: '{ "openapi": "3.0.3", ... }',
}
```

Extracts:
- Schema types → ISL types
- Operations → ISL behaviors
- Error responses → ISL error specs
- Security requirements → Open questions

### Zod

```typescript
{
  id: 'my-schemas',
  sourceType: 'zod',
  name: 'My Schemas',
  filePath: 'schemas.ts',
  content: 'export const UserSchema = z.object({ ... })',
}
```

Extracts:
- Object schemas → ISL struct types
- Enum schemas → ISL enum types
- Validation chains → ISL constraints (partial)

### TypeScript

```typescript
{
  id: 'my-types',
  sourceType: 'typescript',
  name: 'My Types',
  filePath: 'types.ts',
  content: 'export interface User { ... }',
}
```

Extracts:
- Interfaces → ISL struct types
- Type aliases → ISL types
- String unions → ISL enum types
- Enums → ISL enum types

## Open Questions

The migrator generates open questions for items that need human review:

```typescript
interface OpenQuestion {
  id: string;                    // Unique identifier
  category: QuestionCategory;    // type_mapping, behavior_contract, etc.
  priority: QuestionPriority;    // low, medium, high, critical
  question: string;              // Human-readable question
  sourceContext?: { ... };       // Where this came from
  targetElement?: string;        // Target in generated ISL
  suggestion?: string;           // Suggested resolution
}
```

### Categories

| Category | Description |
|----------|-------------|
| `type_mapping` | Type couldn't be precisely mapped |
| `constraint_loss` | Constraints couldn't be preserved |
| `behavior_contract` | Missing pre/post conditions |
| `security` | Security requirements unclear |
| `validation` | Validation rules unclear |
| `relationship` | Entity relationships unclear |
| `naming` | Naming ambiguities |
| `semantics` | Semantic meaning unclear |

## Examples

### Basic Migration

```typescript
const result = migrateToISL([
  {
    id: '1',
    sourceType: 'openapi',
    name: 'API',
    filePath: 'api.json',
    content: openapiJson,
  },
]);
```

### Multiple Sources

```typescript
const result = migrateToISL([
  { id: '1', sourceType: 'openapi', name: 'API', filePath: 'api.json', content: apiSpec },
  { id: '2', sourceType: 'typescript', name: 'Types', filePath: 'types.ts', content: tsTypes },
], {
  domainName: 'CombinedAPI',
  inferEntities: true,
});
```

### With Custom Configuration

```typescript
const result = migrateToISL([source], {
  domainName: 'MyDomain',
  version: '2.0.0',
  generatePreconditions: true,
  generatePostconditions: true,
  inferEntities: true,
  naming: 'PascalCase',
});
```

## Demo

Run the demo to see the migrator in action:

```bash
npx tsx bench/isl-migrate-demo/run.ts
```

See [bench/isl-migrate-demo/README.md](../../../bench/isl-migrate-demo/README.md) for details.

## Testing

```bash
# Run tests
pnpm test packages/core/src/isl-migrate-v2

# Run with coverage
pnpm test:coverage packages/core/src/isl-migrate-v2
```

## Architecture

```
isl-migrate-v2/
├── index.ts           # Public exports
├── migrate.ts         # Main migration logic
├── types.ts           # Type definitions
├── sources/           # Source adapters
│   ├── openapi.ts     # OpenAPI adapter
│   ├── zod.ts         # Zod adapter
│   └── typescript.ts  # TypeScript adapter
├── samples/           # Sample inputs
│   ├── openapi.json
│   ├── zod.ts.fixture
│   └── types.ts.fixture
└── __tests__/         # Tests
    └── migrate.test.ts
```

## Differences from V1 (isl-migrate)

| Feature | V1 | V2 |
|---------|----|----|
| Unknown tracking | `MigrationNote` | `OpenQuestion` with categories |
| Output format | AST only | AST + canonical ISL |
| Entity inference | Basic | Enhanced heuristics |
| Question priority | 4 levels | 4 levels with categories |
| Source context | Limited | Full context tracking |

## Related

- [ISL Language Specification](../../../../ISL-LANGUAGE-SPEC.md)
- [ISL Parser](../../../../packages/parser)
- [Demo Runner](../../../../bench/isl-migrate-demo)
