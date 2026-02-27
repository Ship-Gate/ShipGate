# Polyglot Runtime Verification

ShipGate supports runtime verification for multiple languages beyond TypeScript. This guide covers using ISL runtime helpers for Rust and Go.

## Overview

Runtime verification allows you to:
1. **Load ISL constraints** from spec files or compiled JSON
2. **Emit trace events** during behavior execution
3. **Save traces** for verification with `shipgate verify`
4. **Produce proof bundles** demonstrating compliance with ISL specifications

## Architecture

```
┌─────────────────┐
│  Your App       │
│  (Rust/Go)      │
└────────┬────────┘
         │
         │ Uses
         ▼
┌─────────────────┐
│  ISL Runtime    │
│  Helpers        │
│  (isl-runtime)  │
└────────┬────────┘
         │
         │ Emits
         ▼
┌─────────────────┐
│  Trace Events   │
│  (.json files)  │
└────────┬────────┘
         │
         │ Input to
         ▼
┌─────────────────┐
│  shipgate       │
│  verify         │
└─────────────────┘
```

## Rust Integration

### Installation

Add to your `Cargo.toml`:

```toml
[dependencies]
isl-runtime = { path = "../packages/isl-runtime-rs" }
```

### Basic Usage

```rust
use isl_runtime::{ConstraintLoader, TraceEmitter};
use serde_json::json;

// 1. Load constraints
let loader = ConstraintLoader::new();
let constraints = loader.load_from_json("specs/auth.json")?;

// 2. Create trace emitter
let mut emitter = TraceEmitter::new("Auth", "Login");

// 3. Emit events during execution
emitter.emit_call("Login", &json!({"email": "user@example.com"}));
// ... execute behavior ...
emitter.emit_return("Login", &json!({"session_id": "abc"}), 42);

// 4. Save trace
emitter.save_to_file(".shipgate/traces/login.json", true)?;
```

### Example Project

See `samples/rust-auth-example/` for a complete working example.

## Go Integration

### Installation

```bash
go get github.com/shipgate/isl-runtime-go
```

Or add to `go.mod`:

```go
require github.com/shipgate/isl-runtime-go v0.1.0
```

### Basic Usage

```go
import "github.com/shipgate/isl-runtime-go"

// 1. Load constraints
loader := islruntime.NewConstraintLoader()
constraints, err := loader.LoadFromJSON("specs/auth.json")

// 2. Create trace emitter
emitter := islruntime.NewTraceEmitter("Auth", "Login")

// 3. Emit events during execution
emitter.EmitCall("Login", map[string]interface{}{
    "email": "user@example.com",
})
// ... execute behavior ...
emitter.EmitReturn("Login", map[string]interface{}{
    "session_id": "abc",
}, 42)

// 4. Save trace
emitter.SaveToFile(".shipgate/traces/login.json", true)
```

### Example Project

See `samples/go-auth-example/` for a complete working example.

## Trace Event Format

All traces follow a consistent JSON format:

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
      "behavior": "Login",
      "input": {...}
    },
    {
      "id": "evt_2_1234567891",
      "type": "return",
      "timestamp": 1234567891,
      "data": {
        "kind": "return",
        "function": "Login",
        "result": {...},
        "duration": 1000
      },
      "behavior": "Login",
      "output": {...}
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

## Event Types

### Call Events

Emitted when a behavior function is called:

```rust
emitter.emit_call("Login", &json!({
    "email": "user@example.com",
    "ip_address": "192.168.1.1",
}));
```

### Return Events

Emitted when a behavior function returns:

```rust
emitter.emit_return("Login", &json!({
    "session_id": "abc123",
}), duration_ms);
```

### State Change Events

Emitted when entity state changes:

```rust
emitter.emit_state_change(
    &["User", "login_count"],
    &json!(0),
    &json!(1),
    "Login"
);
```

### Check Events

Emitted for precondition/postcondition/invariant checks:

```rust
emitter.emit_check(
    "input.email.length > 0",
    true,
    "precondition",
    None,
    None,
    None,
);
```

### Error Events

Emitted when errors occur:

```rust
emitter.emit_error(
    "User not found",
    Some("USER_NOT_FOUND"),
    None
);
```

## PII Redaction

The runtime helpers automatically redact sensitive data:

- **Email addresses**: `user@example.com` → `u***@example.com`
- **IP addresses**: `192.168.1.1` → `192.168.xxx.xxx`
- **Phone numbers**: `+1234567890` → `****7890`
- **Forbidden keys**: `password`, `api_key`, `secret`, etc. are excluded

## Verification Workflow

### 1. Generate Traces

Run your application or tests with tracing enabled:

```bash
# Rust
cargo run

# Go
go run main.go
```

Traces are saved to `.shipgate/traces/`.

### 2. Run Verification

```bash
shipgate verify --proof .shipgate/traces
```

This will:
- Load ISL constraints from spec files
- Match traces to behaviors
- Evaluate postconditions and invariants
- Produce a proof bundle

### 3. Review Results

The verification produces:
- **Proof bundle**: `.shipgate/proof/` directory
- **Verification report**: JSON summary of results
- **Evidence**: Links between traces and constraints

## Best Practices

### 1. Use Compiled JSON

For production, compile ISL files to JSON using TypeScript tooling:

```bash
# Compile ISL to JSON
shipgate compile specs/auth.isl -o specs/auth.json
```

Then load from JSON in your Rust/Go code for better performance.

### 2. Emit All Events

Include all relevant events:
- Call events for behavior entry
- Return events for behavior exit
- State change events for entity modifications
- Check events for precondition/postcondition validation

### 3. Group by Behavior

Create one trace per behavior execution:

```rust
let mut emitter = TraceEmitter::new("Auth", "Login");
// ... emit events ...
emitter.save_to_file(".shipgate/traces/login.json", true)?;
```

### 4. Include State Snapshots

When possible, capture state snapshots:

```rust
emitter.capture_initial_state(json!({
    "user_count": 0,
    "session_count": 0,
}));
```

### 5. Save Traces Persistently

Save traces to `.shipgate/traces/` for verification:

```rust
std::fs::create_dir_all(".shipgate/traces")?;
emitter.save_to_file(".shipgate/traces/login.json", true)?;
```

## CI/CD Integration

### GitHub Actions

```yaml
- name: Run tests with tracing
  run: |
    cargo test -- --nocapture
    # or: go test -v

- name: Verify traces
  run: |
    shipgate verify --proof .shipgate/traces --ci
```

### GitLab CI

```yaml
verify:
  script:
    - cargo test
    - shipgate verify --proof .shipgate/traces --ci
```

## Troubleshooting

### Traces Not Found

Ensure traces are saved to `.shipgate/traces/`:

```rust
std::fs::create_dir_all(".shipgate/traces")?;
```

### Verification Fails

Check that:
1. ISL spec files are present
2. Trace format matches expected schema
3. Behavior names match between traces and specs

### PII Not Redacted

The runtime helpers automatically redact PII. If you see sensitive data:
1. Check that you're using the latest version
2. Verify redaction is enabled (it's on by default)
3. Report issues if patterns are missed

## Next Steps

- See `samples/rust-auth-example/` for Rust examples
- See `samples/go-auth-example/` for Go examples
- Read the [main verification docs](./verification.md)
- Check the [ISL specification](../packages/isl-runtime-rs/README.md)

## Support

For issues or questions:
- Open an issue on GitHub
- Check existing documentation
- Review example projects
