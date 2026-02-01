import { CodeBlock } from "@/components/CodeBlock";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata = {
  title: "Your First Spec - ISL Documentation",
  description: "Write and validate your first ISL specification.",
};

export default function FirstSpecPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-6 lg:px-8">
      <div className="prose prose-invert max-w-none">
        <h1>Your First Spec</h1>

        <p className="lead text-xl text-muted-foreground">
          Let&apos;s write a complete ISL specification for a simple todo application.
        </p>

        <h2>Create the Spec File</h2>

        <p>
          Create a new file called <code>todo.isl</code> in your <code>specs/</code> directory:
        </p>

        <CodeBlock
          code={`# Todo Application Domain
# Defines the behavioral contract for a simple todo app

domain TodoApp {
  version: "1.0.0"

  # Custom types with validation
  type TodoId = UUID { immutable: true }
  type Title = String { min_length: 1, max_length: 200 }
  type Description = String { max_length: 2000 }

  # Status enumeration
  enum TodoStatus {
    PENDING
    IN_PROGRESS
    COMPLETED
    ARCHIVED
  }

  # Main entity with invariants
  entity Todo {
    id: TodoId [immutable, unique]
    title: Title
    description: Description?
    status: TodoStatus [default: PENDING]
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    completed_at: Timestamp?

    # Rules that must always be true
    invariants {
      title.length > 0
      status == COMPLETED implies completed_at != null
      completed_at != null implies completed_at >= created_at
    }

    # Valid state transitions
    lifecycle {
      PENDING -> IN_PROGRESS
      PENDING -> COMPLETED
      IN_PROGRESS -> COMPLETED
      IN_PROGRESS -> PENDING
      COMPLETED -> ARCHIVED
    }
  }

  # Create a new todo
  behavior CreateTodo {
    description: "Create a new todo item"

    input {
      title: Title
      description: Description?
    }

    output {
      success: Todo
      errors {
        TITLE_EMPTY {
          when: "Title is empty or whitespace only"
          retriable: false
        }
      }
    }

    preconditions {
      input.title.trim().length > 0
    }

    postconditions {
      success implies {
        - Todo.exists(result.id)
        - result.title == input.title
        - result.status == PENDING
        - result.created_at == now()
      }
    }
  }

  # Mark a todo as completed
  behavior CompleteTodo {
    description: "Mark a todo as completed"

    input {
      todo_id: TodoId
    }

    output {
      success: Todo
      errors {
        NOT_FOUND {
          when: "Todo does not exist"
          retriable: false
        }
        ALREADY_COMPLETED {
          when: "Todo is already completed"
          retriable: false
        }
        INVALID_TRANSITION {
          when: "Cannot complete from current status"
          retriable: false
        }
      }
    }

    preconditions {
      Todo.exists(input.todo_id)
      Todo.lookup(input.todo_id).status != COMPLETED
      Todo.lookup(input.todo_id).status != ARCHIVED
    }

    postconditions {
      success implies {
        - Todo.lookup(input.todo_id).status == COMPLETED
        - Todo.lookup(input.todo_id).completed_at == now()
      }
    }
  }

  # List all todos with optional filtering
  behavior ListTodos {
    description: "List all todos with optional status filter"

    input {
      status_filter: TodoStatus?
      limit: Int { min: 1, max: 100 }?
      offset: Int { min: 0 }?
    }

    output {
      success: {
        items: List<Todo>
        total: Int
        has_more: Boolean
      }
    }

    postconditions {
      success implies {
        - result.items.length <= (input.limit ?? 50)
        - input.status_filter != null implies 
            result.items.all(t => t.status == input.status_filter)
      }
    }

    temporal {
      - within 100ms (p95): response returned
    }
  }
}`}
          language="isl"
          filename="specs/todo.isl"
          showLineNumbers
        />

        <h2>Validate the Spec</h2>

        <p>
          Use the <code>isl check</code> command to validate your specification:
        </p>

        <CodeBlock
          code={`$ isl check specs/todo.isl

Checking specs/todo.isl...

✓ Syntax valid
✓ Types resolved
✓ Invariants consistent
✓ Lifecycles valid
✓ Behaviors complete

Summary:
  Domain: TodoApp v1.0.0
  Types: 3
  Enums: 1
  Entities: 1
  Behaviors: 3

All checks passed!`}
          language="bash"
        />

        <h2>Understanding the Spec</h2>

        <h3>Types</h3>
        <p>
          Types define the shape of your data with built-in validation:
        </p>

        <CodeBlock
          code={`type Title = String { min_length: 1, max_length: 200 }`}
          language="isl"
        />

        <p>
          This creates a string type that must be between 1 and 200 characters.
        </p>

        <h3>Entities</h3>
        <p>
          Entities are your domain objects. They have fields, invariants 
          (rules that must always be true), and lifecycles (valid state transitions):
        </p>

        <CodeBlock
          code={`entity Todo {
  id: TodoId [immutable, unique]
  status: TodoStatus [default: PENDING]
  
  invariants {
    status == COMPLETED implies completed_at != null
  }
  
  lifecycle {
    PENDING -> COMPLETED
  }
}`}
          language="isl"
        />

        <h3>Behaviors</h3>
        <p>
          Behaviors define operations with explicit contracts:
        </p>

        <ul>
          <li><strong>Preconditions</strong>: What must be true before the operation</li>
          <li><strong>Postconditions</strong>: What must be true after the operation</li>
          <li><strong>Errors</strong>: Explicit error cases with descriptions</li>
        </ul>

        <h2>Common Patterns</h2>

        <h3>Optional Fields</h3>
        <CodeBlock
          code={`description: Description?  # The ? makes it optional`}
          language="isl"
        />

        <h3>Field Modifiers</h3>
        <CodeBlock
          code={`id: UUID [immutable, unique]  # Cannot change after creation, must be unique
email: String [indexed]       # Should be indexed for fast lookups
password: String [sensitive]  # Should not appear in logs`}
          language="isl"
        />

        <h3>Temporal Constraints</h3>
        <CodeBlock
          code={`temporal {
  - within 100ms (p95): response returned
  - eventually within 5s: event published
}`}
          language="isl"
        />

        <h2>Next Steps</h2>

        <div className="not-prose flex flex-col gap-3">
          <Link
            href="/docs/getting-started/generate"
            className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted transition-colors group"
          >
            <div>
              <div className="font-semibold group-hover:text-primary transition-colors">
                Code Generation
              </div>
              <div className="text-sm text-muted-foreground">
                Generate TypeScript types and tests from your spec
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
          <Link
            href="/docs/language/types"
            className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted transition-colors group"
          >
            <div>
              <div className="font-semibold group-hover:text-primary transition-colors">
                Type System
              </div>
              <div className="text-sm text-muted-foreground">
                Learn about all available types and constraints
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
        </div>
      </div>
    </div>
  );
}
