"""
ISL Services - Service layer implementations.

This module provides service classes that implement the business logic
for each API domain with verification.
"""

from __future__ import annotations

from typing import AsyncIterator, Any

import httpx
import websockets
from pydantic import ValidationError as PydanticValidationError

from isl.config import ISLClientConfig
from isl.exceptions import PreconditionError, PostconditionError
from isl.models import (
    User,
    UserStatus,
    CreateUserInput,
    UpdateUserInput,
    ListUsersInput,
    SearchUsersInput,
    PaginatedList,
)
from isl.results import (
    CreateUserResult,
    CreateUserResultType,
    GetUserResult,
    GetUserResultType,
    UpdateUserResult,
    UpdateUserResultType,
    DeleteUserResult,
    DeleteUserResultType,
    ListUsersResult,
    ListUsersResultType,
    SearchUsersResult,
    SearchUsersResultType,
)
from isl.verification import RuntimeChecker


class UserService:
    """
    User service for user-related operations.
    
    This service implements all user behaviors defined in the ISL specification
    with automatic precondition and postcondition verification.
    """
    
    def __init__(
        self,
        http_client: httpx.AsyncClient,
        config: ISLClientConfig,
    ) -> None:
        """Initialize the user service."""
        self._http_client = http_client
        self._config = config
        self._checker = RuntimeChecker(config.verification_config)
    
    async def create_user(self, input_data: CreateUserInput) -> CreateUserResultType:
        """
        Create a new user.
        
        Preconditions:
        - Email must be valid format (contains @, max 254 chars)
        - Username must be 3-30 characters
        
        Postconditions:
        - User created with PENDING status
        - User email matches input
        - User username matches input
        
        Args:
            input_data: The user creation input
            
        Returns:
            CreateUserResult with success or typed error
        """
        # Validate preconditions
        if self._config.verification_config.enable_preconditions:
            self._checker.verify_create_user_preconditions(input_data)
        
        try:
            response = await self._http_client.post(
                "/api/users",
                json=input_data.model_dump(mode="json"),
            )
            
            return self._handle_create_user_response(response, input_data)
            
        except httpx.RequestError as e:
            return CreateUserResult.NetworkError(cause=e)
    
    def _handle_create_user_response(
        self,
        response: httpx.Response,
        input_data: CreateUserInput,
    ) -> CreateUserResultType:
        """Handle create user response."""
        if response.status_code in (200, 201):
            user = User.model_validate(response.json())
            
            # Verify postconditions
            if self._config.verification_config.enable_postconditions:
                self._checker.verify_create_user_postconditions(input_data, user)
            
            return CreateUserResult.Success(user=user)
        
        if response.status_code == 409:
            body = response.json() if response.content else {}
            message = body.get("message", "").lower()
            if "email" in message:
                return CreateUserResult.DuplicateEmail()
            if "username" in message:
                return CreateUserResult.DuplicateUsername()
            return CreateUserResult.InvalidInput(message=body.get("message", "Conflict"))
        
        if response.status_code == 400:
            body = response.json() if response.content else {}
            return CreateUserResult.InvalidInput(
                message=body.get("message", "Invalid input"),
                field=body.get("field"),
            )
        
        if response.status_code == 429:
            retry_after = int(response.headers.get("Retry-After", "60"))
            return CreateUserResult.RateLimited(retry_after=retry_after)
        
        return CreateUserResult.ServerError(
            message=f"Server error: {response.status_code}",
            code=str(response.status_code),
        )
    
    async def get_user(self, user_id: str) -> GetUserResultType:
        """
        Get a user by ID.
        
        Args:
            user_id: The user ID to fetch
            
        Returns:
            GetUserResult with success or typed error
        """
        # Validate preconditions
        if self._config.verification_config.enable_preconditions:
            self._checker.verify_get_user_preconditions(user_id)
        
        try:
            response = await self._http_client.get(f"/api/users/{user_id}")
            
            if response.status_code == 200:
                user = User.model_validate(response.json())
                
                # Verify postconditions
                if self._config.verification_config.enable_postconditions:
                    self._checker.verify_get_user_postconditions(user_id, user)
                
                return GetUserResult.Success(user=user)
            
            if response.status_code == 404:
                return GetUserResult.NotFound()
            
            if response.status_code == 401:
                return GetUserResult.Unauthorized()
            
            return GetUserResult.ServerError(message=f"Server error: {response.status_code}")
            
        except httpx.RequestError as e:
            return GetUserResult.NetworkError(cause=e)
    
    async def update_user(
        self,
        user_id: str,
        input_data: UpdateUserInput,
    ) -> UpdateUserResultType:
        """
        Update a user.
        
        Args:
            user_id: The user ID to update
            input_data: The update input
            
        Returns:
            UpdateUserResult with success or typed error
        """
        # Validate preconditions
        if self._config.verification_config.enable_preconditions:
            self._checker.verify_update_user_preconditions(user_id, input_data)
        
        try:
            response = await self._http_client.patch(
                f"/api/users/{user_id}",
                json=input_data.model_dump(mode="json", exclude_none=True),
            )
            
            if response.status_code == 200:
                user = User.model_validate(response.json())
                
                # Verify postconditions
                if self._config.verification_config.enable_postconditions:
                    self._checker.verify_update_user_postconditions(user_id, input_data, user)
                
                return UpdateUserResult.Success(user=user)
            
            if response.status_code == 404:
                return UpdateUserResult.NotFound()
            
            if response.status_code == 401:
                return UpdateUserResult.Unauthorized()
            
            if response.status_code == 403:
                return UpdateUserResult.Forbidden()
            
            if response.status_code == 400:
                body = response.json() if response.content else {}
                return UpdateUserResult.InvalidInput(
                    message=body.get("message", "Invalid input"),
                    field=body.get("field"),
                )
            
            if response.status_code == 409:
                body = response.json() if response.content else {}
                return UpdateUserResult.Conflict(message=body.get("message", "Conflict"))
            
            if response.status_code == 429:
                retry_after = int(response.headers.get("Retry-After", "60"))
                return UpdateUserResult.RateLimited(retry_after=retry_after)
            
            return UpdateUserResult.ServerError(message=f"Server error: {response.status_code}")
            
        except httpx.RequestError as e:
            return UpdateUserResult.NetworkError(cause=e)
    
    async def delete_user(self, user_id: str) -> DeleteUserResultType:
        """
        Delete a user.
        
        Args:
            user_id: The user ID to delete
            
        Returns:
            DeleteUserResult with success or typed error
        """
        # Validate preconditions
        if self._config.verification_config.enable_preconditions:
            self._checker.verify_delete_user_preconditions(user_id)
        
        try:
            response = await self._http_client.delete(f"/api/users/{user_id}")
            
            if response.status_code in (200, 204):
                return DeleteUserResult.Success()
            
            if response.status_code == 404:
                return DeleteUserResult.NotFound()
            
            if response.status_code == 401:
                return DeleteUserResult.Unauthorized()
            
            if response.status_code == 403:
                return DeleteUserResult.Forbidden()
            
            return DeleteUserResult.ServerError(message=f"Server error: {response.status_code}")
            
        except httpx.RequestError as e:
            return DeleteUserResult.NetworkError(cause=e)
    
    async def list_users(
        self,
        input_data: ListUsersInput | None = None,
    ) -> ListUsersResultType:
        """
        List users with pagination.
        
        Args:
            input_data: The list input with filters and pagination
            
        Returns:
            ListUsersResult with success or typed error
        """
        if input_data is None:
            input_data = ListUsersInput()
        
        # Validate preconditions
        if self._config.verification_config.enable_preconditions:
            self._checker.verify_list_users_preconditions(input_data)
        
        try:
            params: dict[str, Any] = {
                "page_size": input_data.page_size,
                "sort_by": input_data.sort_by,
                "sort_order": input_data.sort_order.value,
            }
            
            if input_data.status:
                params["status"] = input_data.status.value
            if input_data.role:
                params["role"] = input_data.role.value
            if input_data.page_token:
                params["page_token"] = input_data.page_token
            
            response = await self._http_client.get("/api/users", params=params)
            
            if response.status_code == 200:
                data = response.json()
                users = [User.model_validate(u) for u in data.get("items", [])]
                return ListUsersResult.Success(
                    users=users,
                    next_page_token=data.get("next_page_token"),
                    total_count=data.get("total_count"),
                )
            
            if response.status_code == 401:
                return ListUsersResult.Unauthorized()
            
            if response.status_code == 400:
                body = response.json() if response.content else {}
                return ListUsersResult.InvalidInput(message=body.get("message", "Invalid input"))
            
            return ListUsersResult.ServerError(message=f"Server error: {response.status_code}")
            
        except httpx.RequestError as e:
            return ListUsersResult.NetworkError(cause=e)
    
    async def search_users(self, input_data: SearchUsersInput) -> SearchUsersResultType:
        """
        Search users by query.
        
        Args:
            input_data: The search input
            
        Returns:
            SearchUsersResult with success or typed error
        """
        # Validate preconditions
        if self._config.verification_config.enable_preconditions:
            self._checker.verify_search_users_preconditions(input_data)
        
        try:
            params: dict[str, Any] = {
                "q": input_data.query,
                "fields": ",".join(input_data.fields),
                "page_size": input_data.page_size,
            }
            
            if input_data.page_token:
                params["page_token"] = input_data.page_token
            
            response = await self._http_client.get("/api/users/search", params=params)
            
            if response.status_code == 200:
                data = response.json()
                users = [User.model_validate(u) for u in data.get("items", [])]
                return SearchUsersResult.Success(
                    users=users,
                    next_page_token=data.get("next_page_token"),
                    total_count=data.get("total_count"),
                )
            
            if response.status_code == 401:
                return SearchUsersResult.Unauthorized()
            
            if response.status_code == 400:
                body = response.json() if response.content else {}
                return SearchUsersResult.InvalidInput(message=body.get("message", "Invalid input"))
            
            return SearchUsersResult.ServerError(message=f"Server error: {response.status_code}")
            
        except httpx.RequestError as e:
            return SearchUsersResult.NetworkError(cause=e)
    
    async def observe_user(self, user_id: str) -> AsyncIterator[User]:
        """
        Observe user updates via WebSocket.
        
        Args:
            user_id: The user ID to observe
            
        Yields:
            User objects as updates arrive
        """
        ws_url = self._config.base_url.replace("http", "ws")
        
        async with websockets.connect(f"{ws_url}/ws/users/{user_id}") as websocket:
            async for message in websocket:
                import json
                data = json.loads(message)
                yield User.model_validate(data)
