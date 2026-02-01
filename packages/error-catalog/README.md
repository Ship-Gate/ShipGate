# Error Catalog Generator

Generate comprehensive error documentation from ISL error definitions. Outputs include Markdown docs, JSON catalogs, TypeScript classes, OpenAPI schemas, and a searchable static website.

## Features

- **Multi-format output**: Markdown, JSON, TypeScript, OpenAPI, HTML website
- **ISL extraction**: Parse error definitions from ISL files
- **Validation**: Check for duplicates, missing descriptions, broken references
- **Search**: Full-text search in generated website
- **Customizable**: Templates, themes, grouping options

## Installation

```bash
npm install @intentos/error-catalog
```

## Quick Start

### CLI

```bash
# Generate all outputs
npx error-catalog generate -i "**/*.isl" -o ./docs --markdown --json --typescript

# Validate definitions
npx error-catalog validate -i "**/*.isl"

# Show statistics
npx error-catalog stats -i "**/*.isl"
```

### Programmatic API

```typescript
import { generateErrorCatalog } from '@intentos/error-catalog';

const outputs = await generateErrorCatalog({
  inputGlob: '**/*.isl',
  groupBy: 'domain',
  sortBy: 'code',
  outputs: {
    markdown: {
      outputDir: './docs',
      splitByGroup: true,
      includeToc: true,
    },
    json: {
      outputFile: './errors.json',
      pretty: true,
    },
    typescript: {
      outputFile: './errors.ts',
      generateClasses: true,
      generateTypeGuards: true,
    },
    openapi: {
      outputFile: './openapi-errors.yaml',
      version: '3.1',
    },
    website: {
      outputDir: './website',
      title: 'API Error Reference',
      includeSearch: true,
    },
  },
});
```

## ISL Error Definition Format

```isl
domain Auth {
  error DUPLICATE_EMAIL {
    code: "AUTH_001"
    httpStatus: 409
    message: "Email already exists"
    description: """
      The email address is already registered in the system.
      This error occurs during user registration or email updates.
    """
    retriable: false
    severity: error
    causes: [
      "User attempts to register with an existing email",
      "Admin creates user with duplicate email"
    ]
    resolutions: [
      "Use a different email address",
      "Reset password for existing account"
    ]
    tags: ["auth", "registration"]
  }

  error RATE_LIMITED {
    code: "AUTH_002"
    httpStatus: 429
    message: "Too many requests"
    retriable: true
    retryAfter: 60
    severity: warning
    causes: ["Excessive API requests in short time period"]
    resolutions: ["Wait for retry-after duration", "Implement exponential backoff"]
  }
}
```

## Generated Outputs

### Markdown

```markdown
# Error Catalog: Auth Domain

## DUPLICATE_EMAIL
**Code:** `AUTH_001`
**HTTP Status:** 409 Conflict
**Retriable:** No

### Description
The email address is already registered in the system.

### When This Occurs
- User attempts to register with an existing email
- Admin creates user with duplicate email

### Resolution
- Use a different email address
- Reset password for existing account

### Example Response
```json
{
  "error": {
    "code": "AUTH_001",
    "type": "DUPLICATE_EMAIL",
    "message": "Email already exists"
  }
}
```
```

### TypeScript

```typescript
export enum ErrorCode {
  DUPLICATE_EMAIL = 'AUTH_001',
  RATE_LIMITED = 'AUTH_002',
}

export class DuplicateEmailError extends ApiError {
  constructor(details?: ErrorDetails) {
    super(
      ErrorCode.DUPLICATE_EMAIL,
      HttpStatus.CONFLICT,
      'Email already exists',
      details,
      false
    );
  }
}

// Type guards
export function isDuplicateEmailError(error: unknown): error is DuplicateEmailError {
  return error instanceof DuplicateEmailError;
}

// Factories
export namespace Errors {
  export function duplicateEmail(details?: ErrorDetails): DuplicateEmailError {
    return new DuplicateEmailError(details);
  }
}
```

### OpenAPI

```yaml
components:
  schemas:
    DuplicateEmailError:
      allOf:
        - $ref: '#/components/schemas/ErrorResponse'
        - type: object
          properties:
            error:
              properties:
                code:
                  enum: ['AUTH_001']
                type:
                  enum: ['DUPLICATE_EMAIL']

  responses:
    Error409:
      description: Conflict
      content:
        application/json:
          schema:
            oneOf:
              - $ref: '#/components/schemas/DuplicateEmailError'
```

## Configuration Options

### Generator Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `inputGlob` | string | - | Glob pattern for ISL files |
| `groupBy` | string | `'domain'` | Group by: domain, httpStatus, severity, tag |
| `sortBy` | string | `'code'` | Sort by: code, id, httpStatus, severity |

### Markdown Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `outputDir` | string | - | Output directory |
| `splitByGroup` | boolean | `false` | Create separate files per group |
| `includeToc` | boolean | `true` | Include table of contents |
| `includeExamples` | boolean | `true` | Include example responses |
| `template` | string | - | Custom Handlebars template |

### TypeScript Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `outputFile` | string | - | Output file path |
| `generateClasses` | boolean | `true` | Generate error classes |
| `generateTypeGuards` | boolean | `true` | Generate type guard functions |
| `generateFactories` | boolean | `true` | Generate factory functions |
| `baseClassName` | string | `'ApiError'` | Base error class name |

### Website Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `outputDir` | string | - | Output directory |
| `title` | string | `'Error Reference'` | Site title |
| `includeSearch` | boolean | `true` | Enable search functionality |
| `theme` | string | `'auto'` | Theme: light, dark, auto |
| `customCss` | string | - | Path to custom CSS |
| `logo` | string | - | Logo URL |

## Validation

The catalog validates:

- **Duplicate IDs**: No two errors can have the same ID
- **Duplicate codes**: No two errors can have the same code
- **Missing descriptions**: Warns if description is empty
- **Missing resolutions**: Warns if no resolutions provided
- **Broken references**: Warns if relatedErrors reference unknown IDs

```typescript
import { ErrorCatalog, ErrorExtractor } from '@intentos/error-catalog';

const extractor = new ErrorExtractor();
const { errors, warnings } = await extractor.extractFromGlob('**/*.isl');

const catalog = new ErrorCatalog(errors);
const validation = catalog.validate();

if (!validation.valid) {
  console.error('Validation failed:', validation.issues);
}
```

## Statistics

```typescript
const stats = catalog.getStats();

console.log(`Total errors: ${stats.totalErrors}`);
console.log(`Retriable: ${stats.retriableCount}`);
console.log(`By domain:`, stats.byDomain);
console.log(`By HTTP status:`, stats.byHttpStatus);
console.log(`By severity:`, stats.bySeverity);
```

## Custom Templates

Use Handlebars templates for custom Markdown output:

```handlebars
# {{title}}

{{#each groups}}
## {{name}}

{{#each errors}}
### {{id}} ({{code}})

{{description}}

| Property | Value |
|----------|-------|
| HTTP Status | {{httpStatus}} |
| Retriable | {{#if retriable}}Yes{{else}}No{{/if}} |

{{/each}}
{{/each}}
```

## License

MIT
