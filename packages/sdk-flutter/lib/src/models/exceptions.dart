import 'package:meta/meta.dart';

/// Base exception for all ISL SDK errors
@immutable
sealed class ISLException implements Exception {
  final String message;
  final String? code;
  final Map<String, dynamic>? details;
  final StackTrace? stackTrace;

  const ISLException({
    required this.message,
    this.code,
    this.details,
    this.stackTrace,
  });

  @override
  String toString() => 'ISLException($code): $message';
}

/// Thrown when input validation fails (precondition violation)
@immutable
class ValidationException extends ISLException {
  final String field;
  final dynamic invalidValue;
  final List<String> constraints;

  const ValidationException({
    required super.message,
    required this.field,
    this.invalidValue,
    this.constraints = const [],
    super.code = 'VALIDATION_ERROR',
    super.details,
    super.stackTrace,
  });

  factory ValidationException.required(String field) => ValidationException(
        message: '$field is required',
        field: field,
        constraints: ['required'],
      );

  factory ValidationException.invalidFormat(String field, String expected) =>
      ValidationException(
        message: '$field has invalid format. Expected: $expected',
        field: field,
        constraints: ['format:$expected'],
      );

  factory ValidationException.outOfRange(
    String field, {
    num? min,
    num? max,
    num? actual,
  }) =>
      ValidationException(
        message: '$field must be between $min and $max',
        field: field,
        invalidValue: actual,
        constraints: [
          if (min != null) 'min:$min',
          if (max != null) 'max:$max',
        ],
      );

  @override
  String toString() => 'ValidationException($field): $message';
}

/// Thrown when a postcondition verification fails
@immutable
class ContractViolationException extends ISLException {
  final String contractType;
  final String expected;
  final String actual;

  const ContractViolationException({
    required super.message,
    required this.contractType,
    required this.expected,
    required this.actual,
    super.code = 'CONTRACT_VIOLATION',
    super.details,
    super.stackTrace,
  });

  factory ContractViolationException.postcondition({
    required String condition,
    required String expected,
    required String actual,
  }) =>
      ContractViolationException(
        message: 'Postcondition failed: $condition',
        contractType: 'postcondition',
        expected: expected,
        actual: actual,
      );

  factory ContractViolationException.invariant({
    required String condition,
    required String expected,
    required String actual,
  }) =>
      ContractViolationException(
        message: 'Invariant violated: $condition',
        contractType: 'invariant',
        expected: expected,
        actual: actual,
      );

  @override
  String toString() =>
      'ContractViolationException($contractType): expected $expected, got $actual';
}

/// Thrown when network operations fail
@immutable
class NetworkException extends ISLException {
  final int? statusCode;
  final String? url;
  final Duration? timeout;

  const NetworkException({
    required super.message,
    this.statusCode,
    this.url,
    this.timeout,
    super.code = 'NETWORK_ERROR',
    super.details,
    super.stackTrace,
  });

  factory NetworkException.timeout(String url, Duration timeout) =>
      NetworkException(
        message: 'Request timed out after ${timeout.inSeconds}s',
        url: url,
        timeout: timeout,
        code: 'TIMEOUT',
      );

  factory NetworkException.noConnection() => const NetworkException(
        message: 'No internet connection',
        code: 'NO_CONNECTION',
      );

  factory NetworkException.serverError(int statusCode, String? body) =>
      NetworkException(
        message: 'Server error: $statusCode',
        statusCode: statusCode,
        code: 'SERVER_ERROR',
        details: body != null ? {'body': body} : null,
      );

  bool get isTimeout => code == 'TIMEOUT';
  bool get isNoConnection => code == 'NO_CONNECTION';
  bool get isServerError => statusCode != null && statusCode! >= 500;

  @override
  String toString() => 'NetworkException($code): $message';
}

/// Thrown when authentication fails
@immutable
class AuthenticationException extends ISLException {
  final AuthFailureReason reason;

  const AuthenticationException({
    required super.message,
    required this.reason,
    super.code = 'AUTH_ERROR',
    super.details,
    super.stackTrace,
  });

  factory AuthenticationException.invalidCredentials() =>
      const AuthenticationException(
        message: 'Invalid credentials',
        reason: AuthFailureReason.invalidCredentials,
      );

  factory AuthenticationException.tokenExpired() =>
      const AuthenticationException(
        message: 'Authentication token has expired',
        reason: AuthFailureReason.tokenExpired,
      );

  factory AuthenticationException.refreshFailed() =>
      const AuthenticationException(
        message: 'Failed to refresh authentication token',
        reason: AuthFailureReason.refreshFailed,
      );

  factory AuthenticationException.unauthorized() =>
      const AuthenticationException(
        message: 'Unauthorized access',
        reason: AuthFailureReason.unauthorized,
      );

  @override
  String toString() => 'AuthenticationException($reason): $message';
}

enum AuthFailureReason {
  invalidCredentials,
  tokenExpired,
  refreshFailed,
  unauthorized,
  mfaRequired,
  accountLocked,
}

/// Thrown when rate limiting is triggered
@immutable
class RateLimitException extends ISLException {
  final Duration retryAfter;
  final int? limit;
  final int? remaining;
  final DateTime? resetAt;

  const RateLimitException({
    required super.message,
    required this.retryAfter,
    this.limit,
    this.remaining,
    this.resetAt,
    super.code = 'RATE_LIMITED',
    super.details,
    super.stackTrace,
  });

  factory RateLimitException.fromHeaders(Map<String, dynamic> headers) {
    final retryAfterSecs =
        int.tryParse(headers['Retry-After']?.toString() ?? '60') ?? 60;
    final limit = int.tryParse(headers['X-RateLimit-Limit']?.toString() ?? '');
    final remaining =
        int.tryParse(headers['X-RateLimit-Remaining']?.toString() ?? '');
    final resetTimestamp =
        int.tryParse(headers['X-RateLimit-Reset']?.toString() ?? '');

    return RateLimitException(
      message: 'Rate limit exceeded. Retry after ${retryAfterSecs}s',
      retryAfter: Duration(seconds: retryAfterSecs),
      limit: limit,
      remaining: remaining,
      resetAt: resetTimestamp != null
          ? DateTime.fromMillisecondsSinceEpoch(resetTimestamp * 1000)
          : null,
    );
  }

  @override
  String toString() =>
      'RateLimitException: retry after ${retryAfter.inSeconds}s';
}
