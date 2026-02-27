@file:Suppress("unused")

package com.isl.client.compose

import androidx.compose.runtime.*
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.isl.client.ISLClient
import com.isl.client.models.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

// ============================================================================
// User ViewModel
// ============================================================================

/**
 * ViewModel for user detail operations
 */
class UserViewModel(
    private val client: ISLClient,
    private val userId: String
) : ViewModel() {
    
    private val _state = MutableStateFlow<UserState>(UserState.Initial)
    val state: StateFlow<UserState> = _state.asStateFlow()
    
    init {
        loadUser()
    }
    
    /**
     * Load user from API
     */
    fun loadUser() {
        viewModelScope.launch {
            _state.value = UserState.Loading
            
            when (val result = client.users.getUser(userId)) {
                is GetUserResult.Success -> {
                    _state.value = UserState.Success(result.user)
                }
                is GetUserResult.Error.NotFound -> {
                    _state.value = UserState.Error("User not found")
                }
                is GetUserResult.Error.Unauthorized -> {
                    _state.value = UserState.Error("Unauthorized")
                }
                is GetUserResult.Error.ServerError -> {
                    _state.value = UserState.Error(result.message)
                }
                is GetUserResult.Error.NetworkError -> {
                    _state.value = UserState.Error("Network error")
                }
            }
        }
    }
    
    /**
     * Update user
     */
    fun updateUser(input: UpdateUserInput) {
        viewModelScope.launch {
            _state.value = UserState.Loading
            
            when (val result = client.users.updateUser(userId, input)) {
                is UpdateUserResult.Success -> {
                    _state.value = UserState.Success(result.user)
                }
                is UpdateUserResult.Error.NotFound -> {
                    _state.value = UserState.Error("User not found")
                }
                is UpdateUserResult.Error.Unauthorized -> {
                    _state.value = UserState.Error("Unauthorized")
                }
                is UpdateUserResult.Error.Forbidden -> {
                    _state.value = UserState.Error("Forbidden")
                }
                is UpdateUserResult.Error.InvalidInput -> {
                    _state.value = UserState.Error(result.message)
                }
                is UpdateUserResult.Error.Conflict -> {
                    _state.value = UserState.Error(result.message)
                }
                is UpdateUserResult.Error.RateLimited -> {
                    _state.value = UserState.Error("Rate limited. Retry in ${result.retryAfter}s")
                }
                is UpdateUserResult.Error.ServerError -> {
                    _state.value = UserState.Error(result.message)
                }
                is UpdateUserResult.Error.NetworkError -> {
                    _state.value = UserState.Error("Network error")
                }
            }
        }
    }
    
    /**
     * Observe real-time user updates
     */
    fun observeUser() {
        viewModelScope.launch {
            client.users.observeUser(userId)
                .catch { e ->
                    _state.value = UserState.Error("WebSocket error: ${e.message}")
                }
                .collect { user ->
                    _state.value = UserState.Success(user)
                }
        }
    }
}

// ============================================================================
// User List ViewModel
// ============================================================================

/**
 * ViewModel for user list operations with pagination
 */
class UserListViewModel(
    private val client: ISLClient
) : ViewModel() {
    
    private val _state = MutableStateFlow<UserListState>(UserListState.Initial)
    val state: StateFlow<UserListState> = _state.asStateFlow()
    
    private var currentPageToken: String? = null
    private var allUsers = mutableListOf<User>()
    
    /**
     * Load initial list of users
     */
    fun loadUsers(
        status: UserStatus? = null,
        role: UserRole? = null,
        pageSize: Int = 20
    ) {
        viewModelScope.launch {
            _state.value = UserListState.Loading
            allUsers.clear()
            currentPageToken = null
            
            val result = client.users.listUsers(
                ListUsersInput(
                    status = status,
                    role = role,
                    pageSize = pageSize
                )
            )
            
            handleListResult(result, isLoadMore = false)
        }
    }
    
    /**
     * Load more users (pagination)
     */
    fun loadMore() {
        val token = currentPageToken ?: return
        val currentState = _state.value as? UserListState.Success ?: return
        
        viewModelScope.launch {
            _state.value = currentState.copy(isLoadingMore = true)
            
            val result = client.users.listUsers(
                ListUsersInput(pageToken = token)
            )
            
            handleListResult(result, isLoadMore = true)
        }
    }
    
    /**
     * Search users
     */
    fun searchUsers(query: String) {
        if (query.isBlank()) {
            loadUsers()
            return
        }
        
        viewModelScope.launch {
            _state.value = UserListState.Loading
            allUsers.clear()
            currentPageToken = null
            
            val result = client.users.searchUsers(
                SearchUsersInput(query = query)
            )
            
            when (result) {
                is SearchUsersResult.Success -> {
                    allUsers.addAll(result.users)
                    currentPageToken = result.nextPageToken
                    _state.value = UserListState.Success(
                        users = allUsers.toList(),
                        hasMore = result.nextPageToken != null
                    )
                }
                is SearchUsersResult.Error.Unauthorized -> {
                    _state.value = UserListState.Error("Unauthorized")
                }
                is SearchUsersResult.Error.InvalidInput -> {
                    _state.value = UserListState.Error(result.message)
                }
                is SearchUsersResult.Error.ServerError -> {
                    _state.value = UserListState.Error(result.message)
                }
                is SearchUsersResult.Error.NetworkError -> {
                    _state.value = UserListState.Error("Network error")
                }
            }
        }
    }
    
    /**
     * Refresh the list
     */
    fun refresh() {
        loadUsers()
    }
    
    private fun handleListResult(result: ListUsersResult, isLoadMore: Boolean) {
        when (result) {
            is ListUsersResult.Success -> {
                allUsers.addAll(result.users)
                currentPageToken = result.nextPageToken
                _state.value = UserListState.Success(
                    users = allUsers.toList(),
                    hasMore = result.nextPageToken != null
                )
            }
            is ListUsersResult.Error.Unauthorized -> {
                _state.value = UserListState.Error("Unauthorized")
            }
            is ListUsersResult.Error.InvalidInput -> {
                _state.value = UserListState.Error(result.message)
            }
            is ListUsersResult.Error.ServerError -> {
                _state.value = UserListState.Error(result.message)
            }
            is ListUsersResult.Error.NetworkError -> {
                _state.value = UserListState.Error("Network error")
            }
        }
    }
}

