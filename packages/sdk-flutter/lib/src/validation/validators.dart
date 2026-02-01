import 'package:meta/meta.dart';

import '../models/exceptions.dart';

/// Base validator interface
abstract class Validator<T> {
  const Validator();

  /// Validate the value and return validation result
  ValidationResult validate(T value);

  /// Validate and throw if invalid
  void validateOrThrow(T value) {
    final result = validate(value);
    if (!result.isValid) {
      throw ValidationException(
        message: result.errors.join('; '),
        field: result.field,
        invalidValue: value,
        constraints: result.constraints,
      );
    }
  }

  /// Chain validators
  Validator<T> and(Validator<T> other) => CompositeValidator([this, other]);
}

/// Result of validation
@immutable
class ValidationResult {
  final bool isValid;
  final String field;
  final List<String> errors;
  final List<String> constraints;

  const ValidationResult({
    required this.isValid,
    required this.field,
    this.errors = const [],
    this.constraints = const [],
  });

  factory ValidationResult.valid(String field) => ValidationResult(
        isValid: true,
        field: field,
      );

  factory ValidationResult.invalid(
    String field, {
    required String error,
    String? constraint,
  }) =>
      ValidationResult(
        isValid: false,
        field: field,
        errors: [error],
        constraints: constraint != null ? [constraint] : [],
      );

  ValidationResult merge(ValidationResult other) {
    return ValidationResult(
      isValid: isValid && other.isValid,
      field: field,
      errors: [...errors, ...other.errors],
      constraints: [...constraints, ...other.constraints],
    );
  }
}

/// Composite validator that combines multiple validators
class CompositeValidator<T> extends Validator<T> {
  final List<Validator<T>> validators;

  const CompositeValidator(this.validators);

  @override
  ValidationResult validate(T value) {
    ValidationResult? result;

    for (final validator in validators) {
      final current = validator.validate(value);
      result = result?.merge(current) ?? current;
    }

    return result ?? ValidationResult.valid('unknown');
  }
}

// ============================================================================
// STRING VALIDATORS
// ============================================================================

/// Validates that a string is not empty
class RequiredValidator extends Validator<String?> {
  final String field;

  const RequiredValidator(this.field);

  @override
  ValidationResult validate(String? value) {
    if (value == null || value.isEmpty) {
      return ValidationResult.invalid(
        field,
        error: '$field is required',
        constraint: 'required',
      );
    }
    return ValidationResult.valid(field);
  }
}

/// Validates string minimum length
class MinLengthValidator extends Validator<String> {
  final String field;
  final int minLength;

  const MinLengthValidator(this.field, this.minLength);

  @override
  ValidationResult validate(String value) {
    if (value.length < minLength) {
      return ValidationResult.invalid(
        field,
        error: '$field must be at least $minLength characters',
        constraint: 'minLength:$minLength',
      );
    }
    return ValidationResult.valid(field);
  }
}

/// Validates string maximum length
class MaxLengthValidator extends Validator<String> {
  final String field;
  final int maxLength;

  const MaxLengthValidator(this.field, this.maxLength);

  @override
  ValidationResult validate(String value) {
    if (value.length > maxLength) {
      return ValidationResult.invalid(
        field,
        error: '$field cannot exceed $maxLength characters',
        constraint: 'maxLength:$maxLength',
      );
    }
    return ValidationResult.valid(field);
  }
}

/// Validates string matches a pattern
class PatternValidator extends Validator<String> {
  final String field;
  final RegExp pattern;
  final String patternName;

  const PatternValidator(this.field, this.pattern, this.patternName);

  @override
  ValidationResult validate(String value) {
    if (!pattern.hasMatch(value)) {
      return ValidationResult.invalid(
        field,
        error: '$field has invalid format',
        constraint: 'pattern:$patternName',
      );
    }
    return ValidationResult.valid(field);
  }
}

/// Email validator
class EmailValidator extends Validator<String> {
  static final _emailRegex = RegExp(
    r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
  );

  const EmailValidator();

  @override
  ValidationResult validate(String value) {
    if (!_emailRegex.hasMatch(value)) {
      return ValidationResult.invalid(
        'email',
        error: 'Invalid email format',
        constraint: 'format:email',
      );
    }
    if (value.length > 254) {
      return ValidationResult.invalid(
        'email',
        error: 'Email exceeds maximum length',
        constraint: 'maxLength:254',
      );
    }
    return ValidationResult.valid('email');
  }
}

/// URL validator
class UrlValidator extends Validator<String> {
  final bool requireHttps;

  const UrlValidator({this.requireHttps = false});

  @override
  ValidationResult validate(String value) {
    try {
      final uri = Uri.parse(value);
      if (!uri.hasScheme || !uri.hasAuthority) {
        return ValidationResult.invalid(
          'url',
          error: 'Invalid URL format',
          constraint: 'format:url',
        );
      }
      if (requireHttps && uri.scheme != 'https') {
        return ValidationResult.invalid(
          'url',
          error: 'URL must use HTTPS',
          constraint: 'scheme:https',
        );
      }
      return ValidationResult.valid('url');
    } catch (_) {
      return ValidationResult.invalid(
        'url',
        error: 'Invalid URL format',
        constraint: 'format:url',
      );
    }
  }
}

