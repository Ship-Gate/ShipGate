# ISL Studio Bridge

Message bridge for communication between the ISL Studio webview and VS Code extension.

## Overview

The bridge provides:
- **Typed message protocol** with TypeScript discriminated unions
- **Request/response correlation** via unique IDs
- **Persistent state storage** for prompts and paths
- **Atomic file writes** for data safety

## Architecture

```
┌─────────────────────┐         ┌─────────────────────┐
│   ISL Studio        │         │   VS Code Extension │
│   (Webview)         │         │                     │
│                     │         │                     │
│  ┌───────────────┐  │         │  ┌───────────────┐  │
│  │ Request       │──┼────────▶│  │ StudioBridge  │  │
│  │ (correlationId)│ │         │  │               │  │
│  └───────────────┘  │         │  │  ┌─────────┐  │  │
│                     │         │  │  │Handlers │  │  │
│  ┌───────────────┐  │         │  │  └─────────┘  │  │
│  │ Response      │◀─┼─────────│  │               │  │
│  │ (correlationId)│ │         │  │  ┌─────────┐  │  │
│  └───────────────┘  │         │  │  │Persist  │  │  │
│                     │         │  │  └─────────┘  │  │
│  ┌───────────────┐  │         │  └───────────────┘  │
│  │ Notification  │◀─┼─────────│                     │
│  │ (one-way)     │  │         │                     │
│  └───────────────┘  │         │                     │
└─────────────────────┘         └─────────────────────┘
```

## Message Protocol

### Request Types (Webview → Extension)

| Type | Description | Payload |
|------|-------------|---------|
| `GenerateSpec` | Generate ISL spec from prompt | `{ prompt, mode, context? }` |
| `Build` | Build/compile a spec | `{ specPath, targets? }` |
| `Audit` | Audit an existing spec | `{ specPath, collectEvidence? }` |
| `OpenReport` | Open report in Evidence View | `{ reportPath }` |
| `SaveSpec` | Save spec to disk | `{ content, path? }` |
| `CancelOperation` | Cancel ongoing operation | `{ operationId? }` |
| `AnswerQuestion` | Answer open question | `{ questionId, answer }` |
| `GetState` | Get persisted state | `{}` |
| `ListSpecs` | List spec files | `{ directory? }` |
| `ListReports` | List report files | `{ specPath? }` |
| `OpenSettings` | Open ISL settings | `{ section? }` |
| `CopyToClipboard` | Copy to clipboard | `{ content }` |

### Response Types (Extension → Webview)

Each request type has a corresponding response with:
- `success: boolean` - Whether operation succeeded
- `error?: string` - Error message if failed
- `payload` - Type-specific result data

### Notification Types (Extension → Webview, one-way)

| Type | Description | Payload |
|------|-------------|---------|
| `Progress` | Operation progress update | `{ operation, percent, message }` |
| `Log` | Activity log message | `{ level, message }` |
| `Status` | Status change | `{ status, message? }` |
| `StateSync` | Full state sync | `{ recentPrompts, lastSpecPath?, lastReportPath? }` |

## Usage

### In StudioPanel (Extension Side)

```typescript
import { StudioBridge, createStudioBridge } from './bridge';

class StudioPanel {
  private bridge: StudioBridge;

  constructor(webview: vscode.Webview, workspaceRoot: string) {
    // Create bridge with handlers
    this.bridge = createStudioBridge(webview, workspaceRoot, {
      GenerateSpec: async (request, bridge) => {
        bridge.setStatus('generating', 'Generating specification...');
        bridge.notifyProgress('generate', 0, 'Starting...');
        
        try {
          const spec = await this.generateSpec(request.payload.prompt);
          bridge.notifyProgress('generate', 100, 'Complete');
          bridge.setStatus('success');
          return { spec };
        } catch (error) {
          bridge.setStatus('error', error.message);
          throw error;
        }
      },

      Build: async (request, bridge) => {
        // ... build implementation
        return { artifacts: [], trustScore: 85 };
      },

      Audit: async (request, bridge) => {
        // ... audit implementation
        return { trustScore: 92, reportPath: '/path/to/report.json' };
      },
    });
  }

  async activate(): Promise<void> {
    await this.bridge.start();
  }

  deactivate(): void {
    this.bridge.stop();
  }
}
```

