# Polyglot Runtime Verification Guide

Complete guide for using ISL runtime verification with Rust and Go applications.

## Quick Start

### Rust

```bash
# 1. Add dependency
# In Cargo.toml:
[dependencies]
isl-runtime = { path = "../packages/isl-runtime-rs" }

# 2. Generate traces
cargo run

# 3. Verify with shipgate
shipgate verify --proof .shipgate/traces
```

### Go

```bash
# 1. Add dependency
go get github.com/shipgate/isl-runtime-go

# 2. Generate traces
go run main.go

# 3. Verify with shipgate
shipgate verify --proof .shipgate/traces
```

## Complete Workflow

### Step 1: Write ISL Specifications

Create ISL spec files (e.g., `specs/auth.isl`):

```isl
domain Auth {
  behavior Login {
    input {
      email: Email
      ip_address: String
    }
    output {
      success: Session
    }
    preconditions {
      input.email.length > 0
    }
    postconditions {
      result.session_id != null
    }
  }
}
```

### Step 2: Implement with Runtime Helpers

#### Rust Example

```rust
use isl_runtime::TraceEmitter;
use serde_json::json;

let mut emitter = TraceEmitter::new("Auth", "Login");
emitter.emit_call("Login", &json!({"email": "user@example.com"}));
// ... execute behavior ...
emitter.emit_return("Login", &json!({"session_id": "abc"}), 42);
emitter.save_to_file(".shipgate/traces/login.json", true)?;
```

#### Go Example

```go
emitter := islruntime.NewTraceEmitter("Auth", "Login")
emitter.EmitCall("Login", map[string]interface{}{
    "email": "user@example.com",
})
// ... execute behavior ...
emitter.EmitReturn("Login", map[string]interface{}{
    "session_id": "abc",
}, 42)
emitter.SaveToFile(".shipgate/traces/login.json", true)
```

### Step 3: Generate Traces

Run your application or tests. Traces are automatically saved to `.shipgate/traces/`.

### Step 4: Verify

```bash
# Option 1: Verify traces directly (if supported)
shipgate verify --proof .shipgate/traces

# Option 2: Create proof bundle first, then verify
shipgate proof pack --input .shipgate/traces --output .shipgate/proof-bundle
shipgate verify --proof .shipgate/proof-bundle
```

## Trace Format

Traces must follow this JSON schema:

```json
{
  "id": "trace_...",
  "name": "Auth - Login",
  "domain": "Auth",
  "start_time": 1234567890,
  "end_time": 1234567891,
  "events": [
    {
      "id": "evt_1_...",
      "type": "call",
      "timestamp": 1234567890,
      "data": {...},
      "behavior": "Login",
      "input": {...}
    },
    {
      "id": "evt_2_...",
      "type": "return",
      "timestamp": 1234567891,
      "data": {...},
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

### Call Event
Emitted when a behavior function is called.

### Return Event
Emitted when a behavior function returns.

### State Change Event
Emitted when entity state changes.

### Check Event
Emitted for precondition/postcondition/invariant checks.

### Error Event
Emitted when errors occur.

## PII Redaction

The runtime helpers automatically redact:
- Email addresses
- IP addresses
- Phone numbers
- Sensitive keys (password, api_key, secret, etc.)

## Example Projects

- **Rust**: `samples/rust-auth-example/`
- **Go**: `samples/go-auth-example/`

## Integration with CI/CD

### GitHub Actions

```yaml
- name: Run tests with tracing
  run: cargo test

- name: Verify traces
  run: shipgate verify --proof .shipgate/traces --ci
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
Ensure traces are saved to `.shipgate/traces/` directory.

### Verification Fails
1. Check ISL spec files are present
2. Verify trace format matches schema
3. Ensure behavior names match between traces and specs

### PII Not Redacted
The runtime helpers automatically redact PII. If issues persist:
1. Update to latest version
2. Check redaction is enabled (default: on)
3. Report missing patterns

## Next Steps

- Read [Runtime Verification Guide](./runtime-verification-polyglot.md)
- Check [ISL Specification](../packages/isl-runtime-rs/README.md)
- Review example projects in `samples/`
