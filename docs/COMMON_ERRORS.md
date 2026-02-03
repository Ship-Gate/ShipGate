# Common ISL Errors

This guide covers the most common errors you'll encounter when writing ISL specifications, with explanations of why they occur and how to fix them.

## Error Format

All ISL errors follow a consistent format:

```
error[E0200]: Type mismatch
  --> specs/payment.isl:7:9
   |
 7 |   post: sender.balance == old(sender.balance) - amount
   |         ^^^^^^^^^^^^^^    ^^^^^^^^^^^^^^^^^^^^^^^^
   |         String             Number
   |
   = note: sender.balance is typed as String but compared with Number
   = help: Did you mean to use sender.balanceAmount? (Number field)
```

Each error includes:
- **Error code** (e.g., `E0200`) - stable identifier for documentation
- **Location** - file, line, and column where the error occurs
- **Code snippet** - shows the problematic code with caret indicators
- **Why** - explanation of what went wrong (shown as `= note:`)
- **How to fix** - actionable suggestions (shown as `= help:`)

## Top 20 Common Errors

### Parser Errors (E0001-E0199)

#### E0002: Unterminated string literal

**Why:** A string was started with a quote but never closed. Strings must be enclosed in matching quotes.

**How to fix:**
- Add the missing closing quote
- For multi-line strings, use triple quotes `"""..."""`
- Escape special characters with backslash

**Example:**
```isl
// ❌ Bad
description: "This string never ends

// ✅ Good
description: """
  This is a long description
  that spans multiple lines
"""
```

#### E0100: Unexpected token

**Why:** The parser encountered a token that doesn't fit the expected syntax. Often indicates a typo or missing punctuation.

**How to fix:**
- Check for typos in keywords
- Verify syntax matches ISL specification
- Use proper punctuation (colons, braces, parentheses)

**Example:**
```isl
// ❌ Bad
entiy User {  // typo: "entiy"
  id UUID     // missing colon
}

// ✅ Good
entity User {
  id: UUID
}
```

#### E0105: Missing closing brace

**Why:** A block was opened with `{` but the matching closing brace `}` was not found.

**How to fix:**
- Add the missing closing brace
- Use an editor with bracket matching
- Format code to make nesting levels clear

**Example:**
```isl
// ❌ Bad
entity Account {
  id: UUID
  fields {
    name: String
  // missing } for fields
// missing } for entity

// ✅ Good
entity Account {
  id: UUID
  fields {
    name: String
  }
}
```

#### E0109: Duplicate entity

**Why:** An entity with this name has already been defined. Each entity must have a unique name.

**How to fix:**
- Rename one of the duplicate entities
- Remove the duplicate definition
- If importing, use namespacing or aliases

**Example:**
```isl
// ❌ Bad
entity User {
  id: UUID
}

entity User {  // duplicate!
  name: String
}

// ✅ Good
entity User {
  id: UUID
  name: String
}
```

#### E0102: Expected identifier

**Why:** The parser expected an identifier (name) but found something else, often due to missing name or syntax error.

**How to fix:**
- Add the missing identifier name
- Check for syntax errors before the identifier

**Example:**
```isl
// ❌ Bad
entity {  // missing name
  id: UUID
}

// ✅ Good
entity User {
  id: UUID
}
```

### Type Errors (E0200-E0299)

#### E0200: Type mismatch

**Why:** The type of a value doesn't match what was expected. ISL is statically typed, so types must be consistent.

**How to fix:**
- Check the expected type and adjust the value
- Use type conversion functions if needed (parseInt, toString)
- Verify field names and types in entity definitions

**Example:**
```isl
// ❌ Bad
entity Account {
  balance: Decimal
}

behavior Transfer {
  postconditions {
    sender.balance == "100.00"  // String vs Decimal
  }
}

// ✅ Good
entity Account {
  balance: Decimal
}

behavior Transfer {
  postconditions {
    sender.balance == 100.00  // Decimal literal
  }
}
```

#### E0201: Undefined type

**Why:** The type referenced hasn't been defined. Could be a typo in a built-in type or a missing custom type definition.

**How to fix:**
- Check spelling of the type name
- Define the type before using it
- Import the type from the correct module
- Use correct casing (types start with uppercase)

