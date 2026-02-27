@file:Suppress("unused")

package com.isl.client.testing

import com.isl.client.models.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf

/**
 * Mock ISL client for testing
 * 
 * Allows defining mock responses for all client operations.
 * 
 * @example
 * ```kotlin
 * val mockClient = MockISLClient {
 *     users.createUser returns CreateUserResult.Success(mockUser)
 *     users.getUser("123") returns GetUserResult.Success(mockUser)
 *     users.getUser("404") returns GetUserResult.Error.NotFound
 * }
 * ```
 */
class MockISLClient(
    setup: MockClientBuilder.() -> Unit = {}
) {
    private val builder = MockClientBuilder()
    
    init {
        builder.setup()
    }
    
    val users: MockUserService = builder.userService
}

/**
 * Builder for mock client configuration
 */
class MockClientBuilder {
    internal val userService = MockUserService()
    
    val users: MockUserServiceBuilder
        get() = MockUserServiceBuilder(userService)
}

/**
 * Builder for mock user service
 */
class MockUserServiceBuilder(private val service: MockUserService) {
    
    infix fun createUser(input: CreateUserInput): MockResultBuilder<CreateUserResult> {
        return MockResultBuilder { result ->
            service.createUserMocks[input] = result
        }
    }
    
    val createUser: MockResultBuilder<CreateUserResult>
        get() = MockResultBuilder { result ->
            service.defaultCreateUserResult = result
        }
    
    fun getUser(userId: String): MockResultBuilder<GetUserResult> {
        return MockResultBuilder { result ->
            service.getUserMocks[userId] = result
        }
    }
    
    val getUser: MockResultBuilder<GetUserResult>
        get() = MockResultBuilder { result ->
            service.defaultGetUserResult = result
        }
    
    fun updateUser(userId: String): MockResultBuilder<UpdateUserResult> {
        return MockResultBuilder { result ->
            service.updateUserMocks[userId] = result
        }
    }
    
    fun deleteUser(userId: String): MockResultBuilder<DeleteUserResult> {
        return MockResultBuilder { result ->
            service.deleteUserMocks[userId] = result
        }
    }
    
    val listUsers: MockResultBuilder<ListUsersResult>
        get() = MockResultBuilder { result ->
            service.defaultListUsersResult = result
        }
    
    val searchUsers: MockResultBuilder<SearchUsersResult>
        get() = MockResultBuilder { result ->
            service.defaultSearchUsersResult = result
        }
    
    fun observeUser(userId: String): MockFlowBuilder<User> {
        return MockFlowBuilder { flow ->
            service.observeUserMocks[userId] = flow
        }
    }
}

/**
 * Builder for mock result
 */
class MockResultBuilder<T>(private val setter: (T) -> Unit) {
    infix fun returns(result: T) {
        setter(result)
    }
}

/**
 * Builder for mock Flow
 */
class MockFlowBuilder<T>(private val setter: (Flow<T>) -> Unit) {
    infix fun emits(vararg values: T) {
        setter(flowOf(*values))
    }
    
    infix fun emits(flow: Flow<T>) {
        setter(flow)
    }
}

/**
 * Mock user service implementation
 */
class MockUserService {
    internal val createUserMocks = mutableMapOf<CreateUserInput, CreateUserResult>()
    internal var defaultCreateUserResult: CreateUserResult = CreateUserResult.Error.ServerError("Not mocked")
    
    internal val getUserMocks = mutableMapOf<String, GetUserResult>()
    internal var defaultGetUserResult: GetUserResult = GetUserResult.Error.ServerError("Not mocked")
    
    internal val updateUserMocks = mutableMapOf<String, UpdateUserResult>()
    internal var defaultUpdateUserResult: UpdateUserResult = UpdateUserResult.Error.ServerError("Not mocked")
    
    internal val deleteUserMocks = mutableMapOf<String, DeleteUserResult>()
    internal var defaultDeleteUserResult: DeleteUserResult = DeleteUserResult.Error.ServerError("Not mocked")
    
    internal var defaultListUsersResult: ListUsersResult = ListUsersResult.Error.ServerError("Not mocked")
    internal var defaultSearchUsersResult: SearchUsersResult = SearchUsersResult.Error.ServerError("Not mocked")
    
    internal val observeUserMocks = mutableMapOf<String, Flow<User>>()
    
    // Call tracking
    private val createUserCalls = mutableListOf<CreateUserInput>()
    private val getUserCalls = mutableListOf<String>()
    private val updateUserCalls = mutableListOf<Pair<String, UpdateUserInput>>()
    private val deleteUserCalls = mutableListOf<String>()
    
    /**
     * Create user mock
     */
    suspend fun createUser(input: CreateUserInput): CreateUserResult {
        createUserCalls.add(input)
        return createUserMocks[input] ?: defaultCreateUserResult
    }
    
