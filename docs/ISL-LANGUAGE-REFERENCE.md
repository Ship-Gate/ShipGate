# ISL Language Reference

**The authoritative documentation for the Intent Specification Language (ISL).**

---

## Table of Contents

- [Quick Start](#quick-start)
- [Core Constructs](#core-constructs)
  - [Entity](#entity)
  - [Behavior](#behavior)
  - [Endpoint](#endpoint)
  - [Actor](#actor)
  - [Screen](#screen)
  - [Form](#form)
  - [Scenario](#scenario)
  - [Constraint](#constraint)
- [Type System](#type-system)
- [Relationships](#relationships)
- [Patterns](#patterns)
- [CLI Reference](#cli-reference)

---

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

---

## Core Constructs

### Entity

Entities represent persistent data with identity. They map to database models and TypeScript interfaces.

#### Syntax (BNF-style)

```
entity EntityName {
  field_name: Type [annotations]?
  field_name: Type? [annotations]?   // optional field

  invariants { expression* }
  lifecycle { StateA -> StateB (StateB -> StateC)* }
}
```

#### Required vs Optional

| Field/Member | Required | Description |
|--------------|----------|-------------|
| `entity` keyword | ✓ | Declares an entity |
| Entity name | ✓ | PascalCase identifier |
| At least one field | ✓ | Data shape |
| `invariants` | ✗ | Conditions that must always hold |
| `lifecycle` | ✗ | State machine transitions |

#### Field Annotations

| Annotation | Description |
|------------|-------------|
| `[immutable]` | Cannot be changed after creation |
| `[unique]` | Must be unique across all instances |
| `[indexed]` | Database index for fast queries |
| `[secret]` | Never exposed in logs or responses |
| `[sensitive]` | Handle with care (PII) |
| `[default: value]` | Default if not provided |
| `[references: EntityName]` | Foreign key / relation |

#### Examples

**Minimal:**
```isl
entity User {
  id: UUID [immutable, unique]
  name: String
}
```

**Typical:**
```isl
entity Todo {
  id: UUID [immutable, unique]
  title: String
  description: String?
  completed: Boolean [default: false]
  user_id: UUID [indexed, references: User]
  created_at: Timestamp [immutable]
  updated_at: Timestamp

  invariants {
    - title.length > 0
  }

  lifecycle {
    Pending -> InProgress -> Done
    InProgress -> Blocked -> InProgress
  }
}
```

**Advanced:**
```isl
entity Payment {
  id: UUID [immutable, unique]
  amount: Decimal [immutable]
  currency: String [immutable]
  status: PaymentStatus [indexed]
  idempotency_key: String [unique, secret]
  metadata: JSON?
  created_at: Timestamp [immutable]

  invariants {
    - amount >= 0
    - status in [PENDING, COMPLETED, FAILED, REFUNDED]
  }

  lifecycle {
    PENDING -> COMPLETED
    PENDING -> FAILED
    COMPLETED -> REFUNDED
  }
}
```

#### Generated Code

| Output | Path |
|--------|------|
| Prisma model | `prisma/schema.prisma` |
| TypeScript type | `src/types/*.ts` or inline in generated routes |
| Zod schema | In API route validation |

#### Common Mistakes

| Mistake | Fix |
|---------|-----|
| Forgetting `version` in domain | Add `version: "1.0.0"` at top of domain |
| Using `{id}` in API paths | Use `/todos/:id` (colon, not braces) |
| Optional without `?` | Use `field: Type?` or `[optional]` |
| `format: email` in type | Use `max_length`, `pattern`; `format` has limited support |

---

### Behavior

Behaviors define operations with pre/post conditions. They map to service functions and API handlers.

#### Syntax

```
behavior BehaviorName {
  description: "string"?

  actors {
    ActorName { must: expression }
  }

  input { field: Type (field: Type?)* }
  output {
    success: Type
    errors {
      ERROR_CODE {
        when: "string"
        retriable: bool?
        retry_after: Duration?
      }*
    }
  }

  preconditions { expression* }
  postconditions {
    success implies { expression* }
    ERROR_CODE implies { expression* }?
    any_error implies { expression* }?
  }

  invariants { expression* }?
  temporal { spec* }?
  security { spec* }?
  compliance { spec* }?
}
```

#### Required vs Optional

| Section | Required | Description |
|---------|----------|-------------|
| `input` | ✓ | Input parameters |
| `output` | ✓ | Success type + errors |
| `description` | ✗ | Human-readable description |
| `actors` | ✗ | Who can invoke (auth) |
| `preconditions` | ✗ | Must hold before execution |
| `postconditions` | ✗ | Must hold after (on success/error) |
| `invariants` | ✗ | Must hold throughout |
| `temporal` | ✗ | Latency SLAs |
| `security` | ✗ | Rate limits, auth |
| `compliance` | ✗ | Regulatory rules |

#### Examples

**Minimal:**
```isl
behavior CreateTask {
  input { title: String }
  output {
    success: Task
    errors { INVALID { when: "Invalid input" } }
  }
}
```

**Typical:**
```isl
behavior CreateTodo {
  description: "Create a new todo for the current user"

  actors {
    User { must: authenticated }
  }

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

**Advanced:**
```isl
behavior ProcessPayment {
  description: "Charge a payment with idempotency"

  actors {
    User { must: authenticated }
    System { must: internal }
  }

  input {
    amount: Decimal
    currency: String
    idempotency_key: String
    metadata: JSON?
  }

  output {
    success: Payment
    errors {
      DUPLICATE { when: "Idempotency key reused" retriable: false }
      INSUFFICIENT_FUNDS { when: "Insufficient balance" retriable: true retry_after: 60.seconds }
      RATE_LIMITED { when: "Too many requests" retriable: true retry_after: 15.seconds }
    }
  }

  preconditions {
    - input.amount > 0
    - input.idempotency_key.length > 0
  }

  postconditions {
    success implies {
      - Payment.exists(result.id)
      - result.amount == input.amount
      - result.status == COMPLETED
    }
    DUPLICATE implies {
      - Payment.count == old(Payment.count)
    }
  }

  temporal {
    response within 500ms (p99)
    eventually within 5.minutes: receipt.sent
  }

  security {
    rate_limit 100 per hour per actor
  }
}
```

#### Generated Code

| Output | Path |
|--------|------|
| API route | `src/app/api/<behavior-kebab>/route.ts` (Next.js) |
| Service stub | `src/services/*.ts` |
| Test stubs | `*.test.ts` |

#### Common Mistakes

| Mistake | Fix |
|---------|-----|
| `post { }` without condition | Use `post success { }` or `success implies { }` |
| Errors as inline strings | Use `errors { CODE { when: "..." } }` |
| Missing `success` in output | Always declare `success: Type` |
| `input` / `in` typo | Both valid; prefer `input` |

---

### Endpoint

Endpoints map HTTP methods and paths to behaviors. They live inside an `api` block.

#### Syntax

```
api {
  base: "/path"?

  GET|POST|PUT|PATCH|DELETE "/path" -> BehaviorName? {
    auth: expression?
    body: Type?
    params { name: Type* }
    response: Type?
  }
}
```

#### Path Parameters

Use colon syntax: `/todos/:id` (not `{id}`).

#### Required vs Optional

| Part | Required | Description |
|------|----------|-------------|
| `api` block | ✗ | Optional; auto-CRUD if omitted |
| `base` | ✗ | Base path prefix |
| Method + path | ✓ | HTTP method and path |
| `-> BehaviorName` | ✗ | Binds to behavior; omit for custom |
| `body` | For POST/PUT/PATCH | Request body type |
| `params` | For path params | e.g. `id: UUID` for `:id` |
| `auth` | ✗ | e.g. `authenticated` |
| `response` | ✗ | Response type |

#### Examples

**Minimal:**
```isl
api {
  POST "/tasks" -> CreateTask { body: CreateTask response: Task }
}
```

**Typical:**
```isl
api {
  base: "/api/v1"

  POST "/auth/register" -> RegisterUser {
    body: RegisterUser
    response: User
  }

  POST "/auth/login" -> LoginUser {
    body: LoginUser
    response: User
  }

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

  DELETE "/todos/:id" -> DeleteTodo {
    auth: authenticated
    params { id: UUID }
  }
}
```

**Advanced:**
```isl
api {
  base: "/api/v2"

  GET "/search" -> SearchTodos {
    auth: authenticated
    params {
      q: String
      page: Int [default: 1]
      limit: Int [default: 20]
    }
    response: Paginated<Todo>
  }

  POST "/todos/:id/archive" -> ArchiveTodo {
    auth: authenticated
    params { id: UUID }
    response: Todo
  }
}
```

#### Generated Code

| Output | Path |
|--------|------|
| Next.js route | `src/app/api/v1/todos/route.ts` |
| Express route | `src/routes/*.ts` |

#### Common Mistakes

| Mistake | Fix |
|---------|-----|
| `/todos/{id}` | Use `/todos/:id` |
| Lowercase method | Use `GET`, `POST`, etc. |
| Missing `body` for POST | Add `body: InputType` |

---

### Actor

Actors define who can invoke a behavior. Declared inside `behavior.actors`.

#### Syntax

```
actors {
  ActorName {
    must: expression
    owns: resource_ref?   // optional ownership check
  }
}
```

#### Options

| Option | Description |
|--------|-------------|
| `must` | Required condition (e.g. `authenticated`, `admin`) |
| `owns` | Resource ownership (e.g. `task_id` for Todo) |

#### Examples

**Minimal:**
```isl
actors {
  User { must: authenticated }
}
```

**Typical:**
```isl
actors {
  User { must: authenticated, owns: todo_id }
  Admin { must: admin }
}
```

**Advanced:**
```isl
actors {
  User { must: authenticated and role in [EDITOR, ADMIN] }
  System { must: internal }
  Anonymous { for: authentication }
}
```

---

### Screen

Screens define UI pages with routes and components.

#### Syntax

```
screen ScreenName {
  description: "string"?
  route: "/path"
  layout: LayoutName?

  component ComponentName {
    type: list | detail | form | chart | custom
    entity: EntityName?
    behavior: BehaviorName?
    fields { field: Type [label: "Label"]* }
    submit: "Button Text"?
  }

  form FormName -> BehaviorName {
    field: Type [required, label: "Label"]*
    submit: "Button Text"
  }

  navigation { "Label" -> ScreenName }*
}
```

#### Required vs Optional

| Member | Required | Description |
|--------|----------|-------------|
| `route` | ✓ | URL path |
| `description` | ✗ | Human-readable |
| `layout` | ✗ | Layout component |
| `component` | ✗ | List/detail/form component |
| `form` | ✗ | Form bound to behavior |
| `navigation` | ✗ | Nav links |

#### Examples

**Minimal:**
```isl
screen TaskList {
  route: "/tasks"
  component TaskList { type: list entity: Task }
}
```

**Typical:**
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
      due_date: Timestamp [label: "Due Date"]
    }
  }

  form CreateTodoForm -> CreateTodo {
    title: String [required, label: "Title"]
    description: String [label: "Description"]
    priority: Int [required, label: "Priority (1-3)"]
    submit: "Add Todo"
  }

  navigation {
    "Settings" -> SettingsScreen
  }
}
```

**Advanced:**
```isl
screen LoginScreen {
  route: "/login"
  layout: Auth

  form LoginForm -> LoginUser {
    email: String [required, label: "Email"]
    password: String [required, label: "Password"]
    submit: "Sign In"
  }
}
```

#### Generated Code

| Output | Path |
|--------|------|
| Page component | `src/app/tasks/page.tsx` (Next.js) |
| Form component | Inline or `src/components/*.tsx` |

---

### Form

Forms bind UI inputs to behaviors. Can be standalone or inside a screen.

#### Syntax

```
form FormName -> BehaviorName {
  field: Type [required]? [label: "Label"]*
  submit: "Button Text"
}
```

#### Examples

**Minimal:**
```isl
form CreateTaskForm -> CreateTask {
  title: String [required]
  submit: "Create"
}
```

**Typical:**
```isl
form CreateTodoForm -> CreateTodo {
  title: String [required, label: "Title"]
  description: String [label: "Description"]
  priority: Int [required, label: "Priority (1-3)"]
  due_date: Timestamp [label: "Due Date"]
  submit: "Add Todo"
}
```

---

### Scenario

Scenarios define test cases (given/when/then) for behaviors.

#### Syntax

```
scenarios BehaviorName {
  scenario "description" {
    given { statement* }
    when { statement* }
    then { expression* }
  }
}

// Standalone (global)
scenario "description" {
  given { statement* }
  when { statement* }
  then { expression* }
}
```

#### Statements

- `var = Expression` — bind variable
- `result = BehaviorName(arg: value, ...)` — invoke behavior

#### Examples

**Minimal:**
```isl
scenarios CreateTask {
  scenario "creates task" {
    given { }
    when { r = CreateTask(title: "Buy milk") }
    then { - r != null }
  }
}
```

**Typical:**
```isl
scenarios CreatePayment {
  scenario "successful payment" {
    given {
      initial_count = Payment.count
    }
    when {
      result = CreatePayment(amount: 100.00, idempotency_key: "test-1")
    }
    then {
      result != null
      Payment.count == initial_count + 1
    }
  }

  scenario "duplicate idempotency key" {
    given {
      existing = CreatePayment(amount: 50.00, idempotency_key: "dupe-key")
    }
    when {
      result = CreatePayment(amount: 100.00, idempotency_key: "dupe-key")
    }
    then {
      result is DUPLICATE
      Payment.count == old(Payment.count)
    }
  }
}
```

**Advanced:**
```isl
scenario "Register and create todo" {
  given { User.count == 0 }
  when {
    RegisterUser(email: "test@example.com", password: "secure123", name: "Test")
  }
  then { User.count == 1 }
}
```

#### Generated Code

| Output | Path |
|--------|------|
| Test file | `*.test.ts` (Vitest/Jest) |

---

### Constraint

Constraints apply to types and entity fields.

#### Type Constraints (braced)

```isl
type Email = String { max_length: 254 }
type Money = Decimal { min: 0, precision: 2 }
type Age = Int { min: 0, max: 150 }
type Slug = String { min_length: 1, max_length: 100 }
```

#### Supported Constraint Keys

| Key | Applies To | Description |
|-----|------------|-------------|
| `min` | Int, Decimal | Minimum value |
| `max` | Int, Decimal | Maximum value |
| `min_length` | String, List | Minimum length |
| `max_length` | String, List | Maximum length |
| `precision` | Decimal | Decimal places |
| `pattern` | String | Regex (limited support) |

#### Field Annotations (brackets)

```isl
email: String [unique, indexed]
id: UUID [immutable, unique]
user_id: UUID [references: User]
```

#### Common Mistakes

| Mistake | Fix |
|---------|-----|
| `format: "email"` | Use `max_length`, `pattern`; format has limited parser support |
| `A | B` union | Union types not fully supported; use separate types |

---

## Type System

### Primitive Types

| Type | Description |
|------|-------------|
| `String` | Text |
| `Int` | Integer |
| `Decimal` | Decimal (money, precise math) |
| `Boolean` | true/false |
| `UUID` | Universally unique identifier |
| `Timestamp` | Date and time |
| `Duration` | Time span |
| `JSON` | Arbitrary JSON |
| `Binary` | Binary data |

### Entity References (Relations)

```isl
entity Todo {
  user_id: UUID [references: User]  // FK to User
}
```

### Enums

```isl
enum TaskStatus {
  PENDING
  IN_PROGRESS
  DONE
  ARCHIVED
}

enum PaymentStatus {
  PENDING
  COMPLETED
  FAILED
  REFUNDED
}
```

### Arrays and Optional Types

```isl
items: List<Todo>
tags: List<String>
optional_field: String?
due_date: Timestamp?
```

### Union Types

```isl
type Result = Success | Failure
type PaymentMethod = Card | BankTransfer | Crypto
```

### Custom Validators (Constrained Types)

```isl
type Email = String { max_length: 254 }
type Money = Decimal { min: 0, precision: 2 }
type PositiveInt = Int { min: 1 }
type NonEmptyList<T> = List<T> { min_length: 1 }
```

---

## Relationships

### One-to-One

```isl
entity Profile {
  id: UUID [immutable, unique]
  user_id: UUID [unique, references: User]
  bio: String?
}
```

Prisma: `Profile` has `user_id` with `@unique`.

### One-to-Many

```isl
entity Todo {
  id: UUID [immutable, unique]
  user_id: UUID [indexed, references: User]
  title: String
}
```

Prisma: `Todo` has `user_id`; `User` has `Todo[] todos`.

### Many-to-Many (Join Table)

```isl
entity User {
  id: UUID [immutable, unique]
  name: String
}

entity Group {
  id: UUID [immutable, unique]
  name: String
}

entity UserGroup {
  id: UUID [immutable, unique]
  user_id: UUID [references: User]
  group_id: UUID [references: Group]
}
```

Prisma: Explicit join model `UserGroup` with `user_id` and `group_id`.

---

## Patterns

### Authentication Pattern

```isl
behavior LoginUser {
  actors { Anonymous { for: authentication } }
  input { email: String password: String }
  output {
    success: Session
    errors {
      INVALID_CREDENTIALS { when: "Bad credentials" retriable: true }
      ACCOUNT_LOCKED { when: "Account locked" retriable: false }
    }
  }
}

behavior CreateTodo {
  actors { User { must: authenticated } }
  input { title: String }
  output { success: Todo errors { UNAUTHORIZED { when: "Must login" } } }
}
```

### CRUD Pattern

```isl
behavior CreateTodo { input { ... } output { success: Todo errors { ... } } }
behavior ListTodos { input { status? } output { success: List<Todo> } }
behavior UpdateTodo { input { todo_id: UUID ... } output { success: Todo errors { NOT_FOUND } } }
behavior DeleteTodo { input { todo_id: UUID } output { success: Boolean errors { NOT_FOUND } } }

api {
  POST "/todos" -> CreateTodo { ... }
  GET "/todos" -> ListTodos { ... }
  PATCH "/todos/:id" -> UpdateTodo { ... }
  DELETE "/todos/:id" -> DeleteTodo { ... }
}
```

### Search + Pagination Pattern

```isl
behavior SearchTodos {
  input {
    q: String
    page: Int [default: 1]
    limit: Int [default: 20]
  }
  output { success: Paginated<Todo> }
}

api {
  GET "/todos/search" -> SearchTodos {
    params { q: String page: Int? limit: Int? }
    response: Paginated<Todo>
  }
}
```

### File Upload Pattern

```isl
entity File {
  id: UUID [immutable, unique]
  name: String
  size: Int
  mime_type: String
  url: String
  user_id: UUID [references: User]
}

behavior UploadFile {
  input {
    file: Binary
    name: String
    mime_type: String
  }
  output {
    success: File
    errors {
      TOO_LARGE { when: "File exceeds 10MB" }
      INVALID_TYPE { when: "File type not allowed" }
    }
  }
}
```

### Real-Time Pattern (WebSocket)

```isl
behavior SendMessage {
  input { room_id: UUID content: String }
  output { success: Message errors { ... } }
}

// WebSocket subscription implied by behavior; implementation in codegen
```

### Multi-Tenant Pattern

```isl
entity Tenant {
  id: UUID [immutable, unique]
  name: String
}

entity Todo {
  id: UUID [immutable, unique]
  tenant_id: UUID [indexed, references: Tenant]
  user_id: UUID [references: User]
  title: String
}

behavior CreateTodo {
  actors { User { must: authenticated, owns: tenant_id } }
  input { tenant_id: UUID title: String }
  output { success: Todo }
}
```

---

## CLI Reference

### Core Commands

| Command | Description | Example |
|---------|-------------|---------|
| `isl parse <file>` | Parse ISL and show AST | `isl parse specs/auth.isl` |
| `isl check [files...]` | Parse and type-check | `isl check specs/**/*.isl` |
| `isl gen <target> <file>` | Generate code | `isl gen ts auth.isl -o src/` |
| `isl generate [files...]` | Generate types/tests/docs | `isl generate -t -T specs/*.isl` |
| `isl verify [path]` | Verify code vs spec | `isl verify . --impl src/` |
| `isl init [name]` | Initialize project | `isl init my-app` |
| `isl vibe [prompt]` | NL → ISL → code → verify | `isl vibe "todo app with auth"` |

### Parse

```
isl parse <file>
  --fuzzy    Use fuzzy parser (AI-generated normalization)
```

### Check

```
isl check [files...]
  -w, --watch    Watch for changes
  --debug        Print resolved imports
```

### Gen (Code Generation)

```
isl gen <target> <file>
  -o, --output <dir>   Output directory
  --force              Overwrite existing files
  --ai                 Use AI for implementations
  --provider <p>        AI provider: anthropic, openai
  --model <m>          AI model override
  --include-tests      Include tests
  --include-validation Include validation logic
  --style <s>          functional, oop, hybrid

Targets: typescript, ts, python, graphql, openapi, etc.
```

### Generate (Legacy)

```
isl generate [files...]
  -t, --types     Generate TypeScript types
  -T, --tests     Generate test files
  -d, --docs      Generate documentation
  -o, --output    Output directory
  -w, --watch     Watch mode
  --force         Overwrite
```

### Verify

```
isl verify [path]
  --spec <file>         Spec file (legacy)
  -i, --impl <file>     Implementation file
  --proof <bundleDir>   Verify proof bundle
  --format <f>          json, text, gitlab, junit, github
  --fail-on <level>     error, warning, unspecced
  -t, --timeout <ms>    Test timeout (default: 30000)
  -s, --min-score <n>   Min trust score (default: 70)
  --smt                 Enable SMT verification
  --pbt                 Property-based testing
  --temporal            Temporal verification
  --reality             Reality probe (routes, env)
  --all                 Enable all verification modes
```

### Init

```
isl init [name]
  (creates project structure with specs/, src/, etc.)
```

### Vibe (Safe Vibe Coding)

```
isl vibe [prompt]
  -o, --output <dir>      Output directory
  --framework <fw>        nextjs, express, fastify (default: nextjs)
  --database <db>         postgres, sqlite, none (default: sqlite)
  --provider <p>          anthropic, openai
  --model <m>             AI model override
  --from-spec <file>      Skip NL→ISL, use existing spec
  --max-iterations <n>    Max heal iterations (default: 3)
  --dry-run               Plan + spec only, no files
  --no-frontend           Skip frontend
  --no-tests              Skip tests
  --no-cache              Force fresh generation
  --clear-cache           Wipe .isl-cache/
  --resume                Resume from checkpoint
```

### Build (Full Pipeline)

```
isl build <pattern>
  -o, --output <dir>        Output dir (default: ./generated)
  -t, --target <target>     typescript (default)
  --test-framework <fw>     vitest, jest
  --no-verify               Skip verification
  --no-html                 Skip HTML report
  --no-chaos                Skip chaos tests
```

### Format & Lint

```
isl fmt <file>
  --check      Check only, don't write
  --no-write   Print instead of writing

isl lint <file>
  --strict     Treat warnings as errors
```

### Gate & Trust Score

```
isl gate <spec>
  --impl <path>   Implementation path
  --min-score <n> Minimum trust score

isl gate:trust-score <spec>
isl trust-score explain <spec>
```

### Heal

```
isl heal <pattern>
  (Auto-fix spec/code violations)
```

### Watch

```
isl watch [files...]
  --gate          Run gate on changes
  --impl <path>   Implementation path
  --changed-only  Only changed files
```

### ShipGate

```
isl shipgate init
isl shipgate truthpack build
isl shipgate truthpack diff
isl shipgate simulate
isl shipgate verify runtime
isl shipgate domain init
isl shipgate domain validate
```

### Global Options

```
-v, --verbose    Verbose output
--format <f>     json, text (for machine-readable)
--config <path>  Config file path
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success (SHIP) |
| 1 | ISL/verification errors (NO-SHIP) |
| 2 | Usage errors |
| 3 | Internal errors |
