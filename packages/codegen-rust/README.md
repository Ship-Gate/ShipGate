# @isl-lang/codegen-rust

Generate idiomatic, compilable Rust code from ISL domain specifications. Produces structs with **serde**, validation with **validator**, error types with **thiserror**, and async service traits.

## Installation

```bash
pnpm add @isl-lang/codegen-rust
```

## Quick Start

```typescript
import { generate } from '@isl-lang/codegen-rust';
import type { Domain } from '@isl-lang/codegen-rust';

const files = generate(domainAST, {
  outputDir: './generated',
  crateName: 'my_service',
});

for (const file of files) {
  writeFileSync(join('./generated', file.path), file.content);
}
```

## Features

- **Structs with serde** — Entities and input types get `#[derive(Serialize, Deserialize)]` with field renaming, optional handling, and container attributes
- **Validation with validator** — Constrained types produce newtype wrappers with `#[validate(...)]` attributes; supports `email`, `url`, `length`, `range`
- **Error types with thiserror** — Each behavior's error variants become a `#[derive(thiserror::Error)]` enum with `From<ValidationErrors>` impl
- **Async service traits** — Behaviors produce `#[async_trait]` traits with typed input/output
- **Builder pattern** — Input structs include a builder for ergonomic construction
- **Deterministic output** — Same input always produces byte-for-byte identical output

## Generated Crate Structure

```
my_service/
├── Cargo.toml          # Dependencies: serde, validator, thiserror, async-trait, uuid, chrono
└── src/
    ├── lib.rs          # Module declarations + re-exports
    ├── types.rs        # ISL type declarations → Rust enums, newtypes, type aliases
    ├── models.rs       # ISL entities → Rust structs + behavior input structs + builders
    ├── traits.rs       # ISL behaviors → async service traits + result type aliases
    └── errors.rs       # ISL error specs → thiserror enums + From<ValidationErrors>
```

## API

### `generate(domain, options): GeneratedFile[]`

Main entry point. Returns an array of `{ path, content }` objects.

| Option | Type | Description |
|--------|------|-------------|
| `outputDir` | `string` | Output directory (used for documentation only) |
| `crateName` | `string` | Rust crate name in `Cargo.toml` |
| `generateMocks` | `boolean?` | Generate mock service implementations |

### Type Mapping

| ISL Type | Rust Type | Crate |
|----------|-----------|-------|
| `String` | `String` | std |
| `Int` | `i64` | std |
| `Decimal` | `Decimal` | `rust_decimal` |
| `Boolean` | `bool` | std |
| `Timestamp` | `DateTime<Utc>` | `chrono` |
| `UUID` | `Uuid` | `uuid` |
| `Duration` | `chrono::Duration` | `chrono` |
| `List<T>` | `Vec<T>` | std |
| `Map<K,V>` | `HashMap<K,V>` | std |
| `Optional<T>` | `Option<T>` | std |

### Constraint Mapping

| ISL Constraint | Rust Validator Attribute |
|---------------|------------------------|
| `format: "email"` | `#[validate(email)]` |
| `format: "url"` | `#[validate(url)]` |
| `minLength` / `maxLength` | `#[validate(length(min/max = N))]` |
| `min` / `max` | `#[validate(range(min/max = N))]` |
| `positive` | `#[validate(range(min = 1))]` |

## Example Output

Given an ISL domain with an `Email` constrained type and a `Login` behavior:

**types.rs**
```rust
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct Email(#[validate(email)] String);

impl Email {
    pub fn new(value: impl Into<String>) -> Result<Self, validator::ValidationErrors> {
        let instance = Self(value.into());
        instance.validate()?;
        Ok(instance)
    }
}
```

**errors.rs**
```rust
#[derive(Debug, Clone, Serialize, Deserialize, thiserror::Error)]
pub enum LoginError {
    #[error("Invalid email or password")]
    InvalidCredentials,
    #[error("Validation error: {0}")]
    ValidationError(String),
    #[error("Internal error: {0}")]
    InternalError(String),
}

impl From<validator::ValidationErrors> for LoginError {
    fn from(err: validator::ValidationErrors) -> Self {
        Self::ValidationError(err.to_string())
    }
}
```

**traits.rs**
```rust
pub type LoginResult = Result<Uuid, LoginError>;

#[async_trait]
pub trait LoginService: Send + Sync {
    async fn login(&self, input: LoginInput) -> LoginResult;
}
```

## Validation

```bash
# Run TypeScript tests (type mapping, golden snapshots, determinism)
pnpm test

# Verify generated Rust compiles (requires Rust toolchain)
cd tests/golden/auth_service && cargo check
```

## Development

```bash
pnpm build        # Build the package
pnpm test         # Run tests (41 tests)
pnpm typecheck    # Type-check without emit
pnpm clean        # Remove dist/
```

## License

MIT
