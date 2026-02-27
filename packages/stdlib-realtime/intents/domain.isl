# Real-time Communication Standard Library
# WebSockets, Server-Sent Events, and Pub/Sub patterns

domain Realtime {
  version: "1.0.0"
  description: "Real-time bidirectional and unidirectional communication"
  
  imports {
    core from "@intentos/stdlib-core"
    auth from "@intentos/stdlib-auth"
  }
  
  # ============================================
  # Core Types
  # ============================================
  
  type ConnectionId = UUID
  type ChannelId = String
  type MessageId = UUID
  type ClientId = String
  
  # ============================================
  # Connection
  # ============================================
  
  entity Connection {
    id: ConnectionId [immutable, unique]
    client_id: ClientId
    
    # Connection info
    protocol: Protocol
    transport: Transport
    
    # State
    status: ConnectionStatus
    connected_at: Timestamp
    last_activity_at: Timestamp
    
    # Authentication
    user_id: UUID?
    auth_token: String?
    permissions: List<String>?
    
    # Subscriptions
    subscribed_channels: List<ChannelId>
    
    # Metadata
    user_agent: String?
    ip_address: String?
    metadata: Map<String, String>?
    
    # Heartbeat
    last_ping_at: Timestamp?
    last_pong_at: Timestamp?
    
    lifecycle {
      CONNECTING -> CONNECTED [on: handshake_complete]
      CONNECTED -> AUTHENTICATED [on: auth_success]
      CONNECTED -> DISCONNECTING [on: close_requested]
      AUTHENTICATED -> DISCONNECTING [on: close_requested]
      DISCONNECTING -> DISCONNECTED [on: cleanup_complete]
      * -> DISCONNECTED [on: error]
    }
    
    invariants {
      subscribed_channels.length <= max_subscriptions_per_connection
      (now() - last_activity_at) < connection_timeout
    }
  }
  
  enum Protocol {
    WEBSOCKET
    SSE
    LONG_POLLING
    WEBRTC_DATA
  }
  
  enum Transport {
    TCP
    TLS
    HTTP2
  }
  
  enum ConnectionStatus {
    CONNECTING
    CONNECTED
    AUTHENTICATED
    DISCONNECTING
    DISCONNECTED
    ERROR
  }
  
  # ============================================
  # Channel (Pub/Sub)
  # ============================================
  
  entity Channel {
    id: ChannelId [immutable, unique]
    name: String
    type: ChannelType
    
    # Configuration
    config: ChannelConfig
    
    # State
    subscriber_count: Int
    created_at: Timestamp
    
    # Persistence
    history_enabled: Boolean = false
    history_size: Int?
    history_ttl: Duration?
    
    # Access control
    public: Boolean = false
    allowed_publishers: List<String>?
    allowed_subscribers: List<String>?
    
    invariants {
      subscriber_count >= 0
      history_size == null or history_size > 0
    }
  }
  
  enum ChannelType {
    BROADCAST     { description: "One-to-many, all subscribers receive" }
    PRESENCE      { description: "Track who's online in channel" }
    DIRECT        { description: "One-to-one private channel" }
    ROOM          { description: "Many-to-many group communication" }
    FANOUT        { description: "Broadcast to all connected clients" }
  }
  
  type ChannelConfig = {
    max_subscribers: Int?
    max_message_size: Int = 65536
    rate_limit: {
      messages_per_second: Int
      burst: Int?
    }?
    require_auth: Boolean = false
    encryption: Boolean = false
  }
  
  # ============================================
  # Message
  # ============================================
  
  entity Message {
    id: MessageId [immutable, unique, auto_generated]
    channel_id: ChannelId
    
    # Sender
    sender_id: ConnectionId?
    sender_type: SenderType
    
    # Content
    type: MessageType
    event: String
    data: Any
    
    # Metadata
    timestamp: Timestamp [auto_generated]
    ttl: Duration?
    priority: Priority = NORMAL
    
    # Delivery tracking
    delivery_status: DeliveryStatus?
    delivered_to: Int?
    failed_count: Int?
    
    invariants {
      data.serialized_size <= channel.config.max_message_size
    }
  }
  
  enum SenderType {
    CLIENT
    SERVER
    SYSTEM
  }
  
  enum MessageType {
    TEXT
    BINARY
    JSON
    EVENT
    PING
    PONG
    CLOSE
  }
  
  enum Priority {
    LOW
    NORMAL
    HIGH
    CRITICAL
  }
  
  enum DeliveryStatus {
    PENDING
    DELIVERING
    DELIVERED
    PARTIAL
    FAILED
  }
  
  # ============================================
  # Presence
  # ============================================
  
  entity Presence {
    channel_id: ChannelId
    user_id: UUID
    connection_id: ConnectionId
    
    # State
    status: PresenceStatus
    custom_state: Map<String, Any>?
    
    # Timing
    joined_at: Timestamp
    last_seen_at: Timestamp
    
    # Metadata
    device_info: {
      type: String?
      name: String?
    }?
  }
  
  enum PresenceStatus {
    ONLINE
    AWAY
    BUSY
    INVISIBLE
    OFFLINE
  }
  
  # ============================================
  # Behaviors
  # ============================================
  
  behavior Connect {
    description: "Establish a real-time connection"
    
    input {
      protocol: Protocol = WEBSOCKET
      auth_token: String?
      metadata: Map<String, String>?
    }
    
    output {
      success: {
        connection_id: ConnectionId
        client_id: ClientId
        protocol: Protocol
      }
      errors {
        CONNECTION_REFUSED {
          when: "Server rejected connection"
          fields { reason: String }
        }
        AUTH_REQUIRED {
          when: "Authentication is required"
        }
        RATE_LIMITED {
          when: "Too many connection attempts"
          fields { retry_after: Duration }
        }
      }
    }
    
    postconditions {
      success implies {
        Connection.exists(result.connection_id)
        connection.status in [CONNECTED, AUTHENTICATED]
      }
    }
    
    temporal {
      within 5.seconds: connection established or error
    }
    
    effects {
      creates Connection
      emits ConnectionEstablished
    }
  }
  
  behavior Subscribe {
    description: "Subscribe to a channel"
    
    input {
      connection_id: ConnectionId
      channel_id: ChannelId
      from_history: Int?  # Get N historical messages
    }
    
    output {
      success: {
        channel_id: ChannelId
        history: List<Message>?
        presence: List<Presence>?  # For presence channels
      }
      errors {
        CONNECTION_NOT_FOUND { }
        CHANNEL_NOT_FOUND { }
        NOT_AUTHORIZED {
          when: "User cannot subscribe to this channel"
        }
        MAX_SUBSCRIPTIONS {
          when: "Connection has too many subscriptions"
        }
      }
    }
    
    preconditions {
      Connection.exists(connection_id)
      connection.status in [CONNECTED, AUTHENTICATED]
      channel.public or user_has_permission(channel, "subscribe")
    }
    
    postconditions {
      success implies {
        connection.subscribed_channels.contains(channel_id)
        channel.subscriber_count == old(channel.subscriber_count) + 1
      }
    }
    
    effects {
      updates Connection.subscribed_channels
      increments Channel.subscriber_count
      emits SubscriptionCreated
      may_emit PresenceJoined (for presence channels)
    }
  }
  
  behavior Publish {
    description: "Publish a message to a channel"
    
    input {
      channel_id: ChannelId
      event: String
      data: Any
      connection_id: ConnectionId?  # null = server-side publish
      exclude: List<ConnectionId>?
    }
    
    output {
      success: {
        message_id: MessageId
        delivered_to: Int
      }
      errors {
        CHANNEL_NOT_FOUND { }
        NOT_AUTHORIZED { }
        MESSAGE_TOO_LARGE {
          fields { max_size: Int, actual_size: Int }
        }
        RATE_LIMITED {
          fields { retry_after: Duration }
        }
      }
    }
    
    postconditions {
      success implies {
        Message.exists(result.message_id)
        all_subscribers_received or message_in_queue
      }
    }
    
    temporal {
      within 100ms (p99): message delivered to all online subscribers
    }
    
    effects {
      creates Message
      delivers to all channel subscribers
      may_store in history
      emits MessagePublished
    }
  }
  
  behavior Broadcast {
    description: "Broadcast to all connected clients"
    
    input {
      event: String
      data: Any
      filter: {
        user_ids: List<UUID>?
        metadata: Map<String, String>?
      }?
    }
    
    output {
      success: {
        delivered_to: Int
        failed: Int
      }
    }
  }
  
  behavior SendDirect {
    description: "Send a direct message to a specific connection"
    
    input {
      target: ConnectionId | ClientId | UUID  # connection, client, or user
      event: String
      data: Any
    }
    
    output {
      success: { delivered: Boolean }
      errors {
        TARGET_NOT_FOUND { }
        TARGET_OFFLINE { }
      }
    }
  }
  
  behavior UpdatePresence {
    description: "Update presence state"
    
    input {
      connection_id: ConnectionId
      channel_id: ChannelId
      status: PresenceStatus?
      custom_state: Map<String, Any>?
    }
    
    output {
      success: { presence: Presence }
      errors {
        NOT_SUBSCRIBED { }
      }
    }
    
    effects {
      updates Presence
      emits PresenceUpdated to channel subscribers
    }
  }
  
  behavior Disconnect {
    description: "Close a connection"
    
    input {
      connection_id: ConnectionId
      code: Int?
      reason: String?
    }
    
    output {
      success: { }
    }
    
    effects {
      removes from all subscribed channels
      emits PresenceLeft for presence channels
      emits ConnectionClosed
      deletes Connection
    }
  }
  
  # ============================================
  # Server-Sent Events
  # ============================================
  
  behavior SSEConnect {
    description: "Establish SSE connection"
    
    input {
      last_event_id: String?  # For reconnection
      channels: List<ChannelId>?
    }
    
    output {
      success: Stream<SSEEvent>
      errors {
        NOT_SUPPORTED { }
      }
    }
  }
  
  type SSEEvent = {
    id: String?
    event: String?
    data: String
    retry: Int?
  }
  
  # ============================================
  # Room Management
  # ============================================
  
  behavior CreateRoom {
    input {
      name: String
      config: {
        max_participants: Int?
        public: Boolean = false
        persistent: Boolean = false
      }?
    }
    
    output {
      success: { channel: Channel }
      errors {
        ROOM_EXISTS { }
        NOT_AUTHORIZED { }
      }
    }
  }
  
  behavior JoinRoom {
    input {
      room_id: ChannelId
      connection_id: ConnectionId
      role: RoomRole?
    }
    
    output {
      success: {
        room: Channel
        participants: List<Presence>
      }
      errors {
        ROOM_FULL { }
        BANNED { }
      }
    }
  }
  
  enum RoomRole {
    OWNER
    ADMIN
    MODERATOR
    MEMBER
    GUEST
  }
}
