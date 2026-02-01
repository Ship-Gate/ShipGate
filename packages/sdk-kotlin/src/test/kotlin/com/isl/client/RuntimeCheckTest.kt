package com.isl.client

import com.isl.client.models.*
import com.isl.client.verification.*
import kotlin.test.*

class RuntimeCheckTest {
    
    private lateinit var runtimeCheck: RuntimeCheck
    
    @BeforeTest
    fun setup() {
        runtimeCheck = RuntimeCheck(
            VerificationConfig(
                enablePreconditions = true,
                enablePostconditions = true,
                throwOnViolation = true,
                logViolations = false
            )
        )
    }
    
    // ========================================================================
    // Precondition Tests
    // ========================================================================
    
    @Test
    fun `verifyCreateUserPreconditions passes for valid input`() {
        val input = CreateUserInput(
            email = "test@example.com",
            username = "validuser"
        )
        
        // Should not throw
        runtimeCheck.verifyCreateUserPreconditions(input)
    }
    
    @Test
    fun `verifyCreateUserPreconditions fails for invalid email`() {
        val input = CreateUserInput(
            email = "invalid",
            username = "validuser"
        )
        
        assertFailsWith<PreconditionViolationException> {
            runtimeCheck.verifyCreateUserPreconditions(input)
        }
    }
    
    @Test
    fun `verifyCreateUserPreconditions fails for short username`() {
        val input = CreateUserInput(
            email = "test@example.com",
            username = "ab"
        )
        
        assertFailsWith<PreconditionViolationException> {
            runtimeCheck.verifyCreateUserPreconditions(input)
        }
    }
    
    @Test
    fun `verifyCreateUserPreconditions fails for long username`() {
        val input = CreateUserInput(
            email = "test@example.com",
            username = "a".repeat(31)
        )
        
        assertFailsWith<PreconditionViolationException> {
            runtimeCheck.verifyCreateUserPreconditions(input)
        }
    }
    
    @Test
    fun `verifyGetUserPreconditions fails for blank userId`() {
        assertFailsWith<PreconditionViolationException> {
            runtimeCheck.verifyGetUserPreconditions("")
        }
    }
    
    @Test
    fun `verifyGetUserPreconditions passes for valid userId`() {
        // Should not throw
        runtimeCheck.verifyGetUserPreconditions("user-123")
    }
    
    // ========================================================================
    // Postcondition Tests
    // ========================================================================
    
    @Test
    fun `verifyCreateUserPostconditions passes for valid response`() {
        val input = CreateUserInput(
            email = "test@example.com",
            username = "testuser"
        )
        
        val result = User(
            id = "user-123",
            email = "test@example.com",
            username = "testuser",
            status = UserStatus.PENDING,
            createdAt = System.currentTimeMillis(),
            updatedAt = System.currentTimeMillis()
        )
        
        // Should not throw
        runtimeCheck.verifyCreateUserPostconditions(input, result)
    }
    
    @Test
    fun `verifyCreateUserPostconditions fails for email mismatch`() {
        val input = CreateUserInput(
            email = "test@example.com",
            username = "testuser"
        )
        
        val result = User(
            id = "user-123",
            email = "different@example.com", // Mismatch
            username = "testuser",
            status = UserStatus.PENDING,
            createdAt = System.currentTimeMillis(),
            updatedAt = System.currentTimeMillis()
        )
        
        assertFailsWith<PostconditionViolationException> {
            runtimeCheck.verifyCreateUserPostconditions(input, result)
        }
    }
    
    @Test
    fun `verifyCreateUserPostconditions fails for wrong status`() {
        val input = CreateUserInput(
            email = "test@example.com",
            username = "testuser"
        )
        
        val result = User(
            id = "user-123",
            email = "test@example.com",
            username = "testuser",
            status = UserStatus.ACTIVE, // Should be PENDING
            createdAt = System.currentTimeMillis(),
            updatedAt = System.currentTimeMillis()
        )
        
        assertFailsWith<PostconditionViolationException> {
            runtimeCheck.verifyCreateUserPostconditions(input, result)
        }
    }
    
    @Test
    fun `verifyGetUserPostconditions fails for id mismatch`() {
        val result = User(
            id = "different-id",
            email = "test@example.com",
            username = "testuser",
            status = UserStatus.ACTIVE,
            createdAt = System.currentTimeMillis(),
            updatedAt = System.currentTimeMillis()
        )
        
        assertFailsWith<PostconditionViolationException> {
            runtimeCheck.verifyGetUserPostconditions("user-123", result)
        }
    }
    
    // ========================================================================
    // Disabled Verification Tests
    // ========================================================================
    
    @Test
    fun `preconditions not checked when disabled`() {
        val check = RuntimeCheck(
            VerificationConfig(
                enablePreconditions = false,
                enablePostconditions = true,
                throwOnViolation = true
            )
        )
        
        val invalidInput = CreateUserInput(
            email = "invalid",
            username = "ab"
        )
        
        // Should not throw
        check.verifyCreateUserPreconditions(invalidInput)
    }
    
    @Test
    fun `postconditions not checked when disabled`() {
        val check = RuntimeCheck(
            VerificationConfig(
                enablePreconditions = true,
                enablePostconditions = false,
                throwOnViolation = true
            )
        )
        
        val input = CreateUserInput(
            email = "test@example.com",
            username = "testuser"
        )
        
        val invalidResult = User(
            id = "user-123",
            email = "different@example.com",
            username = "testuser",
            status = UserStatus.ACTIVE,
            createdAt = System.currentTimeMillis(),
            updatedAt = System.currentTimeMillis()
        )
        
        // Should not throw
        check.verifyCreateUserPostconditions(input, invalidResult)
    }
    
    @Test
    fun `violations recorded when throwOnViolation is false`() {
        val check = RuntimeCheck(
            VerificationConfig(
                enablePreconditions = true,
                enablePostconditions = true,
                throwOnViolation = false,
                logViolations = false
            )
        )
        
        val invalidInput = CreateUserInput(
            email = "invalid",
            username = "ab"
        )
        
        // Should not throw but record violation
        check.verifyCreateUserPreconditions(invalidInput)
        
        assertTrue(check.hasViolations())
        assertTrue(check.getViolations().isNotEmpty())
    }
    
    @Test
    fun `clearViolations removes recorded violations`() {
        val check = RuntimeCheck(
            VerificationConfig(
                enablePreconditions = true,
                throwOnViolation = false,
                logViolations = false
            )
        )
        
        val invalidInput = CreateUserInput(
            email = "invalid",
            username = "validuser"
        )
        
        check.verifyCreateUserPreconditions(invalidInput)
        assertTrue(check.hasViolations())
        
        check.clearViolations()
        assertFalse(check.hasViolations())
    }
    
    // ========================================================================
    // Violation Details Tests
    // ========================================================================
    
    @Test
    fun `violation contains correct details`() {
        val check = RuntimeCheck(
            VerificationConfig(
                enablePreconditions = true,
                throwOnViolation = false,
                logViolations = false
            )
        )
        
        val invalidInput = CreateUserInput(
            email = "invalid",
            username = "validuser"
        )
        
        check.verifyCreateUserPreconditions(invalidInput)
        
        val violations = check.getViolations()
        assertEquals(1, violations.size)
        
        val violation = violations.first()
        assertEquals(ViolationType.PRECONDITION, violation.type)
        assertNotNull(violation.contract)
        assertNotNull(violation.message)
        assertTrue(violation.timestamp > 0)
    }
}
