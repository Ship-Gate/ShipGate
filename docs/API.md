# ISL API Reference

Complete API documentation for all ISL packages.

## @isl-lang/parser

Parses ISL source code into an Abstract Syntax Tree (AST).

### Installation

```bash
npm install @isl-lang/parser
```

### Usage

```typescript
import { parse, parseFile } from '@isl-lang/parser';

// Parse a string
const source = `
domain UserManagement {
  version: "1.0.0"
  
  entity User {
    id: UUID [immutable, unique]
    email: String [unique]
    name: String
  }
  
  behavior CreateUser {
    input {
      email: String
      name: String
    }
    
    output {
      success: User
    }
    
    pre {
      input.email.is_valid
      not User.exists(email: input.email)
    }
    
    post success {
      User.exists(result.id)
      result.email == input.email
    }
  }
}
`;

const result = parse(source, 'user.isl');

if (result.success) {
  console.log('Domain:', result.domain.name.name);
  console.log('Entities:', result.domain.entities.length);
  console.log('Behaviors:', result.domain.behaviors.length);
} else {
  console.error('Parse errors:', result.errors);
}

// Parse a file
const fileResult = await parseFile('./spec/domain.isl');
```

### Exports

| Export | Type | Description |
|--------|------|-------------|
| `parse(source, filename?)` | `function` | Parse ISL source string |
| `parseFile(path)` | `async function` | Parse ISL file from disk |
| `Lexer` | `class` | Tokenizer for ISL source |
| `Parser` | `class` | Recursive descent parser |

### Types

```typescript
interface ParseResult {
  success: boolean;
  domain?: Domain;
  errors: ParseError[];
  warnings: ParseWarning[];
}

interface ParseError {
  message: string;
  severity: 'error' | 'warning';
  location: SourceLocation;
}

interface SourceLocation {
  file?: string;
  start: Position;
  end: Position;
}
```

---

## @isl-lang/cli

Command-line interface for ISL.

### Installation

```bash
npm install -g @isl-lang/cli
# or
npx @isl-lang/cli
```

### Commands

#### `isl init [name]`

Initialize a new ISL project.

```bash
isl init my-project
isl init --template minimal
isl init --template full
```

Options:
- `--template <type>` - Project template (minimal, full)
- `--force` - Overwrite existing files

#### `isl parse <file>`

Parse an ISL file and show the AST.

```bash
isl parse spec.isl
isl parse spec.isl --format json
isl parse spec.isl --validate
```

Options:
- `--format <type>` - Output format (tree, json)
- `--validate` - Run semantic validation

#### `isl generate <file>`

Generate code from an ISL specification.

```bash
isl generate spec.isl --lang ts --out ./src
isl generate spec.isl --lang rust --out ./src
isl generate spec.isl --lang go --out ./pkg
```

Options:
- `--lang <language>` - Target language (ts, rust, go, python)
- `--out <dir>` - Output directory
- `--types-only` - Only generate types
- `--tests` - Include test generation

#### `isl verify <spec> --impl <file>`

Verify an implementation against a specification.

```bash
isl verify spec.isl --impl impl.ts
isl verify spec.isl --impl impl.ts --verbose
isl verify spec.isl --impl impl.ts --min-score 90
```

Options:
- `--impl <file>` - Implementation file path
- `--verbose` - Detailed output
- `--timeout <ms>` - Test timeout
- `--min-score <n>` - Minimum trust score to pass
- `--format <type>` - Output format (text, json)

Output:
```
Trust Score: 95/100
Confidence: 85%

Recommendation: Production Ready

Breakdown:
  Postconditions   ████████████████████ 10/10
  Invariants       ████████████████░░░░  8/10
  Scenarios        ████████████████████  5/5
  Temporal         ████████████░░░░░░░░  3/5

Test Results:
  ✓ 26 passed
  ✗ 2 failed
  ○ 2 skipped
  Duration: 1234ms

✓ Verification passed
```

#### `isl watch <file>`

Watch for changes and re-run commands.

```bash
isl watch spec.isl --command parse
isl watch spec.isl --command "generate --lang ts"
```

---

## @isl-lang/codegen-tests

Generates executable tests from ISL specifications.

### Installation

```bash
npm install @isl-lang/codegen-tests
```

### Usage

```typescript
import { generate } from '@isl-lang/codegen-tests';
import { parse } from '@isl-lang/parser';

const source = `...ISL source...`;
const { domain } = parse(source);

const files = generate(domain, {
  framework: 'vitest',
  outputDir: './tests/generated',
  includeHelpers: true,
  includeChaosTests: true,
});

for (const file of files) {
  console.log(`Generated: ${file.path} (${file.type})`);
}
```

### Options

```typescript
interface GenerateOptions {
  framework: 'vitest' | 'jest';
  outputDir?: string;
  includeHelpers?: boolean;
  includeChaosTests?: boolean;
}
```

### Generated Files

