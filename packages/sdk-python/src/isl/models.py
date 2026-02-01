"""
ISL Models - Pydantic models generated from ISL specifications.

This module contains:
- Value types with built-in validation (Email, Username, etc.)
- Enums for state machines (UserStatus, UserRole)
- Entity models (User, UserProfile)
- Input DTOs (CreateUserInput, UpdateUserInput)
"""

from __future__ import annotations

import re
from datetime import datetime
from enum import Enum
from typing import Annotated, Any

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)


# =============================================================================
# Value Types - Constrained types from ISL
# =============================================================================


class Email(str):
    """
    Email value type with built-in validation.
    
    Validates:
    - Contains @
    - Max 254 characters
    - Valid email format (RFC 5322 simplified)
    
    Example:
        >>> email = Email("user@example.com")
        >>> Email("invalid")  # Raises ValueError
    """
    
    _EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
    
    def __new__(cls, value: str) -> Email:
        if not value:
            raise ValueError("Email cannot be empty")
        if "@" not in value:
            raise ValueError("Email must contain @")
        if len(value) > 254:
            raise ValueError("Email must be at most 254 characters")
        if len(value) < 3:
            raise ValueError("Email must be at least 3 characters")
        if not cls._EMAIL_REGEX.match(value):
            raise ValueError("Invalid email format")
        return str.__new__(cls, value)


class Username(str):
    """
    Username value type with built-in validation.
    
    Validates:
    - 3-30 characters
    - Alphanumeric with underscores and hyphens only
    - Not a reserved username
    
    Example:
        >>> username = Username("validuser")
        >>> Username("ab")  # Raises ValueError (too short)
    """
    
    _USERNAME_REGEX = re.compile(r"^[a-zA-Z0-9_-]+$")
    _RESERVED = {"admin", "root", "system", "null", "undefined", "api", "www"}
    
    def __new__(cls, value: str) -> Username:
        if not value:
            raise ValueError("Username cannot be empty")
        if len(value) < 3:
            raise ValueError("Username must be at least 3 characters")
        if len(value) > 30:
            raise ValueError("Username must be at most 30 characters")
        if not cls._USERNAME_REGEX.match(value):
            raise ValueError("Username can only contain letters, numbers, underscores, and hyphens")
        if value.lower() in cls._RESERVED:
            raise ValueError(f"Username '{value}' is reserved")
        return str.__new__(cls, value)


class UserId(str):
    """
    User ID value type.
    
    Example:
        >>> user_id = UserId("user-123")
        >>> UserId("")  # Raises ValueError
    """
    
    def __new__(cls, value: str) -> UserId:
        if not value or not value.strip():
            raise ValueError("UserId cannot be blank")
        return str.__new__(cls, value)


class PageToken(str):
    """Pagination token for cursor-based pagination."""
    pass


class PageSize(int):
    """
    Page size with bounds validation (1-100).
    
    Example:
        >>> size = PageSize(20)
        >>> PageSize(101)  # Raises ValueError
    """
    
    def __new__(cls, value: int) -> PageSize:
        if value < 1:
            raise ValueError("Page size must be at least 1")
        if value > 100:
            raise ValueError("Page size must be at most 100")
        return int.__new__(cls, value)


# =============================================================================
# Enums - State machines from ISL
# =============================================================================


class UserStatus(str, Enum):
    """
    User status enumeration.
    
    State transitions:
    - PENDING -> ACTIVE (after email verification)
    - ACTIVE -> SUSPENDED (by admin)
    - SUSPENDED -> ACTIVE (by admin)
    """
    
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"


class UserRole(str, Enum):
    """User role enumeration."""
    
    USER = "USER"
    ADMIN = "ADMIN"
    MODERATOR = "MODERATOR"


class SortOrder(str, Enum):
    """Sort order for queries."""
    
    ASC = "ASC"
    DESC = "DESC"


class ChangeType(str, Enum):
    """Type of change in an event."""
    
    CREATED = "CREATED"
    UPDATED = "UPDATED"
    DELETED = "DELETED"


# =============================================================================
# Entity Models - Domain models from ISL
# =============================================================================


class User(BaseModel):
    """
    User entity representing a system user.
    
    Attributes:
        id: Unique identifier
        email: User's email address
        username: User's display name
        status: Current account status
        role: User's role in the system
        created_at: Timestamp of creation
        updated_at: Timestamp of last update
        metadata: Optional metadata map
    """
    
    model_config = ConfigDict(frozen=True)
    
    id: str
    email: str
    username: str
    status: UserStatus
    role: UserRole = UserRole.USER
    created_at: datetime
    updated_at: datetime
    metadata: dict[str, str] | None = None
    
    @property
    def is_active(self) -> bool:
        """Check if user is active."""
        return self.status == UserStatus.ACTIVE
    
    @property
    def is_pending(self) -> bool:
        """Check if user is pending verification."""
        return self.status == UserStatus.PENDING
    
    @property
    def is_suspended(self) -> bool:
        """Check if user is suspended."""
        return self.status == UserStatus.SUSPENDED
    
    @property
    def is_admin(self) -> bool:
        """Check if user has admin privileges."""
        return self.role == UserRole.ADMIN


