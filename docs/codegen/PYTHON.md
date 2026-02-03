# Python Code Generation

ISL supports full Python code generation with runtime contract checking. This document covers
the Python codegen features, usage, and architecture.

## Status

| Feature | Status |
|---------|--------|
| Type Generation | **v1 Supported** |
| Pydantic Models | **v1 Supported** |
| Contract Checking | **v1 Supported** |
| FastAPI Integration | **v1 Supported** |
| Django Integration | Experimental |
| Flask Integration | Experimental |

## Quick Start

### Generate Python Code

```bash
# Using CLI
isl generate spec.isl --lang python --out ./src

# With contracts enabled (default)
isl generate spec.isl --lang python --out ./src --contracts

# Types only (no contracts)
isl generate spec.isl --lang python --out ./src --types-only
```

### Programmatic Usage

```typescript
import { generate } from '@isl-lang/codegen-types';
import { parse } from '@isl-lang/parser';

const { domain } = parse(`
  domain Payments version "1.0.0"
  
  entity Account {
    id: UUID
    balance: Decimal
  }
  
  behavior TransferFunds {
    input {
      senderId: UUID
      receiverId: UUID
      amount: Decimal
    }
    
    preconditions {
      amount > 0 "Amount must be positive"
    }
    
    postconditions {
      success implies {
        result.balance >= 0
      }
    }
  }
`);

const result = generate(domain, {
  language: 'python',
  validation: true,
  contracts: true,
});

for (const file of result.files) {
  console.log(`Generated: ${file.path}`);
}
```

## Generated Files

When generating Python code, the following files are created:

```
domain_name/
├── __init__.py        # Package exports
├── types.py           # Dataclasses and type definitions
├── validation.py      # Pydantic models with validation
├── contracts.py       # Contract checking code
└── serdes.py          # Serialization/deserialization
```

### types.py

Contains Python dataclasses for entities and behavior types:

```python
@dataclass
class Account:
    """Entity: Account"""
    id: UUID
    balance: Decimal

@dataclass
class TransferFundsInput:
    """Input for TransferFunds"""
    sender_id: UUID
    receiver_id: UUID
    amount: Decimal
```

### validation.py

Contains Pydantic models for runtime validation:

```python
class Account(BaseModel):
    """Entity: Account"""
    id: UUID
    balance: Decimal = Field(ge=0)  # From constraints
    
    model_config = ConfigDict(frozen=True)
```

### contracts.py

Contains contract checking code:

```python
# Exception types
class PreconditionError(ContractError): ...
class PostconditionError(ContractError): ...
class InvariantError(ContractError): ...

# Precondition checker
def _check_transfer_funds_preconditions(_input_, _entities_=None):
    if not ((_input_.amount > 0)):
        raise PreconditionError("Amount must be positive")

# Postcondition checker  
def _check_transfer_funds_postconditions(_input_, _result_, _old_state_, _entities_=None):
    if getattr(_result_, "success", True):
        if not ((_result_.balance >= 0)):
            raise PostconditionError("Postcondition failed")

# Contract decorator
@transfer_funds_contract
async def transfer_funds(input: TransferFundsInput) -> TransferFundsResult:
    ...
```

## Contract Checking

### Contract Modes

The generated code supports three contract enforcement modes:

```python
from domain.contracts import set_contract_mode, ContractMode

# Strict mode (default) - raises exceptions on violations
set_contract_mode(ContractMode.STRICT)

# Warn mode - logs warnings but continues execution
set_contract_mode(ContractMode.WARN)

# Skip mode - bypasses all contract checking
set_contract_mode(ContractMode.SKIP)
```

### Using the Contract Decorator

```python
from domain.contracts import transfer_funds_contract
from domain.types import TransferFundsInput, TransferFundsResult

@transfer_funds_contract
async def transfer_funds(input: TransferFundsInput) -> TransferFundsResult:
    """Implementation with automatic contract checking."""
    # Your implementation here
    # Preconditions checked before execution
    # Postconditions checked after execution
    return TransferFundsResult(success=True, data=account)
```

### Manual Contract Checking

```python
from domain.contracts import (
    _check_transfer_funds_preconditions,
    _check_transfer_funds_postconditions,
    OldState,
)

async def transfer_funds(input: TransferFundsInput) -> TransferFundsResult:
    # Check preconditions manually
    _check_transfer_funds_preconditions(input)
    
    # Capture old state for postconditions
    old_state = OldState({"balance": sender.balance})
    
    # Execute logic
    result = ...
    
    # Check postconditions manually
    _check_transfer_funds_postconditions(input, result, old_state)
    
    return result
```

## Entity Store Integration

For contract expressions that reference entities (e.g., `Account.exists(id)`), you need
to register entity stores:

```python
from domain.contracts import register_entity_store, InMemoryEntityStore

# Register an in-memory store for testing
account_store = InMemoryEntityStore()
register_entity_store("Account", account_store)

# Add some test data
account_store.add(Account(id=uuid4(), balance=Decimal("100")))

# Now contracts can check entity existence
@transfer_funds_contract
async def transfer_funds(input: TransferFundsInput) -> TransferFundsResult:
    ...
```

For production, implement your own `EntityStore` that queries your database:

```python
class DatabaseAccountStore:
    """Production entity store backed by database."""
    
    def __init__(self, db_session):
        self.db = db_session
    
    def exists(self, criteria: dict) -> bool:
        query = self.db.query(AccountModel)
        for key, value in criteria.items():
            query = query.filter(getattr(AccountModel, key) == value)
        return query.first() is not None
    
    def lookup(self, criteria: dict) -> Optional[Account]:
        ...
    
    def count(self, criteria: dict = None) -> int:
        ...

# Register production store
register_entity_store("Account", DatabaseAccountStore(db_session))
```

## FastAPI Integration

The generated code integrates with FastAPI:

```python
from fastapi import FastAPI, HTTPException, Depends
from domain.validation import TransferFundsInput, TransferFundsResult
from domain.contracts import transfer_funds_contract, PreconditionError

app = FastAPI()

@app.post("/transfer")
@transfer_funds_contract
async def transfer_funds_endpoint(input: TransferFundsInput) -> TransferFundsResult:
    # Contract violations become 400/422 errors automatically
    try:
        result = await execute_transfer(input)
        return result
    except PreconditionError as e:
        raise HTTPException(status_code=400, detail=str(e))
```

## ISL Type Mapping

| ISL Type | Python Type |
|----------|-------------|
| String | `str` |
| Int | `int` |
| Float | `float` |
| Decimal | `Decimal` |
| Boolean | `bool` |
| UUID | `UUID` |
| Timestamp | `datetime` |
| Duration | `int` (milliseconds) |
| List<T> | `List[T]` |
| Map<K,V> | `Dict[K, V]` |
| Optional<T> | `Optional[T]` |
| Email | `str` (with validation) |
| URL | `str` (with validation) |
| Money | `Money` dataclass |

## Expression Mapping

| ISL Expression | Python Equivalent |
|----------------|-------------------|
| `a > b` | `(a > b)` |
| `a and b` | `(a and b)` |
| `a or b` | `(a or b)` |
| `not a` | `not (a)` |
| `a implies b` | `(not a or b)` |
| `all x in xs: p(x)` | `all(p(x) for x in xs)` |
| `some x in xs: p(x)` | `any(p(x) for x in xs)` |
| `Entity.exists(id)` | `_entities_["Entity"].exists({"id": id})` |
| `old(x)` | `_old_state_.get("x")` |
| `result.field` | `_result_.field` |

## Testing

The generated code includes testing utilities:

```python
from domain.contracts import (
    reset_config,
    set_contract_mode,
    ContractMode,
    enable_violation_collection,
    get_violations,
    clear_violations,
)

def test_transfer_fails_on_negative_amount():
    reset_config()
    set_contract_mode(ContractMode.STRICT)
    
    with pytest.raises(PreconditionError) as exc:
        transfer_funds(TransferFundsInput(
            sender_id=uuid4(),
            receiver_id=uuid4(),
            amount=Decimal("-10"),
        ))
    
    assert "Amount must be positive" in str(exc.value)

def test_collect_violations():
    reset_config()
    set_contract_mode(ContractMode.WARN)
    enable_violation_collection(True)
    
    # Run tests that may have violations
    ...
    
    violations = get_violations()
    assert len(violations) == 0, f"Found violations: {violations}"
```

## Runtime Library

The `isl_runtime.py` module provides the runtime support:

```python
# Include with your generated code
from isl_runtime import (
    ContractError,
    PreconditionError,
    PostconditionError,
    InvariantError,
    ContractMode,
    set_contract_mode,
    InMemoryEntityStore,
    register_entity_store,
    OldState,
    contract,
    preconditions,
    postconditions,
    invariants,
)
```

## Limitations

Current Python codegen has these limitations:

1. **No cross-file imports** - All contracts for a domain are in single file
2. **No nested quantifiers** - `all x: all y: p(x,y)` not supported
3. **Limited old() support** - Only simple field references in `old()`
4. **No custom entity methods** - Only `exists()`, `lookup()`, `count()`, `all()` supported

## See Also

- [ISL Syntax Reference](../SYNTAX.md)
- [TypeScript Codegen](./TYPESCRIPT.md)
- [Contract Semantics](../SEMANTICS.md)
