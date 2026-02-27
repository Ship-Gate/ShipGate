# ISL Runtime Helpers for Go

Runtime verification helpers for integrating ISL (Intent Specification Language) constraints with Go applications.

## Features

- **Constraint Loading**: Load ISL constraints from spec files or compiled JSON
- **Trace Emission**: Emit trace events during runtime execution
- **PII Redaction**: Automatic redaction of sensitive data in traces
- **Verification Ready**: Traces compatible with `shipgate verify`

## Installation

```bash
go get github.com/shipgate/isl-runtime-go
```

Or add to your `go.mod`:

```go
require github.com/shipgate/isl-runtime-go v0.1.0
```

## Usage

### Loading Constraints

```go
package main

import (
    "fmt"
    "github.com/shipgate/isl-runtime-go"
)

func main() {
    loader := islruntime.NewConstraintLoader()

    // Load from compiled JSON (recommended)
    constraints, err := loader.LoadFromJSON("specs/auth.json")
    if err != nil {
        panic(err)
    }

    // Or load directly from ISL (simplified parser)
    constraints, err := loader.LoadFromFile("specs/auth.isl")
    if err != nil {
        panic(err)
    }

    // Access behavior constraints
    for _, behavior := range constraints.Behaviors {
        fmt.Printf("Behavior: %s\n", behavior.Name)
        fmt.Printf("Preconditions: %v\n", behavior.Preconditions)
        fmt.Printf("Postconditions: %v\n", behavior.Postconditions)
    }
}
```

### Emitting Trace Events

```go
package main

import (
    "time"
    "github.com/shipgate/isl-runtime-go"
)

func main() {
    // Create emitter for a behavior
    emitter := islruntime.NewTraceEmitter("Auth", "Login")

    // Capture initial state
    emitter.CaptureInitialState(map[string]interface{}{
        "user_count": 0,
    })

    // Emit call event
    start := time.Now()
    emitter.EmitCall("Login", map[string]interface{}{
        "email": "user@example.com",
    })

    // ... execute behavior ...

    // Emit return event
    duration := time.Since(start).Milliseconds()
    emitter.EmitReturn("Login", map[string]interface{}{
        "session_id": "abc123",
    }, duration)

    // Emit check events
    message := "Precondition check passed"
    emitter.EmitCheck(
        "input.email.length > 0",
        true,
        "precondition",
        nil,
        nil,
        &message,
    )

    // Finalize and save trace
    if err := emitter.SaveToFile(".shipgate/traces/login.json", true); err != nil {
        panic(err)
    }
}
```

### Complete Example

See `samples/go-auth-example/` for a complete working example.

## Trace Format

Traces are saved in JSON format compatible with `shipgate verify`:

```json
{
  "id": "trace_1234567890_uuid",
  "name": "Auth - Login",
  "domain": "Auth",
  "start_time": 1234567890,
  "end_time": 1234567891,
  "events": [
    {
      "id": "evt_1_1234567890",
      "type": "call",
      "timestamp": 1234567890,
      "data": {
        "kind": "call",
        "function": "Login",
        "args": {...}
      },
      "behavior": "Login"
    }
  ],
  "metadata": {
    "test_name": "Auth::Login",
    "scenario": "Login",
    "version": "1.0.0",
    "environment": "runtime",
    "passed": true,
    "duration": 1000
  }
}
```

## Integration with shipgate verify

1. **Generate traces** during test execution or runtime
2. **Save traces** to `.shipgate/traces/` directory
3. **Run verification**: `shipgate verify --proof .shipgate/traces`

The verification engine will:
- Load ISL constraints from your spec files
- Match traces to behaviors
- Evaluate postconditions and invariants
- Produce proof bundles

## PII Redaction

The trace emitter automatically redacts:
- Email addresses: `user@example.com` → `u***@example.com`
- IP addresses: `192.168.1.1` → `192.168.xxx.xxx`
- Phone numbers: `+1234567890` → `****7890`
- Forbidden keys: `password`, `api_key`, `secret`, etc.

## Best Practices

1. **Use compiled JSON**: For production, compile ISL files to JSON using TypeScript tooling
2. **Emit all events**: Include call, return, state changes, and checks
3. **Save traces**: Persist traces for verification runs
4. **Group by behavior**: One trace per behavior execution
5. **Include state**: Capture state snapshots when possible

## License

MIT
