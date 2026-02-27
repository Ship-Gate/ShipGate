domain TaskManagement {
  version: "1.0.0"
  owner: "Task Management Team"

  entity User {
    id: UUID [immutable, unique]
    email: String [unique, indexed]
    username: String
    password: String
    created_at: Timestamp [immutable]

    invariants {
      - email.contains("@")
      - username.length >= 3
    }
  }

  entity Task {
    id: UUID [immutable, unique]
    title: String
    description: String?
    status: String
    priority: Int
    assignee_id: UUID [references: User]
    created_at: Timestamp [immutable]
    updated_at: Timestamp

    invariants {
      - title.length > 0
      - priority >= 1
      - priority <= 5
    }

    lifecycle {
      Todo -> InProgress -> Done
      Done -> Archived
    }
  }

  behavior CreateTask {
    description: "Create a new task"

    actors {
      User {
        must: authenticated
      }
    }

    input {
      title: String
      description: String?
      priority: Int
    }

    output {
      success: Task

      errors {
        INVALID_PRIORITY {
          when: "Priority must be between 1 and 5"
          retriable: false
        }
      }
    }

    preconditions {
      - input.title.length > 0
      - input.priority >= 1
    }

    postconditions {
      success implies {
        - Task.exists(result.id)
        - Task.title == input.title
      }
    }
  }

  behavior RegisterUser {
    description: "Register a new user"

    input {
      email: String
      username: String
      password: String
    }

    output {
      success: User

      errors {
        DUPLICATE_EMAIL {
          when: "Email already registered"
          retriable: false
        }
        INVALID_USERNAME {
          when: "Username is too short"
          retriable: false
        }
      }
    }

    preconditions {
      - input.email.contains("@")
      - input.username.length >= 3
    }

    postconditions {
      success implies {
        - User.exists(result.id)
        - User.email == input.email
      }
    }
  }

  event TaskCreated {
    task_id: UUID
    title: String
    created_by: UUID
  }

  handler TaskCreated -> NotifyAssignee {
    NotificationService.notify(event.created_by, event.title)
  }

  api {
    base: "/api/v1"

    POST "/tasks" -> CreateTask {
      auth: authenticated
      body: CreateTask
      response: Task
    }

    POST "/users/register" -> RegisterUser {
      body: RegisterUser
      response: User
    }

    GET "/tasks" {
      auth: authenticated
      params {
        status: String?
      }
      response: Task
    }
  }

  storage User {
    engine: "sqlite"
    table: "users"
    indexes {
      unique email
      username
    }
  }

  storage Task {
    engine: "sqlite"
    table: "tasks"
    indexes {
      assignee_id
      status
    }
  }

  screen TaskList {
    description: "List of tasks"
    route: "/tasks"
    layout: list

    component TaskListComponent {
      type: list
      entity: Task
      fields {
        title: String [label: "Title"]
        status: String [label: "Status"]
      }
    }

    navigation {
      "Create Task" -> TaskCreate
    }
  }

  screen TaskCreate {
    description: "Create a new task"
    route: "/tasks/create"
    layout: form

    form TaskForm -> CreateTask {
      title: String [required, label: "Title"]
      description: String [label: "Description"]
      priority: Int [required, label: "Priority"]
      submit: "Create Task"
    }

    navigation {
      "Back to Tasks" -> TaskList
    }
  }

  config {
    database_url: env("DATABASE_URL")
    jwt_secret: secret("JWT_SECRET")
    port: env("PORT") = 3000
  }

  workflow TaskCreation {
    description: "Process of creating a task"
    step 1: ValidateInput
    step 2: SaveTask {
      retry: 3
      timeout: 10s
    }
    on_failure: NotifyAdmin
    timeout: 30s
  }

  scenario "Create task successfully" {
    given {
      Task.count == 0
    }
    when {
      CreateTask(title: "New Task", priority: 3)
    }
    then {
      Task.count == 1
    }
  }
}