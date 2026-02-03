"""
ISL Runtime Library for Python

This module provides the runtime support for ISL contract checking in Python.
It is designed to be copied/bundled with generated Python code.

Features:
- Contract exception types (PreconditionError, PostconditionError, InvariantError)
- Entity store abstraction for contract evaluation
- Old state capture for postcondition checking
- Contract enforcement modes (strict, warn, skip)

Version: 1.0.0
"""

from __future__ import annotations

import functools
import logging
import warnings
from abc import ABC, abstractmethod
from copy import deepcopy
from dataclasses import dataclass, field
from datetime import datetime
from typing import (
    Any,
    Callable,
    Dict,
    Generic,
    List,
    Optional,
    Protocol,
    TypeVar,
    Union,
    runtime_checkable,
)

__version__ = "1.0.0"
__all__ = [
    # Exception types
    "ContractError",
    "PreconditionError",
    "PostconditionError",
    "InvariantError",
    # Configuration
    "ContractMode",
    "ContractConfig",
    "set_contract_mode",
    "get_contract_mode",
    # Entity stores
    "EntityStore",
    "InMemoryEntityStore",
    "register_entity_store",
    "get_entity_store",
    # State management
    "OldState",
    "capture_old_state",
    # Decorators
    "preconditions",
    "postconditions",
    "invariants",
    "contract",
]

# ============================================================================
# LOGGING
# ============================================================================

logger = logging.getLogger("isl.contracts")


# ============================================================================
# CONTRACT EXCEPTIONS
# ============================================================================


class ContractError(Exception):
    """Base exception for all contract violations."""

    def __init__(
        self,
        message: str,
        expression: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message)
        self.message = message
        self.expression = expression
        self.context = context or {}
        self.timestamp = datetime.now()

    def __str__(self) -> str:
        parts = [self.message]
        if self.expression:
            parts.append(f"Expression: {self.expression}")
        if self.context:
            parts.append(f"Context: {self.context}")
        return " | ".join(parts)


class PreconditionError(ContractError):
    """Raised when a precondition check fails."""

    pass


class PostconditionError(ContractError):
    """Raised when a postcondition check fails."""

    pass


class InvariantError(ContractError):
    """Raised when an invariant check fails."""

    pass


# ============================================================================
# CONTRACT CONFIGURATION
# ============================================================================


class ContractMode:
    """Contract enforcement modes."""

    STRICT = "strict"  # Raise exceptions on violation
    WARN = "warn"  # Log warnings but continue
    SKIP = "skip"  # Skip all contract checking


@dataclass
class ContractConfig:
    """Global configuration for contract checking."""

    mode: str = ContractMode.STRICT
    collect_violations: bool = False
    max_violations: int = 100
    log_violations: bool = True

    # Entity stores keyed by name
    entity_stores: Dict[str, "EntityStore"] = field(default_factory=dict)

    # Collected violations (if collect_violations is True)
    violations: List[ContractError] = field(default_factory=list)


# Global configuration instance
_config = ContractConfig()


def set_contract_mode(mode: str) -> None:
    """Set the global contract enforcement mode."""
    if mode not in (ContractMode.STRICT, ContractMode.WARN, ContractMode.SKIP):
        raise ValueError(f"Invalid contract mode: {mode}")
    _config.mode = mode


def get_contract_mode() -> str:
    """Get the current contract enforcement mode."""
    return _config.mode


def get_config() -> ContractConfig:
    """Get the global contract configuration."""
    return _config


# ============================================================================
# ENTITY STORES
# ============================================================================


@runtime_checkable
class EntityStore(Protocol):
    """Protocol for entity storage backends."""

    def exists(self, criteria: Dict[str, Any]) -> bool:
        """Check if an entity matching criteria exists."""
        ...

    def lookup(self, criteria: Dict[str, Any]) -> Optional[Any]:
        """Look up an entity by criteria."""
        ...

    def count(self, criteria: Optional[Dict[str, Any]] = None) -> int:
        """Count entities matching criteria."""
        ...

    def get_all(self) -> List[Any]:
        """Get all entities."""
        ...


T = TypeVar("T")


