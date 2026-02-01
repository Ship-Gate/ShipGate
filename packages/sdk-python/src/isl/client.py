"""
ISL Client - Main client implementation for ISL SDK.

This module provides the async and sync client implementations
for interacting with ISL-verified APIs.
"""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from typing import AsyncIterator, Callable, Any

import httpx
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

from isl.config import ISLClientConfig, RetryConfig, VerificationConfig
from isl.services import UserService
from isl.exceptions import NetworkError


class ISLClient:
    """
    Async client for ISL-verified APIs.
    
    This client provides type-safe access to APIs with automatic
    precondition/postcondition verification.
    
    Example:
        >>> async with ISLClient(base_url="https://api.example.com") as client:
        ...     result = await client.users.create_user(input_data)
    
    Attributes:
        users: User service for user operations
    """
    
    def __init__(
        self,
        base_url: str,
        auth_token: str | None = None,
        timeout: float = 30.0,
        retry_config: RetryConfig | None = None,
        verification_config: VerificationConfig | None = None,
        http_client: httpx.AsyncClient | None = None,
        request_interceptors: list[Callable[[httpx.Request], httpx.Request]] | None = None,
        response_interceptors: list[Callable[[httpx.Response], httpx.Response]] | None = None,
    ) -> None:
        """
        Initialize the ISL client.
        
        Args:
            base_url: Base URL of the API
            auth_token: Optional authentication token
            timeout: Request timeout in seconds
            retry_config: Retry configuration
            verification_config: Verification configuration
            http_client: Custom httpx client (optional)
            request_interceptors: Request interceptor functions
            response_interceptors: Response interceptor functions
        """
        self._config = ISLClientConfig(
            base_url=base_url.rstrip("/"),
            auth_token=auth_token,
            timeout=timeout,
            retry_config=retry_config or RetryConfig(),
            verification_config=verification_config or VerificationConfig(),
        )
        
        self._request_interceptors = request_interceptors or []
        self._response_interceptors = response_interceptors or []
        
        # Initialize HTTP client
        if http_client:
            self._http_client = http_client
            self._owns_client = False
        else:
            self._http_client = self._create_http_client()
            self._owns_client = True
        
        # Initialize services
        self._users: UserService | None = None
    
    def _create_http_client(self) -> httpx.AsyncClient:
        """Create the HTTP client with configuration."""
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-Client-SDK": "isl-python/0.1.0",
        }
        
        if self._config.auth_token:
            headers["Authorization"] = f"Bearer {self._config.auth_token}"
        
        return httpx.AsyncClient(
            base_url=self._config.base_url,
            headers=headers,
            timeout=httpx.Timeout(self._config.timeout),
        )
    
    @property
    def users(self) -> UserService:
        """Get the user service."""
        if self._users is None:
            self._users = UserService(
                http_client=self._http_client,
                config=self._config,
            )
        return self._users
    
    @property
    def http_client(self) -> httpx.AsyncClient:
        """Get the underlying HTTP client."""
        return self._http_client
    
    async def close(self) -> None:
        """Close the client and release resources."""
        if self._owns_client:
            await self._http_client.aclose()
    
    async def __aenter__(self) -> ISLClient:
        """Async context manager entry."""
        return self
    
    async def __aexit__(self, *args: Any) -> None:
        """Async context manager exit."""
        await self.close()
    
    @classmethod
    def simple(cls, base_url: str, auth_token: str | None = None) -> ISLClient:
        """
        Create a simple client with minimal configuration.
        
        Args:
            base_url: Base URL of the API
            auth_token: Optional authentication token
            
        Returns:
            Configured ISLClient instance
        """
        return cls(base_url=base_url, auth_token=auth_token)


class SyncISLClient:
    """
    Synchronous wrapper for ISLClient.
    
    Provides a synchronous interface for environments that don't support async.
    
    Example:
        >>> client = SyncISLClient(base_url="https://api.example.com")
        >>> result = client.users.create_user(input_data)
    """
    
    def __init__(
        self,
        base_url: str,
        auth_token: str | None = None,
        timeout: float = 30.0,
        retry_config: RetryConfig | None = None,
        verification_config: VerificationConfig | None = None,
    ) -> None:
        """Initialize the sync client."""
        self._async_client = ISLClient(
            base_url=base_url,
            auth_token=auth_token,
            timeout=timeout,
            retry_config=retry_config,
            verification_config=verification_config,
        )
        self._users: SyncUserService | None = None
    
    @property
    def users(self) -> SyncUserService:
        """Get the sync user service."""
        if self._users is None:
            self._users = SyncUserService(self._async_client.users)
        return self._users
    
    def close(self) -> None:
        """Close the client."""
        asyncio.get_event_loop().run_until_complete(self._async_client.close())
    
    def __enter__(self) -> SyncISLClient:
        """Context manager entry."""
        return self
    
    def __exit__(self, *args: Any) -> None:
        """Context manager exit."""
        self.close()


class SyncUserService:
    """Synchronous wrapper for UserService."""
    
    def __init__(self, async_service: UserService) -> None:
        self._async_service = async_service
    
    def _run(self, coro: Any) -> Any:
        """Run a coroutine synchronously."""
        loop = asyncio.get_event_loop()
        return loop.run_until_complete(coro)
    
    def create_user(self, input_data: Any) -> Any:
        """Create a user synchronously."""
        return self._run(self._async_service.create_user(input_data))
    
    def get_user(self, user_id: str) -> Any:
        """Get a user synchronously."""
        return self._run(self._async_service.get_user(user_id))
    
    def update_user(self, user_id: str, input_data: Any) -> Any:
        """Update a user synchronously."""
        return self._run(self._async_service.update_user(user_id, input_data))
    
    def delete_user(self, user_id: str) -> Any:
        """Delete a user synchronously."""
        return self._run(self._async_service.delete_user(user_id))
    
    def list_users(self, input_data: Any | None = None) -> Any:
        """List users synchronously."""
        return self._run(self._async_service.list_users(input_data))
    
    def search_users(self, input_data: Any) -> Any:
        """Search users synchronously."""
        return self._run(self._async_service.search_users(input_data))
