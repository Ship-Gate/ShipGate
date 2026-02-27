# @isl-lang/codegen

ISL code generators - umbrella package for all code generation targets.

## Installation

```bash
npm install @isl-lang/codegen
```

For individual generators (better tree-shaking):

```bash
npm install @isl-lang/codegen-python
npm install @isl-lang/codegen-openapi
npm install @isl-lang/codegen-graphql
```

## Usage

```typescript
import { generatePython, generateOpenAPI, generateGraphQL } from '@isl-lang/codegen';
import { parse } from '@isl-lang/parser';

const ast = parse(`
  domain UserAPI {
    type User {
      id: uuid
      name: string
      email: email
    }

    intent CreateUser {
      input { name: string, email: email }
      output { user: User }
    }
  }
`);

// Generate Python (Pydantic + FastAPI)
const pythonCode = generatePython(ast, {
  framework: 'fastapi',
  pydantic: 'v2',
});

// Generate OpenAPI 3.1 spec
const openapi = generateOpenAPI(ast, {
  info: { title: 'User API', version: '1.0.0' },
});

// Generate GraphQL schema
const graphql = generateGraphQL(ast);
```

## Available Generators

| Generator | Package | Description |
|-----------|---------|-------------|
| Python | `@isl-lang/codegen-python` | Pydantic models, FastAPI/Flask endpoints |
| OpenAPI | `@isl-lang/codegen-openapi` | OpenAPI 3.1 specifications |
| GraphQL | `@isl-lang/codegen-graphql` | GraphQL schemas and resolvers |
| TypeScript | `@isl-lang/codegen-types` | TypeScript types and interfaces |
| Rust | `@isl-lang/codegen-rust` | Rust structs with serde |
| Go | `@isl-lang/codegen-go` | Go structs and handlers |
| Validators | `@isl-lang/codegen-validators` | Runtime validators |
| Tests | `@isl-lang/codegen-tests` | Test cases from contracts |
| Mocks | `@isl-lang/codegen-mocks` | Mock implementations |
| Docs | `@isl-lang/codegen-docs` | Documentation generation |

## Subpath Imports

For better tree-shaking, use subpath imports:

```typescript
// Only imports Python generator
import { generatePython } from '@isl-lang/codegen/python';

// Only imports OpenAPI generator
import { generateOpenAPI } from '@isl-lang/codegen/openapi';
```

## CLI Usage

```bash
# Via the ISL CLI
isl generate --target python specs/

# Multiple targets
isl generate --target typescript,openapi specs/
```

## Configuration

Generators accept options for customization:

```typescript
// Python options
generatePython(ast, {
  framework: 'fastapi' | 'flask' | 'django',
  pydantic: 'v1' | 'v2',
  asyncMode: true,
  outputDir: './src/generated',
});

// OpenAPI options
generateOpenAPI(ast, {
  info: { title: 'My API', version: '1.0.0' },
  servers: [{ url: 'https://api.example.com' }],
  security: [{ bearerAuth: [] }],
});

// TypeScript options
generateTypeScript(ast, {
  runtime: true,  // Include runtime validators
  zod: true,      // Generate Zod schemas
  strict: true,   // Strict TypeScript
});
```

## Documentation

Full documentation: https://isl-lang.dev/docs/codegen

## Related Packages

- [@isl-lang/parser](https://npm.im/@isl-lang/parser) - ISL parser
- [@isl-lang/cli](https://npm.im/@isl-lang/cli) - CLI tool

## License

MIT
