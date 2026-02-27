# @intentos/spec-reviewer

AI-powered ISL specification reviewer that provides suggestions and catches issues.

## Features

- **Completeness Analysis**: Detects missing specs, incomplete behaviors, and gaps
- **Consistency Checking**: Finds internal inconsistencies and type mismatches
- **Security Review**: Identifies vulnerabilities, missing controls, and PII handling
- **Performance Analysis**: Catches N+1 patterns, missing indexes, unbounded queries
- **Naming Conventions**: Ensures consistent naming throughout the spec
- **Best Practices**: Enforces ISL patterns and conventions
- **AI-Powered Suggestions**: Optional LLM integration for deeper analysis
- **Multiple Output Formats**: Console, Markdown, and SARIF for CI integration

## Installation

```bash
pnpm add @intentos/spec-reviewer
```

## Quick Start

```typescript
import { review, formatConsole } from '@intentos/spec-reviewer';

// Review a domain
const result = await review(domain, {
  categories: ['security', 'completeness', 'performance'],
  minSeverity: 'warning',
});

// Format for console output
console.log(formatConsole(result));
```

## API Reference

### `review(domain, options?)`

Main entry point for reviewing a domain specification.

```typescript
const result = await review(domain, {
  // Categories to analyze (default: all)
  categories: ['completeness', 'consistency', 'security', 'performance', 'naming', 'bestPractices'],
  
  // Enable AI analysis
  useAI: false,
  
  // Minimum severity to include
  minSeverity: 'info', // 'critical' | 'warning' | 'info'
  
  // Include improvement suggestions
  includeSuggestions: true,
  
  // Minimum confidence for suggestions
  minSuggestionConfidence: 0.5,
});
```

### Review Result

```typescript
interface ReviewResult {
  summary: {
    score: number;           // 0-100
    issues: number;          // Total issue count
    suggestions: number;     // Suggestion count
    criticalIssues: number;  // Critical issue count
  };
  
  categories: {
    completeness: CategoryResult;
    consistency: CategoryResult;
    security: CategoryResult;
    performance: CategoryResult;
    naming: CategoryResult;
    bestPractices: CategoryResult;
  };
  
  issues: Issue[];
  suggestions: Suggestion[];
  aiAnalysis?: AIReviewResult;
  
  metadata: {
    reviewedAt: string;
    duration: number;
    categoriesAnalyzed: string[];
    aiEnabled: boolean;
  };
}
```

### Individual Analyzers

You can also run analyzers individually:

```typescript
import {
  analyzeCompleteness,
  analyzeConsistency,
  analyzeSecurity,
  analyzePerformance,
  analyzeNaming,
  analyzeBestPractices,
} from '@intentos/spec-reviewer';

const securityResult = analyzeSecurity(domain);
console.log(`Security score: ${securityResult.score}/100`);
```

### Reporters

#### Console

```typescript
import { formatConsole } from '@intentos/spec-reviewer';

const output = formatConsole(result, {
  colors: true,     // ANSI colors
  verbose: true,    // Show all details
  showSuggestions: true,
  maxIssues: 50,
});
```

#### Markdown

```typescript
import { formatMarkdown, generateBadge } from '@intentos/spec-reviewer';

const markdown = formatMarkdown(result, {
  includeTableOfContents: true,
  includeSuggestions: true,
  includeTimestamp: true,
});

// Generate shield badge
const badge = generateBadge(result.summary.score);
```

#### SARIF (for CI/GitHub)

```typescript
import { formatSarif } from '@intentos/spec-reviewer';

const sarif = formatSarif(result, {
  specUri: 'src/domain.isl',
  toolVersion: '0.1.0',
});

// Write to file for GitHub Code Scanning
fs.writeFileSync('review-results.sarif', sarif);
```

### AI Integration

```typescript
import { review, createAIClient } from '@intentos/spec-reviewer';

const result = await review(domain, {
  useAI: true,
  aiConfig: {
    provider: 'anthropic',  // 'anthropic' | 'openai' | 'mock'
    model: 'claude-sonnet-4-20250514',
    apiKey: process.env.ANTHROPIC_API_KEY,
  },
});

// AI provides additional insights
console.log(result.aiAnalysis?.suggestions);
```

### Suggestion Templates

```typescript
import { findApplicableTemplates, getTemplateById } from '@intentos/spec-reviewer';

// Find templates for an entity
const templates = findApplicableTemplates({
  entityName: 'User',
  fieldName: 'email',
});

// Get specific template
const template = getTemplateById('add-timestamps');
const code = template?.generateCode?.({ entityName: 'User' });
```

## Review Categories

### Completeness

Checks for:
- Missing descriptions on behaviors
- Missing input/output blocks
- Missing pre/postconditions
- Entity invariants
- Unused type definitions

### Consistency

Checks for:
- Undefined type references
- Entity reference errors
- Duplicate error codes
- Invariant conflicts
- Lifecycle consistency

### Security

Checks for:
- Sensitive data without `[secret]` annotation
- PII without `[pii]` annotation
- Missing rate limiting
- Missing authentication
- Potential injection vulnerabilities
- Unbounded string inputs

Includes CWE references for common weaknesses.

### Performance

Checks for:
- Missing indexes on foreign keys
- N+1 query patterns
- Unbounded list operations
- Missing pagination
- Expensive computed fields
- Missing batch operations

### Naming

Checks for:
- PascalCase for entities and behaviors
- camelCase/snake_case for fields
- Plural entity names
- Verb-first behavior names
- Consistent conventions
- Hungarian notation

### Best Practices

Checks for:
- Domain version
- Entity ID fields
- Timestamp fields
- Idempotency support
- CQRS patterns
- Event sourcing candidates

## CLI Usage (coming soon)

```bash
# Review a spec file
isl-review spec.isl

# Output as markdown
isl-review spec.isl --format markdown -o report.md

# Output as SARIF for GitHub
isl-review spec.isl --format sarif -o results.sarif

# Enable AI analysis
isl-review spec.isl --ai --provider anthropic
```

## CI/CD Integration

### GitHub Actions

```yaml
- name: Review ISL Specs
  run: |
    npx isl-review intents/*.isl --format sarif -o results.sarif

- name: Upload SARIF
  uses: github/codeql-action/upload-sarif@v2
  with:
    sarif_file: results.sarif
```

## Examples

### Typical Security Issues

```isl
entity User {
  id: UUID [unique, immutable]
  email: String        // ⚠️ Missing [pii] annotation
  password: String     // ❌ Missing [secret] annotation
}

behavior CreateUser {
  // ⚠️ No security block for state-modifying behavior
  input { ... }
  output { ... }
}
```

### Typical Performance Issues

```isl
entity Order {
  user_id: UUID   // ⚠️ Foreign key not indexed
}

behavior ListOrders {
  input {
    // ⚠️ No limit parameter - unbounded query
  }
  output {
    success: List<Order>
  }
}
```

## License

MIT
