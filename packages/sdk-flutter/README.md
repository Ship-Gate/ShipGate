# ISL Flutter SDK

A type-safe Flutter SDK for ISL-verified APIs with runtime contract verification. Built with Riverpod, Freezed, and Dio.

## Features

- **Type-Safe API Client**: Strongly typed request/response models generated from ISL specifications
- **Contract Verification**: Runtime verification of preconditions and postconditions
- **Sealed Result Types**: Exhaustive pattern matching for all API responses
- **Riverpod Integration**: First-class state management with providers
- **Secure Storage**: Encrypted token storage with Flutter Secure Storage
- **WebSocket Support**: Real-time updates with automatic reconnection
- **Retry & Rate Limiting**: Built-in error handling and retry logic

## Installation

Add to your `pubspec.yaml`:

```yaml
dependencies:
  isl_flutter_sdk:
    path: packages/sdk-flutter
```

Run code generation:

```bash
flutter pub get
flutter pub run build_runner build
```

## Quick Start

### Basic Usage

```dart
import 'package:isl_flutter_sdk/isl_client.dart';

// Create client
final client = ISLClient(
  config: ISLClientConfig(
    baseUrl: 'https://api.example.com',
    enableVerification: true,
  ),
);

// Create a user
final result = await client.createUser(
  CreateUserInput(
    email: 'user@example.com',
    username: 'johndoe',
  ),
);

// Handle all possible outcomes
result.when(
  success: (user) => print('Created user: ${user.id}'),
  duplicateEmail: () => print('Email already exists'),
  duplicateUsername: () => print('Username already taken'),
  invalidInput: (message) => print('Invalid input: $message'),
  rateLimited: (retryAfter) => print('Rate limited, retry in ${retryAfter.inSeconds}s'),
);
```

### With Riverpod

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:isl_flutter_sdk/isl_client.dart';

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return ProviderScope(
      child: MaterialApp(
        home: UserScreen(),
      ),
    );
  }
}

class UserScreen extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final userAsync = ref.watch(userByIdProvider('user-123'));
    
    return userAsync.when(
      data: (user) => user != null 
        ? UserProfile(user: user)
        : const Text('User not found'),
      loading: () => const CircularProgressIndicator(),
      error: (error, stack) => Text('Error: $error'),
    );
  }
}
```

### Authentication

```dart
// Login
final authState = ref.watch(authStateProvider);
final authNotifier = ref.read(authStateProvider.notifier);

await authNotifier.login(LoginInput(
  email: 'user@example.com',
  password: 'password123',
));

// Check auth state
if (authState.isAuthenticated) {
  final user = authState.user;
  print('Logged in as ${user?.username}');
}

// Logout
await authNotifier.logout();
```

### WebSocket Real-Time Updates

```dart
class RealTimeUserWidget extends ConsumerWidget {
  final String userId;
  
  const RealTimeUserWidget({required this.userId});
  
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final userUpdates = ref.watch(userUpdatesProvider(userId));
    
    return userUpdates.when(
      data: (user) => Text('User: ${user.username}'),
      loading: () => const CircularProgressIndicator(),
      error: (e, s) => Text('Error: $e'),
    );
  }
}
```

## Configuration

### Environment Variables

```dart
// Configure via dart-define
flutter run --dart-define=ISL_API_URL=https://api.example.com \
            --dart-define=ISL_WS_URL=wss://api.example.com/ws \
            --dart-define=ISL_ENABLE_VERIFICATION=true \
            --dart-define=ISL_ENABLE_LOGGING=false
```

### Client Configuration

```dart
final client = ISLClient(
  config: ISLClientConfig(
    baseUrl: 'https://api.example.com',
    connectTimeout: Duration(seconds: 30),
    receiveTimeout: Duration(seconds: 30),
    enableVerification: true,  // Enable contract verification
    enableLogging: false,      // Enable request/response logging
    maxRetries: 3,             // Retry failed requests
    retryDelay: Duration(seconds: 1),
  ),
);
```

## Contract Verification

The SDK automatically verifies ISL contracts at runtime:

### Preconditions

```dart
// Preconditions are verified before API calls
// This will return CreateUserInvalidInput without making a network request
final result = await client.createUser(
  CreateUserInput(
    email: 'invalid-email',  // ❌ Invalid email format
    username: 'ab',          // ❌ Too short (min 3 chars)
  ),
);
```

### Postconditions

```dart
// Postconditions are verified after successful API responses
// If the server returns unexpected data, ContractViolationException is thrown
final result = await client.createUser(input);

