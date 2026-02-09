# Extending the Gate Calibration Corpus

This guide explains how to add new fixtures to the gate calibration corpus.

## Fixture Structure

Each fixture is a directory containing:

```
bench/corpus/{good|bad}/{fixture-id}/
├── spec.isl          # ISL specification
├── impl.ts           # Implementation file
└── metadata.json     # Expected verdict and known violations
```

## Metadata Format

The `metadata.json` file should follow this structure:

```json
{
  "expectedVerdict": "SHIP" | "NO_SHIP",
  "category": "auth" | "payments" | "crud" | "uploads" | "webhooks" | "search",
  "description": "Human-readable description",
  "knownViolations": [
    {
      "ruleId": "rule-id",
      "severity": "critical" | "high" | "medium" | "low",
      "description": "Description of the violation"
    }
  ],
  "tags": ["optional", "tags"]
}
```

## Adding Good Fixtures

Good fixtures should:
- Pass all gate checks
- Follow best practices
- Have proper validation
- Use proper types (no `any`)
- Not contain hardcoded secrets
- Not use `console.log` in production code

Example:

```typescript
// impl.ts
export async function login(email: string, password: string): Promise<Session> {
  if (!email || email.length === 0) {
    throw new Error('Email required');
  }
  
  const user = await findUserByEmail(email);
  if (!user) {
    throw new Error('User not found');
  }
  
  const isValid = await verifyPassword(user, password);
  if (!isValid) {
    throw new Error('Invalid password');
  }
  
  return await createSession(user.id);
}
```

## Adding Bad Fixtures

Bad fixtures should demonstrate specific violations:

### Common Violation Types

1. **Hardcoded Secrets** (`no-hardcoded-secrets`)
   ```typescript
   if (password === 'admin123') { ... }
   ```

2. **SQL Injection** (`no-sql-injection`)
   ```typescript
   const query = `SELECT * FROM users WHERE id = '${userId}'`;
   ```

3. **Missing Authentication** (`unprotected-sensitive-route`)
   ```typescript
   // No auth check before sensitive operation
   await db.users.delete({ id });
   ```

4. **Console.log in Production** (`no-console-log`)
   ```typescript
   console.log('Debug:', sensitiveData);
   ```

5. **Precondition Violation** (`precondition-violation`)
   ```typescript
   // Missing precondition check
   const result = await process(input);
   ```

6. **Postcondition Violation** (`postcondition-violation`)
   ```typescript
   // Returns wrong type or null when spec requires non-null
   return null;
   ```

7. **Any Type Usage** (`no-any-type`)
   ```typescript
   function process(data: any): any { ... }
   ```

8. **Mock Data in Production** (`no-mock-data`)
   ```typescript
   return mockData(); // Should use real API
   ```

## Testing Your Fixture

After adding a fixture, run the benchmark:

```bash
npx tsx bench/corpus/runner.ts --verbose
```

Check that:
- Good fixtures get `SHIP` verdict
- Bad fixtures get `NO_SHIP` verdict
- Known violations are detected

## Best Practices

1. **One Violation Per Fixture**: Each bad fixture should demonstrate one primary violation type for clearer metrics.

2. **Realistic Examples**: Use patterns that might actually appear in production code.

3. **Clear Violations**: Make violations obvious enough that gate rules can detect them.

4. **Balanced Corpus**: Maintain roughly equal numbers of fixtures across categories.

5. **Documentation**: Add clear descriptions explaining what the fixture tests.

## Categories

- **auth**: Authentication, authorization, session management
- **payments**: Payment processing, billing, transactions
- **crud**: Create, read, update, delete operations
- **uploads**: File uploads, media handling
- **webhooks**: Webhook delivery, event handling
- **search**: Search functionality, indexing

## Running the Generator

To generate fixtures programmatically:

```bash
npx tsx bench/corpus/generate-fixtures.ts
```

This will create 50+ good and 50+ bad fixtures automatically.
