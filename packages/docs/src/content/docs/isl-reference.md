---
title: ISL Language Reference
description: The authoritative documentation for the Intent Specification Language (ISL).
---

This is the complete ISL Language Reference. For a one-page cheatsheet, see `docs/CHEATSHEET.md` in the repository.

## Quick Start

### What is ISL?

**ISL (Intent Specification Language)** is a declarative language for specifying software behavior. Instead of writing *how* to do something, you write *what* you want—the system generates the implementation. ISL enables AI-assisted code generation, formal verification, and automatic optimization.

### Minimal Example

One entity, one behavior, one endpoint:

```isl
domain TodoApp {
  version: "1.0.0"

  entity Task {
    id: UUID [immutable, unique]
    title: String
    completed: Boolean [default: false]
  }

  behavior CreateTask {
    input { title: String }
    output {
      success: Task
      errors { INVALID_TITLE { when: "Title is empty" } }
    }
    preconditions { - input.title.length > 0 }
    postconditions { success implies { - Task.exists(result.id) } }
  }

  api {
    POST "/tasks" -> CreateTask { body: CreateTask response: Task }
  }
}
```

**What it generates:**
- `prisma/schema.prisma` — Task model with id, title, completed
- `src/app/api/tasks/route.ts` — POST handler calling CreateTask
- TypeScript types and Zod schemas for validation

### Three Steps: Idea → Spec → Running App

```bash
# 1. Describe what you want
isl vibe "a todo app"

# 2. ISL spec is generated (or edit specs/*.isl)
# 3. Running app: Next.js + Prisma + SQLite
cd output && npm install && npx prisma migrate dev && npm run dev
```

## Core Constructs

### Entity

Entities represent persistent data with identity. They map to database models and TypeScript interfaces.

**Syntax:**
```
entity EntityName {
  field_name: Type [annotations]?
  field_name: Type? [annotations]?

  invariants { expression* }
  lifecycle { StateA -> StateB }
}
```

**Field annotations:** `[immutable]` `[unique]` `[indexed]` `[secret]` `[sensitive]` `[default: value]` `[references: EntityName]`

**Examples:**

```isl
// Minimal
entity User {
  id: UUID [immutable, unique]
  name: String
}

// Typical
entity Todo {
  id: UUID [immutable, unique]
  title: String
  description: String?
  completed: Boolean [default: false]
  user_id: UUID [indexed, references: User]
  created_at: Timestamp [immutable]
  updated_at: Timestamp

  invariants { - title.length > 0 }
  lifecycle { Pending -> InProgress -> Done }
}
```

### Behavior

Behaviors define operations with pre/post conditions. They map to service functions and API handlers.

**Syntax:**
```
behavior BehaviorName {
  description: "string"?
  actors { ActorName { must: expression } }
  input { field: Type (field: Type?)* }
  output {
    success: Type
    errors { ERROR_CODE { when: "string" retriable: bool? }* }
  }
  preconditions { expression* }
  postconditions {
    success implies { expression* }
    ERROR_CODE implies { expression* }?
  }
}
```

**Example:**

```isl
behavior CreateTodo {
  description: "Create a new todo for the current user"
  actors { User { must: authenticated } }
  input {
    title: String
    description: String?
    priority: Int
    due_date: Timestamp?
  }
  output {
    success: Todo
    errors {
      INVALID_TITLE { when: "Title cannot be empty" retriable: true }
      UNAUTHORIZED { when: "User must be authenticated" retriable: false }
    }
  }
  preconditions {
    - input.title.length > 0
    - input.priority >= 1
    - input.priority <= 3
  }
  postconditions {
    success implies {
      - Todo.exists(result.id)
      - result.title == input.title
      - result.completed == false
    }
  }
}
```

### Endpoint

Endpoints map HTTP methods and paths to behaviors. Use colon syntax for path params: `/todos/:id` (not `{id}`).

```isl
api {
  base: "/api/v1"
  POST "/auth/register" -> RegisterUser { body: RegisterUser response: User }
  POST "/todos" -> CreateTodo {
    auth: authenticated
    body: CreateTodo
    response: Todo
  }
  GET "/todos" -> ListTodos {
    auth: authenticated
    params { status: String? priority: Int? }
    response: List<Todo>
  }
  PATCH "/todos/:id" -> UpdateTodo {
    auth: authenticated
    params { id: UUID }
    body: UpdateTodoInput
    response: Todo
  }
  DELETE "/todos/:id" -> DeleteTodo { auth: authenticated params { id: UUID } }
}
```

