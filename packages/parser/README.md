# @intentos/parser

A complete recursive descent parser for ISL (Intent Specification Language) that transforms source code into an Abstract Syntax Tree (AST).

## Installation

```bash
pnpm add @intentos/parser
```

## Usage

### Basic Parsing

```typescript
import { parse } from '@intentos/parser';

const source = `
domain MyApp {
  version: "1.0.0"
  
  entity User {
    id: UUID [immutable, unique]
    name: String
    email: String [indexed]
  }
  
  behavior CreateUser {
    input {
      name: String
      email: String
    }
    
    output {
      success: User
      errors {
        DUPLICATE_EMAIL {
          when: "Email already exists"
          retriable: false
        }
      }
    }
    
    preconditions {
      input.email.is_valid
    }
    
    postconditions {
      success implies {
        User.exists(result.id)
      }
    }
  }
}
`;

const result = parse(source);

if (result.success) {
  console.log('Domain:', result.domain.name.name);
  console.log('Entities:', result.domain.entities.length);
  console.log('Behaviors:', result.domain.behaviors.length);
} else {
  console.error('Parse errors:', result.errors);
}
```

### Parsing from File

```typescript
import { parseFile } from '@intentos/parser';

const result = await parseFile('./my-domain.isl');

if (result.success) {
  // Work with result.domain
}
```

### Using the Parser API

```typescript
import { createParser } from '@intentos/parser';

const parser = createParser();

const result = parser.parse(source, 'my-file.isl');
const fileResult = await parser.parseFile('./domain.isl');
```

### Accessing Tokens

The parser also provides access to the token stream:

```typescript
const result = parse(source);

if (result.tokens) {
  for (const token of result.tokens) {
    console.log(`${token.type}: ${token.value} at ${token.location.line}:${token.location.column}`);
  }
}
```

### Handling Errors

```typescript
const result = parse(invalidSource);

for (const error of result.errors) {
  console.error(`[${error.code}] ${error.message}`);
  console.error(`  at ${error.location.file}:${error.location.line}:${error.location.column}`);
  
  if (error.relatedInformation) {
    for (const info of error.relatedInformation) {
      console.error(`  related: ${info.message}`);
    }
  }
}
```

## API Reference

### Types

#### ParseResult

```typescript
interface ParseResult {
  success: boolean;
  domain?: Domain;
  errors: Diagnostic[];
  tokens?: Token[];
}
```

#### Diagnostic

```typescript
interface Diagnostic {
  severity: 'error' | 'warning' | 'info' | 'hint';
  code: string;
  message: string;
  location: SourceLocation;
  source: string;
  relatedInformation?: RelatedInformation[];
  fix?: CodeFix;
}
```

#### SourceLocation

```typescript
interface SourceLocation {
  file: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
}
```

## ISL Grammar

The parser supports the full ISL grammar including:

- **Domain declarations** with version and owner
- **Imports** from other ISL files
- **Type definitions** including primitives, enums, structs, unions, and constraints
- **Entity definitions** with fields, invariants, and lifecycle specifications
- **Behavior definitions** with actors, input/output, pre/post conditions, temporal specs, security, compliance, and observability
- **Views** with field computations and consistency specifications
- **Policies** with rules
- **Scenarios** for testing
- **Chaos scenarios** for resilience testing

### Example: Full Behavior

```isl
behavior Login {
  description: "Authenticate user and create session"
  
  actors {
    Anonymous { }
  }
  
  input {
    email: Email
    password: Password [sensitive]
  }
  
  output {
    success: Session
    
    errors {
      INVALID_CREDENTIALS {
        when: "Email or password incorrect"
        retriable: true
      }
      ACCOUNT_LOCKED {
        when: "Too many failed attempts"
        retriable: true
        retry_after: 15.minutes
      }
    }
  }
  
  preconditions {
    input.email.is_valid
    input.password.length >= 8
  }
  
  postconditions {
    success implies {
      Session.exists(result.id)
      User.lookup(email: input.email).last_login == now()
    }
    
    INVALID_CREDENTIALS implies {
      User.lookup(email: input.email).failed_attempts == 
        old(User.lookup(email: input.email).failed_attempts) + 1
    }
  }
  
  invariants {
    input.password never_appears_in logs
    timing_safe_comparison(password)
  }
  
  temporal {
    response within 200.ms (p50)
    response within 1.seconds (p99)
    eventually within 5.seconds: audit_log_created
  }
  
  security {
    rate_limit 10/minute per input.email
    rate_limit 100/minute per ip_address
  }
}
```

## Error Recovery

The parser implements error recovery to continue parsing after encountering errors. This allows it to report multiple errors in a single pass and provide partial AST output even when the source contains errors.

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch
```

## License

MIT