| Type | Description |
|------|-------------|
| `test` | Test files for each behavior |
| `helper` | Test utilities and fixtures |
| `fixture` | Entity factories and builders |
| `config` | Framework configuration |

---

## @isl-lang/isl-verify

Verification engine for ISL implementations.

### Installation

```bash
npm install @isl-lang/isl-verify
```

### Usage

```typescript
import { verify } from '@isl-lang/isl-verify';
import { parse } from '@isl-lang/parser';

const spec = parse(`...ISL source...`);
const impl = `...implementation code...`;

const result = await verify(spec.domain, impl, {
  runner: {
    timeout: 30000,
    verbose: false,
    framework: 'vitest',
  },
  trustCalculator: {
    weights: {
      postconditions: 40,
      invariants: 30,
      scenarios: 20,
      temporal: 10,
    },
    thresholds: {
      production: 95,
      staging: 85,
      shadow: 70,
    },
  },
});

console.log(`Trust Score: ${result.trustScore.overall}/100`);
console.log(`Recommendation: ${result.trustScore.recommendation}`);
```

### Exports

| Export | Description |
|--------|-------------|
| `verify(domain, impl, options)` | Full verification pipeline |
| `runTests(domain, impl, options)` | Run tests only |
| `calculateTrustScore(result, options)` | Calculate trust score |
| `formatTrustReport(score)` | Format as JSON report |

### Trust Score

```typescript
interface TrustScore {
  overall: number;           // 0-100
  confidence: number;        // 0-100
  breakdown: {
    postconditions: CategoryScore;
    invariants: CategoryScore;
    scenarios: CategoryScore;
    temporal: CategoryScore;
  };
  recommendation: 
    | 'production_ready'
    | 'staging_recommended'
    | 'shadow_mode'
    | 'not_ready'
    | 'critical_issues';
  details: TrustDetail[];
}
```

---

## @isl-lang/codegen

Generates implementation stubs from ISL specifications.

### Installation

```bash
npm install @isl-lang/codegen
```

### Usage

```typescript
import { generateTypeScript, generateRust, generateGo } from '@isl-lang/codegen';
import { parse } from '@isl-lang/parser';

const { domain } = parse(`...ISL source...`);

// Generate TypeScript
const tsFiles = generateTypeScript(domain, {
  outputDir: './src/generated',
  includeTypes: true,
  includeStubs: true,
});

// Generate Rust
const rsFiles = generateRust(domain, {
  outputDir: './src/generated',
  crateName: 'my_domain',
});

// Generate Go
const goFiles = generateGo(domain, {
  outputDir: './pkg/generated',
  packageName: 'domain',
});
```

### Supported Languages

| Language | Types | Stubs | Validators |
|----------|-------|-------|------------|
| TypeScript | ✓ | ✓ | ✓ |
| Rust | ✓ | ✓ | ✓ |
| Go | ✓ | ✓ | Partial |
| Python | ✓ | ✓ | Partial |

---

## @isl-lang/lsp-server

Language Server Protocol implementation for ISL.

### Installation

```bash
npm install @isl-lang/lsp-server
```

### Usage

```typescript
import { createISLServer, startServer } from '@isl-lang/lsp-server';

// Start as stdio server
startServer();

// Or create server instance
const server = createISLServer();
server.listen();
```

### LSP Features

| Feature | Status |
|---------|--------|
| Syntax highlighting | ✓ |
| Diagnostics | ✓ |
| Hover information | ✓ |
| Go to definition | ✓ |
| Find references | ✓ |
| Auto-completion | ✓ |
| Document symbols | ✓ |
| Code formatting | ✓ |
| Semantic tokens | ✓ |

---

## Common Types

### Domain

```typescript
interface Domain {
  kind: 'Domain';
  name: Identifier;
  version: StringLiteral;
  owner?: StringLiteral;
  imports: Import[];
  types: TypeDefinition[];
  entities: Entity[];
  behaviors: Behavior[];
  views: View[];
  policies: Policy[];
  scenarios: ScenarioBlock[];
  chaos: ChaosBlock[];
  invariants: InvariantBlock[];
  location: SourceLocation;
}
```

### Entity

```typescript
interface Entity {
  kind: 'Entity';
  name: Identifier;
  fields: Field[];
  invariants: Expression[];
  lifecycle?: LifecycleSpec;
  location: SourceLocation;
}
```

### Behavior

```typescript
interface Behavior {
  kind: 'Behavior';
  name: Identifier;
  description?: StringLiteral;
  actors: ActorSpec[];
  input: InputBlock;
  output: OutputBlock;
  preconditions: Expression[];
  postconditions: PostconditionBlock[];
  invariants: Expression[];
  temporal: TemporalSpec[];
  security: SecuritySpec[];
  observability: ObservabilitySpec[];
  location: SourceLocation;
}
```

For complete type definitions, see the `@isl-lang/parser` package source.