// ============================================================================
// Create User ViewModel
// ============================================================================

/**
 * ViewModel for user creation
 */
class CreateUserViewModel(
    private val client: ISLClient
) : ViewModel() {
    
    private val _formState = MutableStateFlow(CreateUserFormState())
    val formState: StateFlow<CreateUserFormState> = _formState.asStateFlow()
    
    private val _createdUser = MutableSharedFlow<User>()
    val createdUser: SharedFlow<User> = _createdUser.asSharedFlow()
    
    /**
     * Update email field
     */
    fun updateEmail(email: String) {
        _formState.update { 
            it.copy(email = email, emailError = null, error = null) 
        }
    }
    
    /**
     * Update username field
     */
    fun updateUsername(username: String) {
        _formState.update { 
            it.copy(username = username, usernameError = null, error = null) 
        }
    }
    
    /**
     * Submit the form
     */
    fun submit() {
        val state = _formState.value
        
        // Client-side validation
        var hasError = false
        var newState = state
        
        if (!state.email.contains("@")) {
            newState = newState.copy(emailError = "Invalid email format")
            hasError = true
        }
        
        if (state.username.length !in 3..30) {
            newState = newState.copy(usernameError = "Username must be 3-30 characters")
            hasError = true
        }
        
        if (hasError) {
            _formState.value = newState
            return
        }
        
        // Submit to API
        viewModelScope.launch {
            _formState.update { it.copy(isLoading = true, error = null) }
            
            val result = client.users.createUser(
                CreateUserInput(
                    email = state.email,
                    username = state.username
                )
            )
            
            when (result) {
                is CreateUserResult.Success -> {
                    _formState.value = CreateUserFormState()
                    _createdUser.emit(result.user)
                }
                is CreateUserResult.Error.DuplicateEmail -> {
                    _formState.update { 
                        it.copy(isLoading = false, emailError = "Email already exists") 
                    }
                }
                is CreateUserResult.Error.DuplicateUsername -> {
                    _formState.update { 
                        it.copy(isLoading = false, usernameError = "Username already taken") 
                    }
                }
                is CreateUserResult.Error.InvalidInput -> {
                    _formState.update { 
                        it.copy(isLoading = false, error = result.message) 
                    }
                }
                is CreateUserResult.Error.RateLimited -> {
                    _formState.update { 
                        it.copy(
                            isLoading = false, 
                            error = "Too many requests. Retry in ${result.retryAfter}s"
                        ) 
                    }
                }
                is CreateUserResult.Error.ServerError -> {
                    _formState.update { 
                        it.copy(isLoading = false, error = "Server error: ${result.message}") 
                    }
                }
                is CreateUserResult.Error.NetworkError -> {
                    _formState.update { 
                        it.copy(isLoading = false, error = "Network error") 
                    }
                }
            }
        }
    }
    
    /**
     * Reset the form
     */
    fun reset() {
        _formState.value = CreateUserFormState()
    }
}

// ============================================================================
// Compose State Holders
// ============================================================================

/**
 * Remember ISL client in composition
 */
@Composable
fun rememberISLClient(
    baseUrl: String,
    authToken: String? = null
): ISLClient {
    return remember(baseUrl, authToken) {
        ISLClient.simple(baseUrl, authToken)
    }
}

/**
 * Collect state as Compose state with lifecycle awareness
 * 
 * Note: This requires lifecycle-runtime-compose dependency
 */
@Composable
fun <T> StateFlow<T>.collectAsStateWithLifecycle(): State<T> {
    return collectAsState()
}