### In Webview (Client Side)

```typescript
// Send request with correlation ID
function sendRequest<T extends StudioRequest>(request: T): Promise<StudioResponse> {
  const correlationId = generateCorrelationId();
  const message = { ...request, correlationId, timestamp: Date.now() };

  return new Promise((resolve, reject) => {
    // Store pending request
    pendingRequests.set(correlationId, { resolve, reject });

    // Send to extension
    vscode.postMessage(message);

    // Timeout after 30s
    setTimeout(() => {
      if (pendingRequests.has(correlationId)) {
        pendingRequests.delete(correlationId);
        reject(new Error('Request timeout'));
      }
    }, 30000);
  });
}

// Handle responses
window.addEventListener('message', (event) => {
  const message = event.data;

  if (message.direction === 'response') {
    const pending = pendingRequests.get(message.correlationId);
    if (pending) {
      pendingRequests.delete(message.correlationId);
      if (message.success) {
        pending.resolve(message);
      } else {
        pending.reject(new Error(message.error));
      }
    }
  }

  if (message.direction === 'notification') {
    handleNotification(message);
  }
});

// Example: Generate spec
async function generateSpec(prompt: string): Promise<void> {
  const response = await sendRequest({
    type: 'GenerateSpec',
    direction: 'request',
    payload: { prompt, mode: 'generate' },
  });

  if (response.success && response.payload.spec) {
    updateUI(response.payload.spec);
  }
}
```

## Persistence

State is stored in `.vibecheck/studio/state.json`:

```json
{
  "version": 1,
  "recentPrompts": [
    { "text": "Create user auth API", "timestamp": 1706745600000, "mode": "generate" },
    { "text": "Payment processing service", "timestamp": 1706742000000 }
  ],
  "lastSpecPath": "/workspace/specs/auth.isl",
  "lastReportPath": "/workspace/.vibecheck/evidence/auth-report.json",
  "lastModified": 1706745600000
}
```

### Features

- **Last 20 prompts** stored with timestamps
- **Deduplication** - same prompt moves to top
- **Atomic writes** - write to temp, then rename
- **Auto-persist** - prompts saved automatically on generate

### Manual Persistence

```typescript
// Add prompt manually
await bridge.addPromptToHistory('My prompt', 'generate');

// Update paths
await bridge.setLastSpecPath('/path/to/spec.isl');
await bridge.setLastReportPath('/path/to/report.json');

// Access persistence directly
const persistence = bridge.getPersistence();
const prompts = await persistence.getRecentPromptTexts(5);
```

## Event System

Listen to bridge events for logging/debugging:

```typescript
bridge.addEventListener((event) => {
  switch (event.type) {
    case 'request':
      console.log('Request:', event.request.type);
      break;
    case 'response':
      console.log('Response:', event.response.type, event.response.success);
      break;
    case 'notification':
      console.log('Notification:', event.notification.type);
      break;
    case 'error':
      console.error('Error:', event.error.message);
      break;
  }
});
```

## File Structure

```
bridge/
├── bridge.ts       # Main StudioBridge class
├── messages.ts     # Message type definitions
├── persistence.ts  # State persistence
├── index.ts        # Public exports
└── README.md       # This file

shared/
├── paths.ts        # Path utilities
├── jsonStore.ts    # Atomic JSON storage
└── index.ts        # Public exports
```

## Error Handling

Errors are handled at multiple levels:

1. **Request handlers** - Catch and return error response
2. **Bridge level** - Emit error events
3. **Persistence level** - Fallback to defaults on parse errors

```typescript
// Handler with error handling
bridge.registerHandler('Build', async (request, bridge) => {
  try {
    const result = await build(request.payload.specPath);
    return { artifacts: result.files };
  } catch (error) {
    // Bridge automatically sends error response
    // and emits error event
    throw error;
  }
});
```

## Testing

```typescript
// Mock webview for testing
const mockWebview = {
  postMessage: vi.fn(),
  onDidReceiveMessage: vi.fn(() => ({ dispose: vi.fn() })),
};

// Create bridge
const bridge = createStudioBridge(mockWebview, '/workspace');

// Verify messages sent
expect(mockWebview.postMessage).toHaveBeenCalledWith(
  expect.objectContaining({ type: 'StateSync' })
);
```
