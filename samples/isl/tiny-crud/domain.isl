# Tiny CRUD — Canonical Sample
# Minimal entity with full Create/Read/Update/Delete behaviors
# Covers: pre/post conditions, error handling, idempotent reads

domain TinyCrud {
  version: "1.0.0"

  enum TodoStatus {
    OPEN
    DONE
    ARCHIVED
  }

  entity Todo {
    id: UUID [immutable, unique]
    title: String { min_length: 1, max_length: 255 }
    status: TodoStatus [default: OPEN, indexed]
    created_at: Timestamp [immutable]
    updated_at: Timestamp

    invariants {
      title.length >= 1
      updated_at >= created_at
    }
  }

  behavior CreateTodo {
    description: "Create a new todo item"

    input {
      title: String
    }

    output {
      success: Todo
      errors {
        TITLE_EMPTY {
          when: "Title is blank or whitespace-only"
          retriable: true
        }
        TITLE_TOO_LONG {
          when: "Title exceeds 255 characters"
          retriable: true
        }
      }
    }

    pre {
      title.trim().length >= 1
      title.length <= 255
    }

    post success {
      - Todo.exists(result.id)
      - result.title == input.title.trim()
      - result.status == OPEN
      - result.created_at == now()
    }
  }

  behavior GetTodo {
    description: "Retrieve a todo by ID"

    input {
      id: UUID
    }

    output {
      success: Todo
      errors {
        NOT_FOUND {
          when: "No todo with this ID exists"
          retriable: false
        }
      }
    }

    pre {
      id.is_valid
    }

    post success {
      - result.id == input.id
    }
  }

  behavior UpdateTodo {
    description: "Update a todo title or status"

    input {
      id: UUID
      title: String?
      status: TodoStatus?
    }

    output {
      success: Todo
      errors {
        NOT_FOUND {
          when: "No todo with this ID exists"
          retriable: false
        }
        TITLE_EMPTY {
          when: "Title is blank or whitespace-only"
          retriable: true
        }
        INVALID_TRANSITION {
          when: "Cannot transition from ARCHIVED to OPEN"
          retriable: false
        }
      }
    }

    pre {
      Todo.exists(id)
      title == null or title.trim().length >= 1
    }

    post success {
      - result.id == input.id
      - input.title != null implies result.title == input.title.trim()
      - input.status != null implies result.status == input.status
      - result.updated_at >= old(Todo.lookup(id).updated_at)
    }

    invariants {
      - ARCHIVED status is terminal: no transition from ARCHIVED to OPEN
    }
  }

  behavior DeleteTodo {
    description: "Permanently delete a todo"

    input {
      id: UUID
    }

    output {
      success: Boolean
      errors {
        NOT_FOUND {
          when: "No todo with this ID exists"
          retriable: false
        }
      }
    }

    pre {
      Todo.exists(id)
    }

    post success {
      - not Todo.exists(input.id)
    }
  }

  behavior ListTodos {
    description: "List todos with optional status filter"

    input {
      status: TodoStatus?
      limit: Int [default: 50]
      offset: Int [default: 0]
    }

    output {
      success: {
        items: List<Todo>
        total: Int
      }
    }

    pre {
      limit > 0
      limit <= 100
      offset >= 0
    }

    post success {
      - result.items.length <= input.limit
      - input.status != null implies result.items.all(t => t.status == input.status)
    }
  }

  scenario "Full CRUD lifecycle" {
    step create = CreateTodo({ title: "Buy milk" })
    assert create.success
    assert create.result.status == OPEN

    step read = GetTodo({ id: create.result.id })
    assert read.result.title == "Buy milk"

    step update = UpdateTodo({ id: create.result.id, status: DONE })
    assert update.result.status == DONE

    step delete = DeleteTodo({ id: create.result.id })
    assert delete.success

    step verify = GetTodo({ id: create.result.id })
    assert verify.error == NOT_FOUND
  }
}