**Built-in types:** `String`, `Int`, `Decimal`, `Boolean`, `UUID`, `Timestamp`, `Duration`, `List<T>`, `Map<K,V>`, `Set<T>`, `Optional<T>`

**Example:**
```isl
// ❌ Bad
entity User {
  id: uuid       // should be UUID (case-sensitive)
  age: Intger    // typo: should be Int
  role: Rol      // undefined custom type
}

// ✅ Good
enum Role { Admin, User, Guest }

entity User {
  id: UUID
  age: Int
  role: Role
}
```

#### E0202: Undefined field

**Why:** You're trying to access a field that doesn't exist on this type. Often caused by typos in field names.

**How to fix:**
- Check the entity definition for available fields
- Correct the typo in the field name
- Use autocomplete in your editor

**Example:**
```isl
// ❌ Bad
entity Account {
  balance: Decimal
}

behavior Check {
  preconditions {
    account.balace > 0  // typo: "balace"
  }
}

// ✅ Good
entity Account {
  balance: Decimal
}

behavior Check {
  preconditions {
    account.balance > 0  // correct spelling
  }
}
```

#### E0210: Incompatible comparison

**Why:** You're trying to compare values that cannot be meaningfully compared (e.g., String with Boolean).

**How to fix:**
- Ensure both sides of comparison have compatible types
- Convert types explicitly if needed
- Use appropriate comparison methods for complex types

**Example:**
```isl
// ❌ Bad
postconditions {
  user.name == user.age  // String == Int
}

// ✅ Good
postconditions {
  user.age >= 18  // Int >= Int
}
```

### Semantic Errors (E0300-E0399)

#### E0300: Undefined variable

**Why:** You're using a variable that hasn't been declared in the current scope.

**How to fix:**
- Check spelling of the variable name
- Declare the variable in the appropriate scope
- Check if the variable should be an input parameter

**Example:**
```isl
// ❌ Bad
behavior Transfer {
  input {
    amount: Decimal
  }
  preconditions {
    ammount > 0  // typo: "ammount"
  }
}

// ✅ Good
behavior Transfer {
  input {
    amount: Decimal
  }
  preconditions {
    amount > 0  // correct spelling
  }
}
```

#### E0301: Undefined entity

**Why:** You're referencing an entity that hasn't been defined in this domain.

**How to fix:**
- Check spelling of the entity name
- Import the entity from the correct domain if it exists elsewhere
- Define the entity before using it
- Use correct casing (entities start with uppercase)

**Example:**
```isl
// ❌ Bad
behavior Transfer {
  preconditions {
    Account.exists(senderId)  // Account not defined
  }
}

// ✅ Good
entity Account {
  id: UUID
}

behavior Transfer {
  preconditions {
    Account.exists(senderId)  // Account is now defined
  }
}
```

#### E0302: Undefined behavior

**Why:** You're referencing a behavior that hasn't been defined in this domain.

**How to fix:**
- Check spelling of the behavior name
- Import the behavior from the correct domain if it exists elsewhere
- Define the behavior before referencing it
- Use correct casing (behaviors start with uppercase)

**Example:**
```isl
// ❌ Bad
scenario "test" {
  given {
    Transfer(amount: 100)  // Transfer not defined
  }
}

// ✅ Good
behavior Transfer {
  input {
    amount: Decimal
  }
}

scenario "test" {
  given {
    Transfer(amount: 100)  // Transfer is now defined
  }
}
```

#### E0304: old() outside postcondition

**Why:** The `old()` function captures values before a behavior executes. It only makes sense in postconditions.

**How to fix:**
- Move the expression to a postcondition
- In preconditions, reference values directly without `old()`

**Example:**
```isl
// ❌ Bad
behavior Transfer {
  preconditions {
    old(sender.balance) >= amount  // old() invalid here
  }
}

// ✅ Good
behavior Transfer {
  preconditions {
    sender.balance >= amount  // direct reference
  }
  postconditions {
    sender.balance == old(sender.balance) - amount  // old() valid here
  }
}
```

#### E0305: result outside postcondition

**Why:** The `result` keyword refers to the return value of a behavior. It only exists after the behavior completes.

**How to fix:**
- Move the expression to a postcondition
- Use output fields to define what the behavior returns

