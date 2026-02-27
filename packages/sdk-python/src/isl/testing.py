"""
ISL Testing - Test utilities and mock client.

This module provides utilities for testing code that uses the ISL SDK.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, TypeVar
from unittest.mock import MagicMock, AsyncMock

from isl.models import (
    User,
    UserStatus,
    UserRole,
    CreateUserInput,
    UpdateUserInput,
)
from isl.results import (
    CreateUserResult,
    GetUserResult,
    UpdateUserResult,
    DeleteUserResult,
    ListUsersResult,
    SearchUsersResult,
)


T = TypeVar("T")


# =============================================================================
# Fixtures
# =============================================================================


class Fixtures:
    """Test fixtures for common test data."""
    
    @staticmethod
    def user(
        id: str = "user-123",
        email: str = "test@example.com",
        username: str = "testuser",
        status: UserStatus = UserStatus.PENDING,
        role: UserRole = UserRole.USER,
        created_at: datetime | None = None,
        updated_at: datetime | None = None,
        metadata: dict[str, str] | None = None,
    ) -> User:
        """Create a mock user."""
        now = datetime.now()
        return User(
            id=id,
            email=email,
            username=username,
            status=status,
            role=role,
            created_at=created_at or now,
            updated_at=updated_at or now,
            metadata=metadata,
        )
    
    @staticmethod
    def users(count: int = 10) -> list[User]:
        """Create a list of mock users."""
        return [
            Fixtures.user(
                id=f"user-{i}",
                email=f"user{i}@example.com",
                username=f"user{i}",
            )
            for i in range(1, count + 1)
        ]
    
    @staticmethod
    def create_user_input(
        email: str = "test@example.com",
        username: str = "testuser",
        role: UserRole = UserRole.USER,
    ) -> CreateUserInput:
        """Create a mock CreateUserInput."""
        return CreateUserInput(
            email=email,
            username=username,
            role=role,
        )
    
    @staticmethod
    def update_user_input(
        username: str | None = None,
        status: UserStatus | None = None,
        role: UserRole | None = None,
    ) -> UpdateUserInput:
        """Create a mock UpdateUserInput."""
        return UpdateUserInput(
            username=username,
            status=status,
            role=role,
        )
    
    # Pre-built fixtures
    @staticmethod
    def active_user() -> User:
        """Get an active user fixture."""
        return Fixtures.user(id="active-user", status=UserStatus.ACTIVE)
    
    @staticmethod
    def pending_user() -> User:
        """Get a pending user fixture."""
        return Fixtures.user(id="pending-user", status=UserStatus.PENDING)
    
    @staticmethod
    def suspended_user() -> User:
        """Get a suspended user fixture."""
        return Fixtures.user(id="suspended-user", status=UserStatus.SUSPENDED)
    
    @staticmethod
    def admin_user() -> User:
        """Get an admin user fixture."""
        return Fixtures.user(id="admin-user", role=UserRole.ADMIN)


# Convenience alias
fixtures = Fixtures()


# =============================================================================
# Mock Result Builder
# =============================================================================


@dataclass
class MockResultBuilder:
    """Builder for mock results."""
    
    _result: Any = None
    _args_matcher: Callable[..., bool] | None = None
    
    def returns(self, result: Any) -> MockResultBuilder:
        """Set the return value."""
        self._result = result
        return self
    
    def with_args(self, *args: Any, **kwargs: Any) -> MockResultBuilder:
        """Match specific arguments."""
        def matcher(*call_args: Any, **call_kwargs: Any) -> bool:
            return call_args == args and call_kwargs == kwargs
        self._args_matcher = matcher
        return self
    
    def raises(self, exception: Exception) -> MockResultBuilder:
        """Raise an exception."""
        async def raise_error(*args: Any, **kwargs: Any) -> None:
            raise exception
        self._result = raise_error
        return self


# =============================================================================
# Mock User Service
# =============================================================================


class MockUserService:
    """Mock user service for testing."""
    
    def __init__(self) -> None:
        self._create_user_results: dict[str, Any] = {}
        self._get_user_results: dict[str, Any] = {}
        self._update_user_results: dict[str, Any] = {}
        self._delete_user_results: dict[str, Any] = {}
        self._list_users_result: Any = None
        self._search_users_result: Any = None
        
        self._default_create_result = CreateUserResult.ServerError(message="Not mocked")
        self._default_get_result = GetUserResult.ServerError(message="Not mocked")
        self._default_update_result = UpdateUserResult.ServerError(message="Not mocked")
        self._default_delete_result = DeleteUserResult.ServerError(message="Not mocked")
        self._default_list_result = ListUsersResult.ServerError(message="Not mocked")
        self._default_search_result = SearchUsersResult.ServerError(message="Not mocked")
        
        # Call tracking
        self._create_user_calls: list[CreateUserInput] = []
        self._get_user_calls: list[str] = []
        self._update_user_calls: list[tuple[str, UpdateUserInput]] = []
        self._delete_user_calls: list[str] = []
    
    # Configuration
    @property
    def create_user(self) -> MockMethodConfig:
        """Configure create_user mock."""
        return MockMethodConfig(
            set_default=lambda r: setattr(self, "_default_create_result", r),
            set_for_key=lambda k, r: self._create_user_results.__setitem__(k, r),
        )
    
    @property
    def get_user(self) -> MockMethodConfig:
        """Configure get_user mock."""
        return MockMethodConfig(
            set_default=lambda r: setattr(self, "_default_get_result", r),
            set_for_key=lambda k, r: self._get_user_results.__setitem__(k, r),
        )
    
    # Async methods
    async def create_user_async(self, input_data: CreateUserInput) -> Any:
        """Mock create_user."""
        self._create_user_calls.append(input_data)
        key = f"{input_data.email}:{input_data.username}"
        return self._create_user_results.get(key, self._default_create_result)
    
    async def get_user_async(self, user_id: str) -> Any:
        """Mock get_user."""
        self._get_user_calls.append(user_id)
        return self._get_user_results.get(user_id, self._default_get_result)
    
    async def update_user_async(self, user_id: str, input_data: UpdateUserInput) -> Any:
        """Mock update_user."""
        self._update_user_calls.append((user_id, input_data))
        return self._update_user_results.get(user_id, self._default_update_result)
    
    async def delete_user_async(self, user_id: str) -> Any:
        """Mock delete_user."""
        self._delete_user_calls.append(user_id)
        return self._delete_user_results.get(user_id, self._default_delete_result)
    
    async def list_users_async(self, input_data: Any = None) -> Any:
        """Mock list_users."""
        return self._list_users_result or self._default_list_result
    
    async def search_users_async(self, input_data: Any) -> Any:
        """Mock search_users."""
        return self._search_users_result or self._default_search_result
    
    # Verification
    def verify_create_user_called(self, input_data: CreateUserInput) -> bool:
        """Verify create_user was called with specific input."""
        return input_data in self._create_user_calls
    
    def verify_create_user_called_times(self, times: int) -> bool:
        """Verify create_user was called n times."""
        return len(self._create_user_calls) == times
    
    def verify_get_user_called(self, user_id: str) -> bool:
        """Verify get_user was called with specific user_id."""
        return user_id in self._get_user_calls
    
    def verify_update_user_called(self, user_id: str) -> bool:
        """Verify update_user was called."""
        return any(call[0] == user_id for call in self._update_user_calls)
    
    def verify_delete_user_called(self, user_id: str) -> bool:
        """Verify delete_user was called."""
        return user_id in self._delete_user_calls
    
    def reset(self) -> None:
        """Reset all mocks and call tracking."""
        self._create_user_results.clear()
        self._get_user_results.clear()
        self._update_user_results.clear()
        self._delete_user_results.clear()
        self._list_users_result = None
        self._search_users_result = None
        self._create_user_calls.clear()
        self._get_user_calls.clear()
        self._update_user_calls.clear()
        self._delete_user_calls.clear()


@dataclass
class MockMethodConfig:
    """Configuration helper for mock methods."""
    
    set_default: Callable[[Any], None]
    set_for_key: Callable[[str, Any], None]
    
    def returns(self, result: Any) -> None:
        """Set default return value."""
        self.set_default(result)
    
    def with_args(self, key: str) -> MockArgsConfig:
        """Configure for specific arguments."""
        return MockArgsConfig(key=key, set_for_key=self.set_for_key)


@dataclass
class MockArgsConfig:
    """Configuration for specific arguments."""
    
    key: str
    set_for_key: Callable[[str, Any], None]
    
    def returns(self, result: Any) -> None:
        """Set return value for specific args."""
        self.set_for_key(self.key, result)


# =============================================================================
# Mock ISL Client
# =============================================================================


class MockISLClient:
    """
    Mock ISL client for testing.
    
    Example:
        >>> mock_client = MockISLClient()
        >>> mock_client.users.create_user.returns(
        ...     CreateUserResult.Success(user=fixtures.user())
        ... )
        >>> result = await mock_client.users.create_user_async(input_data)
    """
    
    def __init__(self) -> None:
        self._users = MockUserService()
    
    @property
    def users(self) -> MockUserService:
        """Get the mock user service."""
        return self._users
    
    def reset(self) -> None:
        """Reset all mocks."""
        self._users.reset()


# =============================================================================
# Assertion Helpers
# =============================================================================


def assert_success(result: Any) -> None:
    """Assert that a result is successful."""
    assert result.is_success, f"Expected success, got: {result}"


def assert_error(result: Any) -> None:
    """Assert that a result is an error."""
    assert result.is_error, f"Expected error, got: {result}"


def assert_user_equals(actual: User, expected: User) -> None:
    """Assert that two users are equal."""
    assert actual.id == expected.id, f"ID mismatch: {actual.id} != {expected.id}"
    assert actual.email == expected.email, f"Email mismatch: {actual.email} != {expected.email}"
    assert actual.username == expected.username
    assert actual.status == expected.status
    assert actual.role == expected.role
