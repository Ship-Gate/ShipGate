# ISL Quickstart Guide

Get from intent to verified code in 5 minutes.

## Installation

```bash
npm install -g @intentos/isl-cli
```

## Step 1: Write Your Specification

Create a file called `todo.isl`:

```isl
domain Todo {
  version: "1.0.0"
  
  entity Task {
    id: UUID [immutable, unique]
    title: String { max_length: 255 }
    completed: Boolean
    created_at: Timestamp [immutable]
  }
  
  behavior CreateTask {
    description: "Create a new task"
    
    input {
      title: String { max_length: 255 }
    }
    
    output {
      success: Task
      errors {
        INVALID_TITLE { when: "Title is empty or too long" }
      }
    }
    
    preconditions {
      input.title.length > 0
      input.title.length <= 255
    }
    
    postconditions {
      success implies {
        Task.exists(result.id)
        result.title == input.title
        result.completed == false
      }
    }
  }
  
  behavior CompleteTask {
    description: "Mark a task as completed"
    
    input {
      task_id: UUID
    }
    
    output {
      success: Task
      errors {
        NOT_FOUND { when: "Task does not exist" }
        ALREADY_COMPLETED { when: "Task is already completed" }
      }
    }
    
    preconditions {
      Task.exists(id: input.task_id)
    }
    
    postconditions {
      success implies {
        result.completed == true
        result.id == input.task_id
      }
    }
  }
}
```

## Step 2: Check Syntax

```bash
isl check todo.isl
```

Output:

```
✓ Parsing successful
✓ 1 domain, 1 entity, 2 behaviors
✓ No errors found
```

## Step 3: Generate Code

```bash
isl generate todo.isl --target typescript --output ./src
```

This generates:

```
src/
├── todo.types.ts      # TypeScript interfaces
├── todo.spec.ts       # Generated tests
└── todo.impl.ts       # Implementation skeleton (if requested)
```

Generated types (`todo.types.ts`):

```typescript
export interface Task {
  id: string;
  title: string;
  completed: boolean;
  created_at: Date;
}

export interface CreateTaskInput {
  title: string;
}

export type CreateTaskError = 'INVALID_TITLE';

export type CreateTaskResult =
  | { success: true; data: Task }
  | { success: false; error: { code: CreateTaskError; message: string } };

export interface CompleteTaskInput {
  task_id: string;
}

export type CompleteTaskError = 'NOT_FOUND' | 'ALREADY_COMPLETED';

export type CompleteTaskResult =
  | { success: true; data: Task }
  | { success: false; error: { code: CompleteTaskError; message: string } };
```

## Step 4: Write Implementation

Create `src/todo.impl.ts`:

```typescript
import type {
  Task,
  CreateTaskInput,
  CreateTaskResult,
  CompleteTaskInput,
  CompleteTaskResult,
} from './todo.types';

// In-memory store (replace with real database)
const tasks = new Map<string, Task>();

export async function createTask(input: CreateTaskInput): Promise<CreateTaskResult> {
  // Validate preconditions
  if (!input.title || input.title.length === 0 || input.title.length > 255) {
    return {
      success: false,
      error: { code: 'INVALID_TITLE', message: 'Title must be 1-255 characters' },
    };
  }

  // Create task
  const task: Task = {
    id: crypto.randomUUID(),
    title: input.title,
    completed: false,
    created_at: new Date(),
  };

  tasks.set(task.id, task);

  return { success: true, data: task };
}

export async function completeTask(input: CompleteTaskInput): Promise<CompleteTaskResult> {
  const task = tasks.get(input.task_id);

  if (!task) {
    return {
      success: false,
      error: { code: 'NOT_FOUND', message: 'Task not found' },
    };
  }

  if (task.completed) {
    return {
      success: false,
      error: { code: 'ALREADY_COMPLETED', message: 'Task already completed' },
    };
  }

  const updated = { ...task, completed: true };
  tasks.set(task.id, updated);

  return { success: true, data: updated };
}
```

## Step 5: Verify

```bash
isl verify todo.isl --impl ./src/todo.impl.ts
```

Output:

```
┌─────────────────────────────────────────────────────────────────┐
│                     VERIFICATION RESULTS                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Trust Score: 87/100  ✓                                          │
│                                                                  │
│  Breakdown:                                                      │
│    Postconditions:  ████████░░  80%  (4/5 passed)               │
│    Invariants:      ██████████  100% (2/2 passed)               │
│    Scenarios:       █████████░  90%  (9/10 passed)              │
│    Temporal:        ██████████  100% (1/1 passed)               │
│                                                                  │
│  Recommendation: STAGING_RECOMMENDED                             │
│                                                                  │
│  Issues:                                                         │
│    ⚠ postcondition "Task.exists(result.id)" - partial           │
│      The entity proxy binding couldn't fully verify existence.   │
│      This is a limitation of the current test runtime.           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Understanding the Output

### Trust Score

The trust score (0-100) is a weighted average:

| Category | Weight | What It Tests |
|----------|--------|---------------|
| Postconditions | 40% | "After success, X is true" |
| Invariants | 30% | "X is always true" |
| Scenarios | 20% | Happy path + error cases |
| Temporal | 10% | Response time constraints |

### Recommendations

| Score | Failures | Recommendation |
|-------|----------|----------------|
| ≥95 | 0 | `PRODUCTION_READY` |
| ≥85 | 0 | `STAGING_RECOMMENDED` |
| ≥70 | ≤2 | `SHADOW_MODE` |
| <70 | any | `NOT_READY` |

### What "Verified" Actually Means

**Important**: ISL verification runs **tests**, not formal proofs.

When we say a postcondition is "verified," we mean:

- Generated tests **passed** when run against your implementation
- The test inputs covered the cases we could generate
- Edge cases were tested based on error definitions

We do **not** mean:

- Mathematical proof that the postcondition always holds
- Exhaustive testing of all possible inputs
- Symbolic execution or model checking

See [Evidence & Proof](./evidence-and-proof.md) for details on what ISL can and cannot prove.

## Next Steps

1. **Add more behaviors** - Define all your domain operations
2. **Use stdlib** - Import common patterns from `@intentos/stdlib-*`
3. **CI integration** - Run `isl verify` in your CI pipeline
4. **Pro features** - Unlock deeper verification with [Pro tier](./pro-tier.md)

## CLI Reference

```bash
# Check ISL syntax
isl check <spec.isl>

# Generate code
isl generate <spec.isl> --target typescript --output ./src

# Verify implementation
isl verify <spec.isl> --impl <path> [--verbose]

# Format specification
isl fmt <spec.isl>

# Parse and dump AST (debugging)
isl parse <spec.isl> --json

# Interactive REPL
isl repl
```
