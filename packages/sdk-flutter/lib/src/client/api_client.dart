import 'package:dio/dio.dart';
import 'package:logger/logger.dart';
import 'package:meta/meta.dart';

import '../models/exceptions.dart';
import '../models/generated.dart';
import '../models/pagination.dart';
import '../storage/secure_storage.dart';
import '../validation/contracts.dart';
import 'interceptors.dart';

/// Configuration for ISL Client
@immutable
class ISLClientConfig {
  final String baseUrl;
  final Duration connectTimeout;
  final Duration receiveTimeout;
  final Duration sendTimeout;
  final bool enableVerification;
  final bool enableLogging;
  final int maxRetries;
  final Duration retryDelay;
  final Map<String, String>? defaultHeaders;

  const ISLClientConfig({
    required this.baseUrl,
    this.connectTimeout = const Duration(seconds: 30),
    this.receiveTimeout = const Duration(seconds: 30),
    this.sendTimeout = const Duration(seconds: 30),
    this.enableVerification = true,
    this.enableLogging = false,
    this.maxRetries = 3,
    this.retryDelay = const Duration(seconds: 1),
    this.defaultHeaders,
  });

  ISLClientConfig copyWith({
    String? baseUrl,
    Duration? connectTimeout,
    Duration? receiveTimeout,
    Duration? sendTimeout,
    bool? enableVerification,
    bool? enableLogging,
    int? maxRetries,
    Duration? retryDelay,
    Map<String, String>? defaultHeaders,
  }) {
    return ISLClientConfig(
      baseUrl: baseUrl ?? this.baseUrl,
      connectTimeout: connectTimeout ?? this.connectTimeout,
      receiveTimeout: receiveTimeout ?? this.receiveTimeout,
      sendTimeout: sendTimeout ?? this.sendTimeout,
      enableVerification: enableVerification ?? this.enableVerification,
      enableLogging: enableLogging ?? this.enableLogging,
      maxRetries: maxRetries ?? this.maxRetries,
      retryDelay: retryDelay ?? this.retryDelay,
      defaultHeaders: defaultHeaders ?? this.defaultHeaders,
    );
  }
}

/// Main ISL API Client with contract verification
class ISLClient {
  final Dio _dio;
  final ISLClientConfig config;
  final ISLSecureStorage _storage;
  final ContractVerifier _contractVerifier;
  final Logger _logger;

  ISLClient({
    required this.config,
    ISLSecureStorage? storage,
    Dio? dio,
    Logger? logger,
  })  : _storage = storage ?? ISLSecureStorage(),
        _dio = dio ?? Dio(),
        _contractVerifier = ContractVerifier(enabled: config.enableVerification),
        _logger = logger ?? Logger(level: config.enableLogging ? Level.debug : Level.off) {
    _setupDio();
  }

  /// Factory constructor with just base URL
  factory ISLClient.simple(String baseUrl) {
    return ISLClient(config: ISLClientConfig(baseUrl: baseUrl));
  }

  void _setupDio() {
    _dio.options = BaseOptions(
      baseUrl: config.baseUrl,
      connectTimeout: config.connectTimeout,
      receiveTimeout: config.receiveTimeout,
      sendTimeout: config.sendTimeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...?config.defaultHeaders,
      },
    );