class InMemoryEntityStore(Generic[T]):
    """In-memory entity store implementation for testing."""

    def __init__(self, entities: Optional[List[T]] = None):
        self._entities: List[T] = list(entities) if entities else []

    def add(self, entity: T) -> None:
        """Add an entity to the store."""
        self._entities.append(entity)

    def remove(self, entity: T) -> bool:
        """Remove an entity from the store."""
        try:
            self._entities.remove(entity)
            return True
        except ValueError:
            return False

    def clear(self) -> None:
        """Clear all entities."""
        self._entities.clear()

    def exists(self, criteria: Dict[str, Any]) -> bool:
        """Check if an entity matching criteria exists."""
        return self.lookup(criteria) is not None

    def lookup(self, criteria: Dict[str, Any]) -> Optional[T]:
        """Look up an entity by criteria."""
        for entity in self._entities:
            if self._matches(entity, criteria):
                return entity
        return None

    def count(self, criteria: Optional[Dict[str, Any]] = None) -> int:
        """Count entities matching criteria."""
        if criteria is None:
            return len(self._entities)
        return sum(1 for e in self._entities if self._matches(e, criteria))

    def get_all(self) -> List[T]:
        """Get all entities."""
        return list(self._entities)

    def _matches(self, entity: T, criteria: Dict[str, Any]) -> bool:
        """Check if entity matches all criteria."""
        for key, value in criteria.items():
            entity_value = getattr(entity, key, None)
            if entity_value is None:
                # Try dict-style access
                if isinstance(entity, dict):
                    entity_value = entity.get(key)
            if entity_value != value:
                return False
        return True


def register_entity_store(name: str, store: EntityStore) -> None:
    """Register an entity store by name."""
    _config.entity_stores[name] = store


def get_entity_store(name: str) -> Optional[EntityStore]:
    """Get a registered entity store by name."""
    return _config.entity_stores.get(name)


# ============================================================================
# OLD STATE MANAGEMENT
# ============================================================================


class OldState:
    """Captures old state for postcondition checking."""

    def __init__(self, values: Optional[Dict[str, Any]] = None):
        self._values = values or {}

    def get(self, name: str) -> Any:
        """Get an old value by name."""
        return self._values.get(name)

    def entity(self, name: str) -> Any:
        """Get old entity store state."""
        return self._values.get(f"__entity_{name}")

    def set(self, name: str, value: Any) -> None:
        """Set an old value."""
        self._values[name] = value

    def set_entity(self, name: str, store: EntityStore) -> None:
        """Capture entity store state."""
        self._values[f"__entity_{name}"] = deepcopy(store)

    def __repr__(self) -> str:
        return f"OldState({self._values})"


def capture_old_state(
    input_obj: Any = None,
    entity_names: Optional[List[str]] = None,
) -> OldState:
    """
    Capture old state before behavior execution.

    Args:
        input_obj: The input object (its fields will be captured)
        entity_names: Names of entity stores to capture

    Returns:
        OldState object with captured values
    """
    old = OldState()

    # Capture input fields
    if input_obj is not None:
        if hasattr(input_obj, "__dict__"):
            for key, value in input_obj.__dict__.items():
                old.set(key, deepcopy(value))
        elif isinstance(input_obj, dict):
            for key, value in input_obj.items():
                old.set(key, deepcopy(value))

    # Capture entity stores
    if entity_names:
        for name in entity_names:
            store = get_entity_store(name)
            if store:
                old.set_entity(name, store)

    return old


# ============================================================================
# CONTRACT CHECKING HELPERS
# ============================================================================


def _handle_violation(error: ContractError) -> None:
    """Handle a contract violation according to current mode."""
    mode = _config.mode

    if _config.collect_violations and len(_config.violations) < _config.max_violations:
        _config.violations.append(error)

    if mode == ContractMode.SKIP:
        return

    if _config.log_violations:
        logger.warning(f"Contract violation: {error}")

    if mode == ContractMode.STRICT:
        raise error
    elif mode == ContractMode.WARN:
        warnings.warn(str(error), UserWarning, stacklevel=3)


def check_precondition(
    condition: bool,
    message: str = "Precondition failed",
    expression: Optional[str] = None,
    context: Optional[Dict[str, Any]] = None,
) -> None:
    """Check a precondition and handle violations."""
    if _config.mode == ContractMode.SKIP:
        return

    if not condition:
        _handle_violation(PreconditionError(message, expression, context))


def check_postcondition(
    condition: bool,
    message: str = "Postcondition failed",
    expression: Optional[str] = None,
    context: Optional[Dict[str, Any]] = None,
) -> None:
    """Check a postcondition and handle violations."""
    if _config.mode == ContractMode.SKIP:
        return

    if not condition:
        _handle_violation(PostconditionError(message, expression, context))


def check_invariant(
    condition: bool,
    message: str = "Invariant violated",
    expression: Optional[str] = None,
    context: Optional[Dict[str, Any]] = None,
) -> None:
    """Check an invariant and handle violations."""
    if _config.mode == ContractMode.SKIP:
        return

    if not condition:
        _handle_violation(InvariantError(message, expression, context))


# ============================================================================
# CONTRACT DECORATORS
# ============================================================================

F = TypeVar("F", bound=Callable[..., Any])


