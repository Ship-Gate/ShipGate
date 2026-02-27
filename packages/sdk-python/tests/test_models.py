"""Tests for ISL models."""

import pytest
from datetime import datetime

from isl.models import (
    Email,
    Username,
    UserId,
    PageSize,
    User,
    UserStatus,
    UserRole,
    CreateUserInput,
    UpdateUserInput,
    ListUsersInput,
    SearchUsersInput,
)


class TestEmail:
    """Tests for Email value type."""
    
    def test_valid_email(self):
        """Test valid email creation."""
        email = Email("test@example.com")
        assert str(email) == "test@example.com"
    
    def test_email_without_at_raises(self):
        """Test that email without @ raises ValueError."""
        with pytest.raises(ValueError, match="must contain @"):
            Email("invalid")
    
    def test_email_too_long_raises(self):
        """Test that email over 254 chars raises ValueError."""
        long_email = "a" * 250 + "@test.com"
        with pytest.raises(ValueError, match="at most 254"):
            Email(long_email)
    
    def test_empty_email_raises(self):
        """Test that empty email raises ValueError."""
        with pytest.raises(ValueError, match="cannot be empty"):
            Email("")


class TestUsername:
    """Tests for Username value type."""
    
    def test_valid_username(self):
        """Test valid username creation."""
        username = Username("validuser")
        assert str(username) == "validuser"
    
    def test_username_with_underscore(self):
        """Test username with underscore."""
        username = Username("valid_user")
        assert str(username) == "valid_user"
    
    def test_username_with_hyphen(self):
        """Test username with hyphen."""
        username = Username("valid-user")
        assert str(username) == "valid-user"
    
    def test_username_too_short_raises(self):
        """Test that username under 3 chars raises ValueError."""
        with pytest.raises(ValueError, match="at least 3"):
            Username("ab")
    
    def test_username_too_long_raises(self):
        """Test that username over 30 chars raises ValueError."""
        with pytest.raises(ValueError, match="at most 30"):
            Username("a" * 31)
    
    def test_username_special_chars_raises(self):
        """Test that username with special chars raises ValueError."""
        with pytest.raises(ValueError, match="only contain"):
            Username("user@name")
    
    def test_reserved_username_raises(self):
        """Test that reserved usernames raise ValueError."""
        with pytest.raises(ValueError, match="reserved"):
            Username("admin")


class TestUserId:
    """Tests for UserId value type."""
    
    def test_valid_user_id(self):
        """Test valid user ID creation."""
        user_id = UserId("user-123")
        assert str(user_id) == "user-123"
    
    def test_blank_user_id_raises(self):
        """Test that blank user ID raises ValueError."""
        with pytest.raises(ValueError, match="cannot be blank"):
            UserId("")
    
    def test_whitespace_user_id_raises(self):
        """Test that whitespace-only user ID raises ValueError."""
        with pytest.raises(ValueError, match="cannot be blank"):
            UserId("   ")


class TestPageSize:
    """Tests for PageSize value type."""
    
    def test_valid_page_size(self):
        """Test valid page size creation."""
        size = PageSize(20)
        assert int(size) == 20
    
    def test_page_size_too_small_raises(self):
        """Test that page size < 1 raises ValueError."""
        with pytest.raises(ValueError, match="at least 1"):
            PageSize(0)
    
    def test_page_size_too_large_raises(self):
        """Test that page size > 100 raises ValueError."""
        with pytest.raises(ValueError, match="at most 100"):
            PageSize(101)


class TestUser:
    """Tests for User model."""
    
    @pytest.fixture
    def user(self):
        """Create a test user."""
        return User(
            id="user-123",
            email="test@example.com",
            username="testuser",
            status=UserStatus.ACTIVE,
            role=UserRole.USER,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
    
    def test_is_active(self, user):
        """Test is_active property."""
        assert user.is_active is True
    
    def test_is_pending(self):
        """Test is_pending property."""
        user = User(
            id="user-123",
            email="test@example.com",
            username="testuser",
            status=UserStatus.PENDING,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        assert user.is_pending is True
        assert user.is_active is False
    
    def test_is_suspended(self):
        """Test is_suspended property."""
        user = User(
            id="user-123",
            email="test@example.com",
            username="testuser",
            status=UserStatus.SUSPENDED,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        assert user.is_suspended is True
    
    def test_is_admin(self):
        """Test is_admin property."""
        admin = User(
            id="user-123",
            email="test@example.com",
            username="testuser",
            status=UserStatus.ACTIVE,
            role=UserRole.ADMIN,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        assert admin.is_admin is True
    
    def test_user_is_immutable(self, user):
        """Test that user is immutable."""
        with pytest.raises(Exception):
            user.email = "new@example.com"


class TestCreateUserInput:
    """Tests for CreateUserInput model."""
    
    def test_valid_input(self):
        """Test valid input creation."""
        input_data = CreateUserInput(
            email="test@example.com",
            username="testuser",
        )
        assert input_data.email == "test@example.com"
        assert input_data.username == "testuser"
        assert input_data.role == UserRole.USER
    
    def test_email_validation(self):
        """Test email validation."""
        with pytest.raises(ValueError, match="must contain @"):
            CreateUserInput(
                email="invalid",
                username="testuser",
            )
    
    def test_username_validation(self):
        """Test username validation."""
        with pytest.raises(ValueError):
            CreateUserInput(
                email="test@example.com",
                username="user@name",  # Invalid chars
            )


class TestListUsersInput:
    """Tests for ListUsersInput model."""
    
    def test_valid_input(self):
        """Test valid input creation."""
        input_data = ListUsersInput()
        assert input_data.page_size == 20
        assert input_data.sort_by == "created_at"
    
    def test_invalid_sort_by(self):
        """Test invalid sort_by validation."""
        with pytest.raises(ValueError, match="sort_by must be one of"):
            ListUsersInput(sort_by="invalid_field")


class TestSearchUsersInput:
    """Tests for SearchUsersInput model."""
    
    def test_valid_input(self):
        """Test valid input creation."""
        input_data = SearchUsersInput(query="test")
        assert input_data.query == "test"
        assert input_data.fields == ["email", "username"]
    
    def test_invalid_fields(self):
        """Test invalid fields validation."""
        with pytest.raises(ValueError, match="Invalid search fields"):
            SearchUsersInput(
                query="test",
                fields=["email", "invalid_field"],
            )
