domain ChatMessages {
  version: "1.0.0"

  entity Room {
    id: UUID [immutable, unique]
    name: String
  }

  entity ChatMessage {
    id: UUID [immutable, unique]
    room_id: UUID
    sender_id: UUID
    body: String
    created_at: Timestamp [immutable]
  }

  behavior CreateRoom {
    input {
      name: String
    }
    output {
      success: Room
    }
  }

  behavior GetMessages {
    input {
      room_id: UUID
      limit: Int?
      offset: Int?
    }
    output {
      success: List<ChatMessage>
    }
  }
}
