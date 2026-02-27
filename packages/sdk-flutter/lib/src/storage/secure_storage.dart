import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:meta/meta.dart';

/// Keys for secure storage
abstract class StorageKeys {
  static const String accessToken = 'isl_access_token';
  static const String refreshToken = 'isl_refresh_token';
  static const String userId = 'isl_user_id';
  static const String sessionId = 'isl_session_id';
  static const String deviceId = 'isl_device_id';
  static const String preferences = 'isl_preferences';
}

/// Secure storage wrapper for ISL SDK
class ISLSecureStorage {
  final FlutterSecureStorage _storage;
  final IOSOptions _iosOptions;
  final AndroidOptions _androidOptions;

  ISLSecureStorage({
    FlutterSecureStorage? storage,
    IOSOptions? iosOptions,
    AndroidOptions? androidOptions,
  })  : _storage = storage ?? const FlutterSecureStorage(),
        _iosOptions = iosOptions ??
            const IOSOptions(
              accessibility: KeychainAccessibility.first_unlock_this_device,
            ),
        _androidOptions = androidOptions ??
            const AndroidOptions(
              encryptedSharedPreferences: true,
            );

  // ============================================================================
  // TOKEN MANAGEMENT
  // ============================================================================

  /// Save authentication tokens
  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    await Future.wait([
      _write(StorageKeys.accessToken, accessToken),
      _write(StorageKeys.refreshToken, refreshToken),
    ]);
  }

  /// Get the access token
  Future<String?> getAccessToken() async {
    return _read(StorageKeys.accessToken);
  }

  /// Get the refresh token
  Future<String?> getRefreshToken() async {
    return _read(StorageKeys.refreshToken);
  }

  /// Clear all authentication tokens
  Future<void> clearTokens() async {
    await Future.wait([
      _delete(StorageKeys.accessToken),
      _delete(StorageKeys.refreshToken),
    ]);
  }

  /// Check if tokens exist
  Future<bool> hasTokens() async {
    final token = await getAccessToken();
    return token != null && token.isNotEmpty;
  }

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  /// Save session information
  Future<void> saveSession({
    required String sessionId,
    required String userId,
  }) async {
    await Future.wait([
      _write(StorageKeys.sessionId, sessionId),
      _write(StorageKeys.userId, userId),
    ]);
  }

  /// Get the current session ID
  Future<String?> getSessionId() async {
    return _read(StorageKeys.sessionId);
  }

  /// Get the current user ID
  Future<String?> getUserId() async {
    return _read(StorageKeys.userId);
  }

  /// Clear session information
  Future<void> clearSession() async {
    await Future.wait([
      _delete(StorageKeys.sessionId),
      _delete(StorageKeys.userId),
    ]);
  }

  // ============================================================================
  // DEVICE MANAGEMENT
  // ============================================================================

  /// Get or generate device ID
  Future<String> getOrCreateDeviceId() async {
    var deviceId = await _read(StorageKeys.deviceId);

    if (deviceId == null || deviceId.isEmpty) {
      deviceId = _generateDeviceId();
      await _write(StorageKeys.deviceId, deviceId);
    }

    return deviceId;
  }

  /// Get device ID if exists
  Future<String?> getDeviceId() async {
    return _read(StorageKeys.deviceId);
  }

  String _generateDeviceId() {
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final random = DateTime.now().microsecondsSinceEpoch;
    return 'device_${timestamp}_$random';
  }

  // ============================================================================
  // PREFERENCES
  // ============================================================================

  /// Save user preferences
  Future<void> savePreferences(Map<String, dynamic> preferences) async {
    final json = jsonEncode(preferences);
    await _write(StorageKeys.preferences, json);
  }

  /// Get user preferences
  Future<Map<String, dynamic>> getPreferences() async {
    final json = await _read(StorageKeys.preferences);
    if (json == null || json.isEmpty) {
      return {};
    }

    try {
      return jsonDecode(json) as Map<String, dynamic>;
    } catch (_) {
      return {};
    }
  }

  /// Update a single preference
  Future<void> updatePreference(String key, dynamic value) async {
    final prefs = await getPreferences();
    prefs[key] = value;
    await savePreferences(prefs);
  }

  /// Get a single preference
  Future<T?> getPreference<T>(String key) async {
    final prefs = await getPreferences();
    return prefs[key] as T?;
  }

  // ============================================================================
  // GENERIC OPERATIONS
  // ============================================================================

  /// Write a value to secure storage
  Future<void> write(String key, String value) async {
    await _write(key, value);
  }

  /// Read a value from secure storage
  Future<String?> read(String key) async {
    return _read(key);
  }

  /// Delete a value from secure storage
  Future<void> delete(String key) async {
    await _delete(key);
  }

  /// Check if a key exists
  Future<bool> containsKey(String key) async {
    final value = await _read(key);
    return value != null;
  }

  /// Clear all ISL storage
  Future<void> clearAll() async {
    await Future.wait([
      clearTokens(),
      clearSession(),
      _delete(StorageKeys.deviceId),
      _delete(StorageKeys.preferences),
    ]);
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  Future<void> _write(String key, String value) async {
    await _storage.write(
      key: key,
      value: value,
      iOptions: _iosOptions,
      aOptions: _androidOptions,
    );
  }

  Future<String?> _read(String key) async {
    return _storage.read(
      key: key,
      iOptions: _iosOptions,
      aOptions: _androidOptions,
    );
  }

  Future<void> _delete(String key) async {
    await _storage.delete(
      key: key,
      iOptions: _iosOptions,
      aOptions: _androidOptions,
    );
  }
}

/// In-memory storage for testing
@visibleForTesting
class InMemorySecureStorage extends ISLSecureStorage {
  final Map<String, String> _store = {};

  InMemorySecureStorage() : super(storage: const FlutterSecureStorage());

  @override
  Future<void> write(String key, String value) async {
    _store[key] = value;
  }

  @override
  Future<String?> read(String key) async {
    return _store[key];
  }

  @override
  Future<void> delete(String key) async {
    _store.remove(key);
  }

  @override
  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    _store[StorageKeys.accessToken] = accessToken;
    _store[StorageKeys.refreshToken] = refreshToken;
  }

  @override
  Future<String?> getAccessToken() async {
    return _store[StorageKeys.accessToken];
  }

  @override
  Future<String?> getRefreshToken() async {
    return _store[StorageKeys.refreshToken];
  }

  @override
  Future<void> clearTokens() async {
    _store.remove(StorageKeys.accessToken);
    _store.remove(StorageKeys.refreshToken);
  }

  @override
  Future<void> clearAll() async {
    _store.clear();
  }

  /// Get all stored keys (for testing)
  Set<String> get keys => _store.keys.toSet();

  /// Get all stored values (for testing)
  Map<String, String> get values => Map.unmodifiable(_store);
}
