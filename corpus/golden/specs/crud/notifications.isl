// CRUD: Notifications
domain CRUDNotifications {
  version: "1.0.0"

  enum NotificationType {
    INFO
    SUCCESS
    WARNING
    ERROR
    SYSTEM
  }

  enum NotificationChannel {
    IN_APP
    EMAIL
    PUSH
    SMS
  }

  entity Notification {
    id: UUID [immutable, unique]
    user_id: UUID [indexed]
    type: NotificationType
    channel: NotificationChannel
    title: String
    body: String
    data: Map<String, String>?
    action_url: String?
    read: Boolean [default: false]
    read_at: Timestamp?
    sent_at: Timestamp?
    created_at: Timestamp [immutable]

    invariants {
      title.length > 0
      read implies read_at != null
    }
  }

  entity NotificationPreference {
    id: UUID [immutable, unique]
    user_id: UUID [indexed]
    notification_type: String
    channel: NotificationChannel
    enabled: Boolean [default: true]
    created_at: Timestamp [immutable]
    updated_at: Timestamp
  }

  behavior CreateNotification {
    description: "Create a notification"

    actors {
      System { }
      Admin { must: authenticated }
    }

    input {
      user_id: UUID
      type: NotificationType
      channel: NotificationChannel
      title: String
      body: String
      data: Map<String, String>?
      action_url: String?
      send_immediately: Boolean?
    }

    output {
      success: Notification

      errors {
        USER_NOT_FOUND {
          when: "User not found"
          retriable: false
        }
        CHANNEL_DISABLED {
          when: "User disabled this channel"
          retriable: false
        }
        RATE_LIMITED {
          when: "Too many notifications"
          retriable: true
          retry_after: 1m
        }
      }
    }

    pre {
      input.title.length > 0
      input.body.length > 0
    }

    post success {
      - Notification.exists(result.id)
      - result.user_id == input.user_id
      - result.read == false
    }

    temporal {
      - input.send_immediately == true implies eventually within 30s: notification delivered
    }
  }

  behavior GetNotification {
    description: "Get notification"

    actors {
      User { must: authenticated }
    }

    input {
      notification_id: UUID
    }

    output {
      success: Notification

      errors {
        NOT_FOUND {
          when: "Notification not found"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Not authorized"
          retriable: false
        }
      }
    }

    pre {
      Notification.exists(input.notification_id)
      Notification.lookup(input.notification_id).user_id == actor.id
    }
  }

  behavior MarkAsRead {
    description: "Mark notification as read"

    actors {
      User { must: authenticated }
    }

    input {
      notification_id: UUID
    }

    output {
      success: Notification

      errors {
        NOT_FOUND {
          when: "Notification not found"
          retriable: false
        }
        ALREADY_READ {
          when: "Already read"
          retriable: false
        }
      }
    }

    pre {
      Notification.exists(input.notification_id)
      Notification.lookup(input.notification_id).user_id == actor.id
    }

    post success {
      - result.read == true
      - result.read_at != null
    }
  }

  behavior MarkAllAsRead {
    description: "Mark all notifications as read"

    actors {
      User { must: authenticated }
    }

    input {
      before: Timestamp?
      type: NotificationType?
    }

    output {
      success: { count: Int }
    }

    post success {
      - all(n in Notification.where(user_id: actor.id, read: false): n.read == true)
    }
  }

  behavior DeleteNotification {
    description: "Delete a notification"

    actors {
      User { must: authenticated }
    }

    input {
      notification_id: UUID
    }

    output {
      success: Boolean

      errors {
        NOT_FOUND {
          when: "Notification not found"
          retriable: false
        }
      }
    }

    pre {
      Notification.exists(input.notification_id)
      Notification.lookup(input.notification_id).user_id == actor.id
    }

    post success {
      - not Notification.exists(input.notification_id)
    }
  }

  behavior ListNotifications {
    description: "List user notifications"

    actors {
      User { must: authenticated }
    }

    input {
      type: NotificationType?
      channel: NotificationChannel?
      read: Boolean?
      page: Int?
      page_size: Int?
    }

    output {
      success: {
        notifications: List<Notification>
        unread_count: Int
        total_count: Int
        has_more: Boolean
      }
    }

    post success {
      - all(n in result.notifications: n.user_id == actor.id)
    }
  }

  behavior UpdatePreferences {
    description: "Update notification preferences"

    actors {
      User { must: authenticated }
    }

    input {
      preferences: List<{
        notification_type: String
        channel: NotificationChannel
        enabled: Boolean
      }>
    }

    output {
      success: List<NotificationPreference>
    }

    post success {
      - result.length == input.preferences.length
    }
  }

  scenarios CreateNotification {
    scenario "create in-app notification" {
      when {
        result = CreateNotification(
          user_id: "user-123",
          type: INFO,
          channel: IN_APP,
          title: "New Message",
          body: "You have a new message",
          send_immediately: true
        )
      }

      then {
        result is success
        result.read == false
      }
    }
  }
}