### Actor

```isl
actors {
  User { must: authenticated }
  User { must: authenticated, owns: todo_id }
  Admin { must: admin }
}
```

### Screen

```isl
screen Dashboard {
  description: "Main todo list view"
  route: "/dashboard"
  layout: Dashboard

  component TodoList {
    type: list
    entity: Todo
    fields {
      title: String [label: "Title"]
      priority: Int [label: "Priority"]
      completed: Boolean [label: "Done"]
    }
  }

  form CreateTodoForm -> CreateTodo {
    title: String [required, label: "Title"]
    description: String [label: "Description"]
    priority: Int [required, label: "Priority (1-3)"]
    submit: "Add Todo"
  }
}
```

### Form

```isl
form CreateTodoForm -> CreateTodo {
  title: String [required, label: "Title"]
  description: String [label: "Description"]
  priority: Int [required, label: "Priority (1-3)"]
  submit: "Add Todo"
}
```

### Scenario

```isl
scenarios CreatePayment {
  scenario "successful payment" {
    given { initial_count = Payment.count }
    when { result = CreatePayment(amount: 100.00, idempotency_key: "test-1") }
    then {
      result != null
      Payment.count == initial_count + 1
    }
  }
  scenario "duplicate idempotency key" {
    given { existing = CreatePayment(amount: 50.00, idempotency_key: "dupe-key") }
    when { result = CreatePayment(amount: 100.00, idempotency_key: "dupe-key") }
    then {
      result is DUPLICATE
      Payment.count == old(Payment.count)
    }
  }
}
```

### Constraint

**Type constraints:**
```isl
type Email = String { max_length: 254 }
type Money = Decimal { min: 0, precision: 2 }
type Age = Int { min: 0, max: 150 }
```

**Field annotations:**
```isl
email: String [unique, indexed]
id: UUID [immutable, unique]
user_id: UUID [references: User]
```

## Type System

| Primitive | Optional | Collections |
|-----------|----------|-------------|
| `String` `Int` `Decimal` `Boolean` | `Type?` | `List<T>` `Map<K,V>` |
| `UUID` `Timestamp` `Duration` `JSON` | | |

**Enums:**
```isl
enum TaskStatus { PENDING IN_PROGRESS DONE ARCHIVED }
```

**Special expressions:** `old(expr)` `result` `result.field` `input.field` `now()`

## Relationships

**One-to-one:** `user_id: UUID [unique, references: User]`

**One-to-many:** `user_id: UUID [indexed, references: User]`

**Many-to-many:** Use join entity `UserGroup` with `user_id` and `group_id`

## Patterns

**Authentication:** `actors { User { must: authenticated } }` or `Anonymous { for: authentication }`

**CRUD:** Create, List, Update, Delete behaviors + api block with POST, GET, PATCH, DELETE

**Search + Pagination:** `SearchTodos` with `q`, `page`, `limit` params

**Multi-tenant:** `tenant_id: UUID [indexed, references: Tenant]` + `owns: tenant_id` in actors

## CLI Reference

| Command | Description |
|---------|-------------|
| `isl parse <file>` | Parse ISL and show AST |
| `isl check [files...]` | Parse and type-check |
| `isl gen <target> <file>` | Generate code (ts, python, graphql...) |
| `isl generate -t -T [files]` | Types + tests |
| `isl verify [path]` | Verify code vs spec |
| `isl init [name]` | New project |
| `isl vibe "prompt"` | NL → ISL → code → verify |
| `isl build specs/**/*.isl` | Full pipeline |
| `isl fmt <file>` | Format |
| `isl lint <file>` | Lint |
| `isl gate <spec>` | SHIP/NO-SHIP |
| `isl heal <pattern>` | Auto-fix violations |

**Vibe options:** `-o --output` `--framework nextjs|express|fastify` `--database postgres|sqlite` `--from-spec <file>` `--dry-run`

**Verify options:** `--spec` `-i --impl` `--format json|text` `-s --min-score` `--smt` `--pbt` `--temporal` `--all`

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Missing `version` | Add `version: "1.0.0"` |
| `/x/{id}` | Use `/x/:id` |
| `post { }` | Use `success implies { }` |
| Errors as strings | Use `errors { CODE { when: "..." } }` |
| `format: email` | Use `max_length`, `pattern` |
| Lowercase HTTP methods | Use `GET`, `POST`, etc. |

---

For the full reference with BNF grammar, all options, and detailed examples, see `docs/ISL-LANGUAGE-REFERENCE.md` in the repository.
