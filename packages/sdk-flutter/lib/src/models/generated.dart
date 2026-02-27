import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:meta/meta.dart';
import 'exceptions.dart';

part 'generated.freezed.dart';
part 'generated.g.dart';

// ============================================================================
// VALUE OBJECTS - Type-safe wrappers with validation
// ============================================================================

/// Validated email address
@immutable
class Email {
  final String value;

  Email(this.value) {
    if (!_emailRegex.hasMatch(value)) {
      throw ValidationException(
        message: 'Invalid email format',
        field: 'email',
        invalidValue: value,
        constraints: ['format:email'],
      );
    }
    if (value.length > 254) {
      throw ValidationException(
        message: 'Email exceeds maximum length of 254 characters',
        field: 'email',
        invalidValue: value,
        constraints: ['maxLength:254'],
      );
    }
  }

  static final _emailRegex = RegExp(
    r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
  );

  static bool isValid(String value) => _emailRegex.hasMatch(value);

  @override
  String toString() => value;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Email &&
          runtimeType == other.runtimeType &&
          value.toLowerCase() == other.value.toLowerCase();

  @override
  int get hashCode => value.toLowerCase().hashCode;

  Map<String, dynamic> toJson() => {'value': value};

  factory Email.fromJson(Map<String, dynamic> json) =>
      Email(json['value'] as String);
}

/// Validated username
@immutable
class Username {
  final String value;

  static const int minLength = 3;
  static const int maxLength = 30;
  static final _usernameRegex = RegExp(r'^[a-zA-Z0-9_-]+$');

  Username(this.value) {
    if (value.length < minLength) {
      throw ValidationException(
        message: 'Username must be at least $minLength characters',
        field: 'username',
        invalidValue: value,
        constraints: ['minLength:$minLength'],
      );
    }
    if (value.length > maxLength) {
      throw ValidationException(
        message: 'Username cannot exceed $maxLength characters',
        field: 'username',
        invalidValue: value,
        constraints: ['maxLength:$maxLength'],
      );
    }
    if (!_usernameRegex.hasMatch(value)) {
      throw ValidationException(
        message: 'Username can only contain letters, numbers, underscores, and hyphens',
        field: 'username',
        invalidValue: value,
        constraints: ['pattern:alphanumeric_underscore_hyphen'],
      );
    }
  }

  static bool isValid(String value) =>
      value.length >= minLength &&
      value.length <= maxLength &&
      _usernameRegex.hasMatch(value);

  @override
  String toString() => value;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Username &&
          runtimeType == other.runtimeType &&
          value.toLowerCase() == other.value.toLowerCase();

  @override
  int get hashCode => value.toLowerCase().hashCode;
}

/// Validated UUID
@immutable
class UserId {
  final String value;

  static final _uuidRegex = RegExp(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
    caseSensitive: false,
  );

  UserId(this.value) {
    if (!_uuidRegex.hasMatch(value)) {
      throw ValidationException(
        message: 'Invalid UUID format',
        field: 'userId',
        invalidValue: value,
        constraints: ['format:uuid'],
      );
    }
  }

  static bool isValid(String value) => _uuidRegex.hasMatch(value);

  @override
  String toString() => value;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is UserId &&
          runtimeType == other.runtimeType &&
          value.toLowerCase() == other.value.toLowerCase();

  @override
  int get hashCode => value.toLowerCase().hashCode;
}

// ============================================================================
// ENUMS
// ============================================================================

/// User account status
enum UserStatus {
  @JsonValue('PENDING')
  pending,
  @JsonValue('ACTIVE')
  active,
  @JsonValue('SUSPENDED')
  suspended,
  @JsonValue('DELETED')
  deleted,
}

/// Session status
enum SessionStatus {
  @JsonValue('ACTIVE')
  active,
  @JsonValue('EXPIRED')
  expired,
  @JsonValue('REVOKED')
  revoked,
}

/// Authentication method
enum AuthMethod {
  @JsonValue('PASSWORD')
  password,
  @JsonValue('OAUTH')
  oauth,
  @JsonValue('MFA')
  mfa,
  @JsonValue('API_KEY')
  apiKey,
}

// ============================================================================
// ENTITIES
// ============================================================================

/// User entity
@freezed
class User with _$User {
  const User._();

