import 'dart:async';
import 'package:dio/dio.dart';
import 'package:logger/logger.dart';

import '../models/exceptions.dart';
import '../storage/secure_storage.dart';

/// Interceptor for handling authentication headers and token refresh
class AuthInterceptor extends Interceptor {
  final ISLSecureStorage storage;
  final Logger _logger;
  bool _isRefreshing = false;
  final List<_RequestRetry> _pendingRequests = [];

  AuthInterceptor({
    required this.storage,
    Logger? logger,
  }) : _logger = logger ?? Logger(level: Level.off);

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    // Skip auth for login/register endpoints
    if (_isAuthEndpoint(options.path)) {
      return handler.next(options);
    }

    final token = await storage.getAccessToken();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }

    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    if (err.response?.statusCode != 401) {
      return handler.next(err);
    }

    // Skip if already handling auth error on auth endpoint
    if (_isAuthEndpoint(err.requestOptions.path)) {
      return handler.next(err);
    }

    // Queue request for retry after token refresh
    if (_isRefreshing) {
      return _queueRequest(err, handler);
    }

    _isRefreshing = true;

    try {
      final refreshToken = await storage.getRefreshToken();
      if (refreshToken == null) {
        _rejectPendingRequests(err);
        return handler.next(err);
      }

      // Attempt token refresh
      final dio = Dio(BaseOptions(
        baseUrl: err.requestOptions.baseUrl,
      ));

      final response = await dio.post(
        '/api/auth/refresh',
        data: {'refreshToken': refreshToken},
      );

      final newAccessToken = response.data['accessToken'] as String;
      final newRefreshToken = response.data['refreshToken'] as String;

      await storage.saveTokens(
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      );

      // Retry original request
      err.requestOptions.headers['Authorization'] = 'Bearer $newAccessToken';

      final retryDio = Dio(BaseOptions(
        baseUrl: err.requestOptions.baseUrl,
      ));

      final retryResponse = await retryDio.fetch(err.requestOptions);
      
      // Retry pending requests
      _retryPendingRequests(newAccessToken);

      return handler.resolve(retryResponse);
    } on DioException catch (refreshError) {
      _logger.w('Token refresh failed: ${refreshError.message}');
      await storage.clearTokens();
      _rejectPendingRequests(err);
      return handler.next(err);
    } finally {
      _isRefreshing = false;
    }
  }

  bool _isAuthEndpoint(String path) {
    return path.contains('/auth/login') ||
        path.contains('/auth/register') ||
        path.contains('/auth/refresh');
  }

  void _queueRequest(DioException err, ErrorInterceptorHandler handler) {
    _pendingRequests.add(_RequestRetry(
      requestOptions: err.requestOptions,
      handler: handler,
    ));
  }

  void _retryPendingRequests(String newToken) {
    for (final pending in _pendingRequests) {
      pending.requestOptions.headers['Authorization'] = 'Bearer $newToken';
      // Note: In a real implementation, you'd retry these requests
    }
    _pendingRequests.clear();
  }

  void _rejectPendingRequests(DioException error) {
    for (final pending in _pendingRequests) {
      pending.handler.next(error);
    }
    _pendingRequests.clear();
  }
}

class _RequestRetry {
  final RequestOptions requestOptions;
  final ErrorInterceptorHandler handler;

  _RequestRetry({
    required this.requestOptions,
    required this.handler,
  });
}

/// Interceptor for automatic request retries with exponential backoff
class RetryInterceptor extends Interceptor {
  final Dio dio;
  final int maxRetries;
  final Duration retryDelay;
  final Set<int> retryableStatusCodes;
  final Logger _logger;

  RetryInterceptor({
    required this.dio,
    this.maxRetries = 3,
    this.retryDelay = const Duration(seconds: 1),
    this.retryableStatusCodes = const {408, 500, 502, 503, 504},
    Logger? logger,
  }) : _logger = logger ?? Logger(level: Level.off);

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final attempt = err.requestOptions.extra['retryAttempt'] as int? ?? 0;

    if (!_shouldRetry(err, attempt)) {
      return handler.next(err);
    }

    final nextAttempt = attempt + 1;
    final delay = retryDelay * (1 << attempt); // Exponential backoff

    _logger.d('Retrying request (attempt $nextAttempt/$maxRetries) after ${delay.inMilliseconds}ms');

    await Future.delayed(delay);

