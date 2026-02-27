# @intentos/generator-sdk

SDK for building custom ISL code generators.

## Overview

The Generator SDK provides a powerful foundation for creating custom code generators that transform ISL (Intent Specification Language) domain specifications into any target language or format.

## Installation

```bash
npm install @intentos/generator-sdk
```

## Quick Start

### Creating a Custom Generator

```typescript
import { Generator, type GeneratedFile, type EntityDeclaration, type BehaviorDeclaration } from '@intentos/generator-sdk';

class MyGenerator extends Generator {
  name = 'my-custom-generator';
  version = '1.0.0';
  targetLanguages = ['typescript'];
  
  // Generate files for each entity
  protected visitEntity(entity: EntityDeclaration): GeneratedFile[] {
    return [{
      path: `entities/${entity.name.name}.ts`,
      content: this.template('entity', { entity }),
    }];
  }
  
  // Generate files for each behavior
  protected visitBehavior(behavior: BehaviorDeclaration): GeneratedFile[] {
    return [{
      path: `behaviors/${behavior.name.name}.handler.ts`,
      content: this.template('behavior', { behavior }),
    }];
  }
  
  // Custom template helpers
  protected helpers = {
    customFormat: (s: string) => s.toUpperCase(),
  };
}

// Use the generator
const generator = new MyGenerator();
const result = await generator.generate(domain);
console.log(`Generated ${result.files.length} files`);
```

### Scaffold a New Generator Project

```bash
npx @intentos/generator-sdk create my-generator

# Creates:
# my-generator/
# ├── src/
# │   ├── index.ts
# │   └── generator.ts
# ├── templates/
# │   ├── entity.hbs
# │   └── behavior.hbs
# ├── tests/
# │   └── generator.test.ts
# ├── package.json
# └── README.md
```

## Architecture

### Generator Class

The base `Generator` class provides:

- **Visitor pattern** for processing domain elements
- **Template engine** with Handlebars support
- **Lifecycle hooks** for pre/post processing
- **File output** utilities

```typescript
class Generator {
  // Identity
  abstract name: string;
  version: string;
  description: string;
  targetLanguages: string[];
  
  // Main API
  generate(domain, options): Promise<GenerationResult>;
  generateAndWrite(domain, options): Promise<GenerationResult>;
  
  // Override these to generate files
  protected visitDomain(domain): VisitorResult;
  protected visitEntity(entity): VisitorResult;
  protected visitBehavior(behavior): VisitorResult;
  protected visitType(type): VisitorResult;
  protected visitEnum(enumDecl): VisitorResult;
  
  // Lifecycle hooks
  protected beforeEntities(entities): VisitorResult;
  protected afterEntities(entities): VisitorResult;
  protected beforeBehaviors(behaviors): VisitorResult;
  protected afterBehaviors(behaviors): VisitorResult;
  protected finalize(domain): VisitorResult;
  
  // Template methods
  protected template(name, data): string;
  protected inlineTemplate(source, data): string;
}
```

### Visitor Pattern

The SDK uses a visitor pattern to process different domain elements:

```typescript
// Entity Visitor
class MyEntityVisitor extends EntityVisitorBase {
  visitEntity(entity, context): GeneratedFile[] {
    const fields = this.getFields(entity);
    const requiredFields = this.getRequiredFields(entity);
    const idField = this.getIdField(entity);
    
    return [{
      path: `${this.toFileName(entity, 'kebab')}.ts`,
      content: generateCode(entity, fields),
    }];
  }
}

// Behavior Visitor
class MyBehaviorVisitor extends BehaviorVisitorBase {
  visitBehavior(behavior, context): GeneratedFile[] {
    const inputs = this.getInputFields(behavior);
    const errors = this.getErrors(behavior);
    const successType = this.getSuccessTypeName(behavior);
    
    return [{
      path: `${this.toFileName(behavior)}.handler.ts`,
      content: generateHandler(behavior),
    }];
  }
}

// Compose multiple visitors
const composite = composeVisitors({
  entities: [entityVisitor1, entityVisitor2],
  behaviors: [behaviorVisitor],
  types: [typeVisitor],
});
```

### Template Engine

The template engine uses Handlebars with built-in helpers:

```handlebars
{{! entity.hbs }}
/**
 * Entity: {{entity.name.name}}
 */
export interface {{entity.name.name}} {
{{#each entity.fields}}
  {{#if (hasAnnotation this 'immutable')}}readonly {{/if}}{{name.name}}{{#if optional}}?{{/if}}: {{typeToTS type}};
{{/each}}
}
```

#### Built-in Helpers

| Helper | Description | Example |
|--------|-------------|---------|
| `camelCase` | Convert to camelCase | `{{camelCase "MyClass"}}` → `myClass` |
| `pascalCase` | Convert to PascalCase | `{{pascalCase "myClass"}}` → `MyClass` |
| `kebabCase` | Convert to kebab-case | `{{kebabCase "MyClass"}}` → `my-class` |
| `snakeCase` | Convert to snake_case | `{{snakeCase "MyClass"}}` → `my_class` |
| `typeToTS` | Convert ISL type to TypeScript | `{{typeToTS type}}` |
| `typeToPython` | Convert ISL type to Python | `{{typeToPython type}}` |
| `typeToGo` | Convert ISL type to Go | `{{typeToGo type}}` |
| `typeToRust` | Convert ISL type to Rust | `{{typeToRust type}}` |
| `pluralize` | Pluralize a word | `{{pluralize "user"}}` → `users` |
| `json` | JSON stringify | `{{{json obj}}}` |
| `indent` | Indent content | `{{#indent 2}}...{{/indent}}` |
| `eq`, `neq`, `gt`, `lt` | Comparisons | `{{#if (eq a b)}}...{{/if}}` |
| `first`, `last`, `length` | Array operations | `{{first items}}` |
| `join` | Join array | `{{join items ", "}}` |

