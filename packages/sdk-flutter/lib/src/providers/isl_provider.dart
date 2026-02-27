import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../client/api_client.dart';
import '../client/websocket_client.dart';
import '../models/generated.dart';
import '../storage/secure_storage.dart';

part 'isl_provider.g.dart';

// ============================================================================
// CONFIGURATION PROVIDERS
// ============================================================================

/// Provider for ISL client configuration
final islConfigProvider = Provider<ISLClientConfig>((ref) {
  return ISLClientConfig(
    baseUrl: const String.fromEnvironment(
      'ISL_API_URL',
      defaultValue: 'https://api.example.com',
    ),
    enableVerification: const bool.fromEnvironment(
      'ISL_ENABLE_VERIFICATION',
      defaultValue: true,
    ),
    enableLogging: const bool.fromEnvironment(
      'ISL_ENABLE_LOGGING',
      defaultValue: false,
    ),
  );
});

/// Provider for WebSocket configuration
final wsConfigProvider = Provider<WSClientConfig>((ref) {
  return WSClientConfig(
    url: const String.fromEnvironment(
      'ISL_WS_URL',
      defaultValue: 'wss://api.example.com/ws',
    ),
  );
});

// ============================================================================
// CLIENT PROVIDERS
// ============================================================================

/// Provider for secure storage
final secureStorageProvider = Provider<ISLSecureStorage>((ref) {
  return ISLSecureStorage();
});

/// Provider for the main ISL API client
final islClientProvider = Provider<ISLClient>((ref) {
  final config = ref.watch(islConfigProvider);
  final storage = ref.watch(secureStorageProvider);

  return ISLClient(
    config: config,
    storage: storage,
  );
});

/// Provider for WebSocket client
final wsClientProvider = Provider<ISLWebSocketClient>((ref) {
  final config = ref.watch(wsConfigProvider);
  final storage = ref.watch(secureStorageProvider);

  final client = ISLWebSocketClient(
    config: config,
    storage: storage,
  );

  ref.onDispose(() {
    client.dispose();
  });

  return client;
});

/// Provider for WebSocket connection state
final wsConnectionStateProvider = StreamProvider<WSConnectionState>((ref) {
  final wsClient = ref.watch(wsClientProvider);

  return Stream.periodic(
    const Duration(milliseconds: 500),
    (_) => wsClient.state,
  ).distinct();
});

// ============================================================================
// USER PROVIDERS
// ============================================================================

/// Provider for creating a user
@riverpod
Future<CreateUserResult> createUser(
  CreateUserRef ref,
  CreateUserInput input,
) async {
  final client = ref.watch(islClientProvider);
  return client.createUser(input);
}

/// Provider for getting a user by ID
@riverpod
Future<GetUserResult> getUser(GetUserRef ref, String userId) async {
  final client = ref.watch(islClientProvider);
  return client.getUser(userId);
}

/// Provider for updating a user
@riverpod
Future<UpdateUserResult> updateUser(
  UpdateUserRef ref,
  String userId,
  UpdateUserInput input,
) async {
  final client = ref.watch(islClientProvider);
  return client.updateUser(userId, input);
}

/// Provider for deleting a user
@riverpod
Future<DeleteUserResult> deleteUser(DeleteUserRef ref, String userId) async {
  final client = ref.watch(islClientProvider);
  return client.deleteUser(userId);
}

/// Provider for the current user
@riverpod
class CurrentUser extends _$CurrentUser {
  @override
  AsyncValue<User?> build() {
    return const AsyncValue.data(null);
  }

  Future<void> load(String userId) async {
    state = const AsyncValue.loading();

    final client = ref.read(islClientProvider);
    final result = await client.getUser(userId);

    state = result.when(
      success: (user) => AsyncValue.data(user),
      notFound: () => const AsyncValue.data(null),
      forbidden: () => AsyncValue.error(
        'Access denied',
        StackTrace.current,
      ),
    );
  }

  Future<void> update(UpdateUserInput input) async {
    final current = state.valueOrNull;
    if (current == null) return;

    state = const AsyncValue.loading();

    final client = ref.read(islClientProvider);
    final result = await client.updateUser(current.id, input);

    state = result.when(
      success: (user) => AsyncValue.data(user),
      notFound: () => const AsyncValue.data(null),
      duplicateEmail: () => AsyncValue.error(
        'Email already exists',
        StackTrace.current,
      ),
      duplicateUsername: () => AsyncValue.error(
        'Username already exists',
        StackTrace.current,
      ),
      invalidInput: (msg) => AsyncValue.error(msg, StackTrace.current),
      forbidden: () => AsyncValue.error(
        'Access denied',
        StackTrace.current,
      ),
    );
  }

  void clear() {
    state = const AsyncValue.data(null);
  }
}

// ============================================================================
// AUTH PROVIDERS
// ============================================================================

