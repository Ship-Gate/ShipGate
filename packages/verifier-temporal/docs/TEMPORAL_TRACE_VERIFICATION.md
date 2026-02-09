# Temporal Trace Verification

Temporal verification evaluates temporal properties (always, eventually, until, within) against runtime traces.

## Overview

Temporal verification allows you to verify that your implementation satisfies temporal constraints specified in ISL by analyzing runtime traces. This is useful for:

- **Latency SLAs**: Verify that operations complete within specified time bounds
- **Invariants**: Verify that certain properties hold throughout execution
- **Eventual consistency**: Verify that certain conditions eventually become true
- **Ordering constraints**: Verify that events occur in the correct order

## Usage

### CLI Usage

```bash
# Verify temporal properties using trace files
isl verify --temporal --temporal-trace-files trace1.json,trace2.json spec.isl

# Verify temporal properties using traces from a directory
isl verify --temporal --temporal-trace-dir ./traces spec.isl

# With minimum samples requirement
isl verify --temporal --temporal-min-samples 10 --temporal-trace-dir ./traces spec.isl
```

### Programmatic Usage

```typescript
import {
  loadTraceFiles,
  evaluateTemporalProperties,
} from '@isl-lang/verifier-temporal';
import { parse } from '@isl-lang/parser';

// Load traces
const traces = await loadTraceFiles(['trace1.json', 'trace2.json']);

// Parse ISL domain
const { domain } = parse(islSource, 'spec.isl');

// Evaluate temporal properties
const report = await evaluateTemporalProperties(domain, traces, {
  minSnapshots: 1,
});

console.log(`Success: ${report.success}`);
console.log(`Satisfied: ${report.summary.satisfied}/${report.summary.total}`);
```

## Temporal Operators

### `always`

Verifies that a property holds at all states in the trace.

**ISL Syntax:**
```isl
behavior Login {
  temporal {
    always: no errors occur
  }
}
```

**Example:**
```typescript
const result = evaluateAlways(trace, (state) => {
  const eventCounts = state._eventCounts as Record<string, number> | undefined;
  return !eventCounts || !eventCounts['handler_error'];
}, { description: 'no errors' });
```

### `eventually`

Verifies that a property eventually becomes true within a time bound.

**ISL Syntax:**
```isl
behavior Login {
  temporal {
    eventually within 5s: audit log written
  }
}
```

**Example:**
```typescript
const result = evaluateEventually(trace, (state) => {
  return state.auditWritten === true;
}, { description: 'audit written', boundMs: 5000 });
```

### `until`

Verifies that a property holds until another property becomes true.

**ISL Syntax:**
```isl
behavior Process {
  temporal {
    until: processing continues until completion
  }
}
```

**Example:**
```typescript
const result = evaluateUntil(
  trace,
  (state) => state.processing === true,  // Hold condition
  (state) => state.completed === true,     // Until condition
  { description: 'processing until completion' }
);
```

### `within`

Verifies that an event occurs within a specified time bound.

**ISL Syntax:**
```isl
behavior Login {
  temporal {
    within 200ms (p99): handler returns
  }
}
```

**Example:**
```typescript
const result = evaluateWithin(
  trace,
  'handler_return',
  200,  // milliseconds
  { description: 'response within 200ms' }
);
```

### `never`

Verifies that a property never becomes true (equivalent to `always not`).

**ISL Syntax:**
```isl
behavior Login {
  temporal {
    never: authentication bypass occurs
  }
}
```

**Example:**
```typescript
const result = evaluateNever(trace, (state) => {
  return state.authBypassed === true;
}, { description: 'no auth bypass' });
```

## Trace Format

Traces must follow the ISL trace format:

```json
{
  "id": "trace-1",
  "name": "Login Trace",
  "domain": "Login",
  "startTime": "2024-01-01T00:00:00Z",
  "correlationId": "corr-123",
  "events": [
    {
      "time": "2024-01-01T00:00:00.000Z",
      "kind": "handler_call",
      "correlationId": "event-1",
      "handler": "Login",
      "inputs": {},
      "outputs": {},
      "events": [],
      "timing": {
        "startMs": 0,
        "durationMs": 50
      }
    },
    {
      "time": "2024-01-01T00:00:00.050Z",
      "kind": "handler_return",
      "correlationId": "event-2",
      "handler": "Login",
      "inputs": {},
      "outputs": { "result": "success" },
      "events": [],
      "timing": {
        "startMs": 50,
        "durationMs": 0
      }
    }
  ],
  "initialState": {}
}
```

## Evaluation Results

Each temporal property evaluation returns:

- **satisfied**: Whether the property was satisfied
- **verdict**: `SATISFIED`, `VIOLATED`, `UNKNOWN`, or `VACUOUSLY_TRUE`
- **violation**: Details about violations (if any)
  - `traceId`: Which trace violated the property
  - `timestampMs`: When the violation occurred
  - `snapshotIndex`: Which snapshot violated the property
  - `message`: Human-readable explanation

## Examples

### Example 1: Verify Latency SLA

```bash
# Create trace files from your implementation
# Then verify:
isl verify --temporal --temporal-trace-files traces/login-*.json login.isl
```

**ISL Spec:**
```isl
domain Auth {
  behavior Login {
    temporal {
      within 200ms (p99): handler returns
    }
  }
}
```

### Example 2: Verify Invariant

```bash
isl verify --temporal --temporal-trace-dir ./traces auth.isl
```

**ISL Spec:**
```isl
domain Auth {
  behavior Login {
    temporal {
      always: no authentication errors occur
    }
  }
}
```

### Example 3: Verify Eventual Consistency

```bash
isl verify --temporal --temporal-trace-files trace1.json trace2.json sync.isl
```

**ISL Spec:**
```isl
domain Sync {
  behavior SyncData {
    temporal {
      eventually within 5s: data synchronized
    }
  }
}
```

## Integration with Runtime

To emit traces from your implementation:

1. Use the ISL trace format SDK to instrument your code
2. Emit events at key points (handler calls, state changes, etc.)
3. Save traces to JSON files
4. Run temporal verification against those traces

## Best Practices

1. **Collect sufficient traces**: Use `--temporal-min-samples` to ensure you have enough data
2. **Use realistic traces**: Traces should represent real-world usage patterns
3. **Verify multiple scenarios**: Include traces for both success and failure cases
4. **Monitor violations**: Set up alerts for temporal property violations in production

## Troubleshooting

### "No traces provided for evaluation"

- Ensure trace files exist and are valid JSON
- Check that trace files match the expected format
- Verify file paths are correct

### "Insufficient snapshots"

- Increase `--temporal-min-samples` if you have few traces
- Collect more traces from your implementation
- Ensure traces contain sufficient events

### "UNKNOWN verdict"

- Traces may not contain enough information
- Check that traces include timing information
- Verify that predicates can access required state

## See Also

- [ISL Language Reference](../../docs/isl-language/syntax-reference.md)
- [Trace Format Specification](../../isl-trace-format/README.md)
- [Temporal Operators](../../semantics/README.md)