result.when(
  success: (user) {
    // These are guaranteed by contract verification:
    // - user.email == input.email
    // - user.username == input.username
    // - user.status == UserStatus.pending
  },
  // ...
);
```

### Verification Modes

```dart
// Development: Throw on violations
final devVerifier = ContractVerifier(
  enabled: true,
  mode: VerificationMode.strict,
);

// Staging: Log violations but don't throw
final stagingVerifier = ContractVerifier(
  enabled: true,
  mode: VerificationMode.logOnly,
);

// Production: Disable verification
final prodVerifier = ContractVerifier(
  enabled: false,
);
```

## Value Objects

Type-safe wrappers with built-in validation:

```dart
// Email validation
final email = Email('user@example.com');  // ✓ Valid
final invalid = Email('not-an-email');    // ✗ Throws ValidationException

// Username validation
final username = Username('johndoe');     // ✓ Valid (3-30 chars, alphanumeric)
final short = Username('ab');             // ✗ Throws ValidationException

// UUID validation
final id = UserId('123e4567-e89b-12d3-a456-426614174000');  // ✓ Valid
final badId = UserId('not-a-uuid');                          // ✗ Throws ValidationException
```

## Validators

Composable validators for custom validation:

```dart
// Single validators
const emailValidator = EmailValidator();
const minLength = MinLengthValidator('password', 8);
const range = RangeValidator<int>('age', min: 18, max: 120);

// Composite validators
final passwordValidator = minLength
    .and(MaxLengthValidator('password', 100))
    .and(PatternValidator('password', RegExp(r'[A-Z]'), 'uppercase'));

// Validate
final result = passwordValidator.validate('MyPassword123');
if (!result.isValid) {
  print('Errors: ${result.errors}');
}

// Or throw on failure
passwordValidator.validateOrThrow('weak'); // Throws ValidationException
```

## Error Handling

All API methods return sealed result types for exhaustive error handling:

```dart
final result = await client.login(input);

// Must handle all cases
final message = result.when(
  success: (session, user) => 'Welcome ${user.username}!',
  invalidCredentials: () => 'Wrong email or password',
  accountLocked: (duration) => 'Account locked for ${duration.inMinutes}m',
  accountSuspended: () => 'Account has been suspended',
  mfaRequired: (token) => 'MFA verification required',
  rateLimited: (retry) => 'Too many attempts, wait ${retry.inSeconds}s',
);
```

## Testing

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:isl_flutter_sdk/isl_client.dart';

void main() {
  test('createUser returns success', () async {
    final dio = Dio();
    final dioAdapter = DioAdapter(dio: dio);
    final storage = InMemorySecureStorage();
    
    final client = ISLClient(
      config: ISLClientConfig(baseUrl: 'https://api.test.com'),
      storage: storage,
      dio: dio,
    );
    
    dioAdapter.onPost('/api/users', (server) => server.reply(201, {
      'id': '123',
      'email': 'test@example.com',
      'username': 'testuser',
      'status': 'PENDING',
      'createdAt': DateTime.now().toIso8601String(),
      'updatedAt': DateTime.now().toIso8601String(),
    }));
    
    final result = await client.createUser(
      CreateUserInput(email: 'test@example.com', username: 'testuser'),
    );
    
    expect(result, isA<CreateUserSuccess>());
  });
}
```

## Project Structure

```
packages/sdk-flutter/
├── lib/
│   ├── isl_client.dart              # Main export file
│   └── src/
│       ├── client/
│       │   ├── api_client.dart      # Main HTTP client
│       │   ├── interceptors.dart    # Dio interceptors
│       │   └── websocket_client.dart # WebSocket client
│       ├── models/
│       │   ├── generated.dart       # Freezed models
│       │   ├── exceptions.dart      # Exception types
│       │   └── pagination.dart      # Pagination helpers
│       ├── validation/
│       │   ├── validators.dart      # Validator classes
│       │   └── contracts.dart       # Contract verification
│       ├── providers/
│       │   ├── isl_provider.dart    # Core providers
│       │   ├── auth_provider.dart   # Auth state management
│       │   └── user_provider.dart   # User state management
│       ├── storage/
│       │   └── secure_storage.dart  # Encrypted storage
│       └── utils/
│           ├── result.dart          # Result type
│           └── logger.dart          # Logging utilities
├── test/
│   ├── api_client_test.dart
│   ├── validators_test.dart
│   └── contracts_test.dart
├── pubspec.yaml
└── README.md
```

## License

MIT