def preconditions(*checks: Callable[[Any], bool]) -> Callable[[F], F]:
    """
    Decorator to add precondition checks to a function.

    Args:
        *checks: Callable predicates that receive the first argument

    Example:
        @preconditions(lambda x: x.amount > 0)
        def transfer(input: TransferInput) -> TransferResult:
            ...
    """

    def decorator(func: F) -> F:
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            if _config.mode != ContractMode.SKIP and args:
                input_arg = args[0]
                for i, check in enumerate(checks):
                    try:
                        result = check(input_arg)
                        if not result:
                            _handle_violation(
                                PreconditionError(
                                    f"Precondition {i + 1} failed",
                                    context={"input": str(input_arg)},
                                )
                            )
                    except Exception as e:
                        _handle_violation(
                            PreconditionError(
                                f"Precondition {i + 1} raised exception: {e}",
                                context={"input": str(input_arg)},
                            )
                        )
            return func(*args, **kwargs)

        return wrapper  # type: ignore

    return decorator


def postconditions(*checks: Callable[[Any, Any], bool]) -> Callable[[F], F]:
    """
    Decorator to add postcondition checks to a function.

    Args:
        *checks: Callable predicates that receive (input, result)

    Example:
        @postconditions(lambda inp, res: res.balance >= 0)
        def transfer(input: TransferInput) -> TransferResult:
            ...
    """

    def decorator(func: F) -> F:
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            result = func(*args, **kwargs)

            if _config.mode != ContractMode.SKIP and args:
                input_arg = args[0]
                for i, check in enumerate(checks):
                    try:
                        passed = check(input_arg, result)
                        if not passed:
                            _handle_violation(
                                PostconditionError(
                                    f"Postcondition {i + 1} failed",
                                    context={
                                        "input": str(input_arg),
                                        "result": str(result),
                                    },
                                )
                            )
                    except Exception as e:
                        _handle_violation(
                            PostconditionError(
                                f"Postcondition {i + 1} raised exception: {e}",
                                context={
                                    "input": str(input_arg),
                                    "result": str(result),
                                },
                            )
                        )
            return result

        return wrapper  # type: ignore

    return decorator


def invariants(*checks: Callable[[Any], bool]) -> Callable[[type], type]:
    """
    Class decorator to add invariant checks after each method call.

    Args:
        *checks: Callable predicates that receive self

    Example:
        @invariants(lambda self: self.balance >= 0)
        class Account:
            ...
    """

    def decorator(cls: type) -> type:
        original_init = cls.__init__

        def new_init(self: Any, *args: Any, **kwargs: Any) -> None:
            original_init(self, *args, **kwargs)
            _check_invariants(self, checks)

        cls.__init__ = new_init

        # Wrap all public methods
        for name in dir(cls):
            if name.startswith("_"):
                continue
            attr = getattr(cls, name)
            if callable(attr) and not isinstance(attr, type):
                setattr(cls, name, _wrap_with_invariant_check(attr, checks))

        return cls

    return decorator


def _check_invariants(
    obj: Any, checks: tuple[Callable[[Any], bool], ...]
) -> None:
    """Check all invariants on an object."""
    if _config.mode == ContractMode.SKIP:
        return

    for i, check in enumerate(checks):
        try:
            if not check(obj):
                _handle_violation(
                    InvariantError(
                        f"Invariant {i + 1} failed",
                        context={"object": str(obj)},
                    )
                )
        except Exception as e:
            _handle_violation(
                InvariantError(
                    f"Invariant {i + 1} raised exception: {e}",
                    context={"object": str(obj)},
                )
            )


def _wrap_with_invariant_check(
    method: Callable[..., Any], checks: tuple[Callable[[Any], bool], ...]
) -> Callable[..., Any]:
    """Wrap a method to check invariants after execution."""

    @functools.wraps(method)
    def wrapper(self: Any, *args: Any, **kwargs: Any) -> Any:
        result = method(self, *args, **kwargs)
        _check_invariants(self, checks)
        return result

    return wrapper


def contract(
    pre: Optional[List[Callable[[Any], bool]]] = None,
    post: Optional[List[Callable[[Any, Any], bool]]] = None,
) -> Callable[[F], F]:
    """
    Combined decorator for preconditions and postconditions.

    Args:
        pre: List of precondition checks
        post: List of postcondition checks

    Example:
        @contract(
            pre=[lambda x: x.amount > 0],
            post=[lambda inp, res: res.success]
        )
        def transfer(input: TransferInput) -> TransferResult:
            ...
    """

    def decorator(func: F) -> F:
        wrapped = func
        if pre:
            wrapped = preconditions(*pre)(wrapped)
        if post:
            wrapped = postconditions(*post)(wrapped)
        return wrapped  # type: ignore

    return decorator


# ============================================================================
# TESTING UTILITIES
# ============================================================================


def reset_config() -> None:
    """Reset configuration to defaults (useful for testing)."""
    global _config
    _config = ContractConfig()


def get_violations() -> List[ContractError]:
    """Get collected violations."""
    return list(_config.violations)


def clear_violations() -> None:
    """Clear collected violations."""
    _config.violations.clear()


def enable_violation_collection(enabled: bool = True) -> None:
    """Enable or disable violation collection."""
    _config.collect_violations = enabled
