# ISL Telemetry

Opt-in local telemetry for ISL operations. All data is stored locally in `.shipgate/telemetry/events.jsonl` - **no network calls are made**.

## Features

- **Opt-in by default** - Telemetry is disabled unless explicitly enabled
- **Local storage only** - All events written to local JSONL file
- **No network calls** - Data never leaves your machine
- **Automatic secret redaction** - API keys, passwords, tokens are redacted by default
- **Session-based grouping** - Events grouped by session ID for analysis
- **File rotation** - Automatic rotation when file exceeds 10MB

## Quick Start

```typescript
import { createLocalTelemetry, TELEMETRY_EVENTS } from '@isl/core/telemetry';

// Create telemetry recorder (opt-in required)
const telemetry = await createLocalTelemetry({ enabled: true });

// Record events
telemetry.recordEvent(TELEMETRY_EVENTS.VERIFY_COMPLETE, {
  specName: 'auth.isl',
  score: 95,
  duration: 1234,
});

// Always close when done
await telemetry.close();
```

## Enabling Telemetry

### Via Configuration

```typescript
const telemetry = await createLocalTelemetry({ enabled: true });
```

### Via Environment Variable

```bash
ISL_TELEMETRY=1 isl verify auth.isl
```

### Custom Output Directory

```typescript
const telemetry = await createLocalTelemetry({
  enabled: true,
  outputDir: './my-telemetry',
});
```

Or via environment:

```bash
ISL_TELEMETRY_DIR=./my-telemetry isl verify auth.isl
```

## Event Format

Events are stored in JSONL format (one JSON object per line):

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "event": "verify:complete",
  "sessionId": "ses_abc123_xyz",
  "payload": {
    "specName": "auth.isl",
    "score": 95,
    "duration": 1234
  },
  "metadata": {
    "islVersion": "0.1.0",
    "nodeVersion": "v20.0.0",
    "os": "darwin"
  }
}
```

## Secret Redaction

By default, sensitive data is automatically redacted:

```typescript
telemetry.recordEvent('api:call', {
  apiKey: 'sk_live_abc123xyz',  // Redacted to [STRIPE_KEY_REDACTED]
  password: 'secret123',        // Redacted to [REDACTED]
  bearer: 'Bearer eyJ...',      // Redacted to Bearer [TOKEN_REDACTED]
  data: { name: 'John' },       // Preserved (not sensitive)
});
```

### Redacted Patterns

| Pattern | Example | Redaction |
|---------|---------|-----------|
| API Keys | `api_key: "abc123..."` | `[API_KEY_REDACTED]` |
| Bearer Tokens | `Bearer xyz...` | `Bearer [TOKEN_REDACTED]` |
| JWT Tokens | `eyJ...` | `[JWT_REDACTED]` |
| Passwords | `password: "secret"` | `[PASSWORD_REDACTED]` |
| AWS Keys | `AKIAIOSFODNN...` | `[AWS_KEY_REDACTED]` |
| Private Keys | `-----BEGIN...` | `[PRIVATE_KEY_REDACTED]` |
| GitHub Tokens | `ghp_...` | `[GITHUB_TOKEN_REDACTED]` |
| Stripe Keys | `sk_live_...` | `[STRIPE_KEY_REDACTED]` |
| Connection Strings | `mongodb://...` | `[CONNECTION_STRING_REDACTED]` |

### Custom Redaction Patterns

```typescript
const telemetry = await createLocalTelemetry({
  enabled: true,
  redactionPatterns: [
    ...DEFAULT_REDACTION_PATTERNS,
    {
      name: 'internal_id',
      pattern: /INT_[A-Z0-9]{10}/g,
      replacement: '[INTERNAL_ID_REDACTED]',
    },
  ],
});
```

### Disabling Redaction

```typescript
const telemetry = await createLocalTelemetry({
  enabled: true,
  redactSecrets: false,  // NOT RECOMMENDED
});
```

## Standard Events

