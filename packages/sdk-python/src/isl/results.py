"""
ISL Results - Typed result classes for API operations.

This module provides sealed-class-like result types using Python's
structural pattern matching (3.10+).

Example:
    >>> result = await client.users.create_user(input_data)
    >>> match result:
    ...     case CreateUserResult.Success(user=user):
    ...         print(f"Created: {user.id}")
    ...     case CreateUserResult.DuplicateEmail():
    ...         print("Email exists")
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Generic, TypeVar, Callable, Any

from isl.models import User


T = TypeVar("T")


# =============================================================================
# Base Result Type
# =============================================================================


@dataclass(frozen=True, slots=True)
class Result(Generic[T]):
    """
    Base result type for all operations.
    
    Provides common helper methods for working with results.
    """
    
    @property
    def is_success(self) -> bool:
        """Check if result is successful."""
        return False
    
    @property
    def is_error(self) -> bool:
        """Check if result is an error."""
        return not self.is_success
    
    @property
    def value(self) -> T:
        """Get the success value. Raises if error."""
        raise NotImplementedError
    
    def unwrap(self) -> T:
        """
        Get the success value or raise an exception.
        
        Raises:
            ValueError: If result is an error
        """
        if self.is_success:
            return self.value
        raise ValueError(f"Cannot unwrap error result: {self}")
    
    def unwrap_or(self, default: T) -> T:
        """Get the success value or return a default."""
        return self.value if self.is_success else default
    
    def unwrap_or_else(self, default_fn: Callable[[], T]) -> T:
        """Get the success value or compute a default."""
        return self.value if self.is_success else default_fn()
    
    def map(self, fn: Callable[[T], Any]) -> Any:
        """Map the success value."""
        return fn(self.value) if self.is_success else None
    
    def on_success(self, fn: Callable[[T], None]) -> Result[T]:
        """Execute a function if successful."""
        if self.is_success:
            fn(self.value)
        return self
    
    def on_error(self, fn: Callable[[Result[T]], None]) -> Result[T]:
        """Execute a function if error."""
        if self.is_error:
            fn(self)
        return self


# =============================================================================
# CreateUser Results
# =============================================================================


class CreateUserResult:
    """
    Result type for create_user operation.
    
    Variants:
    - Success: User created successfully
    - DuplicateEmail: Email already exists
    - DuplicateUsername: Username already taken
    - InvalidInput: Input validation failed
    - RateLimited: Too many requests
    - ServerError: Server error
    - NetworkError: Network error
    """
    
    @dataclass(frozen=True, slots=True)
    class Success(Result[User]):
        """Successful user creation."""
        user: User
        
        @property
        def is_success(self) -> bool:
            return True
        
        @property
        def value(self) -> User:
            return self.user
    
    @dataclass(frozen=True, slots=True)
    class DuplicateEmail(Result[User]):
        """Email already exists."""
        
        @property
        def is_success(self) -> bool:
            return False
    
    @dataclass(frozen=True, slots=True)
    class DuplicateUsername(Result[User]):
        """Username already taken."""
        
        @property
        def is_success(self) -> bool:
            return False
    
    @dataclass(frozen=True, slots=True)
    class InvalidInput(Result[User]):
        """Input validation failed."""
        message: str
        field: str | None = None
        
        @property
        def is_success(self) -> bool:
            return False
    
    @dataclass(frozen=True, slots=True)
    class RateLimited(Result[User]):
        """Rate limit exceeded."""
        retry_after: int
        
        @property
        def is_success(self) -> bool:
            return False
    
    @dataclass(frozen=True, slots=True)
    class ServerError(Result[User]):
        """Server error."""
        message: str
        code: str | None = None
        
        @property
        def is_success(self) -> bool:
            return False
    
    @dataclass(frozen=True, slots=True)
    class NetworkError(Result[User]):
        """Network error."""
        cause: Exception
        
        @property
        def is_success(self) -> bool:
            return False


# =============================================================================
# GetUser Results
# =============================================================================


class GetUserResult:
    """Result type for get_user operation."""
    
    @dataclass(frozen=True, slots=True)
    class Success(Result[User]):
        """User found."""
        user: User
        
        @property
        def is_success(self) -> bool:
            return True
        
        @property
        def value(self) -> User:
            return self.user
    
    @dataclass(frozen=True, slots=True)
    class NotFound(Result[User]):
        """User not found."""
        
        @property
        def is_success(self) -> bool:
            return False
    
    @dataclass(frozen=True, slots=True)
    class Unauthorized(Result[User]):
        """Not authorized."""
        
        @property
        def is_success(self) -> bool:
            return False
    
    @dataclass(frozen=True, slots=True)
    class ServerError(Result[User]):
        """Server error."""
        message: str
        
        @property
        def is_success(self) -> bool:
            return False
    
    @dataclass(frozen=True, slots=True)
    class NetworkError(Result[User]):
        """Network error."""
        cause: Exception
        
        @property
        def is_success(self) -> bool:
            return False


# =============================================================================
# UpdateUser Results
# =============================================================================


class UpdateUserResult:
    """Result type for update_user operation."""
    
    @dataclass(frozen=True, slots=True)
    class Success(Result[User]):
        """User updated successfully."""
        user: User
        
        @property
        def is_success(self) -> bool:
            return True
        
        @property
        def value(self) -> User:
            return self.user
    
    @dataclass(frozen=True, slots=True)
    class NotFound(Result[User]):
        """User not found."""
        
        @property
        def is_success(self) -> bool:
            return False
    
    @dataclass(frozen=True, slots=True)
    class Unauthorized(Result[User]):
        """Not authorized."""
        
        @property
        def is_success(self) -> bool:
            return False
    
    @dataclass(frozen=True, slots=True)
    class Forbidden(Result[User]):
        """Operation forbidden."""
        
        @property
        def is_success(self) -> bool:
            return False
    
    @dataclass(frozen=True, slots=True)
    class InvalidInput(Result[User]):
        """Input validation failed."""
        message: str
        field: str | None = None
        
        @property
        def is_success(self) -> bool:
            return False
    
    @dataclass(frozen=True, slots=True)
    class Conflict(Result[User]):
        """Conflict error."""
        message: str
        
        @property
        def is_success(self) -> bool:
            return False
    
    @dataclass(frozen=True, slots=True)
    class RateLimited(Result[User]):
        """Rate limit exceeded."""
        retry_after: int
        
        @property
        def is_success(self) -> bool:
            return False
    
    @dataclass(frozen=True, slots=True)
    class ServerError(Result[User]):
        """Server error."""
        message: str
        
        @property
        def is_success(self) -> bool:
            return False
    
    @dataclass(frozen=True, slots=True)
    class NetworkError(Result[User]):
        """Network error."""
        cause: Exception
        
        @property
        def is_success(self) -> bool:
            return False


# =============================================================================
# DeleteUser Results
# =============================================================================


class DeleteUserResult:
    """Result type for delete_user operation."""
    
    @dataclass(frozen=True, slots=True)
    class Success(Result[None]):
        """User deleted successfully."""
        
        @property
        def is_success(self) -> bool:
            return True
        
        @property
        def value(self) -> None:
            return None
    
    @dataclass(frozen=True, slots=True)
    class NotFound(Result[None]):
        """User not found."""
        
        @property
        def is_success(self) -> bool:
            return False
    
    @dataclass(frozen=True, slots=True)
    class Unauthorized(Result[None]):
        """Not authorized."""
        
        @property
        def is_success(self) -> bool:
            return False
    
    @dataclass(frozen=True, slots=True)
    class Forbidden(Result[None]):
        """Operation forbidden."""
        
        @property
        def is_success(self) -> bool:
            return False
    
    @dataclass(frozen=True, slots=True)
    class ServerError(Result[None]):
        """Server error."""
        message: str
        
        @property
        def is_success(self) -> bool:
            return False
    
    @dataclass(frozen=True, slots=True)
    class NetworkError(Result[None]):
        """Network error."""
        cause: Exception
        
        @property
        def is_success(self) -> bool:
            return False


# =============================================================================
# ListUsers Results
# =============================================================================


class ListUsersResult:
    """Result type for list_users operation."""
    
    @dataclass(frozen=True, slots=True)
    class Success(Result[list[User]]):
        """Users listed successfully."""
        users: list[User]
        next_page_token: str | None = None
        total_count: int | None = None
        
        @property
        def is_success(self) -> bool:
            return True
        
        @property
        def value(self) -> list[User]:
            return self.users
        
        @property
        def has_more(self) -> bool:
            return self.next_page_token is not None
    
    @dataclass(frozen=True, slots=True)
    class Unauthorized(Result[list[User]]):
        """Not authorized."""
        
        @property
        def is_success(self) -> bool:
            return False
    
    @dataclass(frozen=True, slots=True)
    class InvalidInput(Result[list[User]]):
        """Input validation failed."""
        message: str
        
        @property
        def is_success(self) -> bool:
            return False
    
    @dataclass(frozen=True, slots=True)
    class ServerError(Result[list[User]]):
        """Server error."""
        message: str
        
        @property
        def is_success(self) -> bool:
            return False
    
    @dataclass(frozen=True, slots=True)
    class NetworkError(Result[list[User]]):
        """Network error."""
        cause: Exception
        
        @property
        def is_success(self) -> bool:
            return False


# =============================================================================
# SearchUsers Results
# =============================================================================


class SearchUsersResult:
    """Result type for search_users operation."""
    
    @dataclass(frozen=True, slots=True)
    class Success(Result[list[User]]):
        """Search completed successfully."""
        users: list[User]
        next_page_token: str | None = None
        total_count: int | None = None
        
        @property
        def is_success(self) -> bool:
            return True
        
        @property
        def value(self) -> list[User]:
            return self.users
        
        @property
        def has_more(self) -> bool:
            return self.next_page_token is not None
    
    @dataclass(frozen=True, slots=True)
    class Unauthorized(Result[list[User]]):
        """Not authorized."""
        
        @property
        def is_success(self) -> bool:
            return False
    
    @dataclass(frozen=True, slots=True)
    class InvalidInput(Result[list[User]]):
        """Input validation failed."""
        message: str
        
        @property
        def is_success(self) -> bool:
            return False
    
    @dataclass(frozen=True, slots=True)
    class ServerError(Result[list[User]]):
        """Server error."""
        message: str
        
        @property
        def is_success(self) -> bool:
            return False
    
    @dataclass(frozen=True, slots=True)
    class NetworkError(Result[list[User]]):
        """Network error."""
        cause: Exception
        
        @property
        def is_success(self) -> bool:
            return False


# Type aliases for convenience
CreateUserResultType = (
    CreateUserResult.Success
    | CreateUserResult.DuplicateEmail
    | CreateUserResult.DuplicateUsername
    | CreateUserResult.InvalidInput
    | CreateUserResult.RateLimited
    | CreateUserResult.ServerError
    | CreateUserResult.NetworkError
)

GetUserResultType = (
    GetUserResult.Success
    | GetUserResult.NotFound
    | GetUserResult.Unauthorized
    | GetUserResult.ServerError
    | GetUserResult.NetworkError
)

UpdateUserResultType = (
    UpdateUserResult.Success
    | UpdateUserResult.NotFound
    | UpdateUserResult.Unauthorized
    | UpdateUserResult.Forbidden
    | UpdateUserResult.InvalidInput
    | UpdateUserResult.Conflict
    | UpdateUserResult.RateLimited
    | UpdateUserResult.ServerError
    | UpdateUserResult.NetworkError
)

DeleteUserResultType = (
    DeleteUserResult.Success
    | DeleteUserResult.NotFound
    | DeleteUserResult.Unauthorized
    | DeleteUserResult.Forbidden
    | DeleteUserResult.ServerError
    | DeleteUserResult.NetworkError
)

ListUsersResultType = (
    ListUsersResult.Success
    | ListUsersResult.Unauthorized
    | ListUsersResult.InvalidInput
    | ListUsersResult.ServerError
    | ListUsersResult.NetworkError
)

SearchUsersResultType = (
    SearchUsersResult.Success
    | SearchUsersResult.Unauthorized
    | SearchUsersResult.InvalidInput
    | SearchUsersResult.ServerError
    | SearchUsersResult.NetworkError
)
