"""
ISL Configuration - Client configuration classes.

This module provides configuration classes for the ISL client.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class RetryConfig:
    """
    Configuration for retry behavior.
    
    Attributes:
        max_retries: Maximum number of retry attempts
        retry_on_status: HTTP status codes to retry on
        exponential_base: Base for exponential backoff
        initial_delay: Initial delay in seconds
        max_delay: Maximum delay in seconds
    """
    
    max_retries: int = 3
    retry_on_status: tuple[int, ...] = (429, 500, 502, 503, 504)
    exponential_base: float = 2.0
    initial_delay: float = 1.0
    max_delay: float = 60.0


@dataclass(frozen=True)
class VerificationConfig:
    """
    Configuration for runtime verification.
    
    Attributes:
        enable_preconditions: Whether to check preconditions
        enable_postconditions: Whether to check postconditions
        raise_on_violation: Whether to raise exceptions on violations
        log_violations: Whether to log violations
    """
    
    enable_preconditions: bool = True
    enable_postconditions: bool = True
    raise_on_violation: bool = True
    log_violations: bool = True


@dataclass(frozen=True)
class ISLClientConfig:
    """
    Main configuration for ISL client.
    
    Attributes:
        base_url: Base URL of the API
        auth_token: Optional authentication token
        timeout: Request timeout in seconds
        retry_config: Retry configuration
        verification_config: Verification configuration
    """
    
    base_url: str
    auth_token: str | None = None
    timeout: float = 30.0
    retry_config: RetryConfig = field(default_factory=RetryConfig)
    verification_config: VerificationConfig = field(default_factory=VerificationConfig)
