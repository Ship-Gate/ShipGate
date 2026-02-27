# Rust Auth Example

Example Rust application demonstrating ISL runtime verification.

## Overview

This example shows how to:
1. Load ISL constraints from spec files
2. Emit trace events during behavior execution
3. Save traces for verification with `shipgate verify`

## Running

```bash
# Build and run
cargo run

# This will:
# 1. Load constraints from specs/auth.isl
# 2. Execute CreateUser and Login behaviors
# 3. Emit trace events
# 4. Save traces to .shipgate/traces/
```

## Verification

After running, verify with shipgate:

```bash
shipgate verify --proof .shipgate/traces
```

This will:
- Load ISL constraints from `specs/auth.isl`
- Match traces to behaviors
- Evaluate postconditions and invariants
- Produce a proof bundle

## Project Structure

```
rust-auth-example/
├── Cargo.toml          # Dependencies
├── src/
│   └── main.rs         # Example implementation
├── specs/
│   └── auth.isl        # ISL specification
└── .shipgate/
    └── traces/         # Generated trace files
```

## Trace Output

Traces are saved as JSON files compatible with `shipgate verify`:

- `.shipgate/traces/create_user.json` - CreateUser behavior trace
- `.shipgate/traces/login.json` - Login behavior trace

Each trace includes:
- Call and return events
- Precondition/postcondition checks
- Input/output values (with PII redaction)
- Metadata for verification
