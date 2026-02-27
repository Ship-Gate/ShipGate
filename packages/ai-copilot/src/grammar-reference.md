# ISL Grammar Reference (AI Copilot)

Token-efficient reference for generating valid ISL. All constructs live inside `domain Name { ... }`.

## 1. Domain (required wrapper)
```
domain <Name> {
  version: "<semver>"   // REQUIRED
  owner: "<string>"    // optional
  // ... members
}
```

## 2. Entity
```
entity <Name> {
  <field>: <Type>                    // required
  <field>: <Type>?                  // optional (suffix ?)
  <field>: <Type> [annotations]     // annotations in brackets

  invariants { - <expr> }
  lifecycle { StateA -> StateB }
}
```
**Field annotations**: `[immutable]`, `[unique]`, `[indexed]`, `[references: EntityName]`

## 3. Behavior
```
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
      }
    }
  }

  preconditions { - <expr> }
  postconditions {
    success implies { - <expr> }
  }
}
```

## 4. Endpoint (inside api block)
```
api {
  base: "<path>"

  GET|POST|PUT|PATCH|DELETE "<path>" -> <BehaviorName> {
    auth: <expr>
    body: <Type>
    params { <name>: <Type> }
    response: <Type>
  }
}
```
Path params: `/todos/:id` (colon, NOT `{id}`)

## 5. Actor (inside behavior.actors)
```
actors {
  User { must: authenticated }
}
```

## 6. Screen
```
screen <Name> {
  description: "<string>"
  route: "<path>"
  layout: <LayoutName>

  component <Name> {
    type: list|detail|form|chart|custom
    entity: <EntityName>
    behavior: <BehaviorName>
    fields { <field>: <Type> [label: "<Label>"] }
    submit: "<Button Text>"
  }

  navigation { "<Label>" -> <ScreenName> }
}
```

## 7. Form (component inside screen)
```
component CreateTaskForm {
  type: form
  behavior: CreateTask
  fields {
    title: String [required, label: "Title"]
    priority: Int [label: "Priority"]
  }
  submit: "Create"
}
```

## 8. Scenario
```
scenarios <BehaviorName> {
  scenario "<desc>" {
    given { <var> = <expr> }
    when { <result> = <BehaviorName>(<arg>: <val>) }
    then { - <expr> }
  }
}
```
Standalone: `scenario "<desc>" { given {...} when {...} then {...} }`

## 9. Constraint (type & field)

**Type constraints** (braced after base type):
```
type PositiveInt = Int { min: 1 }
type Email = String { max_length: 254 }
type Money = Decimal { min: 0, precision: 2 }
type NonEmpty = List<T> { min_length: 1 }
```
Supported: `min`, `max`, `min_length`, `max_length`, `precision` (NOT `format:` — parser limitation)

**Field annotations** (brackets):
```
email: String [unique, indexed]
id: UUID [immutable, unique]
ref: User [references: User]
```

## Types
- Primitives: `String`, `Int`, `Decimal`, `Boolean`, `UUID`, `Timestamp`, `Duration`
- Optional: `Type?`
- Collections: `List<T>`, `Map<K,V>`
- Struct: `{ field: Type }`
- Reference: `EntityName`, `TypeName`

## Minimal Example (all 8 constructs)
```isl
domain TaskApp {
  version: "1.0.0"

  entity Task {
    id: UUID [immutable, unique]
    title: String
    status: String [indexed]
    invariants { - title.length > 0 }
    lifecycle { Todo -> Done }
  }

  behavior CreateTask {
    actors { User { must: authenticated } }
    input { title: String, priority: Int }
    output { success: Task errors { INVALID { when: "invalid" retriable: false } } }
    preconditions { - input.title.length > 0 }
    postconditions { success implies { - result.id != null } }
  }

  api {
    POST "/tasks" -> CreateTask { auth: authenticated body: CreateTask response: Task }
  }

  screen TaskList {
    route: "/tasks"
    component TaskForm {
      type: form
      behavior: CreateTask
      fields { title: String [required] priority: Int }
      submit: "Create"
    }
  }

  scenarios CreateTask {
    scenario "creates task" {
      given { }
      when { r = CreateTask(title: "x", priority: 1) }
      then { - r != null }
    }
  }
}
```

## Common Mistakes (AVOID)
1. **version** — MUST be first; use `version: "1.0.0"`
2. **Optional** — Use `Type?` or `[optional]`; NOT in form/screen fields
3. **Errors** — Use `{ when: "...", retriable: bool }`; NOT inline strings
4. **Postconditions** — Use `success implies { - expr }`; NOT bare `post { }`
5. **Union types** — `A | B` NOT supported
6. **Regex** — No `^`, `$`, `\d` in invariants
7. **API paths** — Use `/x/:id` NOT `/x/{id}`
8. **API methods** — Uppercase: GET, POST, PUT, PATCH, DELETE
9. **format:** — NOT supported in type constraints (use max_length, pattern workaround)
10. **Standalone** — All constructs inside `domain { }`
