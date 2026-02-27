# @isl-lang/spec-assist

AI-assisted ISL specification generation from existing code.

## Overview

Spec Assist helps you generate ISL specifications from your existing code. It uses AI to analyze your functions and classes, then produces draft ISL specs that capture the intent, preconditions, postconditions, and error handling.

**Key Safety Guarantees:**
- AI **cannot** directly ship code - it can only produce ISL specs
- All AI output is **validated** by the ISL parser + semantic analyzer + verifier
- Must be **explicitly enabled** via feature flag
- Non-ISL output ("slop") is automatically **rejected**

## Quick Start

### 1. Enable AI Assist

Choose one of these methods:

```bash
# Environment variable
export ISL_AI_ENABLED=true

# Or in .islrc.json
{
  "ai": {
    "enabled": true,
    "provider": "stub"  // or "anthropic"
  }
}
```

### 2. Generate a Spec

```typescript
import { generateSpecFromCode } from '@isl-lang/spec-assist';

const result = await generateSpecFromCode(
  `async function createUser(email: string, password: string) {
    if (!isValidEmail(email)) throw new Error('Invalid email');
    const user = await db.users.create({ email, passwordHash: hash(password) });
    return { user, token: generateToken(user.id) };
  }`,
  'typescript'
);

if (result.success) {
  console.log(result.isl);
  // Output: behavior CreateUser { ... }
} else {
  console.log('Validation failed:', result.diagnostics);
}
```

### 3. CLI Usage

```bash
# Generate spec from a file
isl spec --ai src/auth/createUser.ts

# With hints
isl spec --ai src/auth/createUser.ts --hints "handles registration" --hints "sends verification"
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ISL_AI_ENABLED` | Enable AI assist (`true`/`false`) | `false` |
| `ISL_AI_PROVIDER` | Provider to use (`stub`/`anthropic`) | `stub` |
| `ANTHROPIC_API_KEY` | API key for Anthropic provider | - |
| `ISL_AI_MODEL` | Model to use | `claude-3-5-sonnet-20241022` |

### Config File (.islrc.json)

```json
{
  "ai": {
    "enabled": true,
    "provider": "anthropic",
    "model": "claude-3-5-sonnet-20241022",
    "maxTokens": 4096,
    "temperature": 0.3
  }
}
```

## Providers

### Stub Provider (Default)

Offline/testing provider that returns pre-defined ISL templates based on pattern matching. No API calls, deterministic output.

```typescript
import { createSpecAssist } from '@isl-lang/spec-assist';

const service = createSpecAssist({ provider: 'stub' });
```

### Anthropic Provider

Production provider using Claude. Requires API key.

```bash
export ANTHROPIC_API_KEY=your-key-here
export ISL_AI_PROVIDER=anthropic
```

## Privacy Statement

### What Data is Sent

When using a real AI provider (not stub):

1. **Code snippets** - The source code you provide for spec generation
2. **Hints** - Any hints you provide about the code's intent
3. **Domain context** - Any existing ISL specs you provide as context

### What Data is NOT Sent

1. Your API keys (used locally for authentication)
2. Other files in your workspace
3. Git history or commit messages
4. Environment variables (except the code you explicitly provide)

### Data Retention

- **Stub provider**: No data leaves your machine
- **Anthropic provider**: Subject to [Anthropic's data policies](https://www.anthropic.com/privacy)
- **OpenAI provider**: Subject to [OpenAI's data policies](https://openai.com/policies/privacy-policy)

### Recommendations

1. **Review before sending** - Always check what code you're sending
2. **Use stub for testing** - Test your workflow with stub provider first
3. **Avoid secrets** - Don't include files with secrets/credentials
4. **Use .gitignore patterns** - Spec assist respects common ignore patterns

## Validation Pipeline

All AI output goes through this validation pipeline:

```
AI Output → Slop Rejection → Parse → Semantic → Verify → Accept
                ↓              ↓        ↓          ↓
             Reject      Reject    Reject    Accept with warnings
```

### Stage 1: Slop Rejection

Rejects output that isn't valid ISL:
- Prose/explanations
- Markdown with explanatory text
- Code in other languages
- Empty/whitespace output

### Stage 2: Parse

Validates ISL syntax:
- Balanced braces
- Valid keywords
- Proper structure

### Stage 3: Semantic Analysis

Checks for semantic issues:
- Duplicate declarations
- Undefined references
- Type mismatches

### Stage 4: Quick Verify

Soft verification:
- Behavior completeness
- Precondition/postcondition structure
- (Does not require test evidence)

## API Reference

### createSpecAssist(config?)

Create a new SpecAssist service instance.

```typescript
const service = createSpecAssist({
  provider: 'anthropic',
  apiKey: 'sk-...',
  maxTokens: 4096,
  temperature: 0.3,
});

await service.initialize();
```

### generateSpecFromCode(code, language, options?)

Quick helper for one-off generation.

```typescript
const result = await generateSpecFromCode(
  code,
  'typescript',
  {
    signature: 'functionName',
    hints: ['hint1', 'hint2'],
  }
);
```

### isSpecAssistAvailable()

Check if AI assist is enabled and available.

```typescript
if (isSpecAssistAvailable()) {
  // Show AI assist UI
}
```

### validateISL(isl)

Validate ISL through the pipeline.

```typescript
const result = await validateISL(islCode);
if (result.allPassed) {
  // ISL is valid
}
```

## Testing

```bash
# Run tests
pnpm test

# Run with coverage
pnpm test -- --coverage
```

### Test Fixtures

The package exports test fixtures for testing AI output validation:

```typescript
import { INVALID_OUTPUTS } from '@isl-lang/spec-assist';

// Use in your tests
expect(isValidOutput(INVALID_OUTPUTS.proseOnly).valid).toBe(false);
```

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) in the monorepo root.

## License

MIT
