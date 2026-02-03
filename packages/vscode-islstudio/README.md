# ISL Studio for VS Code

**Control surface for ISL**: Set intent blocks, run gate checks, heal until ship, and view violations and proof bundles.

## Features

### 🎯 Core Functionality
- **Sidebar Tree View** - Browse intent blocks, violations, and proof bundles
- **Real-time Diagnostics** - See violations as you code in the Problems panel
- **Gate Status** - SHIP/NO_SHIP verdict with score in status bar
- **Heal Until Ship** - Automated healing with iteration tracking and patch preview
- **Intent Block Management** - View and manage intent blocks from ISL specs
- **Proof Bundle Viewer** - Inspect verification proof bundles

### 🚀 Commands

| Command | Description |
|---------|-------------|
| `ISL Studio: Run Gate (All Files)` | Run full gate check on all files |
| `ISL Studio: Run Gate (Changed Files Only)` | Fast check on changed files only |
| `ISL Studio: Heal Until Ship` | Automatically fix violations until SHIP |
| `ISL Studio: Set Intent Blocks` | Scan and display intent blocks |
| `ISL Studio: View Proof Bundle` | Open proof bundle viewer |
| `ISL Studio: Explain Rule` | Get detailed explanation of a rule |
| `ISL Studio: Create Baseline` | Capture existing violations as baseline |
| `ISL Studio: Refresh Sidebar` | Refresh sidebar data |

### 📊 Sidebar

The ISL Studio sidebar shows:
- **Gate Status** - Current verdict and score
- **Intent Blocks** - All intent blocks from ISL specs
- **Violations** - Grouped by severity (critical, high, medium, low)
- **Proof Bundles** - All verification proof bundles

### 🔧 Status Bar

The status bar shows:
- `🛡️ SHIP 95/100` - No blocking issues
- `⚠️ WARN (2)` - Warnings only
- `❌ NO_SHIP 65/100 (5)` - Blocking issues found

Click to run the full gate.

### 💊 Heal UI

The Heal UI panel shows:
- **Iteration Progress** - Real-time progress through healing iterations
- **Patch Preview** - Diff preview of patches before applying
- **Final Summary** - SHIP/NO_SHIP result with final score

## Installation

### From VS Code Marketplace
Search for "ISL Studio" in the VS Code extensions marketplace.

### From OpenVSX
```bash
code --install-extension isl-studio.vscode-islstudio
```

### From VSIX
1. Download the `.vsix` file
2. Run: `code --install-extension <path-to-vsix>`

## Quick Start

1. **Open a workspace** with TypeScript/JavaScript files
2. **Run Gate** - Click the status bar or use Command Palette
3. **View Violations** - Check Problems panel or sidebar
4. **Heal** - Run "Heal Until Ship" to auto-fix violations
5. **Review** - Check proof bundles in sidebar

## Configuration

Open Settings (Ctrl+,) and search for "ISL Studio":

| Setting | Default | Description |
|---------|---------|-------------|
| `islstudio.enable` | `true` | Enable/disable diagnostics |
| `islstudio.runOnSave` | `true` | Run checks on file save |
| `islstudio.runOnOpen` | `true` | Run gate on workspace open |
| `islstudio.changedOnlyByDefault` | `true` | Only check changed files by default |

## What It Checks

Same 25+ rules as the CLI:

| Pack | Rules |
|------|-------|
| `auth/*` | Bypass, credentials, unprotected routes |
| `pii/*` | Logged PII, unmasked responses |
| `payments/*` | Payment bypass, unsigned webhooks |
| `rate-limit/*` | Missing rate limits |
| `intent/*` | ISL specification violations |

## Suppressing Violations

Add inline comments:

```typescript
// islstudio-ignore pii/console-in-production: Debug only
console.log(data);
```

## Works With

- TypeScript (.ts, .tsx)
- JavaScript (.js, .jsx)
- Node.js APIs
- React/Next.js
- Express/Fastify

## Requirements

- VS Code 1.85.0 or higher
- Node.js 18+ (for CLI integration)

## Links

- [CLI Package](https://npmjs.com/package/islstudio)
- [GitHub](https://github.com/ISL-Studio/ISL-Studio-)
- [Report Issues](https://github.com/ISL-Studio/ISL-Studio-/issues)
- [Documentation](https://islstudio.dev)

## License

MIT

## Changelog

### 0.3.0
- Added sidebar tree view
- Added heal until ship UI
- Added intent block management
- Added proof bundle viewer
- Improved diagnostics integration

### 0.2.0
- Initial release with gate checks
- Status bar integration
- Diagnostics provider
