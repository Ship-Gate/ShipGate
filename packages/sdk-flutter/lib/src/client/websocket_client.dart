import 'dart:async';
import 'dart:convert';

import 'package:logger/logger.dart';
import 'package:meta/meta.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import '../models/exceptions.dart';
import '../storage/secure_storage.dart';

/// WebSocket message types
enum WSMessageType {
  subscribe,
  unsubscribe,
  event,
  error,
  ping,
  pong,
  ack,
}

/// WebSocket message wrapper
@immutable
class WSMessage {
  final String id;
  final WSMessageType type;
  final String? channel;
  final String? event;
  final Map<String, dynamic>? data;
  final DateTime timestamp;

  const WSMessage({
    required this.id,
    required this.type,
    this.channel,
    this.event,
    this.data,
    required this.timestamp,
  });

  factory WSMessage.fromJson(Map<String, dynamic> json) {
    return WSMessage(
      id: json['id'] as String,
      type: WSMessageType.values.byName(json['type'] as String),
      channel: json['channel'] as String?,
      event: json['event'] as String?,
      data: json['data'] as Map<String, dynamic>?,
      timestamp: DateTime.parse(json['timestamp'] as String),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'type': type.name,
        if (channel != null) 'channel': channel,
        if (event != null) 'event': event,
        if (data != null) 'data': data,
        'timestamp': timestamp.toIso8601String(),
      };

  @override
  String toString() => 'WSMessage($type, channel: $channel, event: $event)';
}

/// WebSocket connection state
enum WSConnectionState {
  disconnected,
  connecting,
  connected,
  reconnecting,
  failed,
}

/// Configuration for WebSocket client
@immutable
class WSClientConfig {
  final String url;
  final Duration pingInterval;
  final Duration reconnectDelay;
  final int maxReconnectAttempts;
  final bool autoReconnect;

  const WSClientConfig({
    required this.url,
    this.pingInterval = const Duration(seconds: 30),
    this.reconnectDelay = const Duration(seconds: 5),
    this.maxReconnectAttempts = 5,
    this.autoReconnect = true,
  });
}

/// Callback types for WebSocket events
typedef WSEventCallback = void Function(WSMessage message);
typedef WSErrorCallback = void Function(Object error, StackTrace? stackTrace);
typedef WSStateCallback = void Function(WSConnectionState state);

/// WebSocket client for real-time events
class ISLWebSocketClient {
  final WSClientConfig config;
  final ISLSecureStorage _storage;
  final Logger _logger;

  WebSocketChannel? _channel;
  StreamSubscription? _subscription;
  Timer? _pingTimer;
  Timer? _reconnectTimer;

  WSConnectionState _state = WSConnectionState.disconnected;
  int _reconnectAttempts = 0;
  int _messageIdCounter = 0;

  final Map<String, Set<WSEventCallback>> _channelSubscriptions = {};
  final Map<String, Completer<void>> _pendingAcks = {};
  final List<WSStateCallback> _stateListeners = [];
  final List<WSErrorCallback> _errorListeners = [];

  ISLWebSocketClient({
    required this.config,
    ISLSecureStorage? storage,
    Logger? logger,
  })  : _storage = storage ?? ISLSecureStorage(),
        _logger = logger ?? Logger(level: Level.off);

  /// Current connection state
  WSConnectionState get state => _state;

  /// Whether the client is connected
  bool get isConnected => _state == WSConnectionState.connected;

  /// Connect to WebSocket server
  Future<void> connect() async {
    if (_state == WSConnectionState.connected ||
        _state == WSConnectionState.connecting) {
      return;
    }

    _setState(WSConnectionState.connecting);

    try {
      final token = await _storage.getAccessToken();
      final uri = Uri.parse(config.url).replace(
        queryParameters: token != null ? {'token': token} : null,
      );

      _channel = WebSocketChannel.connect(uri);
      
      await _channel!.ready;

      _subscription = _channel!.stream.listen(
        _handleMessage,
        onError: _handleError,
        onDone: _handleDone,
      );

      _startPingTimer();
      _setState(WSConnectionState.connected);
      _reconnectAttempts = 0;

      // Resubscribe to channels
      await _resubscribeChannels();
    } catch (e, st) {
      _logger.e('WebSocket connection failed', error: e, stackTrace: st);
      _setState(WSConnectionState.failed);
      _notifyError(e, st);
      _scheduleReconnect();
    }
  }

  /// Disconnect from WebSocket server
  Future<void> disconnect() async {
    _reconnectTimer?.cancel();
    _pingTimer?.cancel();
    await _subscription?.cancel();
    await _channel?.sink.close();
    _channel = null;
    _setState(WSConnectionState.disconnected);
  }

  /// Subscribe to a channel
  Future<void> subscribe(String channel, WSEventCallback callback) async {
    _channelSubscriptions.putIfAbsent(channel, () => {});
    _channelSubscriptions[channel]!.add(callback);

    if (isConnected) {
      await _sendSubscribe(channel);
    }
  }

  /// Unsubscribe from a channel
  Future<void> unsubscribe(String channel, [WSEventCallback? callback]) async {
    if (callback != null) {
      _channelSubscriptions[channel]?.remove(callback);
      if (_channelSubscriptions[channel]?.isEmpty ?? true) {
        _channelSubscriptions.remove(channel);
        if (isConnected) {
          await _sendUnsubscribe(channel);
        }
      }
    } else {
      _channelSubscriptions.remove(channel);
      if (isConnected) {
        await _sendUnsubscribe(channel);
      }
    }
  }

