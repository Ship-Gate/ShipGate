# Realtime WebSocket

Chat rooms with presence tracking, strict message ordering, heartbeat keep-alive, and connection lifecycle management.

## Coverage

| Feature | Present |
|---------|---------|
| Preconditions | ✅ |
| Postconditions | ✅ (connection state, message sequence) |
| Invariants | ✅ (ordering, delivery, heartbeat timeout, presence) |
| Scenarios | ✅ (message ordering, heartbeat timeout) |
| Temporal | ✅ (connection p99, delivery p99, heartbeat) |
| Security | ✅ (rate limiting per connection) |

## Key invariants

- **Message ordering**: sequence numbers are monotonically increasing and gap-free per room.
- **Delivery guarantee**: messages delivered to all CONNECTED members.
- **Heartbeat timeout**: connection auto-disconnects after 30s without heartbeat.
- **Presence broadcast**: join/leave events emit PRESENCE messages.

## Usage

```ts
import { samples } from '@isl/samples';
const ws = samples['realtime-websocket'];
```
