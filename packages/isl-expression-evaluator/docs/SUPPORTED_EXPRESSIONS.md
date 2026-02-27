# Supported Expressions v1

This document describes the expressions supported by the ISL Expression Evaluator v1.

## Operators

### Comparison Operators

| Operator | Description | Example | Tri-State Behavior |
|---------|-------------|---------|-------------------|
| `==` | Equality | `x == 5` | Returns `unknown` if either operand is `unknown` |
| `!=` | Inequality | `x != 5` | Returns `unknown` if either operand is `unknown` |
| `<` | Less than | `x < 5` | Returns `unknown` if either operand is `unknown` |
| `<=` | Less than or equal | `x <= 5` | Returns `unknown` if either operand is `unknown` |
| `>` | Greater than | `x > 5` | Returns `unknown` if either operand is `unknown` |
| `>=` | Greater than or equal | `x >= 5` | Returns `unknown` if either operand is `unknown` |

### Logical Operators

| Operator | Description | Example | Tri-State Behavior |
|---------|-------------|---------|-------------------|
| `&&` or `and` | Logical AND | `x && y` | `unknown && true = unknown`, `unknown && false = false` |
| `\|\|` or `or` | Logical OR | `x \|\| y` | `unknown \|\| false = unknown`, `unknown \|\| true = true` |
| `!` or `not` | Logical NOT | `!x` | `!unknown = unknown` |
| `implies` | Implication | `x implies y` | `false implies X = true`, `true implies unknown = unknown` |

**Implication Truth Table:**
- `false implies false` = `true`
- `false implies true` = `true`
- `false implies unknown` = `true`
- `true implies true` = `true`
- `true implies false` = `false`
- `true implies unknown` = `unknown`
- `unknown implies X` = `unknown`

## Literals

### String Literals

```isl
"hello"
"world"
""
```

- Empty string evaluates to `true` (non-null value)
- Use `is_valid()` to check for non-empty strings

### Number Literals

```isl
42
3.14
-10
0
```

- All numbers evaluate to `true` (non-null value)

### Boolean Literals

```isl
true
false
```

- Direct boolean values

### Null Literal

```isl
null
```

- Evaluates to `false` (falsy)

## Property Access

### Member Access

```isl
user.name
user.profile.email
foo.bar.baz
```

- Returns `unknown` if any intermediate property is missing
- Uses adapter's `getProperty()` method

### Index Access (Basic Support)

```isl
array[0]
items[1]
```

- Basic support for array indexing
- Returns `unknown` if index is out of bounds

## Function Predicates

### `is_valid(value)`

Check if a value is valid.

```isl
is_valid(email)
is_valid(user.name)
```

**Behavior:**
- Strings: Returns `true` if length > 0, `false` otherwise
- Arrays: Returns `true` if length > 0, `false` otherwise
- Null/undefined: Returns `false`
- Other types: Returns `true` if non-null

**Tri-State:** Returns `unknown` if value is `unknown`

### `length(value)`

Get the length of a string or array.

```isl
length(name)
length(items)
```

**Behavior:**
- Strings: Returns character count
- Arrays: Returns element count
- Other types: Returns `unknown`

**Tri-State:** Returns `unknown` if value is `unknown`

### `exists(entityName, criteria?)`

Check if an entity exists.

```isl
exists("User", { id: "123" })
User.exists({ id: "123" })
```

**Behavior:**
- Requires adapter implementation
- Returns `true` if entity exists, `false` otherwise
- Returns `unknown` if cannot determine

**Tri-State:** Returns `unknown` if entity lookup cannot be determined

### `lookup(entityName, criteria?)`

Lookup an entity.

```isl
lookup("User", { id: "123" })
User.lookup({ id: "123" })
```

**Behavior:**
- Requires adapter implementation
- Returns entity value if found
- Returns `unknown` if not found or cannot determine

**Tri-State:** Returns `unknown` if lookup cannot be determined

## Quantifiers

### `all variable in collection: predicate`

Check if all elements in a collection satisfy a predicate.

```isl
all item in items: item > 0
all user in users: user.age >= 18
```

**Behavior:**
- Returns `true` if all elements satisfy predicate
- Returns `false` if any element fails predicate
- Returns `unknown` if any element evaluation is `unknown`
- Empty collection: Returns `true` (vacuous truth)

**Tri-State:**
- If any element evaluates to `unknown`, result is `unknown`
- If any element evaluates to `false`, result is `false`
- Otherwise, result is `true`