class UserProfile(BaseModel):
    """User profile with extended information."""
    
    model_config = ConfigDict(frozen=True)
    
    user: User
    display_name: str | None = None
    bio: str | None = None
    avatar_url: str | None = None
    location: str | None = None
    website: str | None = None


class PaginatedList(BaseModel):
    """Paginated list response."""
    
    model_config = ConfigDict(frozen=True)
    
    items: list[Any]
    next_page_token: str | None = None
    total_count: int | None = None
    
    @property
    def has_more(self) -> bool:
        """Check if there are more items."""
        return self.next_page_token is not None


class AuditEntry(BaseModel):
    """Audit log entry for tracking changes."""
    
    model_config = ConfigDict(frozen=True)
    
    id: str
    entity_type: str
    entity_id: str
    action: str
    actor_id: str | None = None
    timestamp: datetime
    changes: dict[str, dict[str, str | None]] | None = None


# =============================================================================
# Input DTOs - Request DTOs from ISL
# =============================================================================


class CreateUserInput(BaseModel):
    """
    Input for creating a new user.
    
    Preconditions:
    - email must be valid format (contains @, max 254 chars)
    - username must be 3-30 characters
    """
    
    model_config = ConfigDict(frozen=True)
    
    email: Annotated[str, Field(min_length=3, max_length=254)]
    username: Annotated[str, Field(min_length=3, max_length=30)]
    role: UserRole = UserRole.USER
    metadata: dict[str, str] | None = None
    
    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        """Validate email format."""
        if "@" not in v:
            raise ValueError("Email must contain @")
        return v
    
    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        """Validate username format."""
        if not re.match(r"^[a-zA-Z0-9_-]+$", v):
            raise ValueError("Username can only contain letters, numbers, underscores, and hyphens")
        return v


class UpdateUserInput(BaseModel):
    """Input for updating a user."""
    
    model_config = ConfigDict(frozen=True)
    
    username: Annotated[str, Field(min_length=3, max_length=30)] | None = None
    status: UserStatus | None = None
    role: UserRole | None = None
    metadata: dict[str, str] | None = None
    
    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str | None) -> str | None:
        """Validate username format if provided."""
        if v is not None and not re.match(r"^[a-zA-Z0-9_-]+$", v):
            raise ValueError("Username can only contain letters, numbers, underscores, and hyphens")
        return v


class UpdateProfileInput(BaseModel):
    """Input for updating user profile."""
    
    model_config = ConfigDict(frozen=True)
    
    display_name: str | None = None
    bio: Annotated[str, Field(max_length=500)] | None = None
    avatar_url: str | None = None
    location: str | None = None
    website: str | None = None


class ListUsersInput(BaseModel):
    """Input for listing users with pagination."""
    
    model_config = ConfigDict(frozen=True)
    
    status: UserStatus | None = None
    role: UserRole | None = None
    page_size: Annotated[int, Field(ge=1, le=100)] = 20
    page_token: str | None = None
    sort_by: str = "created_at"
    sort_order: SortOrder = SortOrder.DESC
    
    @field_validator("sort_by")
    @classmethod
    def validate_sort_by(cls, v: str) -> str:
        """Validate sort field."""
        valid_fields = {"created_at", "updated_at", "email", "username", "status"}
        if v not in valid_fields:
            raise ValueError(f"sort_by must be one of: {', '.join(valid_fields)}")
        return v


class SearchUsersInput(BaseModel):
    """Input for searching users."""
    
    model_config = ConfigDict(frozen=True)
    
    query: Annotated[str, Field(min_length=2, max_length=100)]
    fields: list[str] = Field(default_factory=lambda: ["email", "username"])
    page_size: Annotated[int, Field(ge=1, le=100)] = 20
    page_token: str | None = None
    
    @field_validator("fields")
    @classmethod
    def validate_fields(cls, v: list[str]) -> list[str]:
        """Validate search fields."""
        valid_fields = {"email", "username"}
        invalid = set(v) - valid_fields
        if invalid:
            raise ValueError(f"Invalid search fields: {', '.join(invalid)}")
        return v


# =============================================================================
# WebSocket Messages
# =============================================================================


class UserUpdateEvent(BaseModel):
    """User update event from WebSocket."""
    
    model_config = ConfigDict(frozen=True)
    
    user_id: str
    user: User
    change_type: ChangeType


class WebSocketMessage(BaseModel):
    """WebSocket message wrapper."""
    
    model_config = ConfigDict(frozen=True)
    
    type: str
    payload: dict[str, Any]
    timestamp: datetime = Field(default_factory=datetime.now)
