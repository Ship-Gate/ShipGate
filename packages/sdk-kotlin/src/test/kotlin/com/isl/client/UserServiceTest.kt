package com.isl.client

import com.isl.client.models.*
import com.isl.client.testing.MockISLClient
import com.isl.client.testing.TestFixtures
import com.isl.client.validation.ValidationResult
import com.isl.client.validation.Validators
import kotlinx.coroutines.test.runTest
import kotlin.test.*

class UserServiceTest {
    
    // ========================================================================
    // Validation Tests
    // ========================================================================
    
    @Test
    fun `validateEmail accepts valid email`() {
        val result = Validators.validateEmail("test@example.com")
        assertTrue(result.isValid)
    }
    
    @Test
    fun `validateEmail rejects email without @`() {
        val result = Validators.validateEmail("testexample.com")
        assertTrue(result.isInvalid)
        assertTrue(result.getErrors().any { it.contains("@") })
    }
    
    @Test
    fun `validateEmail rejects email over 254 characters`() {
        val longEmail = "a".repeat(250) + "@test.com"
        val result = Validators.validateEmail(longEmail)
        assertTrue(result.isInvalid)
    }
    
    @Test
    fun `validateUsername accepts valid username`() {
        val result = Validators.validateUsername("validuser")
        assertTrue(result.isValid)
    }
    
    @Test
    fun `validateUsername rejects username under 3 characters`() {
        val result = Validators.validateUsername("ab")
        assertTrue(result.isInvalid)
        assertTrue(result.getErrors().any { it.contains("3") })
    }
    
    @Test
    fun `validateUsername rejects username over 30 characters`() {
        val result = Validators.validateUsername("a".repeat(31))
        assertTrue(result.isInvalid)
        assertTrue(result.getErrors().any { it.contains("30") })
    }
    
    @Test
    fun `validateUsername rejects special characters`() {
        val result = Validators.validateUsername("user@name")
        assertTrue(result.isInvalid)
    }
    
    @Test
    fun `validateCreateUserInput validates both fields`() {
        val input = CreateUserInput(
            email = "invalid",
            username = "ab"
        )
        val result = Validators.validateCreateUserInput(input)
        assertTrue(result.isInvalid)
        assertTrue(result.getErrors().size >= 2)
    }
    
    // ========================================================================
    // Mock Client Tests
    // ========================================================================
    
    @Test
    fun `mock client returns configured response`() = runTest {
        val mockUser = TestFixtures.createUser()
        
        val mockClient = MockISLClient {
            users.createUser returns CreateUserResult.Success(mockUser)
        }
        
        val result = mockClient.users.createUser(
            TestFixtures.createUserInput()
        )
        
        assertTrue(result is CreateUserResult.Success)
        assertEquals(mockUser.id, (result as CreateUserResult.Success).user.id)
    }
    
    @Test
    fun `mock client returns error for specific user id`() = runTest {
        val mockClient = MockISLClient {
            users.getUser("404") returns GetUserResult.Error.NotFound
            users.getUser("123") returns GetUserResult.Success(TestFixtures.createUser(id = "123"))
        }
        
        val notFoundResult = mockClient.users.getUser("404")
        assertTrue(notFoundResult is GetUserResult.Error.NotFound)
        
        val successResult = mockClient.users.getUser("123")
        assertTrue(successResult is GetUserResult.Success)
    }
    
    @Test
    fun `mock client tracks calls`() = runTest {
        val mockClient = MockISLClient {
            users.createUser returns CreateUserResult.Success(TestFixtures.createUser())
        }
        
        val input = TestFixtures.createUserInput()
        mockClient.users.createUser(input)
        
        assertTrue(mockClient.users.verifyCreateUserCalled(input))
        assertTrue(mockClient.users.verifyCreateUserCalledTimes(1))
    }
    
    // ========================================================================
    // Result Extension Tests
    // ========================================================================
    
    @Test
    fun `getOrNull returns user on success`() {
        val user = TestFixtures.createUser()
        val result: CreateUserResult = CreateUserResult.Success(user)
        
        assertEquals(user, result.getOrNull())
    }
    
    @Test
    fun `getOrNull returns null on error`() {
        val result: CreateUserResult = CreateUserResult.Error.DuplicateEmail
        
        assertNull(result.getOrNull())
    }
    
