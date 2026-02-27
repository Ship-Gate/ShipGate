# ISL Unified Logger

A consistent logging module for all ISL subsystems with support for human-readable and JSON structured output.

## Features

- **Human-readable pretty output** - Default format with colors, timestamps, and structured data
- **JSON structured events** - Machine-readable format compatible with evidence reports
- **Correlation IDs** - Trace related events across subsystems
- **Spec context** - Attach spec fingerprint/name for evidence compatibility
- **Timer utilities** - Built-in duration tracking
- **Subsystem tagging** - Clear identification of log source

## Installation

```typescript
import { 
  createISLLogger, 
  ISL_EVENTS,
  createCorrelationId 
} from '@isl/core/logging';
```

## Quick Start

```typescript
// Create a logger for your subsystem
const logger = createISLLogger({ subsystem: 'verifier' });

// Log events using standard event names
logger.info(ISL_EVENTS.VERIFY_START, 'Starting verification', { 
  specName: 'auth.isl' 
});

// Log with timing
const endTimer = logger.startTimer(
  ISL_EVENTS.VERIFY_COMPLETE, 
  'Verification complete'
);
// ... do work ...
endTimer(); // Automatically logs with durationMs
```

## Output Formats

### Pretty Output (Default)

```
12:34:56.789 INF [VRF] verify:start Starting verification specName=auth.isl
12:34:57.123 INF [VRF] verify:complete Verification complete (1.23s)
12:34:57.130 ERR [VRF] verify:error Clause failed
    Error: user.exists returned false
    Code: CLAUSE_FAILED
```

### JSON Output (--json flag)

```json
{"timestamp":"2025-01-15T12:34:56.789Z","level":"info","event":"verify:start","subsystem":"verifier","category":"lifecycle","message":"Starting verification","data":{"specName":"auth.isl"}}
```

Enable JSON output:
- Pass `format: 'json'` in logger options
- Use `--json` or `-j` CLI flag (auto-detected)

## API Reference

### `createISLLogger(options: LoggerOptions): ISLLogger`

Create a new logger instance.

```typescript
interface LoggerOptions {
  /** Minimum level to output: 'debug' | 'info' | 'warn' | 'error' | 'fatal' */
  level?: LogLevel;
  /** Subsystem identifier */
  subsystem: Subsystem;
  /** Output format: 'pretty' | 'json' */
  format?: 'pretty' | 'json';
  /** Enable colors in pretty output */
  colors?: boolean;
  /** Include timestamps in output */
  timestamps?: boolean;
  /** Default correlation ID for all events */
  correlationId?: string;
  /** Custom output function (defaults to console.log) */
  output?: (formatted: string) => void;
}
```

### Logger Methods

```typescript
interface ISLLogger {
  debug(event: EventName, message: string, data?: Record<string, unknown>): void;
  info(event: EventName, message: string, data?: Record<string, unknown>): void;
  warn(event: EventName, message: string, data?: Record<string, unknown>): void;
  error(event: EventName, message: string, error?: Error, data?: Record<string, unknown>): void;
  fatal(event: EventName, message: string, error?: Error, data?: Record<string, unknown>): void;
  
  /** Create child logger with additional context */
  child(options: Partial<LoggerOptions>): ISLLogger;
  
  /** Set correlation ID for tracing */
  setCorrelationId(id: string): void;
  
  /** Set spec context for evidence compatibility */
  setSpecContext(fingerprint: string, name?: string): void;
  
  /** Start a timed operation */
  startTimer(event: EventName, message: string): () => void;
  
  /** Get all logged events (for testing) */
  getEvents(): ISLLogEvent[];
}
```

## Recommended Event Names

Use the `ISL_EVENTS` constant for consistent event naming:

