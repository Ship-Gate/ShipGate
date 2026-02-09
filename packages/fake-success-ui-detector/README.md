# Fake Success UI Detector

Detects UI flows that display success while ignoring failures — the most dangerous hallucination pattern.

## Overview

This package scans TypeScript/JavaScript code to identify patterns where error handling incorrectly displays success messages, masking failures from users. This is a critical bug pattern that can lead to data loss, security issues, and poor user experience.

## Patterns Detected

### 1. Catch Blocks Returning Success
```typescript
try {
  await api.save(data);
} catch (error) {
  return { success: true }; // ❌ Fake success!
}
```

### 2. Try/Catch with Toast.Success in Catch
```typescript
try {
  await api.submit(data);
} catch (error) {
  toast.success('Data saved successfully!'); // ❌ Shows success on error!
}
```

### 3. Promise Catch with Default Success
```typescript
return api.save(data)
  .catch(() => true); // ❌ Returns success on error!
```

## Installation

```bash
pnpm add @isl-lang/fake-success-ui-detector
```

## Usage

### Basic Detection

```typescript
import { detectFakeSuccess } from '@isl-lang/fake-success-ui-detector';

const code = `
async function saveData() {
  try {
    await api.save(data);
  } catch (error) {
    toast.success('Saved!');
  }
}
`;

const result = detectFakeSuccess(code, 'src/components/Form.tsx');

console.log(result.claims);
// [
//   {
//     id: 'try-catch-toast-success-src/components/Form.tsx-5',
//     patternType: 'try-catch-toast-success',
//     filePath: 'src/components/Form.tsx',
//     startLine: 2,
//     endLine: 7,
//     framework: 'react',
//     callChain: {
//       errorOrigin: { line: 5, column: 3, type: 'catch' },
//       successDisplay: { line: 6, column: 5, type: 'toast', method: 'toast.success' }
//     },
//     swallowedError: { line: 5, column: 3, type: 'Error' },
//     confidence: 0.95,
//     snippet: '...'
//   }
// ]
```

### Batch Detection

```typescript
import { detectFakeSuccessBatch } from '@isl-lang/fake-success-ui-detector';

const files = [
  { path: 'src/components/Form.tsx', content: '...' },
  { path: 'src/utils/api.ts', content: '...' },
];

const result = await detectFakeSuccessBatch(files);
```

## Framework Support

### React
- `react-hot-toast`
- `react-toastify`
- `sonner`
- `react-toast-notifications`
- `notistack`
- `antd` (message/notification)
- Material-UI (`useSnackbar`)

### Vue
- `vue-toastification`
- `vue-toast-notification`
- `element-plus`
- `vuetify`

### Generic
- Generic notification patterns
- Alert/notification functions

## Detection Options

```typescript
interface DetectionOptions {
  minConfidence?: number;        // Default: 0.7
  includeSnippets?: boolean;     // Default: true
  maxSnippetLines?: number;      // Default: 15
  frameworkHints?: FrameworkType[]; // Optional framework hints
}
```

## Claim Structure

Each detected pattern includes:

- **Pattern Type**: One of the three detected patterns
- **Location**: File path, line/column ranges
- **Call Chain Evidence**: Traces error origin → success display
- **Swallowed Error**: Information about the ignored error
- **Confidence**: Detection confidence score (0-1)
- **Snippet**: Code snippet showing the issue

## Acceptance Criteria

✅ Flags real fake-success patterns without spamming normal error handling  
✅ Claim includes the swallowed error origin  
✅ Supports React, Vue, and generic frameworks  
✅ Provides call chain evidence for debugging  
✅ Includes line ranges for precise location  

## Testing

```bash
pnpm test
```

Tests include fixtures for all three patterns with both positive and negative cases.

## License

MIT
