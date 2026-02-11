# @isl-lang/stdlib-realtime

Real-time communication library for ISL applications.

## Features

- **WebSocket**: Server and client implementations with auto-reconnect
- **Server-Sent Events (SSE)**: Real-time unidirectional communication
- **Channels**: Pub/sub messaging with authorization
- **Presence**: User presence tracking and state management
- **Protocol**: Extensible protocol with codec and heartbeat support

## Installation

```bash
pnpm add @isl-lang/stdlib-realtime
```

## Usage

```typescript
import { 
  RealtimeServer,
  WebSocketServer,
  ChannelManager,
  DefaultPresenceTracker 
} from '@isl-lang/stdlib-realtime';

// Create a realtime server
const server = new RealtimeServer({
  websocket: new WebSocketServer({ port: 3001 }),
  channels: new ChannelManager(),
  presence: new DefaultPresenceTracker()
});

await server.start();
```

## API

### WebSocket
- `WebSocketServer` - WebSocket server with connection management
- `WebSocketClient` - WebSocket client with auto-reconnect
- `BaseWebSocketConnection` - Base connection class

### SSE
- `SSEServer` - Server-Sent Events server
- `SSEClient` - SSE client with reconnection support

### Channels
- `ChannelManager` - Manages channels and subscriptions
- `Channel` - Individual channel implementation
- `DefaultChannelAuthorizer` - Authorization for channels

### Presence
- `DefaultPresenceTracker` - Track user presence
- `DefaultPresenceStateManager` - Manage presence state

### Protocol
- `DefaultProtocolCodec` - Encode/decode protocol messages
- `DefaultHeartbeatManager` - Manage connection heartbeats

## Development

```bash
pnpm build        # Build the package
pnpm test         # Run tests
pnpm typecheck    # Type-check without emit
pnpm clean        # Remove dist/
```

## License

MIT
