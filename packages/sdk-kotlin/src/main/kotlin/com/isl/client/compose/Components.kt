@file:Suppress("unused")

package com.isl.client.compose

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.isl.client.ISLClient
import com.isl.client.models.*
import kotlinx.coroutines.launch

// ============================================================================
// State Classes
// ============================================================================

/**
 * State for user-related UI operations
 */
sealed class UserState {
    data object Initial : UserState()
    data object Loading : UserState()
    data class Success(val user: User) : UserState()
    data class Error(val message: String) : UserState()
}

/**
 * State for user list operations
 */
sealed class UserListState {
    data object Initial : UserListState()
    data object Loading : UserListState()
    data class Success(
        val users: List<User>,
        val hasMore: Boolean = false,
        val isLoadingMore: Boolean = false
    ) : UserListState()
    data class Error(val message: String) : UserListState()
}

/**
 * Form state for user creation
 */
data class CreateUserFormState(
    val email: String = "",
    val username: String = "",
    val isLoading: Boolean = false,
    val error: String? = null,
    val emailError: String? = null,
    val usernameError: String? = null
)

// ============================================================================
// Composable Components
// ============================================================================

/**
 * Create User Screen with form validation
 * 
 * @param client ISLClient instance
 * @param onUserCreated Callback when user is created successfully
 * @param modifier Optional modifier
 */
@Composable
fun CreateUserScreen(
    client: ISLClient,
    onUserCreated: (User) -> Unit,
    modifier: Modifier = Modifier
) {
    var formState by remember { mutableStateOf(CreateUserFormState()) }
    val scope = rememberCoroutineScope()
    
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "Create New User",
            style = MaterialTheme.typography.headlineMedium
        )
        
        // Email field
        OutlinedTextField(
            value = formState.email,
            onValueChange = { 
                formState = formState.copy(
                    email = it,
                    emailError = null,
                    error = null
                )
            },
            label = { Text("Email") },
            placeholder = { Text("user@example.com") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            isError = formState.emailError != null,
            supportingText = formState.emailError?.let { { Text(it) } },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            enabled = !formState.isLoading
        )
        
        // Username field
        OutlinedTextField(
            value = formState.username,
            onValueChange = { 
                formState = formState.copy(
                    username = it,
                    usernameError = null,
                    error = null
                )
            },
            label = { Text("Username") },
            placeholder = { Text("3-30 characters") },
            isError = formState.usernameError != null,
            supportingText = formState.usernameError?.let { { Text(it) } },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            enabled = !formState.isLoading
        )
        
        // Submit button
        Button(
            onClick = {
                // Validate
                var hasError = false
                var newState = formState
                
                if (!formState.email.contains("@")) {
                    newState = newState.copy(emailError = "Invalid email format")
                    hasError = true
                }
                
                if (formState.username.length !in 3..30) {
                    newState = newState.copy(usernameError = "Username must be 3-30 characters")
                    hasError = true
                }
                
                if (hasError) {
                    formState = newState
                    return@Button
                }
                
                // Submit
                scope.launch {
                    formState = formState.copy(isLoading = true, error = null)
                    
                    val result = client.users.createUser(
                        CreateUserInput(
                            email = formState.email,
                            username = formState.username
                        )
                    )
                    
                    when (result) {
                        is CreateUserResult.Success -> {
                            formState = CreateUserFormState() // Reset form
                            onUserCreated(result.user)
                        }
                        is CreateUserResult.Error.DuplicateEmail -> {
                            formState = formState.copy(
                                isLoading = false,
                                emailError = "Email already exists"
                            )
                        }
                        is CreateUserResult.Error.DuplicateUsername -> {
                            formState = formState.copy(
                                isLoading = false,
                                usernameError = "Username already taken"
                            )
                        }
                        is CreateUserResult.Error.InvalidInput -> {
                            formState = formState.copy(
                                isLoading = false,
                                error = result.message
                            )
                        }
                        is CreateUserResult.Error.RateLimited -> {
                            formState = formState.copy(
                                isLoading = false,
                                error = "Too many requests. Please try again in ${result.retryAfter} seconds."
                            )
                        }
                        is CreateUserResult.Error.ServerError -> {
                            formState = formState.copy(
                                isLoading = false,
                                error = "Server error: ${result.message}"
                            )
                        }
                        is CreateUserResult.Error.NetworkError -> {
                            formState = formState.copy(
                                isLoading = false,
                                error = "Network error. Please check your connection."
                            )
                        }
                    }
                }
            },
            modifier = Modifier.fillMaxWidth(),
            enabled = !formState.isLoading && 
                      formState.email.isNotBlank() && 
                      formState.username.isNotBlank()
        ) {
            if (formState.isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    strokeWidth = 2.dp
                )
                Spacer(modifier = Modifier.width(8.dp))
            }
            Text("Create User")
        }
        
        // General error message
        formState.error?.let { error ->
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.errorContainer
                ),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = error,
                    color = MaterialTheme.colorScheme.onErrorContainer,
                    modifier = Modifier.padding(16.dp)
                )
            }
        }
    }
}

