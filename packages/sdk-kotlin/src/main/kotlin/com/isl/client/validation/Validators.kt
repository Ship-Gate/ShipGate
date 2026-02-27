package com.isl.client.validation

import com.isl.client.models.*

/**
 * Validation utilities for ISL preconditions
 * 
 * These validators implement the precondition checks defined in ISL specifications.
 * They are called automatically before API requests.
 */
object Validators {
    
    // ========================================================================
    // Email Validation
    // ========================================================================
    
    /**
     * Validate email format
     * 
     * ISL Precondition: email must be valid format
     */
    fun validateEmail(email: String): ValidationResult {
        val errors = mutableListOf<String>()
        
        if (email.isBlank()) {
            errors.add("Email cannot be blank")
        }
        
        if (!email.contains("@")) {
            errors.add("Email must contain @")
        }
        
        if (email.length > 254) {
            errors.add("Email must be at most 254 characters")
        }
        
        if (email.length < 3) {
            errors.add("Email must be at least 3 characters")
        }
        
        if (email.startsWith("@")) {
            errors.add("Email cannot start with @")
        }
        
        if (email.endsWith("@")) {
            errors.add("Email cannot end with @")
        }
        
        // More comprehensive email regex (RFC 5322 simplified)
        val emailRegex = Regex("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$")
        if (!emailRegex.matches(email)) {
            errors.add("Email format is invalid")
        }
        
        return if (errors.isEmpty()) {
            ValidationResult.Valid
        } else {
            ValidationResult.Invalid(errors, "email")
        }
    }
    
    // ========================================================================
    // Username Validation
    // ========================================================================
    
    /**
     * Validate username format
     * 
     * ISL Precondition: username must be 3-30 characters
     */
    fun validateUsername(username: String): ValidationResult {
        val errors = mutableListOf<String>()
        
        if (username.isBlank()) {
            errors.add("Username cannot be blank")
        }
        
        if (username.length < 3) {
            errors.add("Username must be at least 3 characters")
        }
        
        if (username.length > 30) {
            errors.add("Username must be at most 30 characters")
        }
        
        val usernameRegex = Regex("^[a-zA-Z0-9_-]+$")
        if (!usernameRegex.matches(username)) {
            errors.add("Username can only contain letters, numbers, underscores, and hyphens")
        }
        
        // Reserved usernames
        val reserved = setOf("admin", "root", "system", "null", "undefined", "api", "www")
        if (username.lowercase() in reserved) {
            errors.add("Username is reserved")
        }
        
        return if (errors.isEmpty()) {
            ValidationResult.Valid
        } else {
            ValidationResult.Invalid(errors, "username")
        }
    }
    
    // ========================================================================
    // ID Validation
    // ========================================================================
    
    /**
     * Validate user ID format
     */
    fun validateUserId(userId: String): ValidationResult {
        val errors = mutableListOf<String>()
        
        if (userId.isBlank()) {
            errors.add("User ID cannot be blank")
        }
        
        // Assuming UUID format
        val uuidRegex = Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
        if (!uuidRegex.matches(userId)) {
            // Also allow simple string IDs
            if (!userId.matches(Regex("^[a-zA-Z0-9_-]+$"))) {
                errors.add("User ID format is invalid")
            }
        }
        
        return if (errors.isEmpty()) {
            ValidationResult.Valid
        } else {
            ValidationResult.Invalid(errors, "userId")
        }
    }
    
    // ========================================================================
    // Input Validation
    // ========================================================================
    
    /**
     * Validate CreateUserInput
     * 
     * ISL Preconditions:
     * - email must be valid format
     * - username must be 3-30 characters
     */
    fun validateCreateUserInput(input: CreateUserInput): ValidationResult {
        val emailResult = validateEmail(input.email)
        val usernameResult = validateUsername(input.username)
        
        return combineResults(emailResult, usernameResult)
    }
    
    /**
     * Validate UpdateUserInput
     */
    fun validateUpdateUserInput(input: UpdateUserInput): ValidationResult {
        val results = mutableListOf<ValidationResult>()
        
        input.username?.let {
            results.add(validateUsername(it))
        }
        
        return if (results.isEmpty()) {
            ValidationResult.Valid
        } else {
            combineResults(*results.toTypedArray())
        }
    }
    
