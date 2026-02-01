import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../client/api_client.dart';
import '../models/generated.dart';
import '../storage/secure_storage.dart';
import 'isl_provider.dart';

/// Authentication controller for managing auth state
class AuthController extends StateNotifier<AuthControllerState> {
  final ISLClient _client;
  final ISLSecureStorage _storage;
  Timer? _refreshTimer;

  AuthController({
    required ISLClient client,
    required ISLSecureStorage storage,
  })  : _client = client,
        _storage = storage,
        super(const AuthControllerState.initial()) {
    _initializeAuth();
  }

  Future<void> _initializeAuth() async {
    final token = await _storage.getAccessToken();
    if (token != null) {
      // Try to refresh to validate the session
      await _refreshSession();
    }
  }

  /// Login with email and password
  Future<LoginResult> login(String email, String password, {String? deviceId}) async {
    state = const AuthControllerState.loading();

    final result = await _client.login(LoginInput(
      email: email,
      password: password,
      deviceId: deviceId,
    ));

    result.when(
      success: (session, user) {
        state = AuthControllerState.authenticated(
          session: session,
          user: user,
        );
        _scheduleRefresh(session);
      },
      invalidCredentials: () {
        state = const AuthControllerState.error('Invalid email or password');
      },
      accountLocked: (duration) {
        state = AuthControllerState.error(
          'Account locked. Try again in ${duration.inMinutes} minutes',
        );
      },
      accountSuspended: () {
        state = const AuthControllerState.error('Account has been suspended');
      },
      mfaRequired: (token) {
        state = AuthControllerState.mfaRequired(mfaToken: token);
      },
      rateLimited: (retry) {
        state = AuthControllerState.error(
          'Too many attempts. Try again in ${retry.inSeconds} seconds',
        );
      },
    );

    return result;
  }

  /// Logout and clear session
  Future<void> logout() async {
    _refreshTimer?.cancel();
    await _client.logout();
    state = const AuthControllerState.unauthenticated();
  }

  /// Refresh the current session
  Future<void> refresh() async {
    await _refreshSession();
  }

  /// Request password reset
  Future<RequestPasswordResetResult> requestPasswordReset(String email) async {
    return _client.requestPasswordReset(
      RequestPasswordResetInput(email: email),
    );
  }

  /// Confirm password reset
  Future<ConfirmPasswordResetResult> confirmPasswordReset(
    String token,
    String newPassword,
  ) async {
    return _client.confirmPasswordReset(
      ConfirmPasswordResetInput(token: token, newPassword: newPassword),
    );
  }

  Future<void> _refreshSession() async {
    final refreshToken = await _storage.getRefreshToken();
    if (refreshToken == null) {
      state = const AuthControllerState.unauthenticated();
      return;
    }

    final result = await _client.refreshToken(
      RefreshTokenInput(refreshToken: refreshToken),
    );

    result.when(
      success: (session) {
        state = state.maybeWhen(
          authenticated: (_, user) => AuthControllerState.authenticated(
            session: session,
            user: user,
          ),
          orElse: () => AuthControllerState.authenticated(session: session),
        );
        _scheduleRefresh(session);
      },
      invalidToken: () {
        _storage.clearTokens();
        state = const AuthControllerState.unauthenticated();
      },
      expired: () {
        _storage.clearTokens();
        state = const AuthControllerState.unauthenticated();
      },
    );
  }

  void _scheduleRefresh(Session session) {
    _refreshTimer?.cancel();

    // Refresh 5 minutes before expiry
    final refreshIn = session.expiresAt
        .subtract(const Duration(minutes: 5))
        .difference(DateTime.now());

    if (refreshIn.isNegative) {
      _refreshSession();
    } else {
      _refreshTimer = Timer(refreshIn, _refreshSession);
    }
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }
}

/// State for AuthController
abstract class AuthControllerState {
  const AuthControllerState();

  const factory AuthControllerState.initial() = _InitialState;
  const factory AuthControllerState.loading() = _LoadingState;
  const factory AuthControllerState.unauthenticated() = _UnauthenticatedState;
  const factory AuthControllerState.authenticated({
    required Session session,
    User? user,
  }) = _AuthenticatedState;
  const factory AuthControllerState.mfaRequired({required String mfaToken}) =
      _MfaRequiredState;
  const factory AuthControllerState.error(String message) = _ErrorState;

  T when<T>({
    required T Function() initial,
    required T Function() loading,
    required T Function() unauthenticated,
    required T Function(Session session, User? user) authenticated,
    required T Function(String mfaToken) mfaRequired,
    required T Function(String message) error,
  });

  T maybeWhen<T>({
    T Function()? initial,
    T Function()? loading,
    T Function()? unauthenticated,
    T Function(Session session, User? user)? authenticated,
    T Function(String mfaToken)? mfaRequired,
    T Function(String message)? error,
    required T Function() orElse,
  });

  bool get isAuthenticated;
  bool get isLoading;
  Session? get session;
  User? get user;
}

class _InitialState extends AuthControllerState {
  const _InitialState();

  @override
  bool get isAuthenticated => false;

  @override
  bool get isLoading => true;

  @override
  Session? get session => null;

  @override
  User? get user => null;

