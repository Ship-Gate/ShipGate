// Todo App with Auth — Full-Stack ISL Specification
// Demo spec for Safe Vibe Coding (isl vibe --from-spec specs/todo-app-with-auth.isl)

domain TodoApp {
  version: "1.0.0"
  owner: "IntentOS Demo"

  // ─── ENTITIES ────────────────────────────────────────────────────────────────

  entity User {
    id: UUID [immutable, unique]
    email: String [unique, indexed]
    password_hash: String
    name: String
    created_at: Timestamp [immutable]
    updated_at: Timestamp

    invariants {
      - email.contains("@")
      - name.length > 0
    }
  }

  entity Todo {
    id: UUID [immutable, unique]
    title: String
    description: String?
    completed: Boolean
    priority: Int
    due_date: Timestamp?
    user_id: UUID [references: User]
    created_at: Timestamp [immutable]
    updated_at: Timestamp

    invariants {
      - title.length > 0
      - priority >= 1
      - priority <= 3
    }

    lifecycle {
      Pending -> InProgress -> Done
      InProgress -> Blocked -> InProgress
      Done -> Archived
    }
  }

  // ─── BEHAVIORS ───────────────────────────────────────────────────────────────

  behavior RegisterUser {
    description: "Register a new user account"

    input {
      email: String
      password: String
      name: String
    }

    output {
      success: User

      errors {
        EMAIL_TAKEN {
          when: "Email address is already registered"
          retriable: false
        }
        INVALID_EMAIL {
          when: "Email format is invalid"
          retriable: false
        }
        WEAK_PASSWORD {
          when: "Password must be at least 8 characters"
          retriable: true
        }
      }
    }

    preconditions {
      - input.email.contains("@")
      - input.password.length >= 8
      - input.name.length > 0
    }

    postconditions {
      success implies {
        - User.exists(result.id)
        - User.email == input.email
        - User.name == input.name
      }
    }
  }

  behavior LoginUser {
    description: "Authenticate a user and return a token"

    input {
      email: String
      password: String
    }

    output {
      success: User

      errors {
        INVALID_CREDENTIALS {
          when: "Email or password is incorrect"
          retriable: true
        }
        ACCOUNT_LOCKED {
          when: "Account is temporarily locked"
          retriable: false
        }
      }
    }

    preconditions {
      - input.email.contains("@")
      - input.password.length > 0
    }
  }

  behavior CreateTodo {
    description: "Create a new todo item"

    actors {
      User {
        must: authenticated
      }
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
        UNAUTHORIZED {
          when: "User must be authenticated"
          retriable: false
        }
        INVALID_TITLE {
          when: "Title cannot be empty"
          retriable: true
        }
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
        - Todo.title == input.title
        - Todo.completed == false
      }
    }
  }

  behavior ListTodos {
    description: "List todos for the current user"

    actors {
      User {
        must: authenticated
      }
    }

    input {
      status: String?
      priority: Int?
    }

    output {
      success: Todo

      errors {
        UNAUTHORIZED {
          when: "User must be authenticated"
          retriable: false
        }
      }
    }
  }

  behavior UpdateTodo {
    description: "Update an existing todo item"

    actors {
      User {
        must: authenticated
      }
    }

    input {
      todo_id: UUID
      title: String?
      description: String?
      completed: Boolean?
      priority: Int?
    }

    output {
      success: Todo

      errors {
        NOT_FOUND {
          when: "Todo not found"
          retriable: false
        }
        FORBIDDEN {
          when: "Cannot update another user's todo"
          retriable: false
        }
      }
    }

    preconditions {
      - Todo.exists(input.todo_id)
    }

    postconditions {
      success implies {
        - Todo.exists(result.id)
      }
    }
  }

  behavior DeleteTodo {
    description: "Delete a todo item"

    actors {
      User {
        must: authenticated
      }
    }

    input {
      todo_id: UUID
    }

    output {
      success: Todo

      errors {
        NOT_FOUND {
          when: "Todo not found"
          retriable: false
        }
        FORBIDDEN {
          when: "Cannot delete another user's todo"
          retriable: false
        }
      }
    }

    preconditions {
      - Todo.exists(input.todo_id)
    }
  }

  // ─── EVENTS ──────────────────────────────────────────────────────────────────

  event UserRegistered {
    user_id: UUID
    email: String
    registered_at: Timestamp
  }

  event TodoCompleted {
    todo_id: UUID
    user_id: UUID
    completed_at: Timestamp
  }

  handler UserRegistered -> SendWelcomeEmail {
    EmailService.send(event.email, "Welcome!")
  }

  // ─── API ─────────────────────────────────────────────────────────────────────

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

    GET "/todos" {
      auth: authenticated
      params {
        status: String?
        priority: Int?
      }
      response: Todo
    }

    PATCH "/todos/:id" -> UpdateTodo {
      auth: authenticated
      params {
        id: UUID
      }
      response: Todo
    }

    DELETE "/todos/:id" -> DeleteTodo {
      auth: authenticated
      params {
        id: UUID
      }
    }
  }

  // ─── STORAGE ─────────────────────────────────────────────────────────────────

  storage User {
    engine: "sqlite"
    table: "users"
    indexes {
      unique email
    }
  }

  storage Todo {
    engine: "sqlite"
    table: "todos"
    indexes {
      user_id
      completed
      priority
    }
  }

  // ─── SCREENS ─────────────────────────────────────────────────────────────────

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
  }

  screen LoginScreen {
    description: "User login page"
    route: "/login"
    layout: Auth

    form LoginForm -> LoginUser {
      email: String [required, label: "Email"]
      password: String [required, label: "Password"]
      submit: "Sign In"
    }
  }

  screen RegisterScreen {
    description: "User registration page"
    route: "/register"
    layout: Auth

    form RegisterForm -> RegisterUser {
      name: String [required, label: "Name"]
      email: String [required, label: "Email"]
      password: String [required, label: "Password"]
      submit: "Create Account"
    }
  }

  // ─── CONFIG ──────────────────────────────────────────────────────────────────

  config {
    database_url: env("DATABASE_URL")
    jwt_secret: secret("JWT_SECRET")
    port: env("PORT") = 3000
    app_name: "TodoApp"
  }

  // ─── SCENARIOS ───────────────────────────────────────────────────────────────

  scenario "Register and create todo" {
    given {
      User.count == 0
    }
    when {
      RegisterUser(email: "test@example.com", password: "secure123", name: "Test User")
    }
    then {
      User.count == 1
    }
  }

  scenario "Create todo with valid data" {
    given {
      Todo.count == 0
    }
    when {
      CreateTodo(title: "Buy groceries", priority: 2)
    }
    then {
      Todo.count == 1
    }
  }
}