/**
 * User Card component
 */
@Composable
fun UserCard(
    user: User,
    onClick: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    Card(
        onClick = onClick ?: {},
        enabled = onClick != null,
        modifier = modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = user.username,
                    style = MaterialTheme.typography.titleMedium
                )
                UserStatusBadge(status = user.status)
            }
            
            Text(
                text = user.email,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            
            Text(
                text = "ID: ${user.id}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

/**
 * User Status Badge component
 */
@Composable
fun UserStatusBadge(
    status: UserStatus,
    modifier: Modifier = Modifier
) {
    val (containerColor, contentColor) = when (status) {
        UserStatus.PENDING -> MaterialTheme.colorScheme.secondaryContainer to MaterialTheme.colorScheme.onSecondaryContainer
        UserStatus.ACTIVE -> MaterialTheme.colorScheme.primaryContainer to MaterialTheme.colorScheme.onPrimaryContainer
        UserStatus.SUSPENDED -> MaterialTheme.colorScheme.errorContainer to MaterialTheme.colorScheme.onErrorContainer
    }
    
    Surface(
        color = containerColor,
        shape = MaterialTheme.shapes.small,
        modifier = modifier
    ) {
        Text(
            text = status.name,
            color = contentColor,
            style = MaterialTheme.typography.labelSmall,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
        )
    }
}

/**
 * User List component with pagination
 */
@Composable
fun UserList(
    state: UserListState,
    onUserClick: (User) -> Unit,
    onLoadMore: () -> Unit,
    modifier: Modifier = Modifier
) {
    when (state) {
        is UserListState.Initial -> {
            Box(
                modifier = modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Text("No users loaded")
            }
        }
        is UserListState.Loading -> {
            Box(
                modifier = modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        }
        is UserListState.Success -> {
            Column(
                modifier = modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                state.users.forEach { user ->
                    UserCard(
                        user = user,
                        onClick = { onUserClick(user) }
                    )
                }
                
                if (state.hasMore) {
                    Button(
                        onClick = onLoadMore,
                        enabled = !state.isLoadingMore,
                        modifier = Modifier.align(Alignment.CenterHorizontally)
                    ) {
                        if (state.isLoadingMore) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                strokeWidth = 2.dp
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                        }
                        Text("Load More")
                    }
                }
            }
        }
        is UserListState.Error -> {
            Box(
                modifier = modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = state.message,
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }
        }
    }
}

/**
 * Loading button that shows progress indicator when loading
 */
@Composable
fun LoadingButton(
    onClick: () -> Unit,
    isLoading: Boolean,
    text: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true
) {
    Button(
        onClick = onClick,
        modifier = modifier,
        enabled = enabled && !isLoading
    ) {
        if (isLoading) {
            CircularProgressIndicator(
                modifier = Modifier.size(20.dp),
                strokeWidth = 2.dp,
                color = MaterialTheme.colorScheme.onPrimary
            )
            Spacer(modifier = Modifier.width(8.dp))
        }
        Text(text)
    }
}

/**
 * Error message component
 */
@Composable
fun ErrorMessage(
    message: String,
    onRetry: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.errorContainer
        ),
        modifier = modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = message,
                color = MaterialTheme.colorScheme.onErrorContainer
            )
            
            onRetry?.let {
                TextButton(
                    onClick = it,
                    colors = ButtonDefaults.textButtonColors(
                        contentColor = MaterialTheme.colorScheme.onErrorContainer
                    )
                ) {
                    Text("Retry")
                }
            }
        }
    }
}

/**
 * Empty state component
 */
@Composable
fun EmptyState(
    message: String,
    action: String? = null,
    onAction: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = message,
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            
            if (action != null && onAction != null) {
                Button(onClick = onAction) {
                    Text(action)
                }
            }
        }
    }
}
