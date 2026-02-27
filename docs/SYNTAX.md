# ISL Canonical Syntax Reference

This document defines the canonical syntax for the Intent Specification Language (ISL).

## Version

ISL Syntax Version: 2.0

## Overview

ISL uses a clean, shorthand syntax designed for readability and modern DSL conventions.

## Domain Structure

```isl
domain DomainName {
  version: "1.0.0"
  owner: "team@example.com"  // optional
  
  imports { ... }
  
  // Type definitions
  type TypeName = ...
  enum EnumName { ... }
  
  // Entity definitions
  entity EntityName { ... }
  
  // Behavior definitions
  behavior BehaviorName { ... }
  
  // Views, policies, scenarios, chaos tests
  view ViewName { ... }
  policy PolicyName { ... }
  scenarios BehaviorName { ... }
  chaos BehaviorName { ... }
  
  // Global invariants
  invariants InvariantName { ... }
}
```

## Behaviors

### Basic Structure

```isl
behavior DoSomething {
  description: "Human-readable description"
  
  actors {
    ActorName {
      must: authenticated
    }
  }
  
  input {
    field_name: Type
    optional_field: Type?
    sensitive_field: String [sensitive]
  }
  
  output {
    success: ResultType
    
    errors {
      ERROR_CODE {
        when: "Condition description"
        retriable: true
        retry_after: 5.seconds
      }
    }
  }
  
  // Preconditions (use shorthand 'pre')
  pre {
    input.field > 0
    some_condition == true
  }
  
  // Postconditions (use shorthand 'post')
  post success {
    result.id != null
    Entity.exists(result.id)
  }
  
  post ERROR_CODE {
    no_side_effects
  }
  
  post failure {
    rollback_complete
  }
  
  invariants {
    password never_logged
  }
  
  temporal {
    response within 500ms
    eventually within 5.seconds: side_effect_complete
  }
  
  security {
    rate_limit 100 per ip_address
  }
  
  compliance {
    gdpr { ... }
  }
  
  observability {
    metrics { ... }
    traces { ... }
    logs { ... }
  }
}
```

## Preconditions and Postconditions

### Canonical Syntax (Shorthand)

**Preconditions**: Use `pre { }` block

```isl
pre {
  input.email.is_valid
  input.password.length >= 8
  not User.exists(input.email)
}
```

**Optional Bullet Points**: For improved readability, you can prefix expressions with `-`:

```isl
pre {
  - input.email.is_valid
  - input.password.length >= 8
  - not User.exists(input.email)
}
```

Both styles are equivalent and fully supported.

**Postconditions**: Use `post <condition> { }` blocks

```isl
// On success
post success {
  User.exists(result.id)
  result.email == input.email
}

// On specific error
post NOT_FOUND {
  no_changes_made
}

// On any failure
post failure {
  state_unchanged
}
```

### Deprecated Syntax (Still Supported)

The verbose syntax is deprecated but still supported for backward compatibility:

```isl
// DEPRECATED - use 'pre' instead
preconditions {
  condition1
  condition2
}

// DEPRECATED - use 'post success' instead
postconditions {
  success implies {
    postcondition1
  }
  
  ERROR_CODE implies {
    postcondition2
  }
}
```

## Type Definitions

### Primitive Types

- `String` - Text values
- `Int` - Integer numbers
- `Decimal` - Decimal numbers with precision
- `Boolean` - true/false
- `Timestamp` - Date and time
- `UUID` - Universally unique identifier
- `Duration` - Time duration

### Constrained Types

```isl
type Email = String {
  format: email
  max_length: 254
}

type Money = Decimal {
  precision: 2
  min: 0
}

type Age = Int {
  min: 0
  max: 150
}
```

### Collection Types

```isl
List<ElementType>
Map<KeyType, ValueType>
```

### Optional Types

```isl
field_name: Type?  // nullable/optional
```

### Enum Types

```isl
enum Status {
  ACTIVE
  INACTIVE
  PENDING
}
```

### Struct Types

```isl
type Address = {
  line1: String
  line2: String?
  city: String
  postal_code: String
  country: String
}
```

## Entities

```isl
entity User {
  id: UUID [immutable, unique]
  email: String [unique, indexed]
  password_hash: String [secret]
  status: Status
  created_at: Timestamp [immutable]
  updated_at: Timestamp
  
  invariants {
    email.length > 0
    status != DELETED implies email.is_valid
  }
  
  lifecycle {
    PENDING -> ACTIVE
    ACTIVE -> SUSPENDED
    SUSPENDED -> ACTIVE
    ACTIVE -> DELETED
  }
}
```

### Field Annotations

