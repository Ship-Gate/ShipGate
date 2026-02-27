# SMT Verification Limitations

This document describes the limitations and supported fragments of ISL SMT verification.

## Supported Expression Fragments

### ✅ Fully Supported

#### Boolean Logic
- `true`, `false`
- `and`, `or`, `not`
- `implies`, `iff`
- Short-circuit evaluation

#### Arithmetic (Integers)
- Comparisons: `==`, `!=`, `<`, `<=`, `>`, `>=`
- Operations: `+`, `-`, `*`, `/`, `%`
- Unary: `-` (negation)
- Bounded integer arithmetic (builtin solver)
- Unbounded integer arithmetic (Z3/CVC5)

#### Arithmetic (Reals)
- Limited support in builtin solver
- Full support in Z3/CVC5

#### Strings
- String literals: `"hello"`
- String length: `str.length` → `str.len` (native SMT-LIB)
- String equality: `==`, `!=`
- **Not supported**: String concatenation, substring operations (future work)

#### Arrays/Maps
- Array access: `arr[index]` → uninterpreted `select`
- Array update: `arr[index] = value` → uninterpreted `store`
- **Not supported**: Array length, array initialization (future work)

#### Null Handling
- Null checks: `x == null`, `x != null` → encoded as boolean flags
- Null-safe property access

#### Enums
- Enum variants as distinct constants
- Enum exhaustiveness checking
- Enum comparisons

#### Quantifiers
- `all x in collection. P(x)` → `forall`
- `some x in collection. P(x)` → `exists`
- `none x in collection. P(x)` → `forall x. ¬P(x)`
- **Limitation**: Quantifiers require Z3/CVC5 (not supported in builtin solver)
- **Limitation**: Quantifier performance degrades with large domains

#### Pre/Post State
- `old(expr)` → pre-state references
- Postcondition verification: `pre => post`
- State splitting for pre/post verification

### ⚠️ Partially Supported

#### Type Constraints
- `min`, `max` → arithmetic constraints
- `positive`, `non_negative`, `negative` → arithmetic constraints
- `min_length`, `max_length` → string length constraints
- `not_empty` → string length > 0
- **Not supported**: Custom constraint functions

#### Entity Methods
- `Entity.exists(key)` → uninterpreted function
- `Entity.lookup(key)` → uninterpreted function
- `Entity.count` → uninterpreted constant
- **Limitation**: No semantic meaning - treated as uninterpreted symbols

#### Member Access
- Simple: `obj.field`
- Nested: `obj.field.subfield`
- **Not supported**: Dynamic property access, computed properties

### ❌ Not Supported

#### Temporal Logic
- `eventually`, `always`, `until` → **Not supported** (use temporal verifier instead)
- Time-based constraints → **Not supported**

#### Side Effects
- Mutations, I/O operations → **Not supported**
- State changes → **Not supported** (use runtime verification)

#### Complex String Operations
- Concatenation, substring, regex → **Not supported**
- String formatting → **Not supported**

#### Floating Point Precision
- Exact floating point equality → **Not supported** (use epsilon comparisons)
- Floating point arithmetic precision → **Limited**

#### Recursive Functions
- Recursive predicates → **Not supported**
- Recursive data structures → **Not supported**

#### Higher-Order Functions
- Function parameters → **Not supported**
- Lambda expressions → **Not supported**

## Solver-Specific Limitations

### Builtin Solver
- **Boolean SAT**: Up to ~20 variables
- **Integer Arithmetic**: Bounded (typically -1000 to 1000)
- **Quantifiers**: Not supported
- **Strings**: Not supported
- **Arrays**: Not supported
- **Timeout**: Hard limit enforced
- **Memory**: Limited to process memory

### Z3 Solver
- **All SMT-LIB 2 theories**: Supported
- **Quantifiers**: Supported (may timeout on complex queries)
- **Strings**: Full support
- **Arrays**: Full support
- **Timeout**: Configurable (default: 5s)
- **Memory**: Configurable (default: 512MB)

### CVC5 Solver
- **All SMT-LIB 2 theories**: Supported
- **Quantifiers**: Supported (may timeout on complex queries)
- **Strings**: Full support with `--strings-exp`
- **Arrays**: Full support
- **Timeout**: Configurable (default: 5s)
- **Memory**: Configurable (default: 512MB)

## Performance Considerations

### Query Complexity
- **Simple constraints** (< 10 variables): < 100ms
- **Medium constraints** (10-50 variables): 100ms - 1s
- **Complex constraints** (50+ variables): 1s - 5s (may timeout)
- **Quantified queries**: Highly variable, may timeout

### Timeout Handling
- Default timeout: 5 seconds per query
- Global timeout: 60 seconds for entire SMT stage
- Timeouts return `unknown` verdict (not failure)

### Memory Limits
- Default: 512MB per solver process
- Processes killed if memory limit exceeded
- No memory leaks (process isolation)

## Encoding Limitations

### Expression Encoding Failures
If an expression cannot be encoded to SMT-LIB, the verifier will:
1. Return `unknown` verdict
2. Log the unsupported feature
3. Continue with other checks

### Common Encoding Failures
- Unsupported operators (e.g., `**` for exponentiation)
- Complex nested member access
- Dynamic property access
- Unsupported function calls

## Recommendations

### When to Use SMT Verification
✅ **Good candidates:**
- Precondition satisfiability checks
- Postcondition implication verification
- Refinement type constraints
- Simple arithmetic properties
- Boolean logic properties

❌ **Not suitable:**
- Temporal properties (use temporal verifier)
- Complex string operations
- Side-effect verification (use runtime verification)
- Performance properties (use temporal verifier)

### Best Practices
1. **Prefer quantifier-free formulas** when possible
2. **Use bounded domains** for better performance
3. **Set appropriate timeouts** (5-10s for most queries)
4. **Use Z3/CVC5** for production (builtin is for development)
5. **Combine with runtime verification** for complete coverage

## Future Work

### Planned Features
- [ ] String concatenation support
- [ ] Array length constraints
- [ ] More built-in functions
- [ ] Better quantifier handling
- [ ] WASM solver fallback
- [ ] Incremental solving
- [ ] Proof generation

### Known Issues
- Quantifier performance degrades with large domains
- String operations limited to length and equality
- No support for recursive predicates
- Floating point precision issues