  /// Send a message
  Future<void> send(String channel, String event, Map<String, dynamic> data) async {
    if (!isConnected) {
      throw const NetworkException(
        message: 'WebSocket not connected',
        code: 'WS_NOT_CONNECTED',
      );
    }

    final message = WSMessage(
      id: _nextMessageId(),
      type: WSMessageType.event,
      channel: channel,
      event: event,
      data: data,
      timestamp: DateTime.now(),
    );

    _channel!.sink.add(jsonEncode(message.toJson()));
  }

  /// Add state change listener
  void addStateListener(WSStateCallback callback) {
    _stateListeners.add(callback);
  }

  /// Remove state change listener
  void removeStateListener(WSStateCallback callback) {
    _stateListeners.remove(callback);
  }

  /// Add error listener
  void addErrorListener(WSErrorCallback callback) {
    _errorListeners.add(callback);
  }

  /// Remove error listener
  void removeErrorListener(WSErrorCallback callback) {
    _errorListeners.remove(callback);
  }

  // Private methods

  void _handleMessage(dynamic data) {
    try {
      final json = jsonDecode(data as String) as Map<String, dynamic>;
      final message = WSMessage.fromJson(json);

      switch (message.type) {
        case WSMessageType.event:
          _handleEvent(message);
          break;
        case WSMessageType.ack:
          _handleAck(message);
          break;
        case WSMessageType.pong:
          _logger.d('Received pong');
          break;
        case WSMessageType.error:
          _handleServerError(message);
          break;
        default:
          _logger.d('Received message: ${message.type}');
      }
    } catch (e, st) {
      _logger.e('Failed to parse WebSocket message', error: e, stackTrace: st);
    }
  }

  void _handleEvent(WSMessage message) {
    final channel = message.channel;
    if (channel == null) return;

    final callbacks = _channelSubscriptions[channel];
    if (callbacks != null) {
      for (final callback in callbacks) {
        try {
          callback(message);
        } catch (e, st) {
          _logger.e('Error in event callback', error: e, stackTrace: st);
        }
      }
    }
  }

  void _handleAck(WSMessage message) {
    final completer = _pendingAcks.remove(message.id);
    completer?.complete();
  }

  void _handleServerError(WSMessage message) {
    _logger.e('Server error: ${message.data}');
    _notifyError(
      NetworkException(
        message: message.data?['message']?.toString() ?? 'WebSocket error',
        code: message.data?['code']?.toString(),
      ),
      null,
    );
  }

  void _handleError(Object error, StackTrace stackTrace) {
    _logger.e('WebSocket error', error: error, stackTrace: stackTrace);
    _notifyError(error, stackTrace);
  }

  void _handleDone() {
    _logger.d('WebSocket connection closed');
    _pingTimer?.cancel();

    if (_state != WSConnectionState.disconnected) {
      _setState(WSConnectionState.disconnected);
      _scheduleReconnect();
    }
  }

  void _startPingTimer() {
    _pingTimer?.cancel();
    _pingTimer = Timer.periodic(config.pingInterval, (_) {
      if (isConnected) {
        final message = WSMessage(
          id: _nextMessageId(),
          type: WSMessageType.ping,
          timestamp: DateTime.now(),
        );
        _channel?.sink.add(jsonEncode(message.toJson()));
      }
    });
  }

  void _scheduleReconnect() {
    if (!config.autoReconnect) return;
    if (_reconnectAttempts >= config.maxReconnectAttempts) {
      _logger.w('Max reconnect attempts reached');
      _setState(WSConnectionState.failed);
      return;
    }

    _reconnectAttempts++;
    final delay = config.reconnectDelay * _reconnectAttempts;

    _logger.d('Scheduling reconnect in ${delay.inSeconds}s (attempt $_reconnectAttempts)');
    _setState(WSConnectionState.reconnecting);

    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(delay, () {
      connect();
    });
  }

  Future<void> _resubscribeChannels() async {
    for (final channel in _channelSubscriptions.keys) {
      await _sendSubscribe(channel);
    }
  }

  Future<void> _sendSubscribe(String channel) async {
    final message = WSMessage(
      id: _nextMessageId(),
      type: WSMessageType.subscribe,
      channel: channel,
      timestamp: DateTime.now(),
    );

    final completer = Completer<void>();
    _pendingAcks[message.id] = completer;

    _channel?.sink.add(jsonEncode(message.toJson()));

    // Wait for ack with timeout
    await completer.future.timeout(
      const Duration(seconds: 5),
      onTimeout: () {
        _pendingAcks.remove(message.id);
        _logger.w('Subscribe ack timeout for channel: $channel');
      },
    );
  }

  Future<void> _sendUnsubscribe(String channel) async {
    final message = WSMessage(
      id: _nextMessageId(),
      type: WSMessageType.unsubscribe,
      channel: channel,
      timestamp: DateTime.now(),
    );

    _channel?.sink.add(jsonEncode(message.toJson()));
  }

  void _setState(WSConnectionState newState) {
    if (_state == newState) return;
    _state = newState;

    for (final listener in _stateListeners) {
      try {
        listener(newState);
      } catch (e) {
        _logger.e('Error in state listener', error: e);
      }
    }
  }

  void _notifyError(Object error, StackTrace? stackTrace) {
    for (final listener in _errorListeners) {
      try {
        listener(error, stackTrace);
      } catch (e) {
        _logger.e('Error in error listener', error: e);
      }
    }
  }

  String _nextMessageId() {
    return 'msg_${_messageIdCounter++}_${DateTime.now().millisecondsSinceEpoch}';
  }

  /// Dispose of the client
  Future<void> dispose() async {
    await disconnect();
    _stateListeners.clear();
    _errorListeners.clear();
    _channelSubscriptions.clear();
  }
}
