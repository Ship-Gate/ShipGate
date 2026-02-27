domain TodoApp version "1.0.0"

// Generated from: "A todo app where users can register and log in. Each user has their own todo lists. Todos have a title, description, due date, priority (low/medium/high), and completed status. Users can create, edit, delete, and reorder todos. There's a dashboard showing overdue todos, today's todos, and upcoming todos. Users can filter by priority and search by title."
// Confidence: 85%
// Timestamp: 2026-02-14T07:45:02.481Z

entity User {
  id: UUID
  email: Email
  username: String
  password: String
  invariant email contains @
  invariant password never stored plain
}

entity Todo {
  id: UUID
  title: String
  description?: String
  dueDate?: DateTime
  priority: String
  completed: Boolean
  order?: Int
  userId: UUID
  invariant title length > 0
  invariant priority in [low,medium,high]
}

behavior RegisterUser {
  // Register a new user account

  input {
    email: Email
    username: String
    password: String
  }

  output {
    success: User
    errors {
      DuplicateEmail when "email already registered"
      InvalidUsername when "username too short"
    }
  }

  // Intent declarations
  @intent rate-limit-required
  @intent audit-required
  @intent no-pii-logging

  pre email valid
  pre username length >= 3

  post success {
    user created
  }
  post success {
    password hashed
  }

  invariant password never logged

}

behavior LoginUser {
  // Log in with email and password

  input {
    email: Email
    password: String
  }

  output {
    success: AuthToken
    errors {
      InvalidCredentials when "email or password wrong"
    }
  }

  // Intent declarations
  @intent rate-limit-required
  @intent audit-required
  @intent no-pii-logging

  pre rate limit not exceeded

  post success {
    token issued
  }
  post success {
    login recorded
  }

  invariant password never logged

}

behavior CreateTodo {
  // Create a new todo

  input {
    title: String
    description?: String
    dueDate?: DateTime
    priority?: String
  }

  output {
    success: Todo
    errors {
      ValidationError when "invalid input"
    }
  }

  // Intent declarations
  @intent auth-required
  @intent audit-required

  pre user authenticated
  pre title length > 0

  post success {
    todo created
  }
  post success {
    todo belongs to user
  }

}

behavior UpdateTodo {
  // Edit an existing todo

  input {
    id: UUID
    title?: String
    description?: String
    dueDate?: DateTime
    priority?: String
    completed?: Boolean
  }

  output {
    success: Todo
    errors {
      NotFound when "todo does not exist"
      Forbidden when "user does not own todo"
    }
  }

  // Intent declarations
  @intent auth-required
  @intent audit-required

  pre user authenticated
  pre user owns todo

  post success {
    todo updated
  }

}

behavior DeleteTodo {
  // Delete a todo

  input {
    id: UUID
  }

  output {
    success: Void
    errors {
      NotFound when "todo does not exist"
      Forbidden when "user does not own todo"
    }
  }

  // Intent declarations
  @intent auth-required
  @intent audit-required

  pre user authenticated
  pre user owns todo

  post success {
    todo deleted
  }

}

behavior ReorderTodos {
  // Reorder todos

  input {
    todoIds: List<UUID>
  }

  output {
    success: Void
    errors {
      ValidationError when "invalid order"
    }
  }

  // Intent declarations
  @intent auth-required
  @intent audit-required

  pre user authenticated
  pre user owns all todos

  post success {
    order updated
  }

}
