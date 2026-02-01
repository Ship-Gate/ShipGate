package com.isl.client.verification

import com.isl.client.models.*

/**
 * Configuration for runtime verification
 */
data class VerificationConfig(
    val enablePreconditions: Boolean = true,
    val enablePostconditions: Boolean = true,
    val throwOnViolation: Boolean = true,
    val logViolations: Boolean = true
)

/**
 * Runtime verification for ISL contracts
 * 
 * This class implements runtime checking of preconditions and postconditions
 * as defined in ISL specifications.
 */
class RuntimeCheck(
    private val config: VerificationConfig = VerificationConfig()
) {
    
    private val violations = mutableListOf<Violation>()
    
    // ========================================================================
    // Precondition Verification
    // ========================================================================
    
    /**
     * Verify preconditions for CreateUser behavior
     * 
     * Preconditions:
     * - email must be valid format (contains @, max 254 chars)
     * - username must be 3-30 characters
     */
    fun verifyCreateUserPreconditions(input: CreateUserInput) {
        if (!config.enablePreconditions) return
        
        // Email validation
        checkPrecondition(
            condition = input.email.contains("@"),
            message = "Email must contain @",
            precondition = "email.contains('@')",
            actualValue = input.email
        )
        
        checkPrecondition(
            condition = input.email.length <= 254,
            message = "Email must be at most 254 characters",
            precondition = "email.length <= 254",
            actualValue = input.email.length
        )
        
        // Username validation
        checkPrecondition(
            condition = input.username.length >= 3,
            message = "Username must be at least 3 characters",
            precondition = "username.length >= 3",
            actualValue = input.username.length
        )
        
        checkPrecondition(
            condition = input.username.length <= 30,
            message = "Username must be at most 30 characters",
            precondition = "username.length <= 30",
            actualValue = input.username.length
        )
    }
    
    /**
     * Verify preconditions for UpdateUser behavior
     */
    fun verifyUpdateUserPreconditions(userId: String, input: UpdateUserInput) {
        if (!config.enablePreconditions) return
        
        checkPrecondition(
            condition = userId.isNotBlank(),
            message = "User ID cannot be blank",
            precondition = "userId.isNotBlank()",
            actualValue = userId
        )
        
        input.username?.let { username ->
            checkPrecondition(
                condition = username.length in 3..30,
                message = "Username must be 3-30 characters",
                precondition = "username.length in 3..30",
                actualValue = username.length
            )
        }
    }
    
    /**
     * Verify preconditions for GetUser behavior
     */
    fun verifyGetUserPreconditions(userId: String) {
        if (!config.enablePreconditions) return
        
        checkPrecondition(
            condition = userId.isNotBlank(),
            message = "User ID cannot be blank",
            precondition = "userId.isNotBlank()",
            actualValue = userId
        )
    }
    
    /**
     * Verify preconditions for DeleteUser behavior
     */
    fun verifyDeleteUserPreconditions(userId: String) {
        if (!config.enablePreconditions) return
        
        checkPrecondition(
            condition = userId.isNotBlank(),
            message = "User ID cannot be blank",
            precondition = "userId.isNotBlank()",
            actualValue = userId
        )
    }
    
    // ========================================================================
    // Postcondition Verification
    // ========================================================================
    
    /**
     * Verify postconditions for CreateUser behavior
     * 
     * Postconditions:
     * - user.email == input.email
     * - user.username == input.username
     * - user.status == PENDING
     */
    fun verifyCreateUserPostconditions(input: CreateUserInput, result: User) {
        if (!config.enablePostconditions) return
        
        checkPostcondition(
            condition = result.email == input.email,
            message = "Created user email must match input email",
            postcondition = "result.email == input.email",
            expected = input.email,
            actual = result.email
        )
        
        checkPostcondition(
            condition = result.username == input.username,
            message = "Created user username must match input username",
            postcondition = "result.username == input.username",
            expected = input.username,
            actual = result.username
        )
        
        checkPostcondition(
            condition = result.status == UserStatus.PENDING,
            message = "Created user status must be PENDING",
            postcondition = "result.status == UserStatus.PENDING",
            expected = UserStatus.PENDING,
            actual = result.status
        )
        
        checkPostcondition(
            condition = result.id.isNotBlank(),
            message = "Created user must have an ID",
            postcondition = "result.id.isNotBlank()",
            expected = "non-blank ID",
            actual = result.id
        )
        
        checkPostcondition(
            condition = result.createdAt > 0,
            message = "Created user must have createdAt timestamp",
            postcondition = "result.createdAt > 0",
            expected = "> 0",
            actual = result.createdAt
        )
    }
    
    /**
     * Verify postconditions for UpdateUser behavior
     */
    fun verifyUpdateUserPostconditions(userId: String, input: UpdateUserInput, result: User) {
        if (!config.enablePostconditions) return
        
        checkPostcondition(
            condition = result.id == userId,
            message = "Updated user ID must match request ID",
            postcondition = "result.id == userId",
            expected = userId,
            actual = result.id
        )
        
        input.username?.let { expectedUsername ->
            checkPostcondition(
                condition = result.username == expectedUsername,
                message = "Updated user username must match input",
                postcondition = "result.username == input.username",
                expected = expectedUsername,
                actual = result.username
            )
        }
        
        input.status?.let { expectedStatus ->
            checkPostcondition(
                condition = result.status == expectedStatus,
                message = "Updated user status must match input",
                postcondition = "result.status == input.status",
                expected = expectedStatus,
                actual = result.status
            )
        }
        
        checkPostcondition(
            condition = result.updatedAt > 0,
            message = "Updated user must have updatedAt timestamp",
            postcondition = "result.updatedAt > 0",
            expected = "> 0",
            actual = result.updatedAt
        )
    }
    
    /**
     * Verify postconditions for GetUser behavior
     */
    fun verifyGetUserPostconditions(userId: String, result: User) {
        if (!config.enablePostconditions) return
        
        checkPostcondition(
            condition = result.id == userId,
            message = "Retrieved user ID must match request ID",
            postcondition = "result.id == userId",
            expected = userId,
            actual = result.id
        )
    }
    
    // ========================================================================
    // Internal Verification Logic
    // ========================================================================
    
    private fun checkPrecondition(
        condition: Boolean,
        message: String,
        precondition: String,
        actualValue: Any?
    ) {
        if (!condition) {
            val violation = Violation(
                type = ViolationType.PRECONDITION,
                message = message,
                contract = precondition,
                expected = null,
                actual = actualValue
            )
            
            handleViolation(violation)
        }
    }
    
    private fun checkPostcondition(
        condition: Boolean,
        message: String,
        postcondition: String,
        expected: Any?,
        actual: Any?
    ) {
        if (!condition) {
            val violation = Violation(
                type = ViolationType.POSTCONDITION,
                message = message,
                contract = postcondition,
                expected = expected,
                actual = actual
            )
            
            handleViolation(violation)
        }
    }
    
    private fun handleViolation(violation: Violation) {
        violations.add(violation)
        
        if (config.logViolations) {
            logViolation(violation)
        }
        
        if (config.throwOnViolation) {
            when (violation.type) {
                ViolationType.PRECONDITION -> throw PreconditionViolationException(
                    message = violation.message,
                    precondition = violation.contract,
                    actualValue = violation.actual
                )
                ViolationType.POSTCONDITION -> throw PostconditionViolationException(
                    message = violation.message,
                    postcondition = violation.contract,
                    expectedValue = violation.expected,
                    actualValue = violation.actual
                )
            }
        }
    }
    
    private fun logViolation(violation: Violation) {
        val prefix = when (violation.type) {
            ViolationType.PRECONDITION -> "[PRECONDITION VIOLATION]"
            ViolationType.POSTCONDITION -> "[POSTCONDITION VIOLATION]"
        }
        
        System.err.println("$prefix ${violation.message}")
        System.err.println("  Contract: ${violation.contract}")
        violation.expected?.let { System.err.println("  Expected: $it") }
        violation.actual?.let { System.err.println("  Actual: $it") }
    }
    
    /**
     * Get all recorded violations
     */
    fun getViolations(): List<Violation> = violations.toList()
    
    /**
     * Clear recorded violations
     */
    fun clearViolations() {
        violations.clear()
    }
    
    /**
     * Check if any violations occurred
     */
    fun hasViolations(): Boolean = violations.isNotEmpty()
}

/**
 * Type of contract violation
 */
enum class ViolationType {
    PRECONDITION,
    POSTCONDITION
}

/**
 * Contract violation record
 */
data class Violation(
    val type: ViolationType,
    val message: String,
    val contract: String,
    val expected: Any?,
    val actual: Any?,
    val timestamp: Long = System.currentTimeMillis()
)

/**
 * Extension function for inline verification
 */
inline fun <T> T.verifyPrecondition(
    condition: (T) -> Boolean,
    lazyMessage: () -> String
): T {
    require(condition(this), lazyMessage)
    return this
}

/**
 * Extension function for postcondition verification
 */
inline fun <T> T.verifyPostcondition(
    condition: (T) -> Boolean,
    lazyMessage: () -> String
): T {
    check(condition(this), lazyMessage)
    return this
}

/**
 * Annotation for marking verified behaviors
 */
@Target(AnnotationTarget.FUNCTION)
@Retention(AnnotationRetention.RUNTIME)
annotation class Verified(
    val preconditions: Array<String> = [],
    val postconditions: Array<String> = []
)
