domain ChatWebSocket {
  version: "1.0.0"

  entity Channel {
    id: UUID [immutable, unique]
    name: String
    created_at: Timestamp
  }

  entity Message {
    id: UUID [immutable, unique]
    channel_id: UUID
    user_id: UUID
    content: String
    sent_at: Timestamp [immutable]
  }

  behavior SendMessage {
    input {
      channel_id: UUID
      content: String
    }
    output {
      success: Message
      errors {
        CHANNEL_NOT_FOUND { when: "Channel does not exist" retriable: false }
        RATE_LIMITED { when: "Too many messages" retriable: true retry_after: 1.seconds }
      }
    }
    preconditions {
      - input.content.length > 0
      - input.content.length <= 4096
    }
  }
}