### `any variable in collection: predicate`

Check if at least one element in a collection satisfies a predicate.

```isl
any item in items: item < 0
any user in users: user.role == "admin"
```

**Behavior:**
- Returns `true` if at least one element satisfies predicate
- Returns `false` if no elements satisfy predicate
- Returns `unknown` if cannot determine (e.g., all unknown)
- Empty collection: Returns `false`

**Tri-State:**
- If any element evaluates to `true`, result is `true`
- If any element evaluates to `unknown`, result is `unknown` (if no true found)
- Otherwise, result is `false`

## Variables

### Identifier Access

```isl
x
userId
result
input
```

**Special Variables:**
- `result`: Result value (for postconditions)
- `input`: Input values (for behaviors)
- `true`, `false`, `null`: Literal values

**Tri-State:**
- Returns `unknown` if variable is not in context
- Returns `true`/`false` based on value if present

## Examples

### Simple Comparisons

```isl
x == 5
y != 10
age >= 18
price < 100.0
```

### Logical Combinations

```isl
x > 5 && y < 10
is_valid(email) || is_valid(phone)
user.role == "admin" implies user.permissions.length > 0
```

### Postconditions

```isl
result.success == true
result.data.id != null
old(user.balance) < user.balance
```

### Invariants

```isl
user.age >= 0
account.balance >= 0
all order in orders: order.total > 0
```

### Complex Expressions

```isl
(x > 0 && y > 0) || (x < 0 && y < 0)
is_valid(email) && email.length > 5 && email.contains("@")
all item in cart.items: item.quantity > 0 && item.price > 0
```

## Precedence

Operators are evaluated in the following order (highest to lowest):

1. Member access (`.`)
2. Function calls (`()`)
3. Unary operators (`!`, `-`)
4. Comparison (`<`, `<=`, `>`, `>=`)
5. Equality (`==`, `!=`)
6. Logical AND (`&&`, `and`)
7. Logical OR (`||`, `or`)
8. Implication (`implies`)

Use parentheses to override precedence:

```isl
(x > 5 && y < 10) || z == 0
```

## Tri-State Propagation

The evaluator propagates `unknown` values through all operations:

- **Comparisons**: `unknown == 5` → `unknown`
- **Logical AND**: `unknown && true` → `unknown`, `unknown && false` → `false`
- **Logical OR**: `unknown || false` → `unknown`, `unknown || true` → `true`
- **Implication**: `unknown implies X` → `unknown`, `false implies X` → `true`
- **Quantifiers**: `all x in items: unknown` → `unknown`

## Postcondition Primitives

For postcondition-specific constructs like "field increased by delta" and "no Entity created",
see [POSTCONDITION_PRIMITIVES.md](./POSTCONDITION_PRIMITIVES.md).

**Supported Postcondition Primitives:**
- `increased_by(field, delta)`: Verify field increased by specific amount
- `none_created(entityType)`: Verify no entities of type were created
- `incremented(field)`: Verify field was incremented (any positive amount)
- `entity_created(entityType)`: Verify entity was created

## Arithmetic Operators

| Operator | Description | Example |
|---------|-------------|---------|
| `+` | Addition (or string concatenation) | `x + 5`, `"hello" + "world"` |
| `-` | Subtraction | `x - 5` |
| `*` | Multiplication | `x * 2` |
| `/` | Division | `x / 2` (returns unknown on divide-by-zero) |
| `%` | Modulo | `x % 10` |

## Limitations (v1)
- Limited index access support
- No lambda expressions (planned for v2)
- No pattern matching (planned for v2)
- No temporal operators (planned for v2)

## String Methods

| Method | Description | Example |
|--------|-------------|---------|
| `contains` / `includes` | Substring check | `email.contains("@")` |
| `startsWith` | Prefix check | `path.startsWith("/api")` |
| `endsWith` | Suffix check | `file.endsWith(".json")` |
| `trim`, `toLowerCase`, `toUpperCase` | Transform | `name.trim()` |
| `split`, `substring`, `slice` | Split/extract | `str.split(",")` |
| `replace`, `replaceAll` | Replace | `str.replace("old", "new")` |
| `charAt` | Character at index | `str.charAt(0)` |

## Future Enhancements
- More quantifiers (`none`, `count`, `sum`)
- Lambda expressions
- Pattern matching
- Temporal operators (`old()`, `eventually`, `always`)
