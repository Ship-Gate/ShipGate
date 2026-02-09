# @isl-lang/codegen-go

Generate compilable, idiomatic Go code from ISL (Intent Specification Language) domain specifications.

## Features

- **Struct generation** with `json` + `validate` struct tags
- **Service interfaces** with `context.Context` signatures
- **Handler skeletons** with precondition checks and input validation
- **Error types** with typed error codes, constructors, and `IsRetriable()` support
- **Test stubs** generated from ISL scenarios (given/when/then)
- **Module scaffold** (`go.mod`, `doc.go`) for a directly compilable Go project
- **Stable output ordering** — deterministic file generation across runs

## Installation

```bash
pnpm add @isl-lang/codegen-go
```

## Quick Start

```typescript
import { generate } from '@isl-lang/codegen-go';
import type { Domain } from '@isl-lang/codegen-go';

const domain: Domain = { /* parsed ISL domain AST */ };

const files = generate(domain, {
  outputDir: 'output',
  module: 'github.com/myorg/myservice',
});

// files is an array of { path, content, type }
for (const file of files) {
  console.log(`${file.path} (${file.type})`);
}
```

## Generated File Structure

For a domain named `Auth`, the generator produces:

```
go.mod                    # Go module with dependencies
auth/
  doc.go                  # Package documentation
  types.go                # Enums, type aliases, union interfaces
  models.go               # Entity structs with json + validate tags
  interfaces.go           # Service interface + input/output structs
  handlers.go             # Service impl struct + handler skeletons
  errors.go               # Typed error structs + constructors
  validation.go           # Validator setup + custom validators
  handlers_test.go        # Test stubs from ISL scenarios
```

## Generated Code Examples

### Entity Struct (models.go)

```go
type User struct {
    Id     uuid.UUID  `json:"id" validate:"required"`
    Email  string     `json:"email" validate:"required,email"`
    Status UserStatus `json:"status" validate:"required"`
}
```

### Service Interface (interfaces.go)

```go
type AuthService interface {
    CreateUser(ctx context.Context, input CreateUserInput) (*CreateUserOutput, error)
}
```

### Handler Skeleton (handlers.go)

```go
func (a *AuthServiceImpl) CreateUser(ctx context.Context, input CreateUserInput) (*CreateUserOutput, error) {
    // Precondition checks
    if !(Input.Email != "") {
        return nil, &CreateUserError{
            Code:    "PRECONDITION_FAILED",
            Message: "Precondition failed: input.email != ",
        }
    }

    // Validate input
    if err := validate.Struct(&input); err != nil {
        return nil, fmt.Errorf("validation failed: %w", err)
    }

    // TODO: Implement business logic
    return nil, fmt.Errorf("create_user: not implemented")
}
```

### Test Stubs (handlers_test.go)

```go
func TestCreateUser_Success(t *testing.T) {
    ctx := context.Background()
    input := CreateUserInput{
        Email: "test@example.com",
        Name:  "test",
    }
    // TODO: Setup test dependencies and call handler
    _ = ctx
    _ = input
}
```

## Supported Frameworks

The generated code uses the standard Go ecosystem:

| Concern        | Library                                     |
| -------------- | ------------------------------------------- |
| Validation     | `github.com/go-playground/validator/v10`    |
| UUIDs          | `github.com/google/uuid`                    |
| Decimals       | `github.com/shopspring/decimal`             |
| HTTP (optional)| **Gin** or **Echo** — not generated, but the service interface is framework-agnostic and easily wired to any router |

### Wiring to Gin (example)

```go
func SetupRoutes(r *gin.Engine, svc AuthService) {
    r.POST("/users", func(c *gin.Context) {
        var input CreateUserInput
        if err := c.ShouldBindJSON(&input); err != nil {
            c.JSON(400, gin.H{"error": err.Error()})
            return
        }
        result, err := svc.CreateUser(c.Request.Context(), input)
        if err != nil {
            c.JSON(500, gin.H{"error": err.Error()})
            return
        }
        c.JSON(201, result)
    })
}
```

### Wiring to Echo (example)

```go
func SetupRoutes(e *echo.Echo, svc AuthService) {
    e.POST("/users", func(c echo.Context) error {
        var input CreateUserInput
        if err := c.Bind(&input); err != nil {
            return echo.NewHTTPError(400, err.Error())
        }
        result, err := svc.CreateUser(c.Request().Context(), input)
        if err != nil {
            return echo.NewHTTPError(500, err.Error())
        }
        return c.JSON(201, result)
    })
}
```

## Generator Options

| Option              | Type      | Default  | Description                              |
| ------------------- | --------- | -------- | ---------------------------------------- |
| `outputDir`         | `string`  | required | Output directory path                    |
| `module`            | `string`  | required | Go module path (e.g. `example.com/auth`) |
| `packageName`       | `string?` | derived  | Override Go package name                 |
| `includeValidation` | `boolean?`| `true`   | Generate validation.go                   |
| `includeHandlers`   | `boolean?`| `true`   | Generate handlers.go                     |
| `includeTests`      | `boolean?`| `true`   | Generate handlers_test.go                |
| `includeScaffold`   | `boolean?`| `true`   | Generate go.mod + doc.go                 |

## ISL → Go Type Mapping

| ISL Type      | Go Type            | Import                              |
| ------------- | ------------------ | ----------------------------------- |
| `String`      | `string`           | —                                   |
| `Int`         | `int64`            | —                                   |
| `Boolean`     | `bool`             | —                                   |
| `Decimal`     | `decimal.Decimal`  | `github.com/shopspring/decimal`     |
| `UUID`        | `uuid.UUID`        | `github.com/google/uuid`            |
| `Timestamp`   | `time.Time`        | `time`                              |
| `Duration`    | `time.Duration`    | `time`                              |
| `List<T>`     | `[]T`              | —                                   |
| `Map<K,V>`    | `map[K]V`          | —                                   |
| `Optional<T>` | `*T`               | —                                   |

## Development

```bash
pnpm build        # Build the package
pnpm test         # Run tests (48 tests)
pnpm typecheck    # Type-check without emit
pnpm clean        # Remove dist/
```

## License

MIT