    _dio.interceptors.addAll([
      AuthInterceptor(storage: _storage),
      RetryInterceptor(
        dio: _dio,
        maxRetries: config.maxRetries,
        retryDelay: config.retryDelay,
      ),
      if (config.enableLogging)
        LogInterceptor(
          requestHeader: true,
          requestBody: true,
          responseHeader: true,
          responseBody: true,
          logPrint: (o) => _logger.d(o.toString()),
        ),
    ]);
  }

  // ============================================================================
  // USER BEHAVIORS
  // ============================================================================

  /// Create a new user
  ///
  /// ## Preconditions
  /// - email must be a valid email address
  /// - username must be 3-30 characters, alphanumeric with underscore/hyphen
  ///
  /// ## Postconditions
  /// - User is created with PENDING status
  /// - User email matches input email
  /// - User username matches input username
  /// - createdAt is set to current time
  Future<CreateUserResult> createUser(CreateUserInput input) async {
    // Verify preconditions
    try {
      input.validate();
    } on ValidationException catch (e) {
      return CreateUserResult.invalidInput(e.message);
    }

    try {
      final response = await _dio.post('/api/users', data: input.toJson());
      final user = User.fromJson(response.data);

      // Verify postconditions
      _contractVerifier.verifyPostconditions('createUser', [
        PostconditionCheck(
          name: 'email_matches',
          condition: () => user.email == input.email,
          expected: input.email,
          actual: user.email,
        ),
        PostconditionCheck(
          name: 'username_matches',
          condition: () => user.username == input.username,
          expected: input.username,
          actual: user.username,
        ),
        PostconditionCheck(
          name: 'status_pending',
          condition: () => user.status == UserStatus.pending,
          expected: 'PENDING',
          actual: user.status.name,
        ),
      ]);

      return CreateUserResult.success(user);
    } on DioException catch (e) {
      return _handleCreateUserError(e);
    }
  }

  /// Get a user by ID
  ///
  /// ## Preconditions
  /// - userId must be a valid UUID
  ///
  /// ## Postconditions
  /// - Returned user ID matches requested ID
  Future<GetUserResult> getUser(String userId) async {
    // Verify preconditions
    if (!UserId.isValid(userId)) {
      return const GetUserResult.notFound();
    }

    try {
      final response = await _dio.get('/api/users/$userId');
      final user = User.fromJson(response.data);

      // Verify postconditions
      _contractVerifier.verifyPostconditions('getUser', [
        PostconditionCheck(
          name: 'id_matches',
          condition: () => user.id == userId,
          expected: userId,
          actual: user.id,
        ),
      ]);

      return GetUserResult.success(user);
    } on DioException catch (e) {
      return _handleGetUserError(e);
    }
  }

  /// Update a user
  ///
  /// ## Preconditions
  /// - userId must be a valid UUID
  /// - If email provided, must be valid email format
  /// - If username provided, must be 3-30 characters
  ///
  /// ## Postconditions
  /// - User ID unchanged
  /// - Updated fields reflect input values
  /// - updatedAt is newer than before
  Future<UpdateUserResult> updateUser(String userId, UpdateUserInput input) async {
    // Verify preconditions
    if (!UserId.isValid(userId)) {
      return const UpdateUserResult.notFound();
    }

    if (input.email != null && !Email.isValid(input.email!)) {
      return const UpdateUserResult.invalidInput('Invalid email format');
    }

    if (input.username != null && !Username.isValid(input.username!)) {
      return const UpdateUserResult.invalidInput('Username must be 3-30 characters');
    }

    try {
      final response = await _dio.patch(
        '/api/users/$userId',
        data: input.toJson(),
      );
      final user = User.fromJson(response.data);

      // Verify postconditions
      _contractVerifier.verifyPostconditions('updateUser', [
        PostconditionCheck(
          name: 'id_unchanged',
          condition: () => user.id == userId,
          expected: userId,
          actual: user.id,
        ),
        if (input.email != null)
          PostconditionCheck(
            name: 'email_updated',
            condition: () => user.email == input.email,
            expected: input.email!,
            actual: user.email,
          ),
        if (input.username != null)
          PostconditionCheck(
            name: 'username_updated',
            condition: () => user.username == input.username,
            expected: input.username!,
            actual: user.username,
          ),
      ]);

      return UpdateUserResult.success(user);
    } on DioException catch (e) {
      return _handleUpdateUserError(e);
    }
  }

  /// Delete a user
  ///
  /// ## Preconditions
  /// - userId must be a valid UUID
  /// - User must exist
  ///
  /// ## Postconditions
  /// - User no longer exists (or is marked as deleted)
  Future<DeleteUserResult> deleteUser(String userId) async {
    if (!UserId.isValid(userId)) {
      return const DeleteUserResult.notFound();
    }

    try {
      await _dio.delete('/api/users/$userId');
      return const DeleteUserResult.success();
    } on DioException catch (e) {
      return _handleDeleteUserError(e);
    }
  }

  /// List users with pagination
  Future<PaginatedResponse<User>> listUsers({
    PaginationParams? pagination,
    UserStatus? status,
  }) async {
    final params = pagination ?? const PaginationParams();

    final response = await _dio.get(
      '/api/users',
      queryParameters: {
        ...params.toQueryParams(),
        if (status != null) 'status': status.name,
      },
    );

    return PaginatedResponse.fromJson(
      response.data,
      (json) => User.fromJson(json as Map<String, dynamic>),
    );
  }

  // ============================================================================
  // AUTHENTICATION BEHAVIORS
  // ============================================================================

  /// Login with email and password
  ///
  /// ## Preconditions
  /// - email must be a valid email
  /// - password must not be empty
  ///
  /// ## Postconditions
  /// - Session is created with ACTIVE status
  /// - Session has valid access and refresh tokens
  /// - Session expiresAt is in the future
  Future<LoginResult> login(LoginInput input) async {
    try {
      final response = await _dio.post('/api/auth/login', data: input.toJson());

      final session = Session.fromJson(response.data['session']);
      final user = User.fromJson(response.data['user']);

      // Store tokens
      await _storage.saveTokens(
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      );

      // Verify postconditions
      _contractVerifier.verifyPostconditions('login', [
        PostconditionCheck(
          name: 'session_active',
          condition: () => session.status == SessionStatus.active,
          expected: 'ACTIVE',
          actual: session.status.name,
        ),
        PostconditionCheck(
          name: 'session_valid',
          condition: () => session.isValid,
          expected: 'true',
          actual: session.isValid.toString(),
        ),
        PostconditionCheck(
          name: 'expires_in_future',
          condition: () => session.expiresAt.isAfter(DateTime.now()),
          expected: 'future date',
          actual: session.expiresAt.toIso8601String(),
        ),
      ]);

      return LoginResult.success(session, user);
    } on DioException catch (e) {
      return _handleLoginError(e);
    }
  }

  /// Refresh authentication token
  ///
  /// ## Preconditions
  /// - refreshToken must be valid and not expired
  ///
  /// ## Postconditions
  /// - New session is created
  /// - New session has extended expiration
  Future<RefreshTokenResult> refreshToken(RefreshTokenInput input) async {
    try {
      final response = await _dio.post(
        '/api/auth/refresh',
        data: input.toJson(),
      );

      final session = Session.fromJson(response.data);

      // Update stored tokens
      await _storage.saveTokens(
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      );

      return RefreshTokenResult.success(session);
    } on DioException catch (e) {
      return _handleRefreshError(e);
    }
  }

  /// Logout and invalidate session
  Future<LogoutResult> logout() async {
    try {
      final refreshToken = await _storage.getRefreshToken();
      if (refreshToken != null) {
        await _dio.post('/api/auth/logout', data: {'refreshToken': refreshToken});
      }
      await _storage.clearTokens();
      return const LogoutResult.success();
    } on DioException {
      // Clear tokens even if server request fails
      await _storage.clearTokens();
      return const LogoutResult.success();
    }
  }

  /// Request password reset email
  Future<RequestPasswordResetResult> requestPasswordReset(
    RequestPasswordResetInput input,
  ) async {
    try {
      await _dio.post('/api/auth/password-reset/request', data: input.toJson());
      return const RequestPasswordResetResult.success();
    } on DioException catch (e) {
      if (e.response?.statusCode == 429) {
        final retryAfter = _parseRetryAfter(e.response?.headers);
        return RequestPasswordResetResult.rateLimited(retryAfter);
      }
      // Don't reveal if user exists
      return const RequestPasswordResetResult.success();
    }
  }

  /// Confirm password reset
  Future<ConfirmPasswordResetResult> confirmPasswordReset(
    ConfirmPasswordResetInput input,
  ) async {
    try {
      await _dio.post('/api/auth/password-reset/confirm', data: input.toJson());
      return const ConfirmPasswordResetResult.success();
    } on DioException catch (e) {
      return _handlePasswordResetError(e);
    }
  }

  // ============================================================================
  // ERROR HANDLERS
  // ============================================================================

  CreateUserResult _handleCreateUserError(DioException e) {
    switch (e.response?.statusCode) {
      case 409:
        final field = e.response?.data?['field'];
        if (field == 'email') {
          return const CreateUserResult.duplicateEmail();
        }
        return const CreateUserResult.duplicateUsername();
      case 422:
        return CreateUserResult.invalidInput(
          e.response?.data?['message'] ?? 'Validation failed',
        );
      case 429:
        return CreateUserResult.rateLimited(_parseRetryAfter(e.response?.headers));
      default:
        return CreateUserResult.invalidInput(
          e.response?.data?['message'] ?? 'Unknown error',
        );
    }
  }

  GetUserResult _handleGetUserError(DioException e) {
    switch (e.response?.statusCode) {
      case 404:
        return const GetUserResult.notFound();
      case 403:
        return const GetUserResult.forbidden();
      default:
        return const GetUserResult.notFound();
    }
  }

  UpdateUserResult _handleUpdateUserError(DioException e) {
    switch (e.response?.statusCode) {
      case 404:
        return const UpdateUserResult.notFound();
      case 403:
        return const UpdateUserResult.forbidden();
      case 409:
        final field = e.response?.data?['field'];
        if (field == 'email') {
          return const UpdateUserResult.duplicateEmail();
        }
        return const UpdateUserResult.duplicateUsername();
      case 422:
        return UpdateUserResult.invalidInput(
          e.response?.data?['message'] ?? 'Validation failed',
        );
      default:
        return UpdateUserResult.invalidInput(
          e.response?.data?['message'] ?? 'Unknown error',
        );
    }
  }

  DeleteUserResult _handleDeleteUserError(DioException e) {
    switch (e.response?.statusCode) {
      case 404:
        return const DeleteUserResult.notFound();
      case 403:
        return const DeleteUserResult.forbidden();
      default:
        return const DeleteUserResult.notFound();
    }
  }

  LoginResult _handleLoginError(DioException e) {
    switch (e.response?.statusCode) {
      case 401:
        return const LoginResult.invalidCredentials();
      case 403:
        final reason = e.response?.data?['reason'];
        if (reason == 'locked') {
          final duration = Duration(
            seconds: e.response?.data?['lockDuration'] ?? 900,
          );
          return LoginResult.accountLocked(duration);
        }
        return const LoginResult.accountSuspended();
      case 428:
        final mfaToken = e.response?.data?['mfaToken'] ?? '';
        return LoginResult.mfaRequired(mfaToken);
      case 429:
        return LoginResult.rateLimited(_parseRetryAfter(e.response?.headers));
      default:
        return const LoginResult.invalidCredentials();
    }
  }

  RefreshTokenResult _handleRefreshError(DioException e) {
    switch (e.response?.statusCode) {
      case 401:
        return const RefreshTokenResult.invalidToken();
      case 410:
        return const RefreshTokenResult.expired();
      default:
        return const RefreshTokenResult.invalidToken();
    }
  }

  ConfirmPasswordResetResult _handlePasswordResetError(DioException e) {
    switch (e.response?.statusCode) {
      case 400:
        final code = e.response?.data?['code'];
        if (code == 'INVALID_TOKEN') {
          return const ConfirmPasswordResetResult.invalidToken();
        }
        if (code == 'EXPIRED_TOKEN') {
          return const ConfirmPasswordResetResult.expiredToken();
        }
        if (code == 'WEAK_PASSWORD') {
          final requirements =
              (e.response?.data?['requirements'] as List?)?.cast<String>() ?? [];
          return ConfirmPasswordResetResult.weakPassword(requirements);
        }
        return const ConfirmPasswordResetResult.invalidToken();
      case 410:
        return const ConfirmPasswordResetResult.expiredToken();
      default:
        return const ConfirmPasswordResetResult.invalidToken();
    }
  }

  Duration _parseRetryAfter(Headers? headers) {
    final value = headers?.value('Retry-After');
    final seconds = int.tryParse(value ?? '60') ?? 60;
    return Duration(seconds: seconds);
  }

  /// Close the client and clean up resources
  void dispose() {
    _dio.close();
  }
}