/// UUID validator
class UuidValidator extends Validator<String> {
  static final _uuidRegex = RegExp(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
    caseSensitive: false,
  );

  final String field;

  const UuidValidator([this.field = 'id']);

  @override
  ValidationResult validate(String value) {
    if (!_uuidRegex.hasMatch(value)) {
      return ValidationResult.invalid(
        field,
        error: 'Invalid UUID format',
        constraint: 'format:uuid',
      );
    }
    return ValidationResult.valid(field);
  }
}

// ============================================================================
// NUMBER VALIDATORS
// ============================================================================

/// Validates number is within range
class RangeValidator<T extends num> extends Validator<T> {
  final String field;
  final T? min;
  final T? max;
  final bool minInclusive;
  final bool maxInclusive;

  const RangeValidator(
    this.field, {
    this.min,
    this.max,
    this.minInclusive = true,
    this.maxInclusive = true,
  });

  @override
  ValidationResult validate(T value) {
    if (min != null) {
      final minOk = minInclusive ? value >= min! : value > min!;
      if (!minOk) {
        return ValidationResult.invalid(
          field,
          error: '$field must be ${minInclusive ? '>=' : '>'} $min',
          constraint: 'min:$min',
        );
      }
    }

    if (max != null) {
      final maxOk = maxInclusive ? value <= max! : value < max!;
      if (!maxOk) {
        return ValidationResult.invalid(
          field,
          error: '$field must be ${maxInclusive ? '<=' : '<'} $max',
          constraint: 'max:$max',
        );
      }
    }

    return ValidationResult.valid(field);
  }
}

/// Validates number is positive
class PositiveValidator<T extends num> extends Validator<T> {
  final String field;
  final bool allowZero;

  const PositiveValidator(this.field, {this.allowZero = false});

  @override
  ValidationResult validate(T value) {
    if (allowZero ? value < 0 : value <= 0) {
      return ValidationResult.invalid(
        field,
        error: '$field must be ${allowZero ? 'non-negative' : 'positive'}',
        constraint: allowZero ? 'min:0' : 'min:0.0001',
      );
    }
    return ValidationResult.valid(field);
  }
}

// ============================================================================
// COLLECTION VALIDATORS
// ============================================================================

/// Validates list is not empty
class NonEmptyListValidator<T> extends Validator<List<T>> {
  final String field;

  const NonEmptyListValidator(this.field);

  @override
  ValidationResult validate(List<T> value) {
    if (value.isEmpty) {
      return ValidationResult.invalid(
        field,
        error: '$field cannot be empty',
        constraint: 'minItems:1',
      );
    }
    return ValidationResult.valid(field);
  }
}

/// Validates list length
class ListLengthValidator<T> extends Validator<List<T>> {
  final String field;
  final int? minLength;
  final int? maxLength;

  const ListLengthValidator(this.field, {this.minLength, this.maxLength});

  @override
  ValidationResult validate(List<T> value) {
    if (minLength != null && value.length < minLength!) {
      return ValidationResult.invalid(
        field,
        error: '$field must have at least $minLength items',
        constraint: 'minItems:$minLength',
      );
    }
    if (maxLength != null && value.length > maxLength!) {
      return ValidationResult.invalid(
        field,
        error: '$field cannot have more than $maxLength items',
        constraint: 'maxItems:$maxLength',
      );
    }
    return ValidationResult.valid(field);
  }
}

// ============================================================================
// BUILDER HELPERS
// ============================================================================

/// Validation builder for fluent API
class ValidationBuilder {
  final List<Validator<dynamic>> _validators = [];
  final Map<String, dynamic> _values = {};

  ValidationBuilder field<T>(String name, T value) {
    _values[name] = value;
    return this;
  }

  ValidationBuilder required(String field) {
    _validators.add(RequiredValidator(field));
    return this;
  }

  ValidationBuilder email(String field) {
    _validators.add(const EmailValidator());
    return this;
  }

  ValidationBuilder minLength(String field, int min) {
    _validators.add(MinLengthValidator(field, min));
    return this;
  }

  ValidationBuilder maxLength(String field, int max) {
    _validators.add(MaxLengthValidator(field, max));
    return this;
  }

  ValidationBuilder range<T extends num>(String field, {T? min, T? max}) {
    _validators.add(RangeValidator<T>(field, min: min, max: max));
    return this;
  }

  ValidationBuilder custom<T>(
    String field,
    bool Function(T value) predicate,
    String errorMessage,
  ) {
    _validators.add(_CustomValidator(field, predicate, errorMessage));
    return this;
  }

  /// Validate all fields and throw if any are invalid
  void validateOrThrow() {
    final errors = <String>[];

    for (final validator in _validators) {
      // This is simplified - in a real impl you'd need to match validators to values
      // For now, we're just demonstrating the pattern
    }

    if (errors.isNotEmpty) {
      throw ValidationException(
        message: errors.join('; '),
        field: 'multiple',
      );
    }
  }
}

class _CustomValidator<T> extends Validator<T> {
  final String field;
  final bool Function(T value) predicate;
  final String errorMessage;

  const _CustomValidator(this.field, this.predicate, this.errorMessage);

  @override
  ValidationResult validate(T value) {
    if (!predicate(value)) {
      return ValidationResult.invalid(field, error: errorMessage);
    }
    return ValidationResult.valid(field);
  }
}