**Example:**
```isl
// ❌ Bad
behavior CalculateTotal {
  preconditions {
    result > 0  // result doesn't exist yet
  }
}

// ✅ Good
behavior CalculateTotal {
  output {
    total: Decimal
  }
  postconditions {
    result.total > 0  // result valid in postcondition
  }
}
```

### Evaluation Errors (E0400-E0499)

#### E0400: Division by zero

**Why:** An expression attempted to divide by zero, which is undefined.

**How to fix:**
- Add a precondition to ensure divisor is non-zero
- Use a default value or handle the zero case
- Check for zero before dividing

**Example:**
```isl
// ❌ Bad
postconditions {
  average == total / count  // count might be 0
}

// ✅ Good
preconditions {
  count > 0  // ensure count is non-zero
}
postconditions {
  average == total / count
}
```

#### E0401: Null reference

**Why:** An expression tried to access a property or call a method on a null value.

**How to fix:**
- Check for null before accessing properties
- Use optional chaining (`?.`) for safe access
- Add preconditions to verify values exist

**Example:**
```isl
// ❌ Bad
postconditions {
  account.balance > 0  // account might be null
}

// ✅ Good
preconditions {
  Account.exists(id)  // verify account exists
}
postconditions {
  account?.balance > 0  // optional chaining
}
```

#### E0403: Undefined property

**Why:** An expression tried to access a property that doesn't exist on the value.

**How to fix:**
- Check spelling of the property name
- Verify the property exists on the type being accessed
- Use autocomplete or check type definitions

**Example:**
```isl
// ❌ Bad
entity Account {
  balance: Decimal
}

postconditions {
  account.balace > 0  // typo: "balace"
}

// ✅ Good
entity Account {
  balance: Decimal
}

postconditions {
  account.balance > 0  // correct spelling
}
```

#### E0404: Invalid operation

**Why:** An operation was attempted that is not valid for the given values or context.

**How to fix:**
- Check the operation is valid for the value type
- Verify the system is in a valid state
- Ensure all required parameters are provided

**Example:**
```isl
// ❌ Bad
postconditions {
  "hello".length()  // strings don't have length() method
}

// ✅ Good
postconditions {
  "hello".length > 0  // use property, not method
}
```

#### E0408: Type coercion failed

**Why:** An attempt to convert a value from one type to another failed because the conversion is not possible.

**How to fix:**
- Ensure the value can be converted to the target type
- Use proper conversion functions (parseInt, toString, etc.)
- Validate the value format before conversion
- Handle null/undefined cases explicitly

**Example:**
```isl
// ❌ Bad
postconditions {
  parseInt("not a number")  // invalid format
}

// ✅ Good
preconditions {
  input.value.matches(/^\\d+$/)  // validate format first
}
postconditions {
  parseInt(input.value) > 0  // safe conversion
}
```

## Getting Help

### Explain an Error Code

To get detailed information about any error code:

```bash
isl explain E0200
```

This will show:
- Detailed explanation
- Common causes
- Step-by-step solutions
- Code examples (bad vs good)

### List All Error Codes

```bash
isl explain --list
```

## Error Code Ranges

- **E0001-E0099:** Lexer errors (tokenization)
- **E0100-E0199:** Parser errors (syntax)
- **E0200-E0299:** Type errors (type checking)
- **E0300-E0399:** Semantic errors (name resolution, scoping)
- **E0400-E0499:** Evaluation errors (runtime)
- **E0500-E0599:** Verification errors (pre/post conditions)
- **E0600-E0699:** Configuration errors
- **E0700-E0799:** I/O errors

## Best Practices

1. **Read the full error message** - The snippet and caret show exactly where the problem is
2. **Check the "why" explanation** - Understanding the cause helps prevent similar errors
3. **Follow the "how to fix" suggestions** - These are tailored to your specific error
4. **Use `isl explain <code>`** - Get detailed documentation for any error code
5. **Enable bracket matching** - Most editors can help find unmatched braces/parentheses
6. **Use type hints** - Let your editor autocomplete to avoid typos

## Related Documentation

- [ISL Syntax Guide](./SYNTAX.md)
- [Type System](./TYPES.md)
- [Quick Start Guide](./QUICKSTART.md)
