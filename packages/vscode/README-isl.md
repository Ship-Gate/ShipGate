# ISL Syntax Highlighting for VS Code

This package provides comprehensive syntax highlighting and language support for **Intent Specification Language (ISL)** files in Visual Studio Code.

## Features

### Syntax Highlighting

The ISL TextMate grammar provides rich syntax highlighting for:

#### Keywords

| Category | Keywords |
|----------|----------|
| **Domain** | `domain`, `version` |
| **Structure** | `entity`, `behavior`, `type`, `enum`, `session`, `handler` |
| **Contracts** | `preconditions`, `postconditions`, `invariants` |
| **Sections** | `input`, `output`, `actors`, `errors`, `lifecycle`, `temporal`, `security`, `effects` |
| **Scenarios** | `scenario`, `chaos`, `given`, `when`, `then`, `inject`, `expect` |
| **Temporal** | `eventually`, `within`, `immediately`, `never`, `always`, `response` |
| **Conditions** | `success`, `failure`, `and`, `or`, `not`, `implies`, `must`, `owns` |
| **Operators** | `forall`, `exists`, `old`, `sum`, `let` |

#### Types

- **Primitives**: `String`, `Number`, `Boolean`, `Int`, `Float`, `Decimal`, `UUID`, `Timestamp`, `Date`, `DateTime`, `Duration`, `Email`, `URL`, `JSON`, `Any`
- **Collections**: `Array`, `List`, `Set`, `Map`, `Vector`, `Matrix`
- **Generics**: `Result`, `Option`, `Maybe`, `Either`, `Success`, `Failure`
- **Special**: `Nat`, `PositiveInt`, `NonEmptyString`, `Money`, `Percentage`

#### Literals

- **Strings**: Double-quoted (`"hello"`), single-quoted (`'hello'`), template strings (`` `hello` ``)
- **Numbers**: Integers (`42`), floats (`3.14`), hex (`0xFF`), percentages (`99%`), percentiles (`p99`)
- **Durations**: `100ms`, `5s`, `30m`, `1h`, `7d`, `5.minutes`, `2.hours`
- **Booleans**: `true`, `false`
- **Null**: `null`, `nil`, `undefined`

#### Comments

- Line comments: `// comment`
- Block comments: `/* comment */`
- Documentation comments: `/** @param name Description */`

#### Annotations

Bracket annotations with modifiers:
```isl
entity User {
  id: UUID [immutable, unique]
  email: Email [indexed, sensitive]
  password: String [secret]
}
```

Supported annotations: `immutable`, `unique`, `indexed`, `secret`, `sensitive`, `default`, `optional`, `required`, `deprecated`, `linear`, `consume`, `readonly`, `async`, `sync`, `idempotent`, `cacheable`

### Language Configuration

The language configuration provides:

- **Bracket matching**: `{}`, `[]`, `()`, `<>`
- **Auto-closing pairs**: Automatically close brackets, quotes, and comments
- **Comment toggling**: Toggle line/block comments with keyboard shortcuts
- **Indentation rules**: Smart indentation for ISL blocks
- **Folding**: Code folding for domains, entities, behaviors, and sections
- **Word patterns**: Proper word selection for ISL identifiers

## File Structure

```
packages/vscode/
├── syntaxes/
│   └── isl.tmLanguage.json    # TextMate grammar
├── language-configuration/
│   └── isl.language-configuration.json
├── language-configuration.json # Root config (legacy)
├── snippets/
│   └── isl.json               # Code snippets
└── README-isl.md              # This file
```

## Grammar Scopes

The TextMate grammar uses the following scope naming conventions:

| Scope | Usage |
|-------|-------|
| `keyword.declaration.isl` | Domain, entity, behavior declarations |
| `keyword.control.section.isl` | Section keywords (input, output, etc.) |
| `keyword.control.temporal.isl` | Temporal logic keywords |
| `keyword.operator.isl` | Operators (implies, forall, etc.) |
| `storage.type.primitive.isl` | Primitive types |
| `entity.name.type.isl` | Custom type names |
| `entity.name.class.isl` | Entity names |
| `entity.name.function.isl` | Behavior names |
| `variable.parameter.isl` | Parameter names |
| `constant.numeric.*.isl` | Number literals |
| `string.quoted.*.isl` | String literals |
| `comment.*.isl` | Comments |
| `punctuation.*.isl` | Punctuation and delimiters |

## Example

```isl
domain Payments {
  version: "1.0.0"
  
  entity Account {
    id: UUID [immutable, unique]
    balance: Money { min: 0 }
    status: AccountStatus
    
    invariants {
      balance >= 0
    }
  }
  
  behavior Transfer {
    description: "Transfer money between accounts"
    
    input {
      from: AccountId
      to: AccountId
      amount: Money { value > 0 }
    }
    
    output {
      success: TransferResult
      errors {
        INSUFFICIENT_FUNDS { when: "Not enough balance" }
        ACCOUNT_NOT_FOUND { when: "Account does not exist" }
      }
    }
    
    preconditions {
      Account.lookup(from).balance >= input.amount
      from != to
    }
    
    postconditions {
      success implies {
        Account.lookup(from).balance == old(Account.lookup(from).balance) - input.amount
        Account.lookup(to).balance == old(Account.lookup(to).balance) + input.amount
      }
    }
    
    temporal {
      response within 200ms (p99)
    }
  }
}
```

## Development

### Testing the Grammar

1. Open VS Code with the extension loaded
2. Open any `.isl` file
3. Use **Developer: Inspect Editor Tokens and Scopes** to verify token scopes

### Updating the Grammar

1. Edit `syntaxes/isl.tmLanguage.json`
2. Reload VS Code window (`Developer: Reload Window`)
3. Verify changes in an `.isl` file

## Contributing

See the main [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT - See [LICENSE](./LICENSE)