    @Test
    fun `getOrThrow returns user on success`() {
        val user = TestFixtures.createUser()
        val result: CreateUserResult = CreateUserResult.Success(user)
        
        assertEquals(user, result.getOrThrow())
    }
    
    @Test
    fun `getOrThrow throws on error`() {
        val result: CreateUserResult = CreateUserResult.Error.DuplicateEmail
        
        assertFailsWith<DuplicateEmailException> {
            result.getOrThrow()
        }
    }
    
    @Test
    fun `onSuccess executes block`() {
        val user = TestFixtures.createUser()
        val result: CreateUserResult = CreateUserResult.Success(user)
        
        var called = false
        result.onSuccess { called = true }
        
        assertTrue(called)
    }
    
    @Test
    fun `onError executes block`() {
        val result: CreateUserResult = CreateUserResult.Error.DuplicateEmail
        
        var called = false
        result.onError { called = true }
        
        assertTrue(called)
    }
    
    // ========================================================================
    // Value Type Tests
    // ========================================================================
    
    @Test
    fun `Email value type validates correctly`() {
        val email = Email("test@example.com")
        assertEquals("test@example.com", email.value)
    }
    
    @Test
    fun `Email value type rejects invalid email`() {
        assertFailsWith<IllegalArgumentException> {
            Email("invalid")
        }
    }
    
    @Test
    fun `Username value type validates correctly`() {
        val username = Username("validuser")
        assertEquals("validuser", username.value)
    }
    
    @Test
    fun `Username value type rejects short username`() {
        assertFailsWith<IllegalArgumentException> {
            Username("ab")
        }
    }
    
    @Test
    fun `Username value type rejects long username`() {
        assertFailsWith<IllegalArgumentException> {
            Username("a".repeat(31))
        }
    }
    
    @Test
    fun `UserId value type rejects blank id`() {
        assertFailsWith<IllegalArgumentException> {
            UserId("")
        }
    }
    
    @Test
    fun `PageSize value type validates range`() {
        assertFailsWith<IllegalArgumentException> {
            PageSize(0)
        }
        assertFailsWith<IllegalArgumentException> {
            PageSize(101)
        }
        
        val valid = PageSize(50)
        assertEquals(50, valid.value)
    }
    
    // ========================================================================
    // User Entity Tests
    // ========================================================================
    
    @Test
    fun `User isActive returns correct value`() {
        val activeUser = TestFixtures.createUser(status = UserStatus.ACTIVE)
        val pendingUser = TestFixtures.createUser(status = UserStatus.PENDING)
        
        assertTrue(activeUser.isActive)
        assertFalse(pendingUser.isActive)
    }
    
    @Test
    fun `User isPending returns correct value`() {
        val pendingUser = TestFixtures.createUser(status = UserStatus.PENDING)
        val activeUser = TestFixtures.createUser(status = UserStatus.ACTIVE)
        
        assertTrue(pendingUser.isPending)
        assertFalse(activeUser.isPending)
    }
    
    @Test
    fun `User isSuspended returns correct value`() {
        val suspendedUser = TestFixtures.createUser(status = UserStatus.SUSPENDED)
        val activeUser = TestFixtures.createUser(status = UserStatus.ACTIVE)
        
        assertTrue(suspendedUser.isSuspended)
        assertFalse(activeUser.isSuspended)
    }
    
    @Test
    fun `User isAdmin returns correct value`() {
        val adminUser = TestFixtures.createUser(role = UserRole.ADMIN)
        val regularUser = TestFixtures.createUser(role = UserRole.USER)
        
        assertTrue(adminUser.isAdmin)
        assertFalse(regularUser.isAdmin)
    }
    
    // ========================================================================
    // Error Code Tests
    // ========================================================================
    
    @Test
    fun `error to exception conversion`() {
        val errors = listOf(
            CreateUserResult.Error.DuplicateEmail to DuplicateEmailException::class,
            CreateUserResult.Error.DuplicateUsername to DuplicateUsernameException::class,
            CreateUserResult.Error.InvalidInput("test") to InvalidInputException::class,
            CreateUserResult.Error.RateLimited(60) to RateLimitedException::class,
            CreateUserResult.Error.ServerError("test") to ServerErrorException::class,
        )
        
        errors.forEach { (error, expectedType) ->
            val exception = error.toException()
            assertEquals(expectedType, exception::class, "Error $error should convert to $expectedType")
        }
    }
}
