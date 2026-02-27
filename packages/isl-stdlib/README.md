# @isl-lang/isl-stdlib

Central registry and import resolver for ISL Standard Library modules.

## Overview

This package provides:
- **Registry**: A central index of all stdlib modules with metadata
- **Resolver**: Import path resolution for `@isl/stdlib-*` imports
- **Discovery**: Search and query modules by name, category, or keyword
- **Dependency Resolution**: Topological ordering of module dependencies

## Installation

```bash
pnpm add @isl-lang/isl-stdlib
```

## Usage

### Getting a Module

```typescript
import { getModule } from '@isl-lang/isl-stdlib';

const authModule = getModule('stdlib-auth');
console.log(authModule?.provides.behaviors);
// ['Register', 'Login', 'Logout', 'RefreshToken', ...]
```

### Resolving Imports

```typescript
import { resolveStdlibImport } from '@isl-lang/isl-stdlib';

const result = resolveStdlibImport('@isl/stdlib-auth/session');
if (!('code' in result)) {
  console.log(result.filePath); // 'intents/session.isl'
  console.log(result.module.name); // '@isl-lang/stdlib-auth'
}
```

### Checking if Import is Stdlib

```typescript
import { isStdlibImport } from '@isl-lang/isl-stdlib';

isStdlibImport('@isl/stdlib-auth');  // true
isStdlibImport('./local.isl');       // false
```

### Searching Modules

```typescript
import { searchModules, findModulesWithBehavior } from '@isl-lang/isl-stdlib';

// Search by keyword
const authModules = searchModules('authentication');

// Find modules providing a specific behavior
const loginModules = findModulesWithBehavior('Login');
```

### Dependency Resolution

```typescript
import { resolveDependencyTree } from '@isl-lang/isl-stdlib';

// Get all dependencies in topological order
const deps = resolveDependencyTree('stdlib-saas');
// ['stdlib-auth', 'stdlib-saas']
```

### Registry Validation

```typescript
import { validateRegistry, getRegistryStats } from '@isl-lang/isl-stdlib';

const { valid, errors } = validateRegistry();
if (!valid) {
  console.error('Registry errors:', errors);
}

const stats = getRegistryStats();
console.log(`Total modules: ${stats.totalModules}`);
console.log(`Total behaviors: ${stats.totalBehaviors}`);
```

## Available Modules

| Module | Category | Description |
|--------|----------|-------------|
| `stdlib-auth` | Security | Authentication & authorization |
| `stdlib-rate-limit` | Security | Rate limiting & throttling |
| `stdlib-audit` | Compliance | Audit logging (SOC2, HIPAA, GDPR) |
| `stdlib-payments` | Business | PCI-compliant payment processing |
| `stdlib-saas` | Business | Multi-tenant SaaS patterns |
| `stdlib-billing` | Business | Subscriptions & metered billing |
| `stdlib-notifications` | Communication | In-app notifications |
| `stdlib-messaging` | Communication | Email, SMS, push |
| `stdlib-realtime` | Communication | WebSockets & pub/sub |
| `stdlib-files` | Storage | File upload & management |
| `stdlib-cache` | Infrastructure | Caching patterns |
| `stdlib-queue` | Infrastructure | Job queues |
| `stdlib-scheduling` | Infrastructure | Cron & scheduled jobs |
| `stdlib-idempotency` | Infrastructure | Request deduplication |
| `stdlib-events` | Architecture | Event sourcing & CQRS |
| `stdlib-workflow` | Architecture | State machines & sagas |
| `stdlib-search` | Data | Full-text search |
| `stdlib-observability` | Operations | Logging, metrics, tracing |
| `stdlib-analytics` | Operations | Product analytics |
| `stdlib-ai` | AI | LLM integration |

## Import Formats

The resolver supports multiple import formats:

```isl
// Recommended: @isl/ prefix
import { User, Login } from "@isl/stdlib-auth"

// Subpath imports
import { Session } from "@isl/stdlib-auth/session"

// NPM package name
import { User } from "@isl-lang/stdlib-auth"

// Short name (for use statements)
use stdlib-auth
```

## Registry Structure

The registry (`registry.json`) contains:

```typescript
interface StdlibRegistry {
  version: string;
  modules: Record<string, StdlibModule>;
  categories: Record<string, CategoryInfo>;
  importAliases: Record<string, string>;
}

interface StdlibModule {
  name: string;           // NPM package name
  version: string;        // Semantic version
  description: string;
  category: string;
  entryPoint: string;     // Main ISL file
  exports: Record<string, string>;  // Subpath -> file mapping
  provides: {
    entities: string[];
    behaviors: string[];
    enums: string[];
    types: string[];
  };
  dependencies: string[];
  peerDependencies: string[];
  keywords: string[];
}
```

## Adding New Modules

See [ADDING_STDLIB_MODULE.md](./ADDING_STDLIB_MODULE.md) for a complete guide.

Quick checklist:
1. Create package in `packages/stdlib-mymodule/`
2. Add ISL files in `intents/` directory
3. Register in `packages/isl-stdlib/registry.json`
4. Run `pnpm run validate-registry` to verify

## API Reference

### Registry Functions

| Function | Description |
|----------|-------------|
| `getRegistry()` | Get the full registry |
| `getModuleNames()` | List all module names |
| `getModule(name)` | Get module by name |
| `getModulesByCategory(cat)` | Get modules in category |
| `searchModules(keyword)` | Search by keyword |
| `findModulesWithEntity(name)` | Find by entity |
| `findModulesWithBehavior(name)` | Find by behavior |
| `resolveDependencyTree(name)` | Get dependencies |
| `validateRegistry()` | Validate registry |
| `getRegistryStats()` | Get statistics |

### Resolver Functions

| Function | Description |
|----------|-------------|
| `parseImportPath(path)` | Parse import into module/subpath |
| `isStdlibImport(path)` | Check if stdlib import |
| `resolveStdlibImport(path)` | Resolve to module/file |
| `resolveImports(paths)` | Resolve multiple imports |
| `getSuggestions(partial)` | Get autocomplete suggestions |
| `moduleFilesExist(name)` | Check if files exist |

## License

MIT
