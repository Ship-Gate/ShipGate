# Report Viewer

VS Code extension module for viewing ISL evidence reports with clause-level navigation and "Fix Next" workflow.

## Features

- **Report Summary**: Displays overall verification score and pass/fail/partial counts
- **Clause List**: Filterable list of all clause verification results
- **Source Navigation**: Click any clause to open the source file and reveal the exact location
- **Fix Next**: One-click navigation to the highest-impact failing clause
- **Diagnostics Integration**: Failed clauses appear as editor diagnostics

## Activation API

### Basic Setup

```typescript
import { activateReportViewer, deactivateReportViewer } from './report-viewer';

// In your extension's activate function:
export function activate(context: vscode.ExtensionContext) {
  // Activate the report viewer feature
  activateReportViewer(context);
  
  // ... rest of your extension setup
}

// In your extension's deactivate function:
export function deactivate() {
  deactivateReportViewer();
}
```

### Showing the Report Viewer

```typescript
import { ReportViewerPanel } from './report-viewer';

// Show empty report viewer
ReportViewerPanel.createOrShow(context.extensionUri);

// Show with a pre-loaded report
ReportViewerPanel.createOrShow(context.extensionUri, evidenceReport);
```

### Loading Reports Programmatically

```typescript
// Via command
await vscode.commands.executeCommand('isl.reportViewer.loadReport', report);

// Via panel instance
const panel = ReportViewerPanel.getCurrent();
if (panel) {
  panel.loadReport(report);
}
```

### Navigation Helpers

```typescript
import { navigateToLocation, navigateToClause, navigateToNextFailure } from './report-viewer';

// Navigate to a specific source location
await navigateToLocation({
  filePath: '/path/to/file.isl',
  startLine: 10,
  endLine: 15,
  startColumn: 2,
  endColumn: 40
});

// Navigate to a clause's source
await navigateToClause(clause);

// Navigate to the highest-impact failing clause
const failingClause = await navigateToNextFailure(report);
```

## Registered Commands

| Command | Description |
|---------|-------------|
| `isl.reportViewer.open` | Open the report viewer panel |
| `isl.reportViewer.openFile` | Open a report JSON file |
| `isl.reportViewer.loadReport` | Load a report programmatically |
| `isl.reportViewer.navigateToClause` | Navigate to a clause's source |
| `isl.reportViewer.fixNext` | Navigate to highest-impact failure |
| `isl.reportViewer.refresh` | Refresh the current report |
| `isl.reportViewer.navigateToLocation` | Navigate to a source location |

## Report Format

Evidence reports must follow this structure:

```typescript
interface EvidenceReport {
  version: string;           // Report format version (e.g., "1.0.0")
  metadata: {
    specPath: string;        // Path to the ISL spec file
    reportPath?: string;     // Path to the saved report file
    fingerprint: string;     // Unique hash of the spec
    timestamp: string;       // ISO 8601 timestamp
    duration: number;        // Total execution time in ms
    islVersion?: string;     // ISL version used
    environment?: string;    // Environment name
  };
  summary: {
    total: number;           // Total clause count
    passed: number;          // Passing clause count
    partial: number;         // Partial pass count
    failed: number;          // Failed clause count
    skipped: number;         // Skipped clause count
    score: number;           // Score 0-100
  };
  clauses: ClauseResult[];   // Array of clause results
}

interface ClauseResult {
  id: string;                // Unique clause ID
  name: string;              // Human-readable name
  status: 'PASS' | 'PARTIAL' | 'FAIL' | 'SKIP';
  category: 'precondition' | 'postcondition' | 'invariant' | 'scenario' | 'effect' | 'state';
  location?: {               // Source location for navigation
    filePath: string;
    startLine: number;       // 1-based line number
    endLine: number;
    startColumn?: number;    // 0-based column
    endColumn?: number;
  };
  message?: string;          // Error or status message
  expected?: string;         // Expected value (for assertions)
  actual?: string;           // Actual value (for assertions)
  impact?: 'critical' | 'high' | 'medium' | 'low';
  duration?: number;         // Execution time in ms
  suggestedFix?: string;     // Fix suggestion for failures
}
```

## Fixtures

Sample evidence reports are provided in the `fixtures/` directory:

- `sample-evidence-report.json` - Mixed pass/fail report (auth example)
- `failing-clauses-report.json` - Mostly failing report (payment example)
- `all-passing-report.json` - All passing report (calculator example)

## UI Components

The report viewer is built with these components:

- **Summary Card**: Score and pass/fail badges
- **Fix Next Button**: Prominent CTA for the highest-impact failure
- **Filters**: Status and category dropdown filters
- **Clause List**: Scrollable list of clause results with navigation buttons

## Webview Messages

### Webview → Extension

| Message Type | Data | Description |
|--------------|------|-------------|
| `ready` | - | Webview initialized |
| `openFile` | `{ location }` | Navigate to source |
| `fixNext` | - | Navigate to highest-impact failure |
| `selectClause` | `{ clauseId }` | Select a clause |
| `refresh` | - | Request report refresh |
| `filterByStatus` | `{ status }` | Filter by status |
| `filterByCategory` | `{ category }` | Filter by category |

### Extension → Webview

| Message Type | Data | Description |
|--------------|------|-------------|
| `loadReport` | `{ report }` | Load new report |
| `setLoading` | `{ isLoading }` | Set loading state |
| `setError` | `{ error }` | Set error state |
| `highlightClause` | `{ clauseId }` | Highlight a clause |
| `updateFilters` | `{ statusFilter?, categoryFilter? }` | Update filters |

## Integration with Verification

To integrate with your verification pipeline:

```typescript
// After running verification
const report = await runVerification(specPath);

// Show in report viewer
const panel = ReportViewerPanel.createOrShow(context.extensionUri, report);

// Or update existing panel
const existingPanel = ReportViewerPanel.getCurrent();
if (existingPanel) {
  existingPanel.loadReport(report);
}
```

## Customization

The UI uses VS Code CSS variables for theme compatibility:

- `--vscode-editor-background`
- `--vscode-foreground`
- `--vscode-button-background`
- `--vscode-panel-border`
- etc.

Custom status colors:
- Pass: `#4caf50`
- Partial: `#ff9800`
- Fail: `#f44336`
- Skip: `#9e9e9e`

## File Structure

```
report-viewer/
├── src/
│   ├── index.ts              # Main exports and activation
│   ├── types.ts              # Type definitions
│   ├── navigation.ts         # Navigation helpers
│   ├── ReportViewerPanel.ts  # Main webview panel
│   ├── reportViewer.html.ts  # HTML template
│   └── components/
│       ├── index.ts          # Component exports
│       ├── styles.ts         # CSS styles
│       ├── Summary.ts        # Summary card
│       ├── ClauseList.ts     # Clause list
│       └── FixNextButton.ts  # Fix Next button
├── fixtures/
│   ├── sample-evidence-report.json
│   ├── failing-clauses-report.json
│   └── all-passing-report.json
└── README.md                 # This file
```
