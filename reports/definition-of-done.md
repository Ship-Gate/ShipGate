# Definition of Done - Package Completion Template

Every package must meet these criteria before being considered "complete":

## 1. Exports ✅
- [ ] Package has a clear entry point (index.ts/js or src/index.ts/js)
- [ ] All public APIs are exported
- [ ] Type definitions are included (.d.ts files)
- [ ] Package.json exports field is properly configured

## 2. Tests ✅
- [ ] Unit tests cover core functionality (>80% coverage)
- [ ] Integration tests for key workflows
- [ ] Tests pass in CI
- [ ] No skipped or disabled tests without justification

## 3. Documentation ✅
- [ ] README.md with:
  - Package purpose and use case
  - Installation instructions
  - Usage examples
  - API documentation (or link to docs)
- [ ] Code comments for public APIs
- [ ] JSDoc/TSDoc for exported functions/classes

## 4. Sample/Examples ✅
- [ ] At least one working example
- [ ] Example demonstrates main use case
- [ ] Example is runnable (if applicable)

## 5. Integration ✅
- [ ] Package integrates correctly with dependent packages
- [ ] No breaking changes to existing integrations
- [ ] CLI commands work (if applicable)
- [ ] VSCode extension works (if applicable)

## 6. CI ✅
- [ ] Package builds successfully
- [ ] Tests run in CI
- [ ] Type checking passes
- [ ] Linting passes
- [ ] No stub implementations in production code

## 7. No Stubs ✅
- [ ] No `throw new Error("Not implemented")` in production code
- [ ] No TODO/FIXME markers in core logic
- [ ] No placeholder return values (`return null`, `return {}`)
- [ ] All exported functions have real implementations

## 8. Production Ready ✅
- [ ] Error handling is implemented
- [ ] Input validation is present
- [ ] Logging uses proper logger (not console.log)
- [ ] No hardcoded secrets or credentials
- [ ] Environment variables are documented

---
*This template should be used as a checklist for each package completion.*
