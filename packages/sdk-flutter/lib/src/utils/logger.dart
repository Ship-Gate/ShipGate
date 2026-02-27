import 'package:logger/logger.dart';

/// Logger configuration for ISL SDK
class ISLLogger {
  static Logger? _instance;

  /// Get the shared logger instance
  static Logger get instance {
    _instance ??= Logger(
      printer: PrettyPrinter(
        methodCount: 2,
        errorMethodCount: 8,
        lineLength: 120,
        colors: true,
        printEmojis: true,
        dateTimeFormat: DateTimeFormat.onlyTimeAndSinceStart,
      ),
      level: Level.debug,
    );
    return _instance!;
  }

  /// Configure the logger
  static void configure({
    Level level = Level.debug,
    bool colors = true,
    bool printEmojis = true,
    int methodCount = 2,
    int errorMethodCount = 8,
    int lineLength = 120,
    LogOutput? output,
  }) {
    _instance = Logger(
      printer: PrettyPrinter(
        methodCount: methodCount,
        errorMethodCount: errorMethodCount,
        lineLength: lineLength,
        colors: colors,
        printEmojis: printEmojis,
        dateTimeFormat: DateTimeFormat.onlyTimeAndSinceStart,
      ),
      level: level,
      output: output,
    );
  }

  /// Configure for production (minimal logging)
  static void configureProduction() {
    _instance = Logger(
      printer: SimplePrinter(colors: false),
      level: Level.warning,
    );
  }

  /// Configure for debug (verbose logging)
  static void configureDebug() {
    configure(
      level: Level.trace,
      methodCount: 3,
      errorMethodCount: 10,
    );
  }

  /// Disable logging completely
  static void disable() {
    _instance = Logger(level: Level.off);
  }

  // Convenience methods
  static void trace(dynamic message, [dynamic error, StackTrace? stackTrace]) {
    instance.t(message, error: error, stackTrace: stackTrace);
  }

  static void debug(dynamic message, [dynamic error, StackTrace? stackTrace]) {
    instance.d(message, error: error, stackTrace: stackTrace);
  }

  static void info(dynamic message, [dynamic error, StackTrace? stackTrace]) {
    instance.i(message, error: error, stackTrace: stackTrace);
  }

  static void warning(dynamic message, [dynamic error, StackTrace? stackTrace]) {
    instance.w(message, error: error, stackTrace: stackTrace);
  }

  static void error(dynamic message, [dynamic error, StackTrace? stackTrace]) {
    instance.e(message, error: error, stackTrace: stackTrace);
  }

  static void fatal(dynamic message, [dynamic error, StackTrace? stackTrace]) {
    instance.f(message, error: error, stackTrace: stackTrace);
  }
}

/// Logger mixin for classes that need logging
mixin ISLLogging {
  Logger get logger => ISLLogger.instance;

  void logTrace(dynamic message, [dynamic error, StackTrace? stackTrace]) {
    logger.t('[$runtimeType] $message', error: error, stackTrace: stackTrace);
  }

  void logDebug(dynamic message, [dynamic error, StackTrace? stackTrace]) {
    logger.d('[$runtimeType] $message', error: error, stackTrace: stackTrace);
  }

  void logInfo(dynamic message, [dynamic error, StackTrace? stackTrace]) {
    logger.i('[$runtimeType] $message', error: error, stackTrace: stackTrace);
  }

  void logWarning(dynamic message, [dynamic error, StackTrace? stackTrace]) {
    logger.w('[$runtimeType] $message', error: error, stackTrace: stackTrace);
  }

  void logError(dynamic message, [dynamic error, StackTrace? stackTrace]) {
    logger.e('[$runtimeType] $message', error: error, stackTrace: stackTrace);
  }
}

/// Custom log output that collects logs for testing
class CollectingLogOutput extends LogOutput {
  final List<OutputEvent> events = [];

  @override
  void output(OutputEvent event) {
    events.add(event);
  }

  void clear() {
    events.clear();
  }

  List<String> get messages =>
      events.expand((e) => e.lines).toList();

  bool containsMessage(String message) =>
      messages.any((m) => m.contains(message));

  int countLevel(Level level) =>
      events.where((e) => e.level == level).length;
}

/// Log filter that only allows certain levels
class LevelFilter extends LogFilter {
  final Set<Level> allowedLevels;

  LevelFilter(this.allowedLevels);

  @override
  bool shouldLog(LogEvent event) {
    return allowedLevels.contains(event.level);
  }
}

/// Log filter for production (warnings and above)
class ProductionFilter extends LogFilter {
  @override
  bool shouldLog(LogEvent event) {
    return event.level.index >= Level.warning.index;
  }
}