    /**
     * Validate ListUsersInput
     */
    fun validateListUsersInput(input: ListUsersInput): ValidationResult {
        val errors = mutableListOf<String>()
        
        if (input.pageSize < 1) {
            errors.add("Page size must be at least 1")
        }
        
        if (input.pageSize > 100) {
            errors.add("Page size must be at most 100")
        }
        
        val validSortFields = setOf("createdAt", "updatedAt", "email", "username", "status")
        if (input.sortBy !in validSortFields) {
            errors.add("Invalid sort field: ${input.sortBy}")
        }
        
        return if (errors.isEmpty()) {
            ValidationResult.Valid
        } else {
            ValidationResult.Invalid(errors, null)
        }
    }
    
    /**
     * Validate SearchUsersInput
     */
    fun validateSearchUsersInput(input: SearchUsersInput): ValidationResult {
        val errors = mutableListOf<String>()
        
        if (input.query.isBlank()) {
            errors.add("Search query cannot be blank")
        }
        
        if (input.query.length < 2) {
            errors.add("Search query must be at least 2 characters")
        }
        
        if (input.query.length > 100) {
            errors.add("Search query must be at most 100 characters")
        }
        
        if (input.pageSize < 1 || input.pageSize > 100) {
            errors.add("Page size must be between 1 and 100")
        }
        
        val validFields = setOf("email", "username")
        val invalidFields = input.fields.filter { it !in validFields }
        if (invalidFields.isNotEmpty()) {
            errors.add("Invalid search fields: ${invalidFields.joinToString()}")
        }
        
        return if (errors.isEmpty()) {
            ValidationResult.Valid
        } else {
            ValidationResult.Invalid(errors, "query")
        }
    }
    
    // ========================================================================
    // Utility Functions
    // ========================================================================
    
    /**
     * Combine multiple validation results
     */
    fun combineResults(vararg results: ValidationResult): ValidationResult {
        val allErrors = results.filterIsInstance<ValidationResult.Invalid>()
        
        return if (allErrors.isEmpty()) {
            ValidationResult.Valid
        } else {
            ValidationResult.Invalid(
                errors = allErrors.flatMap { it.errors },
                field = allErrors.mapNotNull { it.field }.firstOrNull()
            )
        }
    }
    
    /**
     * Require validation to pass, throw exception otherwise
     */
    fun require(result: ValidationResult, message: String? = null) {
        if (result is ValidationResult.Invalid) {
            throw PreconditionViolationException(
                message = message ?: result.errors.joinToString("; "),
                precondition = result.field ?: "input",
                actualValue = null
            )
        }
    }
    
    /**
     * Validate and throw if invalid
     */
    inline fun <T> validateOrThrow(
        input: T,
        validator: (T) -> ValidationResult
    ): T {
        val result = validator(input)
        require(result)
        return input
    }
}

/**
 * Validation result sealed class
 */
sealed class ValidationResult {
    /**
     * Validation passed
     */
    data object Valid : ValidationResult()
    
    /**
     * Validation failed with errors
     */
    data class Invalid(
        val errors: List<String>,
        val field: String?
    ) : ValidationResult()
    
    /**
     * Check if validation passed
     */
    val isValid: Boolean
        get() = this is Valid
    
    /**
     * Check if validation failed
     */
    val isInvalid: Boolean
        get() = this is Invalid
    
    /**
     * Get error messages or empty list
     */
    fun getErrors(): List<String> = when (this) {
        is Valid -> emptyList()
        is Invalid -> errors
    }
    
    /**
     * Get first error message or null
     */
    fun getFirstError(): String? = when (this) {
        is Valid -> null
        is Invalid -> errors.firstOrNull()
    }
}

/**
 * DSL for building validation rules
 */
class ValidationBuilder<T>(private val value: T) {
    private val errors = mutableListOf<String>()
    private var fieldName: String? = null
    
    fun field(name: String): ValidationBuilder<T> {
        fieldName = name
        return this
    }
    
    fun must(predicate: (T) -> Boolean, message: String): ValidationBuilder<T> {
        if (!predicate(value)) {
            errors.add(message)
        }
        return this
    }
    
    fun mustNot(predicate: (T) -> Boolean, message: String): ValidationBuilder<T> {
        if (predicate(value)) {
            errors.add(message)
        }
        return this
    }
    
    fun build(): ValidationResult {
        return if (errors.isEmpty()) {
            ValidationResult.Valid
        } else {
            ValidationResult.Invalid(errors, fieldName)
        }
    }
}

/**
 * Start validation for a value
 */
fun <T> validate(value: T, block: ValidationBuilder<T>.() -> Unit): ValidationResult {
    val builder = ValidationBuilder(value)
    builder.block()
    return builder.build()
}

/**
 * Extension for string validation
 */
fun String.validate(block: ValidationBuilder<String>.() -> Unit): ValidationResult {
    return validate(this, block)
}
