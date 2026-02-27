package com.isl.client.services

import com.isl.client.models.*
import com.isl.client.networking.ApiClient
import com.isl.client.networking.ApiResponse
import com.isl.client.validation.Validators
import com.isl.client.verification.RuntimeCheck
import com.isl.client.verification.VerificationConfig
import com.isl.client.verification.Verified
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.channels.awaitClose

/**
 * User service for user-related operations
 * 
 * This service implements all user behaviors defined in the ISL specification
 * with automatic precondition and postcondition verification.
 */
class UserService(
    private val apiClient: ApiClient,
    private val verificationConfig: VerificationConfig = VerificationConfig()
) {
    
    private val runtimeCheck = RuntimeCheck(verificationConfig)
    
    // ========================================================================
    // Create User
    // ========================================================================
    
    /**
     * Create a new user
     * 
     * Preconditions:
     * - Email must be valid format (contains @, max 254 chars)
     * - Username must be 3-30 characters
     * 
     * Postconditions:
     * - User created with PENDING status
     * - User email matches input
     * - User username matches input
     * 
     * @param input The user creation input
     * @return CreateUserResult with success or typed error
     */
    @Verified(
        preconditions = [
            "input.email.contains('@')",
            "input.email.length <= 254",
            "input.username.length in 3..30"
        ],
        postconditions = [
            "result.email == input.email",
            "result.username == input.username",
            "result.status == UserStatus.PENDING"
        ]
    )
    suspend fun createUser(input: CreateUserInput): CreateUserResult {
        // Validate preconditions
        if (verificationConfig.enablePreconditions) {
            val validationResult = Validators.validateCreateUserInput(input)
            if (validationResult is com.isl.client.validation.ValidationResult.Invalid) {
                return CreateUserResult.Error.InvalidInput(
                    message = validationResult.errors.joinToString("; "),
                    field = validationResult.field
                )
            }
            runtimeCheck.verifyCreateUserPreconditions(input)
        }
        
        // Make API request
        val response = apiClient.post<User, CreateUserInput>("/api/users", input)
        
        return when (response) {
            is ApiResponse.Success -> {
                val user = response.data
                
                // Verify postconditions
                if (verificationConfig.enablePostconditions) {
                    runtimeCheck.verifyCreateUserPostconditions(input, user)
                }
                
                CreateUserResult.Success(user)
            }
            is ApiResponse.Error -> {
                mapCreateUserError(response)
            }
            is ApiResponse.RateLimited -> {
                CreateUserResult.Error.RateLimited(response.retryAfterSeconds)
            }
        }
    }
    
    // ========================================================================
    // Get User
    // ========================================================================
    
    /**
     * Get a user by ID
     * 
     * @param userId The user ID to fetch
     * @return GetUserResult with success or typed error
     */
    @Verified(
        preconditions = ["userId.isNotBlank()"],
        postconditions = ["result.id == userId"]
    )
    suspend fun getUser(userId: String): GetUserResult {
        // Validate preconditions
        if (verificationConfig.enablePreconditions) {
            runtimeCheck.verifyGetUserPreconditions(userId)
        }
        
        val response = apiClient.get<User>("/api/users/$userId")
        
        return when (response) {
            is ApiResponse.Success -> {
                val user = response.data
                
                // Verify postconditions
                if (verificationConfig.enablePostconditions) {
                    runtimeCheck.verifyGetUserPostconditions(userId, user)
                }
                
                GetUserResult.Success(user)
            }
            is ApiResponse.Error -> {
                when (response.errorCode) {
                    ErrorCodes.NOT_FOUND -> GetUserResult.Error.NotFound
                    ErrorCodes.UNAUTHORIZED -> GetUserResult.Error.Unauthorized
                    else -> GetUserResult.Error.ServerError(response.message)
                }
            }
            is ApiResponse.RateLimited -> {
                GetUserResult.Error.ServerError("Rate limited")
            }
        }
    }
    
    // ========================================================================
    // Update User
    // ========================================================================
    
    /**
     * Update a user
     * 
     * @param userId The user ID to update
     * @param input The update input
     * @return UpdateUserResult with success or typed error
     */
    @Verified(
        preconditions = [
            "userId.isNotBlank()",
            "input.username?.length in 3..30 || input.username == null"
        ],
        postconditions = [
            "result.id == userId",
            "result.username == input.username || input.username == null"
        ]
    )
    suspend fun updateUser(userId: String, input: UpdateUserInput): UpdateUserResult {
        // Validate preconditions
        if (verificationConfig.enablePreconditions) {
            val validationResult = Validators.validateUpdateUserInput(input)
            if (validationResult is com.isl.client.validation.ValidationResult.Invalid) {
                return UpdateUserResult.Error.InvalidInput(
                    message = validationResult.errors.joinToString("; "),
                    field = validationResult.field
                )
            }
            runtimeCheck.verifyUpdateUserPreconditions(userId, input)
        }
        
        val response = apiClient.patch<User, UpdateUserInput>("/api/users/$userId", input)
        
        return when (response) {
            is ApiResponse.Success -> {
                val user = response.data
                
                // Verify postconditions
                if (verificationConfig.enablePostconditions) {
                    runtimeCheck.verifyUpdateUserPostconditions(userId, input, user)
                }
                
                UpdateUserResult.Success(user)
            }
            is ApiResponse.Error -> {
                when (response.errorCode) {
                    ErrorCodes.NOT_FOUND -> UpdateUserResult.Error.NotFound
                    ErrorCodes.UNAUTHORIZED -> UpdateUserResult.Error.Unauthorized
                    ErrorCodes.FORBIDDEN -> UpdateUserResult.Error.Forbidden
                    ErrorCodes.CONFLICT -> UpdateUserResult.Error.Conflict(response.message)
                    ErrorCodes.INVALID_INPUT -> UpdateUserResult.Error.InvalidInput(response.message)
                    else -> UpdateUserResult.Error.ServerError(response.message)
                }
            }
            is ApiResponse.RateLimited -> {
                UpdateUserResult.Error.RateLimited(response.retryAfterSeconds)
            }
        }
    }
    
    // ========================================================================
    // Delete User
    // ========================================================================
    
    /**
     * Delete a user
     * 
     * @param userId The user ID to delete
     * @return DeleteUserResult with success or typed error
     */
    @Verified(
        preconditions = ["userId.isNotBlank()"]
    )
    suspend fun deleteUser(userId: String): DeleteUserResult {
        // Validate preconditions
        if (verificationConfig.enablePreconditions) {
            runtimeCheck.verifyDeleteUserPreconditions(userId)
        }
        
        val response = apiClient.delete<Unit>("/api/users/$userId")
        
        return when (response) {
            is ApiResponse.Success -> DeleteUserResult.Success
            is ApiResponse.Error -> {
                when (response.errorCode) {
                    ErrorCodes.NOT_FOUND -> DeleteUserResult.Error.NotFound
                    ErrorCodes.UNAUTHORIZED -> DeleteUserResult.Error.Unauthorized
                    ErrorCodes.FORBIDDEN -> DeleteUserResult.Error.Forbidden
                    else -> DeleteUserResult.Error.ServerError(response.message)
                }
            }
            is ApiResponse.RateLimited -> {
                DeleteUserResult.Error.ServerError("Rate limited")
            }
        }
    }
    
    // ========================================================================
    // List Users
    // ========================================================================
    
    /**
     * List users with pagination
     * 
     * @param input The list input with filters and pagination
     * @return ListUsersResult with success or typed error
     */
    suspend fun listUsers(input: ListUsersInput = ListUsersInput()): ListUsersResult {
        // Validate preconditions
        if (verificationConfig.enablePreconditions) {
            val validationResult = Validators.validateListUsersInput(input)
            if (validationResult is com.isl.client.validation.ValidationResult.Invalid) {
                return ListUsersResult.Error.InvalidInput(validationResult.errors.joinToString("; "))
            }
        }
        
        val queryParams = buildMap {
            input.status?.let { put("status", it.name) }
            input.role?.let { put("role", it.name) }
            put("pageSize", input.pageSize.toString())
            input.pageToken?.let { put("pageToken", it) }
            put("sortBy", input.sortBy)
            put("sortOrder", input.sortOrder.name)
        }
        
        val response = apiClient.get<PaginatedList<User>>("/api/users", queryParams)
        
        return when (response) {
            is ApiResponse.Success -> {
                val data = response.data
                ListUsersResult.Success(
                    users = data.items,
                    nextPageToken = data.nextPageToken,
                    totalCount = data.totalCount
                )
            }
            is ApiResponse.Error -> {
                when (response.errorCode) {
                    ErrorCodes.UNAUTHORIZED -> ListUsersResult.Error.Unauthorized
                    ErrorCodes.INVALID_INPUT -> ListUsersResult.Error.InvalidInput(response.message)
                    else -> ListUsersResult.Error.ServerError(response.message)
                }
            }
            is ApiResponse.RateLimited -> {
                ListUsersResult.Error.ServerError("Rate limited")
            }
        }
    }
    
    // ========================================================================
    // Search Users
    // ========================================================================
    
    /**
     * Search users by query
     * 
     * @param input The search input
     * @return SearchUsersResult with success or typed error
     */
    suspend fun searchUsers(input: SearchUsersInput): SearchUsersResult {
        // Validate preconditions
        if (verificationConfig.enablePreconditions) {
            val validationResult = Validators.validateSearchUsersInput(input)
            if (validationResult is com.isl.client.validation.ValidationResult.Invalid) {
                return SearchUsersResult.Error.InvalidInput(validationResult.errors.joinToString("; "))
            }
        }
        
        val queryParams = buildMap {
            put("q", input.query)
            put("fields", input.fields.joinToString(","))
            put("pageSize", input.pageSize.toString())
            input.pageToken?.let { put("pageToken", it) }
        }
        
        val response = apiClient.get<PaginatedList<User>>("/api/users/search", queryParams)
        
        return when (response) {
            is ApiResponse.Success -> {
                val data = response.data
                SearchUsersResult.Success(
                    users = data.items,
                    nextPageToken = data.nextPageToken,
                    totalCount = data.totalCount
                )
            }
            is ApiResponse.Error -> {
                when (response.errorCode) {
                    ErrorCodes.UNAUTHORIZED -> SearchUsersResult.Error.Unauthorized
                    ErrorCodes.INVALID_INPUT -> SearchUsersResult.Error.InvalidInput(response.message)
                    else -> SearchUsersResult.Error.ServerError(response.message)
                }
            }
            is ApiResponse.RateLimited -> {
                SearchUsersResult.Error.ServerError("Rate limited")
            }
        }
    }
    
    // ========================================================================
    // Real-time Updates
    // ========================================================================
    
    /**
     * Observe user updates via WebSocket
     * 
     * @param userId The user ID to observe
     * @return Flow of User updates
     */
    fun observeUser(userId: String): Flow<User> {
        if (verificationConfig.enablePreconditions) {
            require(userId.isNotBlank()) { "User ID cannot be blank" }
        }
        
        return apiClient.webSocket<UserUpdateEvent>("/ws/users/$userId") { event ->
            // Event handler
        }.map { event ->
            event.user
        }
    }
    
    /**
     * Observe all user updates via WebSocket
     * 
     * @return Flow of UserUpdateEvent
     */
    fun observeAllUsers(): Flow<UserUpdateEvent> {
        return apiClient.webSocket("/ws/users") { }
    }
    
    // ========================================================================
    // Error Mapping
    // ========================================================================
    
    private fun mapCreateUserError(response: ApiResponse.Error): CreateUserResult.Error {
        return when (response.errorCode) {
            ErrorCodes.DUPLICATE_EMAIL -> CreateUserResult.Error.DuplicateEmail
            ErrorCodes.DUPLICATE_USERNAME -> CreateUserResult.Error.DuplicateUsername
            ErrorCodes.CONFLICT -> {
                if (response.message.contains("email", ignoreCase = true)) {
                    CreateUserResult.Error.DuplicateEmail
                } else if (response.message.contains("username", ignoreCase = true)) {
                    CreateUserResult.Error.DuplicateUsername
                } else {
                    CreateUserResult.Error.InvalidInput(response.message)
                }
            }
            ErrorCodes.INVALID_INPUT, ErrorCodes.VALIDATION_FAILED -> {
                CreateUserResult.Error.InvalidInput(response.message)
            }
            else -> CreateUserResult.Error.ServerError(response.message, response.errorCode)
        }
    }
}
