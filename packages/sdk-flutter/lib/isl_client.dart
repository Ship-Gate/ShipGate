/// ISL Flutter SDK
///
/// A type-safe Flutter SDK for ISL-verified APIs with runtime contract verification.
///
/// ## Getting Started
///
/// ```dart
/// import 'package:isl_flutter_sdk/isl_client.dart';
///
/// final client = ISLClient(
///   baseUrl: 'https://api.example.com',
///   enableVerification: true,
/// );
///
/// final result = await client.createUser(
///   CreateUserInput(email: 'user@example.com', username: 'johndoe'),
/// );
///
/// result.when(
///   success: (user) => print('Created: ${user.id}'),
///   duplicateEmail: () => print('Email exists'),
///   invalidInput: (msg) => print('Invalid: $msg'),
///   rateLimited: (retry) => print('Wait ${retry.inSeconds}s'),
/// );
/// ```
library isl_client;

// Models
export 'src/models/generated.dart';
export 'src/models/exceptions.dart';
export 'src/models/pagination.dart';

// Client
export 'src/client/api_client.dart';
export 'src/client/websocket_client.dart';
export 'src/client/interceptors.dart';

// Validation
export 'src/validation/validators.dart';
export 'src/validation/contracts.dart';

// Providers
export 'src/providers/isl_provider.dart';
export 'src/providers/auth_provider.dart';
export 'src/providers/user_provider.dart';

// Storage
export 'src/storage/secure_storage.dart';

// Utilities
export 'src/utils/result.dart';
export 'src/utils/logger.dart';
