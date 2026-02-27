# Acceptance Test: ISL Discovery Engine

## Test Scenario: Fastify Project

### Setup

1. Create a sample Fastify project with:
   - ISL spec file (`specs/auth.isl`) with behaviors: `Login`, `Register`, `Logout`
   - Fastify routes (`src/routes/auth.ts`) with corresponding handlers

### Test Case 1: Basic Discovery

**Given**: A Fastify project with ISL specs and routes

**When**: Running `isl bind specs/auth.isl --impl ./src`

**Then**: 
- ✅ Discovery engine finds ISL symbols (behaviors)
- ✅ Discovery engine finds code symbols (routes)
- ✅ At least 80% of routes/handlers are automatically mapped
- ✅ Bindings file `.shipgate.bindings.json` is generated
- ✅ Confidence scores are calculated for each binding

### Test Case 2: Route Matching

**Given**: ISL behavior `Login` and route `POST /api/login`

**When**: Discovery runs

**Then**:
- ✅ `Login` behavior is bound to `POST /api/login` route
- ✅ Confidence score ≥ 0.80
- ✅ Evidence includes route matching strategy
- ✅ Binding includes file path and line numbers

### Test Case 3: Naming Convention Matching

**Given**: ISL behavior `CreateUser` and function `createUser`

**When**: Discovery runs

**Then**:
- ✅ `CreateUser` is bound to `createUser` function
- ✅ Confidence score ≥ 0.65
- ✅ Evidence includes naming convention match

### Test Case 4: Multiple Specs

**Given**: Multiple ISL spec files (`auth.isl`, `users.isl`)

**When**: Running `isl bind specs/auth.isl specs/users.isl`

**Then**:
- ✅ All spec files are processed
- ✅ Bindings from all specs are included
- ✅ Bindings file references all spec files

### Test Case 5: Unbound Symbols

**Given**: ISL behavior `NotFound` with no matching code

**When**: Discovery runs

**Then**:
- ✅ `NotFound` appears in `unboundSymbols` array
- ✅ Statistics show unbound count
- ✅ Discovery completes successfully (doesn't fail)

## Success Criteria

✅ **80%+ Coverage**: At least 80% of ISL behaviors are automatically bound to code

✅ **High Confidence**: Average confidence score ≥ 0.70

✅ **Correct Bindings**: Bindings correctly map spec symbols to code symbols

✅ **Evidence**: Each binding includes evidence explaining the match

✅ **File Generation**: `.shipgate.bindings.json` is generated with correct format

## Example Output

```json
{
  "version": "1.0.0",
  "timestamp": "2026-02-09T12:00:00.000Z",
  "specs": ["specs/auth.isl"],
  "bindings": [
    {
      "isl": {
        "type": "behavior",
        "name": "Login",
        "domain": "UserAuthentication",
        "specFile": "specs/auth.isl",
        "location": { "start": { "line": 30, "column": 1 }, "end": { "line": 74, "column": 1 } }
      },
      "code": {
        "type": "route",
        "name": "POST /api/login",
        "file": "src/routes/auth.ts",
        "location": { "start": { "line": 45, "column": 1 }, "end": { "line": 45, "column": 1 } },
        "metadata": { "method": "POST", "path": "/api/login" }
      },
      "confidence": 0.85,
      "evidence": [
        {
          "type": "route_matching",
          "description": "Route path contains behavior name: POST /api/login",
          "confidence": 0.80
        }
      ],
      "strategy": "route_matching"
    }
  ]
}
```

## CLI Output Example

```
🔗 ISL Bind - Discovery Engine

  Spec files: specs/auth.isl
  Root directory: ./src
  Output: .shipgate.bindings.json

[Discovery] Starting discovery for 1 spec file(s)
[Discovery] Root directory: ./src
[Discovery] Extracting ISL symbols...
[Discovery] Found 3 ISL symbols
[Discovery] Scanning codebase...
[Discovery] Found 5 code symbols
[Discovery] Matching symbols...
[Discovery] Discovery complete:
  - Bindings found: 3
  - Unbound ISL symbols: 0
  - Unmatched code symbols: 2
  - Average confidence: 82.5%

✓ Bindings generated successfully

  Output: .shipgate.bindings.json

Statistics:
  ISL symbols: 3
  Code symbols: 5
  Bindings: 3
  Coverage: 100.0%
  Average confidence: 82.5%

Strategy breakdown:
  route_matching: 2
  naming_conventions: 1

High confidence bindings (≥80%): 3

  Login → POST /api/login
    src/routes/auth.ts
    Confidence: 85.0% (route_matching)

  Register → POST /api/register
    src/routes/auth.ts
    Confidence: 85.0% (route_matching)

  Logout → POST /api/logout
    src/routes/auth.ts
    Confidence: 80.0% (naming_conventions)
```

## Test Execution

Run acceptance tests:

```bash
cd packages/isl-discovery
pnpm test
```

Run on sample Fastify project:

```bash
# Setup sample project
mkdir test-fastify-project
cd test-fastify-project
# ... create ISL spec and Fastify routes ...

# Run discovery
isl bind specs/auth.isl --impl ./src --verbose

# Verify bindings file
cat .shipgate.bindings.json
```