  @override
  T when<T>({
    required T Function() initial,
    required T Function() loading,
    required T Function() unauthenticated,
    required T Function(Session session, User? user) authenticated,
    required T Function(String mfaToken) mfaRequired,
    required T Function(String message) error,
  }) =>
      initial();

  @override
  T maybeWhen<T>({
    T Function()? initial,
    T Function()? loading,
    T Function()? unauthenticated,
    T Function(Session session, User? user)? authenticated,
    T Function(String mfaToken)? mfaRequired,
    T Function(String message)? error,
    required T Function() orElse,
  }) =>
      initial?.call() ?? orElse();
}

class _LoadingState extends AuthControllerState {
  const _LoadingState();

  @override
  bool get isAuthenticated => false;

  @override
  bool get isLoading => true;

  @override
  Session? get session => null;

  @override
  User? get user => null;

  @override
  T when<T>({
    required T Function() initial,
    required T Function() loading,
    required T Function() unauthenticated,
    required T Function(Session session, User? user) authenticated,
    required T Function(String mfaToken) mfaRequired,
    required T Function(String message) error,
  }) =>
      loading();

  @override
  T maybeWhen<T>({
    T Function()? initial,
    T Function()? loading,
    T Function()? unauthenticated,
    T Function(Session session, User? user)? authenticated,
    T Function(String mfaToken)? mfaRequired,
    T Function(String message)? error,
    required T Function() orElse,
  }) =>
      loading?.call() ?? orElse();
}

class _UnauthenticatedState extends AuthControllerState {
  const _UnauthenticatedState();

  @override
  bool get isAuthenticated => false;

  @override
  bool get isLoading => false;

  @override
  Session? get session => null;

  @override
  User? get user => null;

  @override
  T when<T>({
    required T Function() initial,
    required T Function() loading,
    required T Function() unauthenticated,
    required T Function(Session session, User? user) authenticated,
    required T Function(String mfaToken) mfaRequired,
    required T Function(String message) error,
  }) =>
      unauthenticated();

  @override
  T maybeWhen<T>({
    T Function()? initial,
    T Function()? loading,
    T Function()? unauthenticated,
    T Function(Session session, User? user)? authenticated,
    T Function(String mfaToken)? mfaRequired,
    T Function(String message)? error,
    required T Function() orElse,
  }) =>
      unauthenticated?.call() ?? orElse();
}

class _AuthenticatedState extends AuthControllerState {
  @override
  final Session session;
  @override
  final User? user;

  const _AuthenticatedState({required this.session, this.user});

  @override
  bool get isAuthenticated => true;

  @override
  bool get isLoading => false;

  @override
  T when<T>({
    required T Function() initial,
    required T Function() loading,
    required T Function() unauthenticated,
    required T Function(Session session, User? user) authenticated,
    required T Function(String mfaToken) mfaRequired,
    required T Function(String message) error,
  }) =>
      authenticated(session, user);

  @override
  T maybeWhen<T>({
    T Function()? initial,
    T Function()? loading,
    T Function()? unauthenticated,
    T Function(Session session, User? user)? authenticated,
    T Function(String mfaToken)? mfaRequired,
    T Function(String message)? error,
    required T Function() orElse,
  }) =>
      authenticated?.call(session, user) ?? orElse();
}

class _MfaRequiredState extends AuthControllerState {
  final String mfaToken;

  const _MfaRequiredState({required this.mfaToken});

  @override
  bool get isAuthenticated => false;

  @override
  bool get isLoading => false;

  @override
  Session? get session => null;

  @override
  User? get user => null;

  @override
  T when<T>({
    required T Function() initial,
    required T Function() loading,
    required T Function() unauthenticated,
    required T Function(Session session, User? user) authenticated,
    required T Function(String mfaToken) mfaRequired,
    required T Function(String message) error,
  }) =>
      mfaRequired(mfaToken);

  @override
  T maybeWhen<T>({
    T Function()? initial,
    T Function()? loading,
    T Function()? unauthenticated,
    T Function(Session session, User? user)? authenticated,
    T Function(String mfaToken)? mfaRequired,
    T Function(String message)? error,
    required T Function() orElse,
  }) =>
      mfaRequired?.call(mfaToken) ?? orElse();
}

class _ErrorState extends AuthControllerState {
  final String message;

  const _ErrorState(this.message);

  @override
  bool get isAuthenticated => false;

  @override
  bool get isLoading => false;

  @override
  Session? get session => null;

  @override
  User? get user => null;

  @override
  T when<T>({
    required T Function() initial,
    required T Function() loading,
    required T Function() unauthenticated,
    required T Function(Session session, User? user) authenticated,
    required T Function(String mfaToken) mfaRequired,
    required T Function(String message) error,
  }) =>
      error(message);

  @override
  T maybeWhen<T>({
    T Function()? initial,
    T Function()? loading,
    T Function()? unauthenticated,
    T Function(Session session, User? user)? authenticated,
    T Function(String mfaToken)? mfaRequired,
    T Function(String message)? error,
    required T Function() orElse,
  }) =>
      error?.call(message) ?? orElse();
}

/// Provider for AuthController
final authControllerProvider =
    StateNotifierProvider<AuthController, AuthControllerState>((ref) {
  final client = ref.watch(islClientProvider);
  final storage = ref.watch(secureStorageProvider);

  return AuthController(client: client, storage: storage);
});