    /**
     * Get user mock
     */
    suspend fun getUser(userId: String): GetUserResult {
        getUserCalls.add(userId)
        return getUserMocks[userId] ?: defaultGetUserResult
    }
    
    /**
     * Update user mock
     */
    suspend fun updateUser(userId: String, input: UpdateUserInput): UpdateUserResult {
        updateUserCalls.add(userId to input)
        return updateUserMocks[userId] ?: defaultUpdateUserResult
    }
    
    /**
     * Delete user mock
     */
    suspend fun deleteUser(userId: String): DeleteUserResult {
        deleteUserCalls.add(userId)
        return deleteUserMocks[userId] ?: defaultDeleteUserResult
    }
    
    /**
     * List users mock
     */
    suspend fun listUsers(input: ListUsersInput = ListUsersInput()): ListUsersResult {
        return defaultListUsersResult
    }
    
    /**
     * Search users mock
     */
    suspend fun searchUsers(input: SearchUsersInput): SearchUsersResult {
        return defaultSearchUsersResult
    }
    
    /**
     * Observe user mock
     */
    fun observeUser(userId: String): Flow<User> {
        return observeUserMocks[userId] ?: flowOf()
    }
    
    // Verification methods
    
    /**
     * Verify createUser was called with specific input
     */
    fun verifyCreateUserCalled(input: CreateUserInput): Boolean {
        return input in createUserCalls
    }
    
    /**
     * Verify createUser was called n times
     */
    fun verifyCreateUserCalledTimes(times: Int): Boolean {
        return createUserCalls.size == times
    }
    
    /**
     * Verify getUser was called with specific userId
     */
    fun verifyGetUserCalled(userId: String): Boolean {
        return userId in getUserCalls
    }
    
    /**
     * Verify updateUser was called
     */
    fun verifyUpdateUserCalled(userId: String): Boolean {
        return updateUserCalls.any { it.first == userId }
    }
    
    /**
     * Verify deleteUser was called
     */
    fun verifyDeleteUserCalled(userId: String): Boolean {
        return userId in deleteUserCalls
    }
    
    /**
     * Get all createUser calls
     */
    fun getCreateUserCalls(): List<CreateUserInput> = createUserCalls.toList()
    
    /**
     * Get all getUser calls
     */
    fun getGetUserCalls(): List<String> = getUserCalls.toList()
    
    /**
     * Reset all mocks and call tracking
     */
    fun reset() {
        createUserMocks.clear()
        getUserMocks.clear()
        updateUserMocks.clear()
        deleteUserMocks.clear()
        observeUserMocks.clear()
        createUserCalls.clear()
        getUserCalls.clear()
        updateUserCalls.clear()
        deleteUserCalls.clear()
    }
}

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Test fixtures for common test data
 */
object TestFixtures {
    
    /**
     * Create a mock user
     */
    fun createUser(
        id: String = "user-123",
        email: String = "test@example.com",
        username: String = "testuser",
        status: UserStatus = UserStatus.PENDING,
        role: UserRole = UserRole.USER,
        createdAt: Long = System.currentTimeMillis(),
        updatedAt: Long = System.currentTimeMillis()
    ): User = User(
        id = id,
        email = email,
        username = username,
        status = status,
        role = role,
        createdAt = createdAt,
        updatedAt = updatedAt
    )
    
    /**
     * Create a list of mock users
     */
    fun createUsers(count: Int): List<User> {
        return (1..count).map { i ->
            createUser(
                id = "user-$i",
                email = "user$i@example.com",
                username = "user$i"
            )
        }
    }
    
    /**
     * Create a mock CreateUserInput
     */
    fun createUserInput(
        email: String = "test@example.com",
        username: String = "testuser"
    ): CreateUserInput = CreateUserInput(
        email = email,
        username = username
    )
    
    /**
     * Create a mock UpdateUserInput
     */
    fun updateUserInput(
        username: String? = null,
        status: UserStatus? = null,
        role: UserRole? = null
    ): UpdateUserInput = UpdateUserInput(
        username = username,
        status = status,
        role = role
    )
    
    /**
     * Active user fixture
     */
    val activeUser = createUser(
        id = "active-user",
        status = UserStatus.ACTIVE
    )
    
    /**
     * Pending user fixture
     */
    val pendingUser = createUser(
        id = "pending-user",
        status = UserStatus.PENDING
    )
    
    /**
     * Suspended user fixture
     */
    val suspendedUser = createUser(
        id = "suspended-user",
        status = UserStatus.SUSPENDED
    )
    
    /**
     * Admin user fixture
     */
    val adminUser = createUser(
        id = "admin-user",
        role = UserRole.ADMIN
    )
}
