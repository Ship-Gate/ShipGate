import 'package:logger/logger.dart';
import 'package:meta/meta.dart';

import '../models/exceptions.dart';

/// Represents a postcondition check
@immutable
class PostconditionCheck {
  final String name;
  final bool Function() condition;
  final String expected;
  final String actual;

  const PostconditionCheck({
    required this.name,
    required this.condition,
    required this.expected,
    required this.actual,
  });
}

/// Represents a precondition check
@immutable
class PreconditionCheck {
  final String name;
  final bool Function() condition;
  final String errorMessage;

  const PreconditionCheck({
    required this.name,
    required this.condition,
    required this.errorMessage,
  });
}

/// Represents an invariant check
@immutable
class InvariantCheck {
  final String name;
  final bool Function() condition;
  final String expected;
  final String actual;

  const InvariantCheck({
    required this.name,
    required this.condition,
    required this.expected,
    required this.actual,
  });
}

/// Contract verification modes
enum VerificationMode {
  /// No verification (production)
  disabled,

  /// Log violations but don't throw (staging)
  logOnly,

  /// Throw on violations (development)
  strict,

  /// Assert violations (debug only)
  assertOnly,
}

/// Contract verifier for ISL behaviors
class ContractVerifier {
  final bool enabled;
  final VerificationMode mode;
  final Logger _logger;
  final void Function(ContractViolation)? onViolation;

  ContractVerifier({
    this.enabled = true,
    this.mode = VerificationMode.strict,
    Logger? logger,
    this.onViolation,
  }) : _logger = logger ?? Logger(level: Level.debug);

  /// Verify preconditions before behavior execution
  void verifyPreconditions(
    String behaviorName,
    List<PreconditionCheck> checks,
  ) {
    if (!enabled || mode == VerificationMode.disabled) return;

    for (final check in checks) {
      if (!check.condition()) {
        final violation = ContractViolation(
          type: ContractViolationType.precondition,
          behaviorName: behaviorName,
          checkName: check.name,
          message: check.errorMessage,
        );

        _handleViolation(violation);
      }
    }
  }

  /// Verify postconditions after behavior execution
  void verifyPostconditions(
    String behaviorName,
    List<PostconditionCheck> checks,
  ) {
    if (!enabled || mode == VerificationMode.disabled) return;

    for (final check in checks) {
      if (!check.condition()) {
        final violation = ContractViolation(
          type: ContractViolationType.postcondition,
          behaviorName: behaviorName,
          checkName: check.name,
          message: 'Expected ${check.expected}, got ${check.actual}',
          expected: check.expected,
          actual: check.actual,
        );

        _handleViolation(violation);
      }
    }
  }

  /// Verify invariants
  void verifyInvariants(
    String contextName,
    List<InvariantCheck> checks,
  ) {
    if (!enabled || mode == VerificationMode.disabled) return;

    for (final check in checks) {
      if (!check.condition()) {
        final violation = ContractViolation(
          type: ContractViolationType.invariant,
          behaviorName: contextName,
          checkName: check.name,
          message: 'Invariant violated: ${check.name}',
          expected: check.expected,
          actual: check.actual,
        );

        _handleViolation(violation);
      }
    }
  }

  void _handleViolation(ContractViolation violation) {
    // Notify callback if registered
    onViolation?.call(violation);

    switch (mode) {
      case VerificationMode.disabled:
        return;

      case VerificationMode.logOnly:
        _logger.w('Contract violation: $violation');
        return;

      case VerificationMode.assertOnly:
        assert(
          false,
          'Contract violation in ${violation.behaviorName}: ${violation.message}',
        );
        return;

      case VerificationMode.strict:
        _logger.e('Contract violation: $violation');
        throw ContractViolationException(
          message: violation.message,
          contractType: violation.type.name,
          expected: violation.expected ?? 'true',
          actual: violation.actual ?? 'false',
        );
    }
  }
}

/// Types of contract violations
enum ContractViolationType {
  precondition,
  postcondition,
  invariant,
}

/// Represents a contract violation
@immutable
class ContractViolation {
  final ContractViolationType type;
  final String behaviorName;
  final String checkName;
  final String message;
  final String? expected;
  final String? actual;
  final DateTime timestamp;

  ContractViolation({
    required this.type,
    required this.behaviorName,
    required this.checkName,
    required this.message,
    this.expected,
    this.actual,
    DateTime? timestamp,
  }) : timestamp = timestamp ?? DateTime.now();

  @override
  String toString() {
    final buffer = StringBuffer()
      ..write('ContractViolation(')
      ..write('type: ${type.name}, ')
      ..write('behavior: $behaviorName, ')
      ..write('check: $checkName, ')
      ..write('message: $message');

    if (expected != null) {
      buffer.write(', expected: $expected');
    }
    if (actual != null) {
      buffer.write(', actual: $actual');
    }

    buffer.write(')');
    return buffer.toString();
  }

  Map<String, dynamic> toJson() => {
        'type': type.name,
        'behaviorName': behaviorName,
        'checkName': checkName,
        'message': message,
        if (expected != null) 'expected': expected,
        if (actual != null) 'actual': actual,
        'timestamp': timestamp.toIso8601String(),
      };
}

/// Extension for fluent contract verification
extension ContractVerification<T> on T {
  /// Verify a condition on this value
  T verify(bool Function(T) condition, String message) {
    if (!condition(this)) {
      throw ContractViolationException(
        message: message,
        contractType: 'inline',
        expected: 'condition to be true',
        actual: 'condition was false',
      );
    }
    return this;
  }

  /// Verify this value is not null
  T verifyNotNull(String fieldName) {
    if (this == null) {
      throw ValidationException(
        message: '$fieldName cannot be null',
        field: fieldName,
      );
    }
    return this;
  }
}

/// Mixin for entities that need invariant verification
mixin InvariantVerification {
  /// Get list of invariants to verify
  List<InvariantCheck> get invariants;

  /// Verify all invariants
  void verifyInvariants(ContractVerifier verifier) {
    verifier.verifyInvariants(runtimeType.toString(), invariants);
  }
}

/// Decorator for behavior methods with contract verification
class VerifiedBehavior {
  final String name;
  final List<String> preconditions;
  final List<String> postconditions;

  const VerifiedBehavior({
    required this.name,
    this.preconditions = const [],
    this.postconditions = const [],
  });
}
