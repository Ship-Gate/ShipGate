# ISL Studio for VS Code

Block risky code as you type. Auth, PII, payments, and rate-limit checks with real-time feedback.

## Features

- **Real-time Diagnostics** - See violations as you code
- **Fix Guidance** - Detailed explanations for each rule
- **Status Bar** - SHIP/NO_SHIP verdict at a glance
- **Run on Save** - Automatic checks when you save

## Installation

Search for "ISL Studio" in the VS Code extensions marketplace.

Or install from command line:
```bash
code --install-extension isl-studio.vscode-islstudio
```

## Usage

Once installed, ISL Studio automatically analyzes TypeScript and JavaScript files.

### Commands

- **ISL Studio: Run Gate** - Run full gate check
- **ISL Studio: Explain Rule** - Get details on a rule
- **ISL Studio: Create Baseline** - Capture existing violations

### Status Bar

The status bar shows:
- `🛡️ SHIP` - No blocking issues
- `🛡️ WARN (2 warnings)` - Warnings only
- `🛡️ NO_SHIP (3 errors)` - Blocking issues found

Click to run the full gate.

## Configuration

Open Settings (Ctrl+,) and search for "ISL Studio":

| Setting | Default | Description |
|---------|---------|-------------|
| `islstudio.enable` | `true` | Enable/disable diagnostics |
| `islstudio.runOnSave` | `true` | Run checks on file save |
| `islstudio.severity` | `warning` | Default severity level |

## What It Checks

Same 25 rules as the CLI:

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

## Links

- [CLI Package](https://npmjs.com/package/islstudio)
- [GitHub](https://github.com/ISL-Studio/ISL-Studio-)
- [Report Issues](https://github.com/ISL-Studio/ISL-Studio-/issues)

## License

MIT
