# ISL Cheatsheet — One-Page Reference

## Domain (required wrapper)

```isl
domain <Name> {
  version: "<semver>"   // REQUIRED
  owner: "<string>"     // optional
  // ... members
}
```

---

## Entity

```isl
entity <Name> {
  <field>: <Type>                    // required
  <field>: <Type>?                   // optional (suffix ?)
  <field>: <Type> [annotations]      // annotations in brackets

  invariants { - <expr> }
  lifecycle { StateA -> StateB }
}
```

**Field annotations:** `[immutable]` `[unique]` `[indexed]` `[secret]` `[sensitive]` `[default: value]` `[references: EntityName]`

---

## Behavior

```isl
behavior <Name> {
  description: "<string>"

  actors {
    <ActorName> { must: <expr> }
  }

  input {
    <field>: <Type>
    <field>: <Type>?
  }

  output {
    success: <Type>
    errors {
      <ERROR_NAME> {
        when: "<desc>"
        retriable: true|false
        retry_after: <Duration>?
      }
    }
  }

  preconditions { - <expr> }
  postconditions {
    success implies { - <expr> }
    <ERROR> implies { - <expr> }?
  }
}
```

---

## Endpoint (inside api block)

```isl
api {
  base: "<path>"

  GET|POST|PUT|PATCH|DELETE "<path>" -> <BehaviorName> {
    auth: <expr>?
    body: <Type>?
    params { <name>: <Type> }
    response: <Type>?
  }
}
```

**Path params:** `/todos/:id` (colon, NOT `{id}`)

---

## Actor (inside behavior.actors)

```isl
actors {
  User { must: authenticated }
  User { must: authenticated, owns: todo_id }
  Admin { must: admin }
}
```

---

## Screen

```isl
screen <Name> {
  description: "<string>"
  route: "<path>"
  layout: <LayoutName>?

  component <Name> {
    type: list|detail|form|chart|custom
    entity: <EntityName>
    behavior: <BehaviorName>?
    fields { <field>: <Type> [label: "<Label>"] }
    submit: "<Button Text>"?
  }

  form <FormName> -> <BehaviorName> {
    <field>: <Type> [required, label: "<Label>"]
    submit: "<Button Text>"
  }

  navigation { "<Label>" -> <ScreenName> }
}
```

---

## Form (standalone or in screen)

```isl
form <Name> -> <BehaviorName> {
  <field>: <Type> [required]? [label: "<Label>"]
  submit: "<Button Text>"
}
```

---

## Scenario

```isl
scenarios <BehaviorName> {
  scenario "<desc>" {
    given { <var> = <expr> }
    when { <result> = <BehaviorName>(<arg>: <val>) }
    then { - <expr> }
  }
}
```

**Standalone:** `scenario "<desc>" { given {...} when {...} then {...} }`

---

## Constraint

**Type constraints (braced):**
```isl
type PositiveInt = Int { min: 1 }
type Email = String { max_length: 254 }
type Money = Decimal { min: 0, precision: 2 }
type NonEmpty = List<T> { min_length: 1 }
```

**Field annotations (brackets):**
```isl
email: String [unique, indexed]
id: UUID [immutable, unique]
ref: User [references: User]
```

---

## Types

| Primitive | Optional | Collections | Struct |
|-----------|----------|-------------|--------|
| `String` `Int` `Decimal` `Boolean` | `Type?` | `List<T>` `Map<K,V>` | `{ a: T, b: U }` |
| `UUID` `Timestamp` `Duration` `JSON` | | | |

**Enum:**
```isl
enum Status { ACTIVE INACTIVE DELETED }
```

---

## Special Expressions

| Expression | Description |
|------------|-------------|
| `old(expr)` | Value before behavior |
| `result` | Return value |
| `result.field` | Field of return |
| `input.field` | Input param |
| `now()` | Current timestamp |

---

## Duration Literals

```isl
100ms  5.seconds  15.minutes  1.hours  7.days
1s     5m         1h          7d
```

---

## Chaos Block

```isl
chaos <BehaviorName> {
  scenario "<desc>" {
    inject {
      database_failure(target: X)
      network_latency(target: Y, delay: 100ms)
    }
    when { result = <Behavior>(...) }
    then { result is error }
  }
}
```

**Injection types:** `database_failure` `network_latency` `network_partition` `service_unavailable` `cpu_pressure` `memory_pressure` `clock_skew` `concurrent_requests`

---

## Policy

```isl
policy <Name> {
  applies_to: [Behavior1, Behavior2] | all
  rules {
    when <cond>: <action>
    default: <action>
  }
}
```

---

## View

```isl
view <Name> {
  for: <Entity>
  fields {
    <name>: <Type> = <expr>
  }
  consistency: strong | eventual
  cache { ttl: <Duration> }
}
```

---

## Common Mistakes (AVOID)

| Mistake | Fix |
|---------|-----|
| Missing `version` | Add `version: "1.0.0"` |
| `/x/{id}` | Use `/x/:id` |
| `post { }` | Use `success implies { }` |
| Errors as strings | Use `errors { CODE { when: "..." } }` |
| `format: email` | Use `max_length`, `pattern` |
| Union `A \| B` | Not fully supported |
| Lowercase HTTP methods | Use `GET`, `POST`, etc. |

---

## CLI Quick Reference

```bash
isl parse <file>              # Parse & show AST
isl check [files...]          # Type-check
isl gen <target> <file>       # Generate code (ts, python, graphql...)
isl generate -t -T [files]    # Types + tests
isl verify [path]             # Verify code vs spec
isl init [name]               # New project
isl vibe "prompt"             # NL → ISL → code → verify
isl build specs/**/*.isl      # Full pipeline
isl fmt <file>                # Format
isl lint <file>               # Lint
isl gate <spec>               # SHIP/NO-SHIP
isl heal <pattern>            # Auto-fix violations
isl watch                     # Watch mode
```