- `[immutable]` - Cannot be changed after creation
- `[unique]` - Must be unique across all records
- `[indexed]` - Database index for faster queries
- `[secret]` - Sensitive data, never logged
- `[pii]` - Personally identifiable information
- `[sensitive]` - Handle with care
- `[default: value]` - Default value

## Expressions

### Operators

| Operator | Description |
|----------|-------------|
| `==` | Equals |
| `!=` | Not equals |
| `<`, `>`, `<=`, `>=` | Comparison |
| `and`, `or`, `not` | Logical |
| `implies` | Implication |
| `in` | Membership |
| `+`, `-`, `*`, `/`, `%` | Arithmetic |

### Special Expressions

```isl
old(expression)     // Value before operation
result              // Return value
result.field        // Field of return value
now()               // Current timestamp
this                // Current entity
```

### Quantifiers

```isl
all(collection, item => predicate)   // Universal quantifier
any(collection, item => predicate)   // Existential quantifier
none(collection, item => predicate)  // No items match
count(collection)                     // Number of items
sum(collection, item => expr)        // Sum of values
filter(collection, item => pred)     // Filter items
```

## Duration Literals

```isl
100ms        // Milliseconds
5.seconds    // Seconds
15.minutes   // Minutes
1.hours      // Hours
7.days       // Days
```

## Temporal Specifications

```isl
temporal {
  response within 500ms           // Response time SLA
  response within 2.seconds (p99) // 99th percentile
  eventually within 5.minutes: side_effect
  immediately: cache_invalidated
  always: audit_logged
  never: data_exposed
}
```

## Scenarios (Test Cases)

```isl
scenarios CreateUser {
  scenario "happy path" {
    given {
      initial_state = setup()
    }
    
    when {
      result = CreateUser(email: "test@example.com", name: "Test")
    }
    
    then {
      result is success
      result.email == "test@example.com"
    }
  }
  
  scenario "duplicate email" {
    given {
      existing = CreateUser(email: "existing@example.com", name: "Existing")
    }
    
    when {
      result = CreateUser(email: "existing@example.com", name: "New")
    }
    
    then {
      result is EMAIL_EXISTS
    }
  }
}
```

## Chaos Tests

```isl
chaos CreateUser {
  chaos "database failure" {
    inject {
      database_failure(target: UserRepository)
    }
    
    when {
      result = CreateUser(email: "test@example.com", name: "Test")
    }
    
    then {
      result is error
      state_unchanged
    }
  }
}
```

## Comments

```isl
// Single line comment

# Hash-style comment (alternative)

/* 
 * Multi-line comment
 */
```

## EBNF Grammar (Simplified)

```ebnf
domain        = "domain" identifier "{" domain_body "}" ;
domain_body   = { version | owner | imports | type_decl | entity | behavior | view | policy | scenarios | chaos | invariants } ;

version       = "version" ":" string_literal ;
owner         = "owner" ":" string_literal ;

behavior      = "behavior" identifier "{" behavior_body "}" ;
behavior_body = { description | actors | input | output | pre | post | invariants | temporal | security | compliance | observability } ;

pre           = "pre" "{" { expression } "}" ;
post          = "post" condition "{" { expression } "}" ;
condition     = "success" | "failure" | identifier ;

expression    = or_expr ;
or_expr       = and_expr { "or" and_expr } ;
and_expr      = implies_expr { "and" implies_expr } ;
implies_expr  = equality_expr { "implies" equality_expr } ;
equality_expr = comparison_expr { ( "==" | "!=" ) comparison_expr } ;
comparison_expr = additive_expr { ( "<" | ">" | "<=" | ">=" | "in" ) additive_expr } ;
additive_expr = mult_expr { ( "+" | "-" ) mult_expr } ;
mult_expr     = unary_expr { ( "*" | "/" | "%" ) unary_expr } ;
unary_expr    = [ "not" | "-" ] postfix_expr ;
postfix_expr  = primary { "." identifier | "(" [ arguments ] ")" | "[" expression "]" } ;
primary       = identifier | literal | "(" expression ")" | quantifier ;

identifier    = letter { letter | digit | "_" } ;
string_literal = '"' { character } '"' ;
number_literal = digit { digit } [ "." digit { digit } ] ;
duration_literal = number_literal ( "ms" | "seconds" | "minutes" | "hours" | "days" ) ;
```

## Migration Guide

### From Verbose to Shorthand Syntax

| Old (Deprecated) | New (Canonical) |
|------------------|-----------------|
| `preconditions { ... }` | `pre { ... }` |
| `postconditions { success implies { ... } }` | `post success { ... }` |
| `postconditions { ERROR implies { ... } }` | `post ERROR { ... }` |
| `postconditions { any_error implies { ... } }` | `post failure { ... }` |

Both syntaxes are currently supported, but the shorthand syntax is recommended for all new code.