```typescript
import { ISL_EVENTS } from '@isl/core/logging';

// Lifecycle events
ISL_EVENTS.INIT          // 'init'
ISL_EVENTS.START         // 'start'
ISL_EVENTS.STOP          // 'stop'
ISL_EVENTS.READY         // 'ready'

// Translator events
ISL_EVENTS.TRANSLATE_START     // 'translate:start'
ISL_EVENTS.TRANSLATE_COMPLETE  // 'translate:complete'
ISL_EVENTS.TRANSLATE_ERROR     // 'translate:error'

// Parser events
ISL_EVENTS.PARSE_START     // 'parse:start'
ISL_EVENTS.PARSE_COMPLETE  // 'parse:complete'
ISL_EVENTS.PARSE_ERROR     // 'parse:error'

// Agent events
ISL_EVENTS.AGENT_PLAN      // 'agent:plan'
ISL_EVENTS.AGENT_EXECUTE   // 'agent:execute'
ISL_EVENTS.AGENT_VERIFY    // 'agent:verify'
ISL_EVENTS.AGENT_SCORE     // 'agent:score'

// Verifier events
ISL_EVENTS.VERIFY_START    // 'verify:start'
ISL_EVENTS.VERIFY_CLAUSE   // 'verify:clause'
ISL_EVENTS.VERIFY_COMPLETE // 'verify:complete'
ISL_EVENTS.VERIFY_ERROR    // 'verify:error'

// Evidence events
ISL_EVENTS.EVIDENCE_COLLECT   // 'evidence:collect'
ISL_EVENTS.EVIDENCE_ARTIFACT  // 'evidence:artifact'
ISL_EVENTS.EVIDENCE_REPORT    // 'evidence:report'

// Codegen events
ISL_EVENTS.CODEGEN_START    // 'codegen:start'
ISL_EVENTS.CODEGEN_FILE     // 'codegen:file'
ISL_EVENTS.CODEGEN_COMPLETE // 'codegen:complete'

// Metric events
ISL_EVENTS.METRIC_DURATION  // 'metric:duration'
ISL_EVENTS.METRIC_COUNT     // 'metric:count'
ISL_EVENTS.METRIC_SCORE     // 'metric:score'
```

## Subsystem Identifiers

```typescript
type Subsystem = 
  | 'translator'   // ISL spec translation
  | 'agent'        // AI agent verification
  | 'verifier'     // Runtime verification/test runner
  | 'parser'       // ISL parsing
  | 'typechecker'  // Type checking
  | 'codegen'      // Code generation
  | 'cli'          // CLI operations
  | 'lsp'          // Language server
  | 'core';        // Core utilities
```

## Usage Examples

### Basic Translator Logging

```typescript
import { createISLLogger, ISL_EVENTS } from '@isl/core/logging';

const logger = createISLLogger({ subsystem: 'translator' });

export function translateSpec(spec: string) {
  logger.info(ISL_EVENTS.TRANSLATE_START, 'Starting translation', {
    specLength: spec.length
  });
  
  try {
    const result = doTranslation(spec);
    logger.info(ISL_EVENTS.TRANSLATE_COMPLETE, 'Translation successful', {
      outputFiles: result.files.length
    });
    return result;
  } catch (error) {
    logger.error(ISL_EVENTS.TRANSLATE_ERROR, 'Translation failed', error);
    throw error;
  }
}
```

### Agent Verification with Correlation

```typescript
import { 
  createISLLogger, 
  ISL_EVENTS,
  createCorrelationId 
} from '@isl/core/logging';

const logger = createISLLogger({ 
  subsystem: 'agent',
  level: 'debug'
});

export async function verifyWithAgent(specPath: string) {
  // Create correlation ID for this verification run
  const correlationId = createCorrelationId();
  logger.setCorrelationId(correlationId);
  
  // Set spec context for evidence compatibility
  logger.setSpecContext(computeFingerprint(specPath), specPath);
  
  logger.info(ISL_EVENTS.AGENT_PLAN, 'Planning verification strategy');
  
  const endTimer = logger.startTimer(
    ISL_EVENTS.AGENT_VERIFY, 
    'Agent verification'
  );
  
  try {
    const plan = await createPlan(specPath);
    logger.debug(ISL_EVENTS.AGENT_EXECUTE, 'Executing verification plan', {
      steps: plan.steps.length
    });
    
    const result = await executePlan(plan);
    
    logger.info(ISL_EVENTS.AGENT_SCORE, 'Verification scored', {
      score: result.score,
      passed: result.passCount,
      failed: result.failCount
    });
    
    endTimer(); // Logs completion with duration
    return result;
  } catch (error) {
    logger.error(ISL_EVENTS.VERIFY_ERROR, 'Agent verification failed', error);
    throw error;
  }
}
```

