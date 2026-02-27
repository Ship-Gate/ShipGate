"""
ISL Exceptions - Exception hierarchy for ISL SDK.

This module provides a hierarchy of exceptions for different error types.
"""

from __future__ import annotations

from typing import Any


class ISLError(Exception):
    """Base exception for all ISL SDK errors."""
    
    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


class ValidationError(ISLError):
    """Validation error for input data."""
    
    def __init__(
        self,
        message: str,
        field: str | None = None,
        value: Any = None,
    ) -> None:
        self.field = field
        self.value = value
        super().__init__(message)


class PreconditionError(ISLError):
    """
    Precondition violation error.
    
    Raised when ISL preconditions are not met before an API call.
    """
    
    def __init__(
        self,
        message: str,
        precondition: str,
        actual_value: Any = None,
    ) -> None:
        self.precondition = precondition
        self.actual_value = actual_value
        super().__init__(f"Precondition violated: {message}")


class PostconditionError(ISLError):
    """
    Postcondition violation error.
    
    Raised when server response doesn't match ISL contract.
    """
    
    def __init__(
        self,
        message: str,
        postcondition: str,
        expected_value: Any = None,
        actual_value: Any = None,
    ) -> None:
        self.postcondition = postcondition
        self.expected_value = expected_value
        self.actual_value = actual_value
        super().__init__(
            f"Postcondition violated: {message} "
            f"(expected: {expected_value}, actual: {actual_value})"
        )


class NetworkError(ISLError):
    """
    Network error.
    
    Raised for connection failures, timeouts, etc.
    """
    
    def __init__(
        self,
        message: str,
        cause: Exception | None = None,
        is_timeout: bool = False,
        is_connection_error: bool = False,
    ) -> None:
        self.cause = cause
        self.is_timeout = is_timeout
        self.is_connection_error = is_connection_error
        super().__init__(f"Network error: {message}")


class ServerError(ISLError):
    """
    Server error.
    
    Raised for 5xx responses.
    """
    
    def __init__(
        self,
        message: str,
        status_code: int | None = None,
        error_code: str | None = None,
    ) -> None:
        self.status_code = status_code
        self.error_code = error_code
        super().__init__(f"Server error: {message}")


class UnauthorizedError(ISLError):
    """Unauthorized error (401)."""
    
    def __init__(self, message: str = "Unauthorized") -> None:
        super().__init__(message)


class ForbiddenError(ISLError):
    """Forbidden error (403)."""
    
    def __init__(self, message: str = "Forbidden") -> None:
        super().__init__(message)


class NotFoundError(ISLError):
    """Not found error (404)."""
    
    def __init__(
        self,
        message: str = "Resource not found",
        resource_type: str | None = None,
        resource_id: str | None = None,
    ) -> None:
        self.resource_type = resource_type
        self.resource_id = resource_id
        super().__init__(message)


class ConflictError(ISLError):
    """Conflict error (409)."""
    
    def __init__(
        self,
        message: str,
        conflict_field: str | None = None,
    ) -> None:
        self.conflict_field = conflict_field
        super().__init__(message)


class RateLimitError(ISLError):
    """Rate limit error (429)."""
    
    def __init__(
        self,
        retry_after_seconds: int,
        message: str = "Rate limited",
    ) -> None:
        self.retry_after_seconds = retry_after_seconds
        super().__init__(f"{message}. Retry after {retry_after_seconds} seconds")


class TimeoutError(ISLError):
    """Request timeout error."""
    
    def __init__(
        self,
        message: str = "Request timed out",
        timeout_ms: int | None = None,
    ) -> None:
        self.timeout_ms = timeout_ms
        super().__init__(message)


class SerializationError(ISLError):
    """Serialization/deserialization error."""
    
    def __init__(
        self,
        message: str,
        cause: Exception | None = None,
        response_body: str | None = None,
    ) -> None:
        self.cause = cause
        self.response_body = response_body
        super().__init__(f"Serialization error: {message}")
