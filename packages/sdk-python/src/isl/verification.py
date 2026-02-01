"""
ISL Verification - Runtime verification for ISL contracts.

This module implements runtime checking of preconditions and postconditions
as defined in ISL specifications.
"""

from __future__ import annotations

import structlog
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any

from isl.config import VerificationConfig
from isl.exceptions import PreconditionError, PostconditionError
from isl.models import (
    User,
    UserStatus,
    CreateUserInput,
    UpdateUserInput,
    ListUsersInput,
    SearchUsersInput,
)


logger = structlog.get_logger()


class ViolationType(Enum):
    """Type of contract violation."""
    
    PRECONDITION = "PRECONDITION"
    POSTCONDITION = "POSTCONDITION"


@dataclass(frozen=True)
class Violation:
    """Contract violation record."""
    
    type: ViolationType
    message: str
    contract: str
    expected: Any
    actual: Any
    timestamp: datetime


class RuntimeChecker:
    """
    Runtime verification for ISL contracts.
    
    This class implements runtime checking of preconditions and postconditions
    as defined in ISL specifications.
    """
    
    def __init__(self, config: VerificationConfig) -> None:
        """Initialize the runtime checker."""
        self._config = config
        self._violations: list[Violation] = []
    
    # =========================================================================
    # Precondition Verification
    # =========================================================================
    
    def verify_create_user_preconditions(self, input_data: CreateUserInput) -> None:
        """
        Verify preconditions for CreateUser behavior.
        
        Preconditions:
        - email must be valid format (contains @, max 254 chars)
        - username must be 3-30 characters
        """
        if not self._config.enable_preconditions:
            return
        
        # Email validation
        self._check_precondition(
            condition="@" in input_data.email,
            message="Email must contain @",
            precondition="email.contains('@')",
            actual_value=input_data.email,
        )
        
        self._check_precondition(
            condition=len(input_data.email) <= 254,
            message="Email must be at most 254 characters",
            precondition="email.length <= 254",
            actual_value=len(input_data.email),
        )
        
        # Username validation
        self._check_precondition(
            condition=len(input_data.username) >= 3,
            message="Username must be at least 3 characters",
            precondition="username.length >= 3",
            actual_value=len(input_data.username),
        )
        
        self._check_precondition(
            condition=len(input_data.username) <= 30,
            message="Username must be at most 30 characters",
            precondition="username.length <= 30",
            actual_value=len(input_data.username),
        )
    
    def verify_get_user_preconditions(self, user_id: str) -> None:
        """Verify preconditions for GetUser behavior."""
        if not self._config.enable_preconditions:
            return
        
        self._check_precondition(
            condition=bool(user_id and user_id.strip()),
            message="User ID cannot be blank",
            precondition="user_id.is_not_blank()",
            actual_value=user_id,
        )
    
    def verify_update_user_preconditions(
        self,
        user_id: str,
        input_data: UpdateUserInput,
    ) -> None:
        """Verify preconditions for UpdateUser behavior."""
        if not self._config.enable_preconditions:
            return
        
        self._check_precondition(
            condition=bool(user_id and user_id.strip()),
            message="User ID cannot be blank",
            precondition="user_id.is_not_blank()",
            actual_value=user_id,
        )
        
        if input_data.username is not None:
            self._check_precondition(
                condition=3 <= len(input_data.username) <= 30,
                message="Username must be 3-30 characters",
                precondition="username.length in 3..30",
                actual_value=len(input_data.username),
            )
    
    def verify_delete_user_preconditions(self, user_id: str) -> None:
        """Verify preconditions for DeleteUser behavior."""
        if not self._config.enable_preconditions:
            return
        
        self._check_precondition(
            condition=bool(user_id and user_id.strip()),
            message="User ID cannot be blank",
            precondition="user_id.is_not_blank()",
            actual_value=user_id,
        )
    
    def verify_list_users_preconditions(self, input_data: ListUsersInput) -> None:
        """Verify preconditions for ListUsers behavior."""
        if not self._config.enable_preconditions:
            return
        
        self._check_precondition(
            condition=1 <= input_data.page_size <= 100,
            message="Page size must be between 1 and 100",
            precondition="page_size in 1..100",
            actual_value=input_data.page_size,
        )
    
    def verify_search_users_preconditions(self, input_data: SearchUsersInput) -> None:
        """Verify preconditions for SearchUsers behavior."""
        if not self._config.enable_preconditions:
            return
        
        self._check_precondition(
            condition=len(input_data.query) >= 2,
            message="Search query must be at least 2 characters",
            precondition="query.length >= 2",
            actual_value=len(input_data.query),
        )
    
    # =========================================================================
    # Postcondition Verification
    # =========================================================================
    
    def verify_create_user_postconditions(
        self,
        input_data: CreateUserInput,
        result: User,
    ) -> None:
        """
        Verify postconditions for CreateUser behavior.
        
        Postconditions:
        - user.email == input.email
        - user.username == input.username
        - user.status == PENDING
        """
        if not self._config.enable_postconditions:
            return
        
        self._check_postcondition(
            condition=result.email == input_data.email,
            message="Created user email must match input email",
            postcondition="result.email == input.email",
            expected=input_data.email,
            actual=result.email,
        )
        
        self._check_postcondition(
            condition=result.username == input_data.username,
            message="Created user username must match input username",
            postcondition="result.username == input.username",
            expected=input_data.username,
            actual=result.username,
        )
        
        self._check_postcondition(
            condition=result.status == UserStatus.PENDING,
            message="Created user status must be PENDING",
            postcondition="result.status == UserStatus.PENDING",
            expected=UserStatus.PENDING,
            actual=result.status,
        )
        
        self._check_postcondition(
            condition=bool(result.id),
            message="Created user must have an ID",
            postcondition="result.id.is_not_blank()",
            expected="non-blank ID",
            actual=result.id,
        )
    
    def verify_get_user_postconditions(self, user_id: str, result: User) -> None:
        """Verify postconditions for GetUser behavior."""
        if not self._config.enable_postconditions:
            return
        
        self._check_postcondition(
            condition=result.id == user_id,
            message="Retrieved user ID must match request ID",
            postcondition="result.id == user_id",
            expected=user_id,
            actual=result.id,
        )
    
    def verify_update_user_postconditions(
        self,
        user_id: str,
        input_data: UpdateUserInput,
        result: User,
    ) -> None:
        """Verify postconditions for UpdateUser behavior."""
        if not self._config.enable_postconditions:
            return
        
        self._check_postcondition(
            condition=result.id == user_id,
            message="Updated user ID must match request ID",
            postcondition="result.id == user_id",
            expected=user_id,
            actual=result.id,
        )
        
        if input_data.username is not None:
            self._check_postcondition(
                condition=result.username == input_data.username,
                message="Updated user username must match input",
                postcondition="result.username == input.username",
                expected=input_data.username,
                actual=result.username,
            )
        
        if input_data.status is not None:
            self._check_postcondition(
                condition=result.status == input_data.status,
                message="Updated user status must match input",
                postcondition="result.status == input.status",
                expected=input_data.status,
                actual=result.status,
            )
    
    # =========================================================================
    # Internal Methods
    # =========================================================================
    
    def _check_precondition(
        self,
        condition: bool,
        message: str,
        precondition: str,
        actual_value: Any,
    ) -> None:
        """Check a precondition."""
        if not condition:
            violation = Violation(
                type=ViolationType.PRECONDITION,
                message=message,
                contract=precondition,
                expected=None,
                actual=actual_value,
                timestamp=datetime.now(),
            )
            
            self._handle_violation(violation)
    
    def _check_postcondition(
        self,
        condition: bool,
        message: str,
        postcondition: str,
        expected: Any,
        actual: Any,
    ) -> None:
        """Check a postcondition."""
        if not condition:
            violation = Violation(
                type=ViolationType.POSTCONDITION,
                message=message,
                contract=postcondition,
                expected=expected,
                actual=actual,
                timestamp=datetime.now(),
            )
            
            self._handle_violation(violation)
    
    def _handle_violation(self, violation: Violation) -> None:
        """Handle a contract violation."""
        self._violations.append(violation)
        
        if self._config.log_violations:
            logger.warning(
                f"[{violation.type.value} VIOLATION] {violation.message}",
                contract=violation.contract,
                expected=violation.expected,
                actual=violation.actual,
            )
        
        if self._config.raise_on_violation:
            if violation.type == ViolationType.PRECONDITION:
                raise PreconditionError(
                    message=violation.message,
                    precondition=violation.contract,
                    actual_value=violation.actual,
                )
            else:
                raise PostconditionError(
                    message=violation.message,
                    postcondition=violation.contract,
                    expected_value=violation.expected,
                    actual_value=violation.actual,
                )
    
    @property
    def violations(self) -> list[Violation]:
        """Get all recorded violations."""
        return list(self._violations)
    
    def clear_violations(self) -> None:
        """Clear recorded violations."""
        self._violations.clear()
    
    @property
    def has_violations(self) -> bool:
        """Check if any violations occurred."""
        return len(self._violations) > 0
