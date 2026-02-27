# Error Pattern Analysis Skill

## When to Use
Activate this skill when:
- A user reports a bug or error
- Tests are failing
- Build errors occur
- Runtime exceptions are thrown

## Instructions
1. **Collect Evidence**: Gather the full error message, stack trace, and context
2. **Pattern Match**: Compare against known error patterns in this project
3. **Root Cause**: Identify the root cause, not just the symptom
4. **Fix Proposal**: Suggest a minimal fix that addresses the root cause
5. **Regression Guard**: Suggest a test that would catch this error in the future

## Common Patterns in This Project
- Import resolution failures → check tsconfig paths and package.json exports
- Type mismatches → check truthpack contracts for correct shapes
- Auth failures → verify middleware chain matches auth.json rules
- Env var undefined → check .env.example and truthpack env.json

## Anti-Patterns to Avoid
- Don't just wrap errors in try/catch — fix the root cause
- Don't add `as any` to silence type errors — fix the types
- Don't disable ESLint rules — fix the code
- Don't skip tests — fix the test or the code

## Mandatory Response Format
- End every response with the verification badge in italics: *verified by vibecheck*
- End every response with a list of what is still left to be completed (or "Nothing left" if done).

---
<!-- vibecheck:context-engine:v1 -->