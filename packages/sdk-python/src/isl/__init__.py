"""
ISL Python SDK - Native Python SDK for ISL-verified APIs.

This SDK provides type-safe API clients generated from ISL specifications
with automatic precondition/postcondition verification.

Example:
    >>> from isl import ISLClient
    >>> async with ISLClient(base_url="https://api.example.com") as client:
    ...     result = await client.users.create_user(input_data)
    ...     match result:
    ...         case CreateUserResult.Success(user=user):
    ...             print(f"Created: {user.id}")
"""

from isl.client import ISLClient, SyncISLClient
from isl.config import ISLClientConfig, RetryConfig, VerificationConfig
from isl.exceptions import (
    ISLError,
    PreconditionError,
    PostconditionError,
    ValidationError,
    NetworkError,
    RateLimitError,
    ServerError,
)
from isl.models import (
    User,
    UserStatus,
    UserRole,
    Email,
    Username,
    UserId,
    CreateUserInput,
    UpdateUserInput,
    ListUsersInput,
    SearchUsersInput,
)
from isl.results import (
    CreateUserResult,
    GetUserResult,
    UpdateUserResult,
    DeleteUserResult,
    ListUsersResult,
    SearchUsersResult,
)

__version__ = "0.1.0"
__all__ = [
    # Client
    "ISLClient",
    "SyncISLClient",
    # Config
    "ISLClientConfig",
    "RetryConfig",
    "VerificationConfig",
    # Exceptions
    "ISLError",
    "PreconditionError",
    "PostconditionError",
    "ValidationError",
    "NetworkError",
    "RateLimitError",
    "ServerError",
    # Models
    "User",
    "UserStatus",
    "UserRole",
    "Email",
    "Username",
    "UserId",
    "CreateUserInput",
    "UpdateUserInput",
    "ListUsersInput",
    "SearchUsersInput",
    # Results
    "CreateUserResult",
    "GetUserResult",
    "UpdateUserResult",
    "DeleteUserResult",
    "ListUsersResult",
    "SearchUsersResult",
]