    try {
      err.requestOptions.extra['retryAttempt'] = nextAttempt;
      final response = await dio.fetch(err.requestOptions);
      return handler.resolve(response);
    } on DioException catch (e) {
      return handler.next(e);
    }
  }

  bool _shouldRetry(DioException err, int attempt) {
    if (attempt >= maxRetries) return false;

    // Retry on connection errors
    if (err.type == DioExceptionType.connectionTimeout ||
        err.type == DioExceptionType.receiveTimeout ||
        err.type == DioExceptionType.sendTimeout ||
        err.type == DioExceptionType.connectionError) {
      return true;
    }

    // Retry on specific status codes
    final statusCode = err.response?.statusCode;
    if (statusCode != null && retryableStatusCodes.contains(statusCode)) {
      return true;
    }

    return false;
  }
}

/// Interceptor for rate limit handling
class RateLimitInterceptor extends Interceptor {
  final Duration defaultWait;
  final Logger _logger;
  DateTime? _rateLimitedUntil;

  RateLimitInterceptor({
    this.defaultWait = const Duration(seconds: 60),
    Logger? logger,
  }) : _logger = logger ?? Logger(level: Level.off);

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    if (_rateLimitedUntil != null && DateTime.now().isBefore(_rateLimitedUntil!)) {
      final waitTime = _rateLimitedUntil!.difference(DateTime.now());
      _logger.w('Rate limited. Waiting ${waitTime.inSeconds}s');
      
      throw DioException(
        requestOptions: options,
        error: RateLimitException(
          message: 'Rate limited',
          retryAfter: waitTime,
        ),
        type: DioExceptionType.cancel,
      );
    }

    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (err.response?.statusCode == 429) {
      final retryAfter = _parseRetryAfter(err.response?.headers);
      _rateLimitedUntil = DateTime.now().add(retryAfter);
      _logger.w('Rate limit hit. Blocked until $_rateLimitedUntil');
    }

    handler.next(err);
  }

  Duration _parseRetryAfter(Headers? headers) {
    final value = headers?.value('Retry-After');
    final seconds = int.tryParse(value ?? '') ?? defaultWait.inSeconds;
    return Duration(seconds: seconds);
  }
}

/// Interceptor for request/response logging
class ISLLogInterceptor extends Interceptor {
  final Logger logger;
  final bool logRequestHeaders;
  final bool logRequestBody;
  final bool logResponseHeaders;
  final bool logResponseBody;
  final Set<String> sensitiveHeaders;

  ISLLogInterceptor({
    Logger? logger,
    this.logRequestHeaders = true,
    this.logRequestBody = true,
    this.logResponseHeaders = false,
    this.logResponseBody = true,
    this.sensitiveHeaders = const {'Authorization', 'Cookie', 'Set-Cookie'},
  }) : logger = logger ?? Logger();

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final buffer = StringBuffer();
    buffer.writeln('→ ${options.method} ${options.uri}');

    if (logRequestHeaders) {
      options.headers.forEach((key, value) {
        final displayValue = sensitiveHeaders.contains(key) ? '[REDACTED]' : value;
        buffer.writeln('  $key: $displayValue');
      });
    }

    if (logRequestBody && options.data != null) {
      buffer.writeln('  Body: ${options.data}');
    }

    logger.d(buffer.toString());
    handler.next(options);
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    final buffer = StringBuffer();
    buffer.writeln('← ${response.statusCode} ${response.requestOptions.uri}');

    if (logResponseHeaders) {
      response.headers.forEach((key, values) {
        final displayValue = sensitiveHeaders.contains(key) ? '[REDACTED]' : values.join(', ');
        buffer.writeln('  $key: $displayValue');
      });
    }

    if (logResponseBody && response.data != null) {
      buffer.writeln('  Body: ${response.data}');
    }

    logger.d(buffer.toString());
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    logger.e('✕ ${err.requestOptions.method} ${err.requestOptions.uri}\n'
        '  Error: ${err.message}\n'
        '  Status: ${err.response?.statusCode}');
    handler.next(err);
  }
}

/// Interceptor for adding custom headers
class CustomHeadersInterceptor extends Interceptor {
  final Map<String, String> Function()? headersProvider;
  final Map<String, String> staticHeaders;

  CustomHeadersInterceptor({
    this.headersProvider,
    this.staticHeaders = const {},
  });

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    options.headers.addAll(staticHeaders);

    if (headersProvider != null) {
      options.headers.addAll(headersProvider!());
    }

    handler.next(options);
  }
}
