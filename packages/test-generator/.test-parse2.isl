# Tiny CRUD
domain TinyCrud {
  version: "1.0.0"

  enum TodoStatus {
    OPEN
    DONE
    ARCHIVED
  }

  entity Todo {
    id: UUID [immutable, unique]
    title: String { min_length: 1 max_length: 255 }
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
}