#### Custom Helpers

```typescript
class MyGenerator extends Generator {
  protected helpers = {
    shout: (s: string) => s.toUpperCase() + '!',
    toSQLType: (islType: TypeExpression) => {
      // Custom type mapping
    },
  };
}
```

### File Output

```typescript
import { FileWriter, MultiFileOutput } from '@intentos/generator-sdk';

// Single file writer
const writer = new FileWriter();
await writer.writeFiles(result.files, {
  outputDir: './generated',
  overwrite: true,
  backup: true,
  onWrite: (file, status) => console.log(`${status}: ${file}`),
});

// Multi-file organization
const output = new MultiFileOutput({
  baseDir: 'src/generated',
  groups: [
    { name: 'entities', directory: 'entities' },
    { name: 'behaviors', directory: 'behaviors' },
    { name: 'types', directory: 'types' },
  ],
  generateIndex: true,
});

output.addFile('entities', { path: 'user.ts', content: '...' });
output.addFile('behaviors', { path: 'create-user.ts', content: '...' });
output.generateIndexFiles();

const allFiles = output.getAllFiles();
```

## API Reference

### Generator Options

```typescript
interface GeneratorOptions {
  outputDir?: string;      // Output directory
  comments?: boolean;      // Include comments in output
  overwrite?: boolean;     // Overwrite existing files
  fileExtension?: string;  // Default file extension
  templateDir?: string;    // Custom template directory
  custom?: Record<string, unknown>;  // Custom options
}
```

### Generated File

```typescript
interface GeneratedFile {
  path: string;           // File path relative to output dir
  content: string;        // File contents
  type?: string;          // File type for categorization
  overwrite?: boolean;    // Override default overwrite behavior
  permissions?: string;   // File permissions (e.g., '755')
}
```

### Generation Result

```typescript
interface GenerationResult {
  files: GeneratedFile[];          // All generated files
  domain: string;                   // Domain name
  generator: string;                // Generator name
  generatedAt: Date;               // Timestamp
  warnings: GenerationWarning[];    // Warnings
  metadata: Record<string, unknown>; // Custom metadata
}
```

## Examples

### TypeScript Types Generator

```typescript
class TypeScriptGenerator extends Generator {
  name = 'typescript-types';
  targetLanguages = ['typescript'];

  protected visitEntity(entity: EntityDeclaration): GeneratedFile[] {
    const content = this.generateInterface(entity);
    return [{
      path: `types/${entity.name.name}.ts`,
      content,
    }];
  }

  private generateInterface(entity: EntityDeclaration): string {
    const fields = entity.fields.map(f => 
      `  ${f.name.name}${f.optional ? '?' : ''}: ${this.typeToTS(f.type)};`
    ).join('\n');

    return `export interface ${entity.name.name} {\n${fields}\n}`;
  }

  private typeToTS(type: TypeExpression): string {
    // Type conversion logic
  }
}
```

### REST API Generator

```typescript
class RestApiGenerator extends Generator {
  name = 'rest-api';

  protected visitBehavior(behavior: BehaviorDeclaration): GeneratedFile[] {
    const method = this.inferHttpMethod(behavior.name.name);
    const route = this.inferRoute(behavior);

    return [{
      path: `routes/${behavior.name.name}.ts`,
      content: this.template('route', { behavior, method, route }),
    }];
  }

  private inferHttpMethod(name: string): string {
    if (name.startsWith('Create')) return 'POST';
    if (name.startsWith('Update')) return 'PUT';
    if (name.startsWith('Delete')) return 'DELETE';
    return 'GET';
  }
}
```

### Multi-Language Generator

```typescript
class MultiLangGenerator extends Generator {
  name = 'multi-lang';
  targetLanguages = ['typescript', 'python', 'go'];

  protected visitEntity(entity: EntityDeclaration): GeneratedFile[] {
    return [
      {
        path: `typescript/${entity.name.name}.ts`,
        content: this.template('entity-ts', { entity }),
      },
      {
        path: `python/${entity.name.name.toLowerCase()}.py`,
        content: this.template('entity-py', { entity }),
      },
      {
        path: `go/${entity.name.name.toLowerCase()}.go`,
        content: this.template('entity-go', { entity }),
      },
    ];
  }
}
```

## CLI Commands

```bash
# Create a new generator project
npx @intentos/generator-sdk create <name> [options]

Options:
  -o, --output <dir>      Output directory (default: ".")
  -l, --language <lang>   Target language (default: "typescript")
  -d, --description <desc> Generator description
  --no-examples           Skip example templates
  --npm                   Use npm as package manager
  --yarn                  Use yarn as package manager
  --pnpm                  Use pnpm as package manager

# List available templates
npx @intentos/generator-sdk list-templates
```

## Best Practices

1. **Use Templates**: Keep generation logic in templates for easier customization
2. **Leverage Visitors**: Use visitor base classes for utility methods
3. **Compose Generators**: Combine multiple generators for complex output
4. **Add Warnings**: Use `this.warn()` for non-critical issues
5. **Include Metadata**: Return useful metadata in `getMetadata()`
6. **Test Thoroughly**: Test with various domain configurations

## License

MIT
