package com.isl.client

import com.isl.client.models.*
import com.isl.client.validation.*
import kotlin.test.*

class ValidationTest {
    
    // ========================================================================
    // DSL Validation Tests
    // ========================================================================
    
    @Test
    fun `validation DSL works for valid input`() {
        val result = validate("test@example.com") {
            field("email")
            must({ it.contains("@") }, "Must contain @")
            must({ it.length <= 254 }, "Max 254 characters")
        }
        
        assertTrue(result.isValid)
    }
    
    @Test
    fun `validation DSL catches invalid input`() {
        val result = validate("invalid") {
            field("email")
            must({ it.contains("@") }, "Must contain @")
        }
        
        assertTrue(result.isInvalid)
        assertEquals("Must contain @", result.getFirstError())
    }
    
    @Test
    fun `validation DSL mustNot works`() {
        val result = validate("admin") {
            field("username")
            mustNot({ it == "admin" }, "Reserved username")
        }
        
        assertTrue(result.isInvalid)
        assertEquals("Reserved username", result.getFirstError())
    }
    
    @Test
    fun `validation DSL accumulates multiple errors`() {
        val result = validate("x") {
            field("username")
            must({ it.length >= 3 }, "At least 3 characters")
            must({ it.matches(Regex("^[a-zA-Z0-9]+$")) }, "Alphanumeric only")
        }
        
        assertTrue(result.isInvalid)
        assertEquals(1, result.getErrors().size) // Only first failing rule
    }
    
    // ========================================================================
    // Combined Validation Tests
    // ========================================================================
    
    @Test
    fun `combineResults combines multiple validations`() {
        val emailResult = Validators.validateEmail("test@example.com")
        val usernameResult = Validators.validateUsername("validuser")
        
        val combined = Validators.combineResults(emailResult, usernameResult)
        assertTrue(combined.isValid)
    }
    
    @Test
    fun `combineResults returns all errors`() {
        val emailResult = Validators.validateEmail("invalid")
        val usernameResult = Validators.validateUsername("ab")
        
        val combined = Validators.combineResults(emailResult, usernameResult)
        assertTrue(combined.isInvalid)
        assertTrue(combined.getErrors().size >= 2)
    }
    
    // ========================================================================
    // ListUsersInput Validation Tests
    // ========================================================================
    
    @Test
    fun `validateListUsersInput accepts valid input`() {
        val input = ListUsersInput(
            pageSize = 20,
            sortBy = "createdAt",
            sortOrder = SortOrder.DESC
        )
        
        val result = Validators.validateListUsersInput(input)
        assertTrue(result.isValid)
    }
    
    @Test
    fun `validateListUsersInput rejects invalid page size`() {
        val input = ListUsersInput(pageSize = 0)
        val result = Validators.validateListUsersInput(input)
        assertTrue(result.isInvalid)
        
        val input2 = ListUsersInput(pageSize = 101)
        val result2 = Validators.validateListUsersInput(input2)
        assertTrue(result2.isInvalid)
    }
    
    @Test
    fun `validateListUsersInput rejects invalid sort field`() {
        val input = ListUsersInput(sortBy = "invalidField")
        val result = Validators.validateListUsersInput(input)
        assertTrue(result.isInvalid)
    }
    
    // ========================================================================
    // SearchUsersInput Validation Tests
    // ========================================================================
    
    @Test
    fun `validateSearchUsersInput accepts valid input`() {
        val input = SearchUsersInput(
            query = "test",
            fields = listOf("email", "username")
        )
        
        val result = Validators.validateSearchUsersInput(input)
        assertTrue(result.isValid)
    }
    
    @Test
    fun `validateSearchUsersInput rejects blank query`() {
        val input = SearchUsersInput(query = "")
        val result = Validators.validateSearchUsersInput(input)
        assertTrue(result.isInvalid)
    }
    
    @Test
    fun `validateSearchUsersInput rejects short query`() {
        val input = SearchUsersInput(query = "x")
        val result = Validators.validateSearchUsersInput(input)
        assertTrue(result.isInvalid)
    }
    
    @Test
    fun `validateSearchUsersInput rejects invalid fields`() {
        val input = SearchUsersInput(
            query = "test",
            fields = listOf("email", "invalidField")
        )
        
        val result = Validators.validateSearchUsersInput(input)
        assertTrue(result.isInvalid)
    }
    
    // ========================================================================
    // UserId Validation Tests
    // ========================================================================
    
    @Test
    fun `validateUserId accepts valid UUID`() {
        val result = Validators.validateUserId("550e8400-e29b-41d4-a716-446655440000")
        assertTrue(result.isValid)
    }
    
    @Test
    fun `validateUserId accepts simple string ID`() {
        val result = Validators.validateUserId("user-123")
        assertTrue(result.isValid)
    }
    
    @Test
    fun `validateUserId rejects blank ID`() {
        val result = Validators.validateUserId("")
        assertTrue(result.isInvalid)
    }
    
    // ========================================================================
    // Require Function Tests
    // ========================================================================
    
    @Test
    fun `require does not throw for valid result`() {
        val result = Validators.validateEmail("test@example.com")
        
        // Should not throw
        Validators.require(result)
    }
    
    @Test
    fun `require throws for invalid result`() {
        val result = Validators.validateEmail("invalid")
        
        assertFailsWith<PreconditionViolationException> {
            Validators.require(result)
        }
    }
    
    @Test
    fun `require uses custom message`() {
        val result = Validators.validateEmail("invalid")
        
        val exception = assertFailsWith<PreconditionViolationException> {
            Validators.require(result, "Custom error message")
        }
        
        assertTrue(exception.message?.contains("Custom error message") == true)
    }
    
    // ========================================================================
    // ValidateOrThrow Tests
    // ========================================================================
    
    @Test
    fun `validateOrThrow returns value for valid input`() {
        val result = Validators.validateOrThrow("test@example.com") { email ->
            Validators.validateEmail(email)
        }
        
        assertEquals("test@example.com", result)
    }
    
    @Test
    fun `validateOrThrow throws for invalid input`() {
        assertFailsWith<PreconditionViolationException> {
            Validators.validateOrThrow("invalid") { email ->
                Validators.validateEmail(email)
            }
        }
    }
    
    // ========================================================================
    // Reserved Username Tests
    // ========================================================================
    
    @Test
    fun `validateUsername rejects reserved usernames`() {
        val reserved = listOf("admin", "root", "system", "null", "undefined", "api", "www")
        
        reserved.forEach { username ->
            val result = Validators.validateUsername(username)
            assertTrue(result.isInvalid, "Should reject reserved username: $username")
        }
    }
    
    @Test
    fun `validateUsername allows non-reserved usernames`() {
        val valid = listOf("testuser", "john_doe", "user-123", "MyUser")
        
        valid.forEach { username ->
            val result = Validators.validateUsername(username)
            assertTrue(result.isValid, "Should accept valid username: $username")
        }
    }
}
