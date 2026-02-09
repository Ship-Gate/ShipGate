---
title: "CLI: repl"
description: Interactive REPL for exploring ISL expressions and testing specs.
---

The REPL (Read-Eval-Print Loop) lets you interactively explore ISL syntax, evaluate expressions, and test specification fragments.

## Usage

```bash
shipgate repl [options]
```

## Options

| Flag                    | Description                                |
| ----------------------- | ------------------------------------------ |
| `--load <file>`         | Load an ISL file on start                  |
| `--context <json>`      | Set initial evaluation context             |
| `--parse`               | Parse mode (non-interactive, for piped input) |

## Starting the REPL

```bash
$ shipgate repl

ISL REPL v1.0.0
Type expressions, definitions, or :help for commands.
isl>
```

## REPL commands

| Command      | Description                            |
| ------------ | -------------------------------------- |
| `:help`      | Show available commands                |
| `:load file` | Load an ISL file                       |
| `:clear`     | Clear the current context              |
| `:ast`       | Show AST for last expression           |
| `:type expr` | Show type of an expression             |
| `:exit`      | Exit the REPL                          |

## Examples

### Evaluate expressions

```
isl> 2 + 3
5

isl> "hello".length
5

isl> true and false
false

isl> 10 > 5 implies 3 < 7
true
```

### Define types and entities

```
isl> type Money = Decimal { min: 0, precision: 2 }
Type Money defined

isl> entity User { id: UUID, name: String, email: Email }
Entity User defined

isl> enum Status { ACTIVE, INACTIVE }
Enum Status defined
```

### Test expressions with context

```
isl> :context {"balance": 100, "amount": 50}

isl> balance >= amount
true

isl> balance - amount
50

isl> balance - amount >= 0
true
```

### Load a spec file

```
isl> :load user-service.isl
Loaded: domain UserService (1 entity, 2 behaviors)

isl> :type User.email
Email

isl> User.count
0
```

## Piped input

Use `--parse` mode for non-interactive use:

```bash
echo 'type Money = Decimal { min: 0, precision: 2 }' | shipgate repl --parse
```

## Use cases

### Exploring ISL syntax

Use the REPL to learn ISL before writing full specs:

```
isl> all(x in [1,2,3]: x > 0)
true

isl> count(x in [1,2,3,4,5]: x > 3)
2

isl> sum(x in [10, 20, 30]: x)
60
```

### Testing preconditions

Set up context and test your preconditions interactively:

```
isl> :context {"email": "user@example.com", "name": "Alice", "amount": 100}

isl> email.is_valid
true

isl> name.length > 0
true

isl> amount > 0
true

isl> amount > 0 and email.is_valid and name.length > 0
true
```

### Checking types

```
isl> :type 42
Int

isl> :type "hello"
String

isl> :type true and false
Boolean

isl> :type [1, 2, 3]
List<Int>
```

## Exit codes

| Code | Meaning             |
| ---- | ------------------- |
| `0`  | Clean exit          |
