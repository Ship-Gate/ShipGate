import 'dart:async';

import 'package:meta/meta.dart';

/// A Result type for handling success/failure without exceptions
@immutable
sealed class Result<T, E> {
  const Result();

  /// Create a success result
  const factory Result.success(T value) = Success<T, E>;

  /// Create a failure result
  const factory Result.failure(E error) = Failure<T, E>;

  /// Whether this is a success
  bool get isSuccess;

  /// Whether this is a failure
  bool get isFailure;

  /// Get the value if success, null otherwise
  T? get valueOrNull;

  /// Get the error if failure, null otherwise
  E? get errorOrNull;

  /// Get the value or throw if failure
  T get valueOrThrow;

  /// Map the success value
  Result<U, E> map<U>(U Function(T value) transform);

  /// Map the error
  Result<T, F> mapError<F>(F Function(E error) transform);

  /// FlatMap the success value
  Result<U, E> flatMap<U>(Result<U, E> Function(T value) transform);

  /// Handle both cases
  R when<R>({
    required R Function(T value) success,
    required R Function(E error) failure,
  });

  /// Handle with default value for failure
  T getOrElse(T Function(E error) orElse);

  /// Handle with default value
  T getOrDefault(T defaultValue);
}

/// Success case
@immutable
class Success<T, E> extends Result<T, E> {
  final T value;

  const Success(this.value);

  @override
  bool get isSuccess => true;

  @override
  bool get isFailure => false;

  @override
  T? get valueOrNull => value;

  @override
  E? get errorOrNull => null;

  @override
  T get valueOrThrow => value;

  @override
  Result<U, E> map<U>(U Function(T value) transform) {
    return Result.success(transform(value));
  }

  @override
  Result<T, F> mapError<F>(F Function(E error) transform) {
    return Result.success(value);
  }

  @override
  Result<U, E> flatMap<U>(Result<U, E> Function(T value) transform) {
    return transform(value);
  }

  @override
  R when<R>({
    required R Function(T value) success,
    required R Function(E error) failure,
  }) {
    return success(value);
  }

  @override
  T getOrElse(T Function(E error) orElse) => value;

  @override
  T getOrDefault(T defaultValue) => value;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Success<T, E> && value == other.value;

  @override
  int get hashCode => value.hashCode;

  @override
  String toString() => 'Success($value)';
}

/// Failure case
@immutable
class Failure<T, E> extends Result<T, E> {
  final E error;

  const Failure(this.error);

  @override
  bool get isSuccess => false;

  @override
  bool get isFailure => true;

  @override
  T? get valueOrNull => null;

  @override
  E? get errorOrNull => error;

  @override
  T get valueOrThrow => throw error as Object;

  @override
  Result<U, E> map<U>(U Function(T value) transform) {
    return Result.failure(error);
  }

  @override
  Result<T, F> mapError<F>(F Function(E error) transform) {
    return Result.failure(transform(error));
  }

  @override
  Result<U, E> flatMap<U>(Result<U, E> Function(T value) transform) {
    return Result.failure(error);
  }

  @override
  R when<R>({
    required R Function(T value) success,
    required R Function(E error) failure,
  }) {
    return failure(error);
  }

  @override
  T getOrElse(T Function(E error) orElse) => orElse(error);

  @override
  T getOrDefault(T defaultValue) => defaultValue;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Failure<T, E> && error == other.error;

  @override
  int get hashCode => error.hashCode;

  @override
  String toString() => 'Failure($error)';
}

/// Extensions for async operations
extension ResultAsync<T, E> on Future<Result<T, E>> {
  /// Map the success value asynchronously
  Future<Result<U, E>> mapAsync<U>(FutureOr<U> Function(T value) transform) async {
    final result = await this;
    return result.when(
      success: (value) async => Result.success(await transform(value)),
      failure: (error) => Result.failure(error),
    );
  }

  /// FlatMap asynchronously
  Future<Result<U, E>> flatMapAsync<U>(
    FutureOr<Result<U, E>> Function(T value) transform,
  ) async {
    final result = await this;
    return result.when(
      success: (value) async => await transform(value),
      failure: (error) => Result.failure(error),
    );
  }

  /// Get value or throw
  Future<T> getOrThrow() async {
    final result = await this;
    return result.valueOrThrow;
  }

  /// Get value or default
  Future<T> getOrDefault(T defaultValue) async {
    final result = await this;
    return result.getOrDefault(defaultValue);
  }
}

/// Helper to wrap async operations that may throw
Future<Result<T, Exception>> runCatching<T>(
  Future<T> Function() operation,
) async {
  try {
    final value = await operation();
    return Result.success(value);
  } on Exception catch (e) {
    return Result.failure(e);
  }
}

/// Helper to wrap sync operations that may throw
Result<T, Exception> runCatchingSync<T>(T Function() operation) {
  try {
    final value = operation();
    return Result.success(value);
  } on Exception catch (e) {
    return Result.failure(e);
  }
}

/// Extension for nullable values
extension ResultFromNullable<T> on T? {
  /// Convert nullable to Result
  Result<T, E> toResult<E>(E Function() errorProvider) {
    if (this != null) {
      return Result.success(this as T);
    }
    return Result.failure(errorProvider());
  }
}

/// Combine multiple results
class ResultCombiner {
  /// Combine two results
  static Result<(T1, T2), E> combine2<T1, T2, E>(
    Result<T1, E> r1,
    Result<T2, E> r2,
  ) {
    return r1.flatMap((v1) => r2.map((v2) => (v1, v2)));
  }

  /// Combine three results
  static Result<(T1, T2, T3), E> combine3<T1, T2, T3, E>(
    Result<T1, E> r1,
    Result<T2, E> r2,
    Result<T3, E> r3,
  ) {
    return r1.flatMap(
      (v1) => r2.flatMap(
        (v2) => r3.map((v3) => (v1, v2, v3)),
      ),
    );
  }

  /// Combine a list of results
  static Result<List<T>, E> combineAll<T, E>(List<Result<T, E>> results) {
    final values = <T>[];

    for (final result in results) {
      if (result.isFailure) {
        return Result.failure(result.errorOrNull as E);
      }
      values.add(result.valueOrNull as T);
    }

    return Result.success(values);
  }
}
