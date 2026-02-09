# Realtime WebSocket — Canonical Sample
# Chat rooms with presence, message ordering, and connection lifecycle
# Covers: pre/post, invariants, temporal, scenarios

domain RealtimeWebsocket {
  version: "1.0.0"

  enum ConnectionState {
    CONNECTING
    CONNECTED
    DISCONNECTED
    RECONNECTING
  }

  enum MessageType {
    TEXT
    SYSTEM
    TYPING_INDICATOR
    PRESENCE
  }

  entity Room {
    id: UUID [immutable, unique]
    name: String { min_length: 1, max_length: 100 }
    max_members: Int [default: 100]
    created_at: Timestamp [immutable]

    invariants {
      max_members >= 2
      max_members <= 10000
    }
  }

  entity Connection {
    id: UUID [immutable, unique]
    user_id: UUID [indexed]
    room_id: UUID [indexed]
    state: ConnectionState [default: CONNECTING]
    last_heartbeat: Timestamp
    connected_at: Timestamp?
    disconnected_at: Timestamp?

    invariants {
      state == CONNECTED implies connected_at != null
      state == DISCONNECTED implies disconnected_at != null
      (user_id, room_id) is unique when state != DISCONNECTED
    }
  }

  entity Message {
    id: UUID [immutable, unique]
    room_id: UUID [immutable, indexed]
    sender_id: UUID [immutable, indexed]
    type: MessageType [default: TEXT]
    content: String { max_length: 4096 }
    sequence: Int [immutable]
    created_at: Timestamp [immutable]

    invariants {
      sequence is monotonically increasing per room_id
      content.length >= 1 or type != TEXT
    }
  }

  behavior JoinRoom {
    description: "Connect a user to a chat room"

    input {
      user_id: UUID
      room_id: UUID
    }

    output {
      success: Connection
      errors {
        ROOM_NOT_FOUND {
          when: "Room does not exist"
          retriable: false
        }
        ROOM_FULL {
          when: "Room has reached max_members"
          retriable: true
          retry_after: 5s
        }
        ALREADY_CONNECTED {
          when: "User already has an active connection to this room"
          retriable: false
        }
      }
    }

    pre {
      Room.exists(room_id)
      Connection.active_count_for(room_id) < Room.lookup(room_id).max_members
      not Connection.active_exists(user_id, room_id)
    }

    post success {
      - result.state == CONNECTED
      - result.connected_at == now()
      - Connection.active_count_for(room_id) == old(count) + 1
    }

    invariants {
      - join broadcasts a PRESENCE message to all room members
    }

    temporal {
      within 500ms (p99): connection established
    }
  }

  behavior SendMessage {
    description: "Send a message to a room"

    input {
      connection_id: UUID
      content: String
      type: MessageType?
    }

    output {
      success: Message
      errors {
        NOT_CONNECTED {
          when: "Connection is not in CONNECTED state"
          retriable: false
        }
        CONTENT_TOO_LONG {
          when: "Message exceeds 4096 characters"
          retriable: true
        }
        RATE_LIMITED {
          when: "Too many messages sent too quickly"
          retriable: true
          retry_after: 1s
        }
      }
    }

    pre {
      Connection.exists(connection_id)
      Connection.lookup(connection_id).state == CONNECTED
      content.length >= 1
      content.length <= 4096
    }

    post success {
      - Message.exists(result.id)
      - result.room_id == Connection.lookup(connection_id).room_id
      - result.sender_id == Connection.lookup(connection_id).user_id
      - result.sequence > old(Message.max_sequence_for(result.room_id))
    }

    invariants {
      - messages delivered to all CONNECTED members in room
      - message ordering is consistent across all recipients
      - sequence numbers are gap-free per room
    }

    temporal {
      within 100ms (p99): message delivered to all connected clients
    }

    security {
      rate_limit 30 per second per connection
    }
  }

  behavior LeaveRoom {
    description: "Disconnect a user from a room"

    input {
      connection_id: UUID
    }

    output {
      success: Connection
      errors {
        CONNECTION_NOT_FOUND {
          when: "Connection does not exist"
          retriable: false
        }
      }
    }

    pre {
      Connection.exists(connection_id)
      Connection.lookup(connection_id).state in [CONNECTED, RECONNECTING]
    }

    post success {
      - result.state == DISCONNECTED
      - result.disconnected_at == now()
      - Connection.active_count_for(result.room_id) == old(count) - 1
    }

    invariants {
      - leave broadcasts a PRESENCE message to remaining members
    }
  }

  behavior Heartbeat {
    description: "Keep-alive ping from client"

    input {
      connection_id: UUID
    }

    output {
      success: { alive: Boolean }
      errors {
        CONNECTION_NOT_FOUND {
          when: "Connection does not exist"
          retriable: false
        }
        NOT_CONNECTED {
          when: "Connection is not active"
          retriable: false
        }
      }
    }

    pre {
      Connection.exists(connection_id)
      Connection.lookup(connection_id).state == CONNECTED
    }

    post success {
      - Connection.lookup(connection_id).last_heartbeat == now()
    }

    invariants {
      - connection with no heartbeat for 30s transitions to DISCONNECTED
    }

    temporal {
      within 10ms (p99): response returned
    }
  }

  scenario "Message ordering guarantee" {
    step join1 = JoinRoom({ user_id: u1, room_id: room.id })
    step join2 = JoinRoom({ user_id: u2, room_id: room.id })

    step m1 = SendMessage({ connection_id: join1.result.id, content: "Hello" })
    step m2 = SendMessage({ connection_id: join2.result.id, content: "World" })
    step m3 = SendMessage({ connection_id: join1.result.id, content: "!" })

    assert m1.result.sequence < m2.result.sequence
    assert m2.result.sequence < m3.result.sequence
    # No gaps
    assert m3.result.sequence == m1.result.sequence + 2
  }

  scenario "Heartbeat timeout disconnects" {
    step join = JoinRoom({ user_id: u1, room_id: room.id })
    assert join.result.state == CONNECTED

    # Simulate 30s without heartbeat
    step after_timeout = Connection.lookup(join.result.id)
    assert after_timeout.state == DISCONNECTED
  }
}
