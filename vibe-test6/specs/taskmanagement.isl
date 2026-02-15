domain TaskManagement {
  version: "1.0.0"
  owner: "TaskManagementTeam"

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
      assignee_id: UUID
    }

    output {
      success: Task

      errors {
        INVALID_PRIORITY {
          when: "Priority must be between 1 and 5"
          retriable: false
        }
        USER_NOT_FOUND {
          when: "Assignee user does not exist"
          retriable: false
        }
      }
    }

    preconditions {
      - input.title.length > 0
      - input.priority >= 1
      - User.exists(input.assignee_id)
    }

    postconditions {
      success implies {
        - Task.exists(result.id)
        - Task.title == input.title
      }
    }
  }

  event TaskCreated {
    task_id: UUID
    title: String
    created_by: UUID
  }

  handler TaskCreated -> SendNotification {
    NotificationService.send(event.created_by, event.title)
  }

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
      }
      response: Task
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
    description: "Task List Screen"
    route: "/tasks"
    layout: list

    component TaskList {
      type: list
      entity: Task
      fields {
        title: String [label: "Title"]
        status: String [label: "Status"]
        priority: Int [label: "Priority"]
      }
    }

    navigation {
      "Create Task" -> TaskCreate
    }
  }

  screen TaskCreate {
    description: "Task Creation Screen"
    route: "/tasks/create"
    layout: form

    form TaskForm -> CreateTask {
      title: String [required, label: "Title"]
      description: String [label: "Description"]
      priority: Int [required, label: "Priority"]
      assignee_id: UUID [required, label: "Assignee"]
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
    description: "Task creation process"
    step 1: ValidateInput
    step 2: PersistTask {
      retry: 3
      timeout: 10s
    }
    on_failure: NotifyFailure
    timeout: 30s
  }

  scenario "Create task successfully" {
    given {
      Task.count == 0
    }
    when {
      CreateTask(title: "New Task", priority: 3, assignee_id: someUserId)
    }
    then {
      Task.count == 1
    }
  }
}