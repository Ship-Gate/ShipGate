# @isl-lang/ui-generator

Generate React UI components from ISL entity and behavior specifications.

- **Entities → List + Detail + Create/Edit Form** components
- **Behaviors → Action forms** with submit handlers
- **Client-side validation** derived from ISL constraints (required, minLength, email, matches, min/max, pattern)
- **Optional React Router** wiring for navigation

## Installation

```bash
pnpm add @isl-lang/ui-generator
```

## Usage

```typescript
import { generateUI } from '@isl-lang/ui-generator';
import { parseISL } from '@isl-lang/isl-core';

const { ast } = parseISL(`
  domain Payments version "1.0.0"
  entity Account {
    id: UUID
    balance: Decimal
    isActive: Boolean
  }
  behavior TransferFunds {
    input {
      senderId: UUID
      receiverId: UUID
      amount: Decimal
    }
    output { success: Account }
    preconditions { amount > 0 }
  }
`);

const files = generateUI({ domain: ast!, includeRouting: true });
// files = [
//   { path: 'types.ts',              content: '...' },
//   { path: 'validation.ts',         content: '...' },
//   { path: 'AccountList.tsx',       content: '...' },
//   { path: 'AccountDetail.tsx',     content: '...' },
//   { path: 'AccountForm.tsx',       content: '...' },
//   { path: 'TransferFundsForm.tsx', content: '...' },
//   { path: 'App.tsx',               content: '...' },
// ]
```

## Generated Files

| File | Description |
|------|-------------|
| `types.ts` | TS interfaces/enums for all entities and behavior inputs |
| `validation.ts` | Pure `validate*()` functions derived from ISL constraints |
| `{Entity}List.tsx` | Table view with View/Delete actions |
| `{Entity}Detail.tsx` | Read-only detail view with Back/Edit |
| `{Entity}Form.tsx` | Create/edit form with validation |
| `{Behavior}Form.tsx` | Behavior action form with validation |
| `App.tsx` | App shell (optional React Router routes) |

## Validation Mapping

| ISL Constraint | Validation Rule |
|----------------|----------------|
| Non-optional field | `required` |
| `field.length >= N` (precondition) | `minLength(N)` |
| `amount > 0` (precondition) | `min(1)` |
| `password == confirm_password` | `matches('confirm_password')` |
| Field named `email` | `email` regex |
| `UUID` typed field | UUID `pattern` |
| `[sensitive]` / `[secret]` annotation | `password` input type |

## API

### `generateUI(options: GenerateUIOptions): GeneratedUIFile[]`

Main entry point. Returns an array of `{ path, content }` file objects.

### `mapDomain(domain: DomainDeclaration): DomainUIModel`

Lower-level: maps an ISL domain AST into the intermediate UI model.

### `extractFieldValidation(field): ValidationRule[]`

Extract validation rules from a single ISL FieldDeclaration.

### `extractBehaviorValidation(behavior): ValidationRule[]`

Extract cross-field validation rules from behavior preconditions.

## Development

```bash
pnpm install      # Install dependencies
pnpm build        # Build the package
pnpm test         # Run tests
pnpm typecheck    # Type-check without emit
pnpm clean        # Remove dist/
```

## License

MIT
