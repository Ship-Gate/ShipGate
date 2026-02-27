# ISL Runtime Helpers for Rust

Runtime verification helpers for integrating ISL (Intent Specification Language) constraints with Rust applications.

## Features

- **Constraint Loading**: Load ISL constraints from spec files or compiled JSON
- **Trace Emission**: Emit trace events during runtime execution
- **PII Redaction**: Automatic redaction of sensitive data in traces
- **Verification Ready**: Traces compatible with `shipgate verify`

## Installation

Add to your `Cargo.toml`:

```toml
[dependencies]
isl-runtime = { path = "../isl-runtime-rs" }
```

## Usage

### Loading Constraints

```rust
use isl_runtime::ConstraintLoader;

let loader = ConstraintLoader::new();

// Load from compiled JSON (recommended)
let constraints = loader.load_from_json("specs/auth.json")?;

// Or load directly from ISL (simplified parser)
let constraints = loader.load_from_file("specs/auth.isl")?;

// Access behavior constraints
for behavior in &constraints.behaviors {
    println!("Behavior: {}", behavior.name);
    println!("Preconditions: {:?}", behavior.preconditions);
    println!("Postconditions: {:?}", behavior.postconditions);
}
```

### Emitting Trace Events

```rust
use isl_runtime::TraceEmitter;
use serde_json::json;

// Create emitter for a behavior
let mut emitter = TraceEmitter::new("Auth", "Login");

// Capture initial state
emitter.capture_initial_state(json!({
    "user_count": 0,
}));

// Emit call event
let start = std::time::Instant::now();
emitter.emit_call("Login", &json!({
    "email": "user@example.com",
}));

// ... execute behavior ...

// Emit return event
let duration = start.elapsed().as_millis() as i64;
emitter.emit_return("Login", &json!({
    "session_id": "abc123",
}), duration);

// Emit check events
emitter.emit_check(
    "input.email.length > 0",
    true,
    "precondition",
    None,
    None,
    None,
);

// Finalize and save trace
emitter.save_to_file(".shipgate/traces/login.json", true)?;
```

### Complete Example

See `samples/rust-auth-example/` for a complete working example.

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
