// ============================================================================
// ISL Error Explanation Catalog
// ============================================================================
//
// Detailed explanations for each error code, used by `isl explain <code>`.
// Inspired by Rust's --explain and Elm's error messages.
//
// ============================================================================

import type { ErrorCategory, ErrorExplanation } from './types.js';

/**
 * Complete error explanation catalog
 */
export const ERROR_EXPLANATIONS: Record<string, ErrorExplanation> = {
  // ==========================================================================
  // LEXER ERRORS (E0001-E0099)
  // ==========================================================================
  
  E0001: {
    code: 'E0001',
    category: 'lexer',
    title: 'Unexpected character',
    explanation: `
The lexer encountered a character that is not valid in ISL source code.
This often happens when copying code from a word processor or website,
which may insert special characters like curly quotes or non-breaking spaces.
`.trim(),
    causes: [
      'Copying code from a word processor (Word, Google Docs) with smart quotes',
      'Using special Unicode characters instead of ASCII equivalents',
      'Accidental keyboard shortcuts inserting special characters',
      'File encoding issues',
    ],
    solutions: [
      'Replace curly quotes "" with straight quotes ""',
      'Replace special dashes (—, –) with regular dashes (-)',
      'Ensure the file is saved as UTF-8',
      'Use a plain text editor to verify the file contents',
    ],
    badExample: {
      code: `entity Account {
  name: "String"  // ← curly quotes
}`,
      description: 'Using curly/smart quotes instead of straight quotes',
    },
    goodExample: {
      code: `entity Account {
  name: String  // ← no quotes needed for types
}`,
      description: 'Using proper ISL syntax',
    },
    seeAlso: ['E0002', 'E0004'],
  },

  E0002: {
    code: 'E0002',
    category: 'lexer',
    title: 'Unterminated string literal',
    explanation: `
A string literal was started with a quote but never closed. In ISL,
strings must be enclosed in matching double quotes ("...") or single
quotes ('...').
`.trim(),
    causes: [
      'Missing closing quote at the end of a string',
      'Newline inside a string (use \\n for multi-line)',
      'Using the wrong type of closing quote',
    ],
    solutions: [
      'Add the missing closing quote',
      'For multi-line strings, use triple quotes """..."""',
      'Escape special characters with backslash',
    ],
    badExample: {
      code: `description: "This is a long description
that spans multiple lines`,
      description: 'String with missing closing quote',
    },
    goodExample: {
      code: `description: """
  This is a long description
  that spans multiple lines
"""`,
      description: 'Using triple quotes for multi-line strings',
    },
  },

  E0006: {
    code: 'E0006',
    category: 'lexer',
    title: 'Unterminated block comment',
    explanation: `
A block comment was started with /* but never closed with */.
Block comments can span multiple lines but must be properly closed.
`.trim(),
    causes: [
      'Missing closing */ for a block comment',
      'Accidentally deleted the closing */',
      'Nested block comments (not supported)',
    ],
    solutions: [
      'Add the missing */ at the end of the comment',
      'If you need nested comments, use multiple single-line comments (//) instead',
    ],
    badExample: {
      code: `/* This comment
never ends

entity Account {
  id: UUID
}`,
      description: 'Block comment missing closing */',
    },
    goodExample: {
      code: `/* This comment
is properly closed */

entity Account {
  id: UUID
}`,
      description: 'Block comment with proper closing',
    },
  },

  // ==========================================================================
  // PARSER ERRORS (E0100-E0199)
  // ==========================================================================

  E0100: {
    code: 'E0100',
    category: 'parser',
    title: 'Unexpected token',
    explanation: `
The parser encountered a token that doesn't fit the expected syntax.
This often indicates a typo, missing punctuation, or misunderstanding
of ISL syntax.
`.trim(),
    causes: [
      'Typo in a keyword (e.g., "entiy" instead of "entity")',
      'Missing colon between field name and type',
      'Extra or missing braces',
      'Using operators incorrectly',
    ],
    solutions: [
      'Check for typos in keywords',
      'Verify the syntax matches ISL specification',
      'Use proper punctuation (colons, braces, parentheses)',
    ],
    badExample: {
      code: `entiy Account {  // ← typo: "entiy"
  id UUID  // ← missing colon
}`,
      description: 'Multiple syntax errors',
    },
    goodExample: {
      code: `entity Account {
  id: UUID
}`,
      description: 'Correct ISL syntax',
    },
    seeAlso: ['E0101', 'E0102'],
  },

  E0105: {
    code: 'E0105',
    category: 'parser',
    title: 'Missing closing brace',
    explanation: `
A block was opened with { but the matching closing brace } was not found.
Every opening brace must have a corresponding closing brace.
`.trim(),
    causes: [
      'Forgot to add closing brace',
      'Braces are mismatched due to copy-paste errors',
      'Deleted closing brace by accident',
    ],
    solutions: [
      'Add the missing closing brace',
      'Use an editor with bracket matching to find unmatched braces',
      'Format the code to make nesting levels clear',
    ],
    badExample: {
      code: `entity Account {
  id: UUID
  fields {
    name: String
    email: String
  // ← missing } for fields
// ← missing } for entity`,
      description: 'Missing closing braces',
    },
    goodExample: {
      code: `entity Account {
  id: UUID
  fields {
    name: String
    email: String
  }
}`,
      description: 'Properly matched braces',
    },
    seeAlso: ['E0106', 'E0107', 'E0118'],
  },

  E0109: {
    code: 'E0109',
    category: 'parser',
    title: 'Duplicate entity',
    explanation: `
An entity with this name has already been defined. Each entity in a
domain must have a unique name.
`.trim(),
    causes: [
      'Copy-paste error creating a duplicate',
      'Same entity defined in multiple imported files',
      'Forgot to rename after copying',
    ],
    solutions: [
      'Rename one of the duplicate entities',
      'Remove the duplicate definition',
      'If importing, use namespacing or aliases',
    ],
    badExample: {
      code: `entity User {
  id: UUID
}

entity User {  // ← duplicate!
  name: String
}`,
      description: 'Entity defined twice',
    },
    goodExample: {
      code: `entity User {
  id: UUID
  name: String
}`,
      description: 'Single entity definition with all fields',
    },
    seeAlso: ['E0110', 'E0111', 'E0309'],
  },

  // ==========================================================================
  // TYPE ERRORS (E0200-E0299)
  // ==========================================================================

  E0200: {
    code: 'E0200',
    category: 'type',
    title: 'Type mismatch',
    explanation: `
The type of a value doesn't match what was expected. ISL is statically
typed, so types must be consistent throughout your specification.
`.trim(),
    causes: [
      'Assigning a value of the wrong type to a field',
      'Comparing values of different types',
      'Returning wrong type from an expression',
      'Using wrong field on an entity',
    ],
    solutions: [
      'Check the expected type and adjust the value',
      'Use type conversion functions if needed (parseInt, toString)',
      'Verify field names and types in entity definitions',
    ],
    badExample: {
      code: `entity Account {
  balance: Decimal
}

behavior Transfer {
  postconditions {
    // Error: comparing Decimal with String
    sender.balance == "100.00"
  }
}`,
      description: 'Comparing Decimal with String',
    },
    goodExample: {
      code: `entity Account {
  balance: Decimal
}

behavior Transfer {
  postconditions {
    sender.balance == 100.00  // ← Decimal literal
  }
}`,
      description: 'Using matching types',
    },
    seeAlso: ['E0203', 'E0210'],
  },

  E0201: {
    code: 'E0201',
    category: 'type',
    title: 'Undefined type',
    explanation: `
The type referenced in your code has not been defined. This could be
a built-in type with a typo, or a custom type that hasn't been declared.

Built-in types: String, Int, Decimal, Boolean, UUID, Timestamp, Duration,
                List<T>, Map<K,V>, Set<T>, Optional<T>
`.trim(),
    causes: [
      'Typo in type name (e.g., "Intger" instead of "Int")',
      'Using a type before defining it',
      'Missing import for a type from another domain',
      'Case sensitivity issue (types are case-sensitive)',
    ],
    solutions: [
      'Check spelling of the type name',
      'Define the type before using it',
      'Import the type from the correct module',
      'Use correct casing (types start with uppercase)',
    ],
    badExample: {
      code: `entity User {
  id: uuid       // ← should be UUID (case-sensitive)
  age: Intger    // ← typo: should be Int
  role: Rol      // ← undefined custom type
}`,
      description: 'Various undefined type errors',
    },
    goodExample: {
      code: `enum Role { Admin, User, Guest }

entity User {
  id: UUID
  age: Int
  role: Role
}`,
      description: 'All types properly defined',
    },
  },

  E0202: {
    code: 'E0202',
    category: 'type',
    title: 'Undefined field',
    explanation: `
You're trying to access a field that doesn't exist on this type.
This is often caused by typos in field names.
`.trim(),
    causes: [
      'Typo in field name',
      'Field exists on a different entity',
      'Field was renamed but not all usages were updated',
      'Accessing a field on the wrong variable',
    ],
    solutions: [
      'Check the entity definition for available fields',
      'Correct the typo in the field name',
      'Use autocomplete in your editor to see available fields',
    ],
    badExample: {
      code: `entity Account {
  balance: Decimal
}

behavior Check {
  preconditions {
    account.balace > 0  // ← typo: "balace"
  }
}`,
      description: 'Typo in field name',
    },
    goodExample: {
      code: `entity Account {
  balance: Decimal
}

behavior Check {
  preconditions {
    account.balance > 0  // ← correct spelling
  }
}`,
      description: 'Correct field name',
    },
  },

  E0210: {
    code: 'E0210',
    category: 'type',
    title: 'Incompatible comparison',
    explanation: `
You're trying to compare values that cannot be meaningfully compared.
While some type comparisons are allowed (like comparing numbers), others
don't make sense (like comparing a String with a Boolean).
`.trim(),
    causes: [
      'Comparing values of unrelated types',
      'Using wrong operator for comparison',
      'Type coercion confusion',
    ],
    solutions: [
      'Ensure both sides of comparison have compatible types',
      'Convert types explicitly if needed',
      'Use appropriate comparison methods for complex types',
    ],
    badExample: {
      code: `postconditions {
  user.name == user.age  // ← String == Int
}`,
      description: 'Comparing incompatible types',
    },
    goodExample: {
      code: `postconditions {
  user.age >= 18  // ← Int >= Int
}`,
      description: 'Comparing compatible types',
    },
    seeAlso: ['E0200', 'E0203'],
  },

  // ==========================================================================
  // SEMANTIC ERRORS (E0300-E0399)
  // ==========================================================================

  E0300: {
    code: 'E0300',
    category: 'semantic',
    title: 'Undefined variable',
    explanation: `
You're using a variable that hasn't been declared in the current scope.
Variables must be declared before use, either as input parameters,
local bindings, or in parent scopes.
`.trim(),
    causes: [
      'Typo in variable name',
      'Variable declared in a different scope',
      'Forgot to declare the variable',
      'Using a reserved word as a variable name',
    ],
    solutions: [
      'Check spelling of the variable name',
      'Declare the variable in the appropriate scope',
      'Check if the variable should be an input parameter',
    ],
    badExample: {
      code: `behavior Transfer {
  input {
    amount: Decimal
  }
  preconditions {
    ammount > 0  // ← typo: "ammount"
  }
}`,
      description: 'Typo in variable name',
    },
    goodExample: {
      code: `behavior Transfer {
  input {
    amount: Decimal
  }
  preconditions {
    amount > 0  // ← correct spelling
  }
}`,
      description: 'Correct variable reference',
    },
    seeAlso: ['E0301', 'E0302'],
  },

  E0301: {
    code: 'E0301',
    category: 'semantic',
    title: 'Undefined entity',
    explanation: `
You're referencing an entity that hasn't been defined in this domain.
Entities must be declared before they can be used in behaviors, types, or
other entities.
`.trim(),
    causes: [
      'Typo in entity name',
      'Entity defined in a different domain (missing import)',
      "Entity was renamed but references weren't updated",
      'Case sensitivity issue (entity names are case-sensitive)',
    ],
    solutions: [
      'Check spelling of the entity name',
      'Import the entity from the correct domain if it exists elsewhere',
      'Define the entity before using it',
      'Use correct casing (entities start with uppercase)',
    ],
    badExample: {
      code: `behavior Transfer {
  preconditions {
    Account.exists(senderId)  // ← Account not defined
  }
}`,
      description: 'Referencing undefined entity',
    },
    goodExample: {
      code: `entity Account {
  id: UUID
}

behavior Transfer {
  preconditions {
    Account.exists(senderId)  // ← Account is now defined
  }
}`,
      description: 'Entity defined before use',
    },
    seeAlso: ['E0300', 'E0302'],
  },

  E0302: {
    code: 'E0302',
    category: 'semantic',
    title: 'Undefined behavior',
    explanation: `
You're referencing a behavior that hasn't been defined in this domain.
Behaviors must be declared before they can be referenced in scenarios,
policies, or other behaviors.
`.trim(),
    causes: [
      'Typo in behavior name',
      'Behavior defined in a different domain (missing import)',
      "Behavior was renamed but references weren't updated",
      'Case sensitivity issue',
    ],
    solutions: [
      'Check spelling of the behavior name',
      'Import the behavior from the correct domain if it exists elsewhere',
      'Define the behavior before referencing it',
      'Use correct casing (behaviors start with uppercase)',
    ],
    badExample: {
      code: `scenario "test" {
  given {
    Transfer(amount: 100)  // ← Transfer not defined
  }
}`,
      description: 'Referencing undefined behavior',
    },
    goodExample: {
      code: `behavior Transfer {
  input {
    amount: Decimal
  }
}

scenario "test" {
  given {
    Transfer(amount: 100)  // ← Transfer is now defined
  }
}`,
      description: 'Behavior defined before use',
    },
    seeAlso: ['E0300', 'E0301'],
  },

  E0304: {
    code: 'E0304',
    category: 'semantic',
    title: 'old() outside postcondition',
    explanation: `
The old() function captures the value of an expression before a behavior
executes. It only makes sense in postconditions, where you're comparing
the state before and after execution.
`.trim(),
    causes: [
      'Using old() in a precondition',
      'Using old() in an invariant',
      'Misunderstanding when old() is valid',
    ],
    solutions: [
      'Move the expression to a postcondition',
      'In preconditions, reference values directly without old()',
    ],
    badExample: {
      code: `behavior Transfer {
  preconditions {
    old(sender.balance) >= amount  // ← old() invalid here
  }
}`,
      description: 'old() used in precondition',
    },
    goodExample: {
      code: `behavior Transfer {
  preconditions {
    sender.balance >= amount  // ← direct reference
  }
  postconditions {
    sender.balance == old(sender.balance) - amount  // ← old() valid here
  }
}`,
      description: 'old() correctly used in postcondition',
    },
    seeAlso: ['E0305'],
  },

  E0305: {
    code: 'E0305',
    category: 'semantic',
    title: 'result outside postcondition',
    explanation: `
The 'result' keyword refers to the return value of a behavior. It only
exists after the behavior completes, so it can only be used in
postconditions.
`.trim(),
    causes: [
      'Using result in a precondition',
      'Using result in behavior body instead of output',
    ],
    solutions: [
      'Move the expression to a postcondition',
      'Use output fields to define what the behavior returns',
    ],
    badExample: {
      code: `behavior CalculateTotal {
  preconditions {
    result > 0  // ← result doesn't exist yet
  }
}`,
      description: 'result used in precondition',
    },
    goodExample: {
      code: `behavior CalculateTotal {
  output {
    total: Decimal
  }
  postconditions {
    result.total > 0  // ← result valid in postcondition
  }
}`,
      description: 'result correctly used in postcondition',
    },
    seeAlso: ['E0304'],
  },

  E0310: {
    code: 'E0310',
    category: 'semantic',
    title: 'Unsatisfiable precondition',
    explanation: `
The preconditions contain contradictory constraints that can never all
be satisfied simultaneously. This means the behavior can never be
invoked legally.
`.trim(),
    causes: [
      'Contradictory numeric bounds (e.g., x > 5 and x < 2)',
      'Mutually exclusive conditions combined with AND',
      'Copy-paste errors creating conflicting constraints',
      'Overly strict validation that rejects all inputs',
    ],
    solutions: [
      'Review the preconditions and remove contradictory constraints',
      'Change AND to OR if conditions should be alternatives',
      'Use consistent bounds (lower bound < upper bound)',
      'Remove redundant or conflicting checks',
    ],
    badExample: {
      code: `behavior Transfer {
  preconditions {
    amount > 1000 and amount < 100  // ← impossible
  }
}`,
      description: 'Contradictory bounds that can never be satisfied',
    },
    goodExample: {
      code: `behavior Transfer {
  preconditions {
    amount > 0 and amount <= 10000  // ← valid range
  }
}`,
      description: 'Consistent bounds that define a valid range',
    },
    seeAlso: ['E0311', 'E0500'],
  },

  E0311: {
    code: 'E0311',
    category: 'semantic',
    title: 'Output referenced in precondition',
    explanation: `
A precondition references 'result' or 'output', but these values don't
exist until after the behavior executes. Preconditions are checked
BEFORE execution, so they can only reference inputs and existing state.
`.trim(),
    causes: [
      'Confusing preconditions with postconditions',
      'Copy-paste error from a postcondition',
      'Misunderstanding of contract evaluation order',
    ],
    solutions: [
      'Move the check to a postcondition if validating output',
      'Reference input fields instead of output fields',
      'Use old() in postconditions to compare pre/post state',
    ],
    badExample: {
      code: `behavior Transfer {
  preconditions {
    result.success == true  // ← result doesn't exist yet
  }
}`,
      description: 'Referencing result in a precondition',
    },
    goodExample: {
      code: `behavior Transfer {
  preconditions {
    amount > 0  // ← validates input
  }
  postconditions {
    success implies result.transferred == amount
  }
}`,
      description: 'Preconditions check inputs, postconditions check results',
    },
    seeAlso: ['E0305', 'E0310'],
  },

  E0312: {
    code: 'E0312',
    category: 'semantic',
    title: 'Undefined result field',
    explanation: `
A postcondition references a field on 'result' that is not declared
in the output type. This will cause a runtime error when the
postcondition is evaluated.
`.trim(),
    causes: [
      'Typo in field name',
      'Field was renamed in output but not in postcondition',
      'Referencing a field from a different behavior',
      'Forgetting to add a field to the output type',
    ],
    solutions: [
      'Check the spelling of the field name',
      'Add the missing field to the output type',
      'Use a field that exists in the declared output',
    ],
    badExample: {
      code: `behavior Transfer {
  output {
    success: transferred: Decimal
  }
  postconditions {
    result.ammount > 0  // ← typo: 'ammount' not in output
  }
}`,
      description: 'Referencing non-existent field in output',
    },
    goodExample: {
      code: `behavior Transfer {
  output {
    success: transferred: Decimal
  }
  postconditions {
    result.transferred > 0  // ← correct field name
  }
}`,
      description: 'Referencing a declared output field',
    },
    seeAlso: ['E0202', 'E0313'],
  },

  E0313: {
    code: 'E0313',
    category: 'semantic',
    title: 'Undefined invariant variable',
    explanation: `
An invariant references a variable that is not defined in the current
scope. Invariants can only reference entities, types, fields, and
bound variables from quantifiers.
`.trim(),
    causes: [
      'Typo in variable or field name',
      'Variable defined in a different scope',
      'Missing quantifier binding',
      'Entity or type not defined before the invariant',
    ],
    solutions: [
      'Check the spelling of the variable name',
      'Define the entity or type before the invariant',
      'Use a quantifier (all, any) to bind iteration variables',
      'Reference fields using entity.field syntax',
    ],
    badExample: {
      code: `invariant "balance check" {
  account.balence >= 0  // ← typo: 'balence'
}`,
      description: 'Typo in field name',
    },
    goodExample: {
      code: `invariant "balance check" {
  all a in Account: a.balance >= 0  // ← correct with quantifier
}`,
      description: 'Proper variable binding with quantifier',
    },
    seeAlso: ['E0300', 'E0312'],
  },

  E0314: {
    code: 'E0314',
    category: 'semantic',
    title: 'Contradictory bounds',
    explanation: `
The specified bounds for a variable are contradictory - the lower bound
is greater than the upper bound, making it impossible for any value to
satisfy both constraints.
`.trim(),
    causes: [
      'Swapped comparison operators (< vs >)',
      'Numeric typo in bound values',
      'Copy-paste error with wrong variable',
    ],
    solutions: [
      'Ensure lower bound < upper bound',
      'Check comparison operators are correct',
      'Verify numeric values are as intended',
    ],
    badExample: {
      code: `type Age = Int where min(100) and max(0)  // ← min > max`,
      description: 'Minimum bound greater than maximum',
    },
    goodExample: {
      code: `type Age = Int where min(0) and max(120)  // ← valid range`,
      description: 'Valid minimum and maximum bounds',
    },
    seeAlso: ['E0310', 'E0200'],
  },

  // ==========================================================================
  // EVALUATION ERRORS (E0400-E0499)
  // ==========================================================================

  E0400: {
    code: 'E0400',
    category: 'eval',
    title: 'Division by zero',
    explanation: `
An expression attempted to divide by zero, which is undefined in
mathematics. This often occurs when a divisor variable is zero.
`.trim(),
    causes: [
      'Literal division by zero',
      'Variable divisor that happens to be zero',
      'Missing zero-check before division',
    ],
    solutions: [
      'Add a precondition to ensure divisor is non-zero',
      'Use a default value or handle the zero case',
      'Check for zero before dividing',
    ],
    badExample: {
      code: `postconditions {
  average == total / count  // ← count might be 0
}`,
      description: 'Division without checking for zero',
    },
    goodExample: {
      code: `preconditions {
  count > 0  // ← ensure count is non-zero
}
postconditions {
  average == total / count
}`,
      description: 'Adding precondition to prevent division by zero',
    },
  },

  E0401: {
    code: 'E0401',
    category: 'eval',
    title: 'Null reference',
    explanation: `
An expression tried to access a property or call a method on a null
value. This is one of the most common runtime errors.
`.trim(),
    causes: [
      'Accessing a field on an optional value without checking',
      'Entity lookup returned null',
      'Uninitialized variable',
    ],
    solutions: [
      'Check for null before accessing properties',
      'Use optional chaining (?.) for safe access',
      'Add preconditions to verify values exist',
    ],
    badExample: {
      code: `postconditions {
  account.balance > 0  // ← account might be null
}`,
      description: 'Accessing property without null check',
    },
    goodExample: {
      code: `preconditions {
  Account.exists(id)  // ← verify account exists
}
postconditions {
  account?.balance > 0  // ← optional chaining
}`,
      description: 'Safe property access with null checks',
    },
  },

  E0403: {
    code: 'E0403',
    category: 'eval',
    title: 'Undefined property',
    explanation: `
An expression tried to access a property that doesn't exist on the value.
This is a runtime error that occurs when accessing fields, methods, or
other properties that aren't defined.
`.trim(),
    causes: [
      'Typo in property name',
      'Property exists on a different type',
      "Property was renamed but usages weren't updated",
      'Accessing property on wrong object',
    ],
    solutions: [
      'Check spelling of the property name',
      'Verify the property exists on the type being accessed',
      'Use autocomplete or check type definitions',
      'Check if property needs to be accessed differently',
    ],
    badExample: {
      code: `entity Account {
  balance: Decimal
}

postconditions {
  account.balace > 0  // ← typo: "balace"
}`,
      description: 'Typo in property name',
    },
    goodExample: {
      code: `entity Account {
  balance: Decimal
}

postconditions {
  account.balance > 0  // ← correct spelling
}`,
      description: 'Correct property name',
    },
    seeAlso: ['E0202', 'E0401'],
  },

  E0404: {
    code: 'E0404',
    category: 'eval',
    title: 'Invalid operation',
    explanation: `
An operation was attempted that is not valid for the given values or
context. This is a catch-all for various runtime errors that don't fit
into more specific categories.
`.trim(),
    causes: [
      'Operation not supported for the value type',
      'Invalid state for the operation',
      'Missing required context or parameters',
      'Operation failed due to constraints',
    ],
    solutions: [
      'Check the operation is valid for the value type',
      'Verify the system is in a valid state',
      'Ensure all required parameters are provided',
      'Review constraints and preconditions',
    ],
    badExample: {
      code: `postconditions {
  "hello".length()  // ← strings don't have length() method
}`,
      description: 'Invalid operation on type',
    },
    goodExample: {
      code: `postconditions {
  "hello".length > 0  // ← use property, not method
}`,
      description: 'Correct operation',
    },
    seeAlso: ['E0204', 'E0400'],
  },

  E0408: {
    code: 'E0408',
    category: 'eval',
    title: 'Type coercion failed',
    explanation: `
An attempt to convert a value from one type to another failed because
the conversion is not possible or the value is invalid for the target type.
`.trim(),
    causes: [
      'Converting incompatible types (e.g., String to Int)',
      'Invalid format for conversion (e.g., "abc" to Int)',
      'Value out of range for target type',
      'Null/undefined value cannot be coerced',
    ],
    solutions: [
      'Ensure the value can be converted to the target type',
      'Use proper conversion functions (parseInt, toString, etc.)',
      'Validate the value format before conversion',
      'Handle null/undefined cases explicitly',
    ],
    badExample: {
      code: `postconditions {
  parseInt("not a number")  // ← invalid format
}`,
      description: 'Invalid conversion',
    },
    goodExample: {
      code: `preconditions {
  input.value.matches(/^\\d+$/)  // ← validate format first
}
postconditions {
  parseInt(input.value) > 0  // ← safe conversion
}`,
      description: 'Validating before conversion',
    },
    seeAlso: ['E0200', 'E0403'],
  },

  // ==========================================================================
  // VERIFICATION ERRORS (E0500-E0599)
  // ==========================================================================

  E0500: {
    code: 'E0500',
    category: 'verify',
    title: 'Precondition failed',
    explanation: `
A precondition was not satisfied when the behavior was invoked. 
Preconditions define the valid states under which a behavior can execute.
If a precondition fails, it means the caller violated the contract.
`.trim(),
    causes: [
      'Caller provided invalid input',
      'System state doesn\'t meet requirements',
      'Missing validation before calling behavior',
    ],
    solutions: [
      'Validate inputs before invoking the behavior',
      'Ensure system is in correct state',
      'Review the preconditions and adjust if too strict',
    ],
    badExample: {
      code: `// Precondition: amount > 0
// Actual call:
transfer({ amount: -50 })  // ← negative amount`,
      description: 'Calling with invalid input',
    },
    goodExample: {
      code: `// Validate first
if (amount <= 0) {
  throw InvalidAmountError()
}
transfer({ amount: 50 })  // ← valid amount`,
      description: 'Validating before calling',
    },
    seeAlso: ['E0501', 'E0502'],
  },

  E0501: {
    code: 'E0501',
    category: 'verify',
    title: 'Postcondition failed',
    explanation: `
A postcondition was not satisfied after the behavior executed.
Postconditions define what must be true after successful execution.
If a postcondition fails, the implementation has a bug.
`.trim(),
    causes: [
      'Implementation doesn\'t match specification',
      'Edge case not handled correctly',
      'State wasn\'t updated as expected',
      'Side effect from another operation',
    ],
    solutions: [
      'Review the implementation logic',
      'Add missing state updates',
      'Check for edge cases',
      'Verify no concurrent modifications',
    ],
    badExample: {
      code: `// Postcondition: sender.balance == old(sender.balance) - amount
// But implementation forgot to update sender
receiver.balance += amount
// sender.balance unchanged!`,
      description: 'Implementation missing state update',
    },
    goodExample: {
      code: `// Correct implementation
sender.balance -= amount
receiver.balance += amount
// Both postconditions satisfied`,
      description: 'Complete implementation',
    },
    seeAlso: ['E0500', 'E0502'],
  },

  E0502: {
    code: 'E0502',
    category: 'verify',
    title: 'Invariant violated',
    explanation: `
An invariant — a condition that must always be true — was violated.
Invariants are checked before and after every behavior execution.
This indicates a critical error in the system logic.
`.trim(),
    causes: [
      'Behavior left system in invalid state',
      'Concurrent modification bypassed checks',
      'Invariant is too strict for actual requirements',
      'Initial state was invalid',
    ],
    solutions: [
      'Review the behavior implementation',
      'Check for race conditions',
      'Ensure all state transitions maintain invariants',
      'Consider if invariant definition is correct',
    ],
    badExample: {
      code: `// Invariant: balance >= 0
// After overdraft:
account.balance = -100  // ← violates invariant`,
      description: 'Behavior violating balance invariant',
    },
    goodExample: {
      code: `// Check before allowing operation
if (account.balance < amount) {
  throw InsufficientFunds()
}
account.balance -= amount  // ← invariant preserved`,
      description: 'Checking before modification',
    },
  },

  // ==========================================================================
  // CONFIGURATION ERRORS (E0600-E0699)
  // ==========================================================================

  E0600: {
    code: 'E0600',
    category: 'config',
    title: 'Invalid configuration file',
    explanation: `
The configuration file (isl.config.json or isl.config.yaml) could not
be parsed. This is usually due to syntax errors in the file.
`.trim(),
    causes: [
      'Invalid JSON/YAML syntax',
      'Missing required fields',
      'Invalid field values',
      'Encoding issues',
    ],
    solutions: [
      'Validate your JSON/YAML syntax using a linter',
      'Check for missing commas, brackets, or quotes',
      'Refer to documentation for required fields',
    ],
    badExample: {
      code: `{
  "version": 1
  "strict": true  // ← missing comma after 1
}`,
      description: 'Invalid JSON syntax',
    },
    goodExample: {
      code: `{
  "version": 1,
  "strict": true
}`,
      description: 'Valid JSON syntax',
    },
  },

  E0700: {
    code: 'E0700',
    category: 'io',
    title: 'File not found',
    explanation: `
The specified file could not be found. Check that the path is correct
and the file exists.
`.trim(),
    causes: [
      'Typo in file path',
      'File was moved or deleted',
      'Wrong working directory',
      'Case sensitivity on some file systems',
    ],
    solutions: [
      'Verify the file path is correct',
      'Check the current working directory',
      'Use absolute paths if relative paths are ambiguous',
    ],
  },

  E0705: {
    code: 'E0705',
    category: 'io',
    title: 'Import not found',
    explanation: `
The import statement references a module that cannot be found. This
could be a built-in module, a package, or a local file.
`.trim(),
    causes: [
      'Typo in module name',
      'Package not installed',
      'Incorrect import path',
      'Module doesn\'t export the requested item',
    ],
    solutions: [
      'Check spelling of module name',
      'Install missing packages',
      'Verify import path is correct',
      'Check what the module actually exports',
    ],
    badExample: {
      code: `import { Auth } from "@isl-lang/stdlib/auht"  // ← typo`,
      description: 'Typo in module path',
    },
    goodExample: {
      code: `import { Auth } from "@isl-lang/stdlib/auth"  // ← correct`,
      description: 'Correct import path',
    },
  },

  // ==========================================================================
  // MODULE RESOLUTION ERRORS (E0710-E0799)
  // ==========================================================================

  E0710: {
    code: 'E0710',
    category: 'io',
    title: 'Module not found',
    explanation: `
The module specified in the use statement could not be found.
ISL searches for modules in this order:
1. Relative paths (./local.isl)
2. Project root and intents/ folder
3. Standard library (stdlib-*)
4. External packages (@org/module)
`.trim(),
    causes: [
      'Typo in module name',
      'Module file does not exist',
      'Missing stdlib package installation',
      'Incorrect relative path',
      'Wrong file extension',
    ],
    solutions: [
      'Check spelling of module name',
      'Verify the file exists at the expected path',
      'Install @isl-lang/stdlib if using stdlib modules',
      'Use correct relative path syntax (./)',
      'Ensure file has .isl extension',
    ],
    badExample: {
      code: `use stdlib-autth  // ← typo: "autth" instead of "auth"`,
      description: 'Typo in stdlib module name',
    },
    goodExample: {
      code: `use stdlib-auth  // ← correct spelling`,
      description: 'Correct stdlib module name',
    },
    seeAlso: ['E0705', 'E0711'],
  },

  E0711: {
    code: 'E0711',
    category: 'semantic',
    title: 'Circular import detected',
    explanation: `
A circular dependency was detected in the module graph.
Module A imports B, which imports C, which imports A again.
Circular imports are not allowed as they create ambiguous load order
and can cause initialization issues.

ISL detects these cycles during module graph construction using
Tarjan's algorithm for finding strongly connected components.
`.trim(),
    causes: [
      'Two modules importing each other directly',
      'Indirect cycle through multiple modules (A → B → C → A)',
      'Shared types placed in a module that imports them',
      'Refactoring that accidentally introduced a cycle',
    ],
    solutions: [
      'Extract shared types to a common module that both can import',
      'Restructure modules to break the cycle',
      'Use interface segregation - split large modules',
      'Create a dedicated "types" module for shared definitions',
    ],
    badExample: {
      code: `// auth.isl
use "./session"  // imports session

// session.isl  
use "./auth"     // imports auth → CYCLE!`,
      description: 'Two modules importing each other',
    },
    goodExample: {
      code: `// types.isl (shared types)
entity User { ... }

// auth.isl
use "./types"    // imports shared types

// session.isl
use "./types"    // imports shared types (no cycle)`,
      description: 'Extracting shared types to break the cycle',
    },
    seeAlso: ['E0710', 'E0712'],
  },

  E0712: {
    code: 'E0712',
    category: 'semantic',
    title: 'Module version conflict',
    explanation: `
The same module is imported with different version constraints that
cannot be satisfied simultaneously.

When you use versioned imports like 'use stdlib-auth@1.0.0', ISL tracks
all version constraints and reports conflicts when the same module is
requested with incompatible versions.
`.trim(),
    causes: [
      'Different files require incompatible versions of the same module',
      'Transitive dependencies with version mismatch',
      'Copy-paste error with different version numbers',
      'Upgrading one import but forgetting others',
    ],
    solutions: [
      'Align version constraints across all files',
      'Update all imports to use the same compatible version',
      'Remove version constraints to use latest compatible version',
      'Check transitive dependencies for version requirements',
    ],
    badExample: {
      code: `// file-a.isl
use stdlib-auth@1.0.0

// file-b.isl
use stdlib-auth@2.0.0  // ← conflicts with file-a.isl!`,
      description: 'Same module with conflicting versions',
    },
    goodExample: {
      code: `// file-a.isl
use stdlib-auth@2.0.0

// file-b.isl
use stdlib-auth@2.0.0  // ← same version, no conflict`,
      description: 'Aligned version constraints',
    },
    seeAlso: ['E0710', 'E0711'],
  },
};

/**
 * Get explanation for an error code
 */
export function getExplanation(code: string): ErrorExplanation | undefined {
  return ERROR_EXPLANATIONS[code];
}

/**
 * Get all error codes that have explanations
 */
export function getAllExplainedCodes(): string[] {
  return Object.keys(ERROR_EXPLANATIONS).sort();
}

/**
 * Check if an error code has an explanation
 */
export function hasExplanation(code: string): boolean {
  return code in ERROR_EXPLANATIONS;
}

/**
 * Get explanations by category
 */
export function getExplanationsByCategory(category: ErrorCategory): ErrorExplanation[] {
  return Object.values(ERROR_EXPLANATIONS).filter(e => e.category === category);
}
