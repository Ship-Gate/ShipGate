# @intentos/codegen-jvm

Generate idiomatic Java and Kotlin code from ISL (Intent Specification Language) specifications.

## Features

- **Java 17/21 Support**: Records, sealed interfaces, pattern matching
- **Kotlin Support**: Data classes, sealed classes, value classes, coroutines
- **Framework Integration**: Spring Boot, Quarkus, Micronaut
- **Jakarta Validation**: Auto-generated validation constraints
- **Type-Safe Results**: Sealed types for behavior outcomes

## Installation

```bash
npm install @intentos/codegen-jvm
# or
pnpm add @intentos/codegen-jvm
```

## Usage

```typescript
import { generate } from '@intentos/codegen-jvm';
import { parse } from '@intentos/isl-core';

const domain = parse(`
  domain Auth {
    version: "1.0.0"
    
    type Email = String {
      format: /^[^\\s@]+@[^\\s@]+$/
    }
    
    enum UserStatus { PENDING, ACTIVE, SUSPENDED }
    
    entity User {
      id: UUID [immutable, unique]
      email: Email [unique]
      status: UserStatus
    }
    
    behavior CreateUser {
      input { email: Email }
      output { 
        success: User
        errors { DUPLICATE_EMAIL { } }
      }
    }
  }
`);

// Generate Java code
const javaFiles = generate(domain, {
  language: 'java',
  javaVersion: 17,
  framework: 'spring',
  package: 'com.example.auth',
});

// Generate Kotlin code
const kotlinFiles = generate(domain, {
  language: 'kotlin',
  package: 'com.example.auth',
  useSuspend: true,
});
```

## Generated Output

### Java (17+)

```java
// Types
public record Email(String value) {
    public Email {
        if (!value.matches("^[^\\s@]+@[^\\s@]+$")) {
            throw new IllegalArgumentException("Invalid email format");
        }
    }
}

// Enums
public enum UserStatus {
    PENDING, ACTIVE, SUSPENDED
}

// Entities
public record User(
    UUID id,
    Email email,
    UserStatus status,
    Instant createdAt
) {}

// Behavior Input/Output
public record CreateUserInput(
    @NotNull Email email
) {}

public sealed interface CreateUserResult {
    record Success(User user) implements CreateUserResult {}
    record DuplicateEmail() implements CreateUserResult {}
}

// Service Interface
public interface AuthService {
    CreateUserResult createUser(CreateUserInput input);
}
```

### Kotlin

```kotlin
// Types
@JvmInline
value class Email(val value: String) {
    init {
        require(value.matches(Regex("^[^\\s@]+@[^\\s@]+$"))) { "Invalid email" }
    }
}

// Enums
enum class UserStatus { PENDING, ACTIVE, SUSPENDED }

// Entities
data class User(
    val id: UUID,
    val email: Email,
    val status: UserStatus,
    val createdAt: Instant
)

// Behavior Input/Output
data class CreateUserInput(val email: Email)

sealed class CreateUserResult {
    data class Success(val user: User) : CreateUserResult()
    data object DuplicateEmail : CreateUserResult()
}

// Service Interface
interface AuthService {
    suspend fun createUser(input: CreateUserInput): CreateUserResult
}
```

### Spring Boot Controller

```java
@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService authService;
    
    @PostMapping("/create-user")
    public ResponseEntity<?> createUser(@Valid @RequestBody CreateUserInput input) {
        return switch (authService.createUser(input)) {
            case CreateUserResult.Success s -> ResponseEntity.ok(s.user());
            case CreateUserResult.DuplicateEmail e -> ResponseEntity.status(409).body(e);
        };
    }
}
```

## API

### `generate(domain, options)`

Generates JVM code from an ISL domain.

#### Parameters

- `domain: Domain` - Parsed ISL domain
- `options: GeneratorOptions` - Generation options

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `language` | `'java' \| 'kotlin'` | Required | Target language |
| `javaVersion` | `17 \| 21` | `17` | Java version (affects features used) |
| `framework` | `'spring' \| 'quarkus' \| 'micronaut' \| 'none'` | `'none'` | Framework integration |
| `package` | `string` | Required | Base package name |
| `generateValidation` | `boolean` | `true` | Generate validation annotations |
| `useSuspend` | `boolean` | `true` | Use Kotlin suspend functions |

#### Returns

`GeneratedFile[]` - Array of generated files with `path`, `content`, and `type`.

## Generated File Types

| Type | Description |
|------|-------------|
| `type` | Custom types (value objects, enums, structs) |
| `entity` | Entity classes |
| `behavior` | Behavior input/output types |
| `service` | Service interfaces |
| `controller` | REST controllers (framework-specific) |
| `config` | Configuration classes |

## Type Mappings

### ISL to Java

| ISL Type | Java Type |
|----------|-----------|
| `String` | `String` |
| `Int` | `Integer` |
| `Decimal` | `BigDecimal` |
| `Boolean` | `Boolean` |
| `Timestamp` | `Instant` |
| `UUID` | `UUID` |
| `Duration` | `Duration` |
| `List<T>` | `List<T>` |
| `Map<K,V>` | `Map<K,V>` |
| `T?` | `T` (nullable) |

### ISL to Kotlin

| ISL Type | Kotlin Type |
|----------|-------------|
| `String` | `String` |
| `Int` | `Int` |
| `Decimal` | `BigDecimal` |
| `Boolean` | `Boolean` |
| `Timestamp` | `Instant` |
| `UUID` | `UUID` |
| `Duration` | `Duration` |
| `List<T>` | `List<T>` |
| `Map<K,V>` | `Map<K,V>` |
| `T?` | `T?` |

## Framework Features

### Spring Boot

- `@RestController` with proper request mappings
- `@Valid` parameter validation
- `ResponseEntity` responses with appropriate status codes
- Configuration beans for JSON handling

### Quarkus (Planned)

- RESTEasy resources
- Panache repositories
- Reactive support

### Micronaut (Planned)

- Controller generation
- Data repositories
- AOT compilation support

## License

MIT
