// Full-Stack ISL Specification Example
// Demonstrates all new language constructs for complete app generation

domain TaskManager {
  version: "1.0.0"
  owner: "IntentOS Team"

  // ─── ENTITIES ───────────────────────────────────────────────────────────────

  entity User {
    id: UUID [immutable, unique]
    email: String [unique, indexed]
    name: String
    role: String
    created_at: Timestamp [immutable]

    invariants {
      - email.contains("@")
      - name.length > 0
    }
  }

  entity Task {
    id: UUID [immutable, unique]
    title: String
    description: String?
    status: String
    priority: Int
    assignee_id: UUID [references: User]
    created_by: UUID [references: User]
    due_date: Timestamp?
    created_at: Timestamp [immutable]
    updated_at: Timestamp

    invariants {
      - title.length > 0
      - priority >= 1
      - priority <= 5
    }

    lifecycle {
      Todo -> InProgress -> Done
      InProgress -> Blocked -> InProgress
      Done -> Archived
    }
  }

  // ─── BEHAVIORS ──────────────────────────────────────────────────────────────

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
      assignee_id: UUID?
    }

    output {
      success: Task

      errors {
        INVALID_PRIORITY {
          when: "Priority must be between 1 and 5"
          retriable: false
        }
        ASSIGNEE_NOT_FOUND {
          when: "Assigned user does not exist"
          retriable: false
        }
      }
    }

    preconditions {
      - input.title.length > 0
      - input.priority >= 1
      - input.priority <= 5
    }

    postconditions {
      success implies {
        - Task.exists(result.id)
        - Task.title == input.title
      }
    }
  }

  behavior UpdateTaskStatus {
    description: "Update the status of a task"

    input {
      task_id: UUID
      status: String
    }

    output {
      success: Task

      errors {
        TASK_NOT_FOUND {
          when: "Task does not exist"
          retriable: false
        }
        INVALID_TRANSITION {
          when: "Status transition not allowed"
          retriable: false
        }
      }
    }
  }

  // ─── EVENTS ─────────────────────────────────────────────────────────────────

  event TaskCreated {
    task_id: UUID
    title: String
    created_by: UUID
    created_at: Timestamp
  }

  event TaskStatusChanged {
    task_id: UUID
    old_status: String
    new_status: String
    changed_by: UUID
  }

  handler TaskCreated -> SendNotification {
    NotificationService.send(event.created_by, event.title)
  }

  // ─── API ────────────────────────────────────────────────────────────────────

  api {
    base: "/api/v1"

    POST "/tasks" -> CreateTask {
      auth: authenticated
      body: CreateTask
      response: Task
    }

    GET "/tasks" {
      auth: authenticated
      params {
        status: String?
        assignee: UUID?
      }
      response: Task
    }

    PATCH "/tasks/:id/status" -> UpdateTaskStatus {
      auth: authenticated
      params {
        id: UUID
      }
    }

    GET "/tasks/:id" {
      auth: authenticated
      params {
        id: UUID
      }
      response: Task
    }

    DELETE "/tasks/:id" {
      auth: authenticated
    }
  }

  // ─── STORAGE ────────────────────────────────────────────────────────────────

  storage User {
    engine: "postgres"
    table: "users"
    indexes {
      unique email
    }
  }

  storage Task {
    engine: "postgres"
    table: "tasks"
    indexes {
      assignee_id
      status
      unique title
    }
  }

  // ─── WORKFLOWS ──────────────────────────────────────────────────────────────

  workflow TaskOnboarding {
    description: "Full task creation and assignment flow"

    step 1: CreateTask
    step 2: AssignTask {
      retry: 3
    }
    step 3: NotifyAssignee {
      timeout: 30s
    }

    on_failure: RollbackTask
    timeout: 60s
  }

  // ─── SCREENS ────────────────────────────────────────────────────────────────

  screen TaskList {
    description: "Main task list view"
    route: "/tasks"
    layout: Dashboard

    component TaskTable {
      type: list
      entity: Task
      fields {
        title: String [label: "Title"]
        status: String [label: "Status"]
        priority: Int [label: "Priority"]
      }
    }

    form CreateTaskForm -> CreateTask {
      title: String [required, label: "Task Title"]
      description: String [label: "Description"]
      priority: Int [required, label: "Priority"]
      submit: "Create Task"
    }

    navigation {
      "Dashboard" -> Dashboard
      "Settings" -> Settings
    }
  }

  // ─── CONFIG ─────────────────────────────────────────────────────────────────

  config {
    database_url: env("DATABASE_URL")
    jwt_secret: secret("JWT_SECRET")
    port: env("PORT") = 3000
    app_name: "TaskManager"
  }

  // ─── SCENARIOS ──────────────────────────────────────────────────────────────

  scenario "Create task with valid data" {
    given {
      Task.count == 0
    }
    when {
      CreateTask(title: "Test Task", priority: 3)
    }
    then {
      Task.count == 1
    }
  }
}