  const factory User({
    required String id,
    required String email,
    required String username,
    required UserStatus status,
    required DateTime createdAt,
    required DateTime updatedAt,
    String? displayName,
    String? avatarUrl,
    Map<String, dynamic>? metadata,
  }) = _User;

  factory User.fromJson(Map<String, dynamic> json) => _$UserFromJson(json);

  /// Check if user account is active
  bool get isActive => status == UserStatus.active;

  /// Check if user account is pending verification
  bool get isPending => status == UserStatus.pending;

  /// Check if user account is suspended
  bool get isSuspended => status == UserStatus.suspended;

  /// Get display name or fallback to username
  String get effectiveDisplayName => displayName ?? username;
}

/// Session entity
@freezed
class Session with _$Session {
  const Session._();

  const factory Session({
    required String id,
    required String userId,
    required String accessToken,
    required String refreshToken,
    required DateTime expiresAt,
    required DateTime createdAt,
    required SessionStatus status,
    String? deviceId,
    String? ipAddress,
    String? userAgent,
  }) = _Session;

  factory Session.fromJson(Map<String, dynamic> json) => _$SessionFromJson(json);

  /// Check if session is still valid
  bool get isValid =>
      status == SessionStatus.active && DateTime.now().isBefore(expiresAt);

  /// Check if session needs refresh (within 5 minutes of expiry)
  bool get needsRefresh =>
      isValid && DateTime.now().isAfter(expiresAt.subtract(const Duration(minutes: 5)));

  /// Time until session expires
  Duration get timeUntilExpiry => expiresAt.difference(DateTime.now());
}

/// API key entity
@freezed
class ApiKey with _$ApiKey {
  const ApiKey._();

  const factory ApiKey({
    required String id,
    required String name,
    required String prefix,
    required List<String> scopes,
    required DateTime createdAt,
    DateTime? expiresAt,
    DateTime? lastUsedAt,
  }) = _ApiKey;

  factory ApiKey.fromJson(Map<String, dynamic> json) => _$ApiKeyFromJson(json);

  bool get isExpired =>
      expiresAt != null && DateTime.now().isAfter(expiresAt!);
}

// ============================================================================
// BEHAVIOR INPUTS
// ============================================================================

/// Input for creating a new user
@freezed
class CreateUserInput with _$CreateUserInput {
  const CreateUserInput._();

  const factory CreateUserInput({
    required String email,
    required String username,
    String? displayName,
    Map<String, dynamic>? metadata,
  }) = _CreateUserInput;

  factory CreateUserInput.fromJson(Map<String, dynamic> json) =>
      _$CreateUserInputFromJson(json);

  /// Validate input against preconditions
  void validate() {
    Email(email); // Will throw ValidationException if invalid
    Username(username); // Will throw ValidationException if invalid
  }
}

/// Input for updating a user
@freezed
class UpdateUserInput with _$UpdateUserInput {
  const factory UpdateUserInput({
    String? email,
    String? username,
    String? displayName,
    String? avatarUrl,
    Map<String, dynamic>? metadata,
  }) = _UpdateUserInput;

  factory UpdateUserInput.fromJson(Map<String, dynamic> json) =>
      _$UpdateUserInputFromJson(json);
}

/// Input for login
@freezed
class LoginInput with _$LoginInput {
  const factory LoginInput({
    required String email,
    required String password,
    String? deviceId,
    bool? rememberMe,
  }) = _LoginInput;

  factory LoginInput.fromJson(Map<String, dynamic> json) =>
      _$LoginInputFromJson(json);
}

/// Input for token refresh
@freezed
class RefreshTokenInput with _$RefreshTokenInput {
  const factory RefreshTokenInput({
    required String refreshToken,
  }) = _RefreshTokenInput;

  factory RefreshTokenInput.fromJson(Map<String, dynamic> json) =>
      _$RefreshTokenInputFromJson(json);
}

/// Input for password reset request
@freezed
class RequestPasswordResetInput with _$RequestPasswordResetInput {
  const factory RequestPasswordResetInput({
    required String email,
  }) = _RequestPasswordResetInput;

  factory RequestPasswordResetInput.fromJson(Map<String, dynamic> json) =>
      _$RequestPasswordResetInputFromJson(json);
}

/// Input for confirming password reset
@freezed
class ConfirmPasswordResetInput with _$ConfirmPasswordResetInput {
  const factory ConfirmPasswordResetInput({
    required String token,
    required String newPassword,
  }) = _ConfirmPasswordResetInput;