### Verifier with Child Loggers

```typescript
import { createISLLogger, ISL_EVENTS } from '@isl/core/logging';

const logger = createISLLogger({ subsystem: 'verifier' });

export async function runVerification(clauses: Clause[]) {
  logger.info(ISL_EVENTS.VERIFY_START, 'Starting clause verification', {
    clauseCount: clauses.length
  });
  
  for (const clause of clauses) {
    // Create child logger for each clause
    const clauseLogger = logger.child({
      correlationId: clause.id
    });
    
    clauseLogger.debug(ISL_EVENTS.VERIFY_CLAUSE, `Verifying: ${clause.name}`);
    
    const result = await verifyClause(clause);
    
    if (result.passed) {
      clauseLogger.info(ISL_EVENTS.VERIFY_CLAUSE, `Passed: ${clause.name}`);
    } else {
      clauseLogger.warn(ISL_EVENTS.VERIFY_ERROR, `Failed: ${clause.name}`, {
        expected: result.expected,
        actual: result.actual
      });
    }
  }
}
```

### Evidence Report Integration

```typescript
import { 
  createISLLogger, 
  ISL_EVENTS,
  toEvidenceArtifact 
} from '@isl/core/logging';

const logger = createISLLogger({ 
  subsystem: 'verifier',
  format: 'json' // For evidence compatibility
});

export function createEvidenceWithLogs(result: VerificationResult) {
  // Get all logged events
  const events = logger.getEvents();
  
  // Convert to evidence artifacts
  const logArtifacts = events.map((event, i) => 
    toEvidenceArtifact(event, `log-${i}`)
  );
  
  return {
    ...result,
    artifacts: [
      ...result.artifacts,
      ...logArtifacts
    ]
  };
}
```

### Testing with Memory Logger

```typescript
import { createMemoryLogger, ISL_EVENTS } from '@isl/core/logging';

describe('MyModule', () => {
  it('should log verification events', () => {
    const logger = createMemoryLogger({ subsystem: 'verifier' });
    
    // Run code that uses logger
    myFunction(logger);
    
    // Assert on logged events
    const events = logger.getEvents();
    expect(events).toHaveLength(2);
    expect(events[0].event).toBe(ISL_EVENTS.VERIFY_START);
    expect(events[1].event).toBe(ISL_EVENTS.VERIFY_COMPLETE);
    expect(events[1].durationMs).toBeDefined();
  });
});
```

## JSON Schema

Log events follow this structure (compatible with evidence artifacts):

```typescript
interface ISLLogEvent {
  timestamp: string;      // ISO 8601
  level: LogLevel;        // 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  event: string;          // Event name (use ISL_EVENTS)
  subsystem: Subsystem;   // Source subsystem
  category: EventCategory; // 'lifecycle' | 'operation' | 'result' | 'error' | 'metric' | 'evidence'
  message: string;        // Human-readable message
  correlationId?: string; // For tracing related events
  specFingerprint?: string; // Spec hash for evidence
  specName?: string;      // Spec name
  durationMs?: number;    // Operation duration
  data?: Record<string, unknown>; // Additional structured data
  error?: {               // Error details
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
}
```

## Environment Detection

The logger automatically detects:

- **JSON mode**: `--json` or `-j` CLI flag
- **No colors**: `NO_COLOR=1`, `FORCE_COLOR=0`, or non-TTY output

## Best Practices

1. **Use standard event names** - Import from `ISL_EVENTS` for consistency
2. **Add correlation IDs** - Enable tracing across subsystems
3. **Include relevant data** - Add structured data for analysis
4. **Use timers** - Track operation durations with `startTimer()`
5. **Set spec context** - Enable evidence report compatibility
6. **Use child loggers** - Isolate context for nested operations