/// Provider for authentication state
@riverpod
class AuthState extends _$AuthState {
  @override
  AsyncValue<AuthStateData> build() {
    _checkStoredSession();
    return const AsyncValue.data(AuthStateData.unauthenticated());
  }

  Future<void> _checkStoredSession() async {
    final storage = ref.read(secureStorageProvider);
    final token = await storage.getAccessToken();

    if (token != null) {
      state = const AsyncValue.data(AuthStateData.authenticated());
    }
  }

  Future<void> login(LoginInput input) async {
    state = const AsyncValue.loading();

    final client = ref.read(islClientProvider);
    final result = await client.login(input);

    state = result.when(
      success: (session, user) {
        ref.read(currentUserProvider.notifier).load(user.id);
        return AsyncValue.data(AuthStateData.authenticated(
          session: session,
          user: user,
        ));
      },
      invalidCredentials: () => AsyncValue.error(
        'Invalid credentials',
        StackTrace.current,
      ),
      accountLocked: (duration) => AsyncValue.error(
        'Account locked for ${duration.inMinutes} minutes',
        StackTrace.current,
      ),
      accountSuspended: () => AsyncValue.error(
        'Account suspended',
        StackTrace.current,
      ),
      mfaRequired: (token) => AsyncValue.data(
        AuthStateData.mfaRequired(mfaToken: token),
      ),
      rateLimited: (retry) => AsyncValue.error(
        'Too many attempts. Try again in ${retry.inSeconds}s',
        StackTrace.current,
      ),
    );
  }

  Future<void> logout() async {
    final client = ref.read(islClientProvider);
    await client.logout();
    ref.read(currentUserProvider.notifier).clear();
    state = const AsyncValue.data(AuthStateData.unauthenticated());
  }

  Future<void> refreshToken() async {
    final storage = ref.read(secureStorageProvider);
    final refreshToken = await storage.getRefreshToken();

    if (refreshToken == null) {
      state = const AsyncValue.data(AuthStateData.unauthenticated());
      return;
    }

    final client = ref.read(islClientProvider);
    final result = await client.refreshToken(
      RefreshTokenInput(refreshToken: refreshToken),
    );

    result.when(
      success: (session) {
        // Session tokens are already saved in the client
      },
      invalidToken: () {
        logout();
      },
      expired: () {
        logout();
      },
    );
  }
}

/// Authentication state data
class AuthStateData {
  final AuthStatus status;
  final Session? session;
  final User? user;
  final String? mfaToken;

  const AuthStateData._({
    required this.status,
    this.session,
    this.user,
    this.mfaToken,
  });

  const factory AuthStateData.unauthenticated() = _UnauthenticatedState;
  const factory AuthStateData.authenticated({Session? session, User? user}) =
      _AuthenticatedState;
  const factory AuthStateData.mfaRequired({required String mfaToken}) =
      _MfaRequiredState;

  bool get isAuthenticated => status == AuthStatus.authenticated;
  bool get isMfaRequired => status == AuthStatus.mfaRequired;
}

class _UnauthenticatedState extends AuthStateData {
  const _UnauthenticatedState()
      : super._(status: AuthStatus.unauthenticated);
}

class _AuthenticatedState extends AuthStateData {
  const _AuthenticatedState({super.session, super.user})
      : super._(status: AuthStatus.authenticated);
}

class _MfaRequiredState extends AuthStateData {
  const _MfaRequiredState({required String mfaToken})
      : super._(status: AuthStatus.mfaRequired, mfaToken: mfaToken);
}

enum AuthStatus {
  unauthenticated,
  authenticated,
  mfaRequired,
}

// ============================================================================
// REAL-TIME PROVIDERS
// ============================================================================

/// Provider for subscribing to user updates
@riverpod
Stream<User> userUpdates(UserUpdatesRef ref, String userId) async* {
  final wsClient = ref.watch(wsClientProvider);

  // Connect if not already connected
  if (!wsClient.isConnected) {
    await wsClient.connect();
  }

  final controller = StreamController<User>();

  await wsClient.subscribe('users:$userId', (message) {
    if (message.event == 'updated' && message.data != null) {
      final user = User.fromJson(message.data!);
      controller.add(user);
    }
  });

  ref.onDispose(() {
    wsClient.unsubscribe('users:$userId');
    controller.close();
  });

  yield* controller.stream;
}

// ============================================================================
// UTILITY PROVIDERS
// ============================================================================

/// Provider for checking if user is logged in
final isLoggedInProvider = Provider<bool>((ref) {
  final authState = ref.watch(authStateProvider);
  return authState.valueOrNull?.isAuthenticated ?? false;
});

/// Provider for current session
final currentSessionProvider = Provider<Session?>((ref) {
  final authState = ref.watch(authStateProvider);
  return authState.valueOrNull?.session;
});