  factory ConfirmPasswordResetInput.fromJson(Map<String, dynamic> json) =>
      _$ConfirmPasswordResetInputFromJson(json);
}

// ============================================================================
// BEHAVIOR RESULTS (Sealed Union Types)
// ============================================================================

/// Result of creating a user
@freezed
sealed class CreateUserResult with _$CreateUserResult {
  const factory CreateUserResult.success(User user) = CreateUserSuccess;
  const factory CreateUserResult.duplicateEmail() = CreateUserDuplicateEmail;
  const factory CreateUserResult.duplicateUsername() = CreateUserDuplicateUsername;
  const factory CreateUserResult.invalidInput(String message) = CreateUserInvalidInput;
  const factory CreateUserResult.rateLimited(Duration retryAfter) = CreateUserRateLimited;
}

/// Result of updating a user
@freezed
sealed class UpdateUserResult with _$UpdateUserResult {
  const factory UpdateUserResult.success(User user) = UpdateUserSuccess;
  const factory UpdateUserResult.notFound() = UpdateUserNotFound;
  const factory UpdateUserResult.duplicateEmail() = UpdateUserDuplicateEmail;
  const factory UpdateUserResult.duplicateUsername() = UpdateUserDuplicateUsername;
  const factory UpdateUserResult.invalidInput(String message) = UpdateUserInvalidInput;
  const factory UpdateUserResult.forbidden() = UpdateUserForbidden;
}

/// Result of getting a user
@freezed
sealed class GetUserResult with _$GetUserResult {
  const factory GetUserResult.success(User user) = GetUserSuccess;
  const factory GetUserResult.notFound() = GetUserNotFound;
  const factory GetUserResult.forbidden() = GetUserForbidden;
}

/// Result of deleting a user
@freezed
sealed class DeleteUserResult with _$DeleteUserResult {
  const factory DeleteUserResult.success() = DeleteUserSuccess;
  const factory DeleteUserResult.notFound() = DeleteUserNotFound;
  const factory DeleteUserResult.forbidden() = DeleteUserForbidden;
}

/// Result of login
@freezed
sealed class LoginResult with _$LoginResult {
  const factory LoginResult.success(Session session, User user) = LoginSuccess;
  const factory LoginResult.invalidCredentials() = LoginInvalidCredentials;
  const factory LoginResult.accountLocked(Duration lockDuration) = LoginAccountLocked;
  const factory LoginResult.accountSuspended() = LoginAccountSuspended;
  const factory LoginResult.mfaRequired(String mfaToken) = LoginMfaRequired;
  const factory LoginResult.rateLimited(Duration retryAfter) = LoginRateLimited;
}

/// Result of token refresh
@freezed
sealed class RefreshTokenResult with _$RefreshTokenResult {
  const factory RefreshTokenResult.success(Session session) = RefreshTokenSuccess;
  const factory RefreshTokenResult.invalidToken() = RefreshTokenInvalid;
  const factory RefreshTokenResult.expired() = RefreshTokenExpired;
}

/// Result of logout
@freezed
sealed class LogoutResult with _$LogoutResult {
  const factory LogoutResult.success() = LogoutSuccess;
  const factory LogoutResult.invalidSession() = LogoutInvalidSession;
}

/// Result of password reset request
@freezed
sealed class RequestPasswordResetResult with _$RequestPasswordResetResult {
  const factory RequestPasswordResetResult.success() = RequestPasswordResetSuccess;
  const factory RequestPasswordResetResult.userNotFound() = RequestPasswordResetUserNotFound;
  const factory RequestPasswordResetResult.rateLimited(Duration retryAfter) =
      RequestPasswordResetRateLimited;
}

/// Result of password reset confirmation
@freezed
sealed class ConfirmPasswordResetResult with _$ConfirmPasswordResetResult {
  const factory ConfirmPasswordResetResult.success() = ConfirmPasswordResetSuccess;
  const factory ConfirmPasswordResetResult.invalidToken() = ConfirmPasswordResetInvalidToken;
  const factory ConfirmPasswordResetResult.expiredToken() = ConfirmPasswordResetExpiredToken;
  const factory ConfirmPasswordResetResult.weakPassword(List<String> requirements) =
      ConfirmPasswordResetWeakPassword;
}