```typescript
import { TELEMETRY_EVENTS } from '@isl/core/telemetry';

// Session lifecycle
TELEMETRY_EVENTS.SESSION_START   // 'session:start'
TELEMETRY_EVENTS.SESSION_END     // 'session:end'

// Translation events
TELEMETRY_EVENTS.TRANSLATE_START    // 'translate:start'
TELEMETRY_EVENTS.TRANSLATE_COMPLETE // 'translate:complete'
TELEMETRY_EVENTS.TRANSLATE_ERROR    // 'translate:error'

// Verification events
TELEMETRY_EVENTS.VERIFY_START    // 'verify:start'
TELEMETRY_EVENTS.VERIFY_COMPLETE // 'verify:complete'
TELEMETRY_EVENTS.VERIFY_SCORE    // 'verify:score'
TELEMETRY_EVENTS.VERIFY_ERROR    // 'verify:error'

// Agent events
TELEMETRY_EVENTS.AGENT_PLAN     // 'agent:plan'
TELEMETRY_EVENTS.AGENT_EXECUTE  // 'agent:execute'
TELEMETRY_EVENTS.AGENT_FEEDBACK // 'agent:feedback'

// Evidence events
TELEMETRY_EVENTS.EVIDENCE_COLLECT // 'evidence:collect'
TELEMETRY_EVENTS.EVIDENCE_REPORT  // 'evidence:report'

// CLI events
TELEMETRY_EVENTS.CLI_COMMAND // 'cli:command'
TELEMETRY_EVENTS.CLI_ERROR   // 'cli:error'

// Performance events
TELEMETRY_EVENTS.PERF_TIMING // 'perf:timing'
TELEMETRY_EVENTS.PERF_MEMORY // 'perf:memory'
```

## API Reference

### `createLocalTelemetry(config)`

Create a telemetry recorder that writes to local file.

```typescript
const telemetry = await createLocalTelemetry({
  enabled: true,                          // Required to enable
  outputDir: '.shipgate/telemetry',      // Output directory
  filename: 'events.jsonl',               // Output filename
  redactSecrets: true,                    // Enable secret redaction
  includeMetadata: true,                  // Include system metadata
  maxFileSize: 10 * 1024 * 1024,         // 10MB before rotation
  flushIntervalMs: 1000,                  // Flush every 1s
});
```

### `recordEvent(event, payload)`

Record a telemetry event (non-blocking).

```typescript
telemetry.recordEvent('verify:complete', { score: 95 });
```

### `recordEventAsync(event, payload)`

Record a telemetry event and wait for write.

```typescript
await telemetry.recordEventAsync('verify:complete', { score: 95 });
```

### `flush()`

Flush buffered events to disk.

```typescript
await telemetry.flush();
```

### `close()`

Close recorder and flush remaining events.

```typescript
await telemetry.close();
```

### `setCorrelationId(id)`

Set correlation ID for subsequent events.

```typescript
telemetry.setCorrelationId('req-abc123');
```

### `redactSecrets(data, patterns?)`

Manually redact secrets from data.

```typescript
import { redactSecrets } from '@isl/core/telemetry';

const safe = redactSecrets({
  apiKey: 'sk_live_abc123',
  name: 'John',
});
// { apiKey: '[STRIPE_KEY_REDACTED]', name: 'John' }
```

## Testing

For testing, use `MemoryTelemetryRecorder`:

```typescript
import { MemoryTelemetryRecorder } from '@isl/core/telemetry';

const telemetry = new MemoryTelemetryRecorder();

telemetry.recordEvent('test:event', { data: 'value' });

const events = telemetry.getEvents();
expect(events).toHaveLength(1);
expect(events[0].event).toBe('test:event');

telemetry.clearEvents();
```

## File Location

Default: `.shipgate/telemetry/events.jsonl`

The telemetry directory is created automatically if it doesn't exist.

## Privacy

- **No network calls** - Data stays on your machine
- **Opt-in only** - Disabled by default
- **Secret redaction** - Sensitive data automatically removed
- **Local control** - Delete `.shipgate/telemetry/` anytime

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ISL_TELEMETRY` | Enable telemetry (`1`, `true`, `yes`) | Disabled |
| `ISL_TELEMETRY_DIR` | Custom output directory | `.shipgate/telemetry` |
