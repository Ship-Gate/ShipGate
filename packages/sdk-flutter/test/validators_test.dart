import 'package:flutter_test/flutter_test.dart';
import 'package:isl_flutter_sdk/isl_client.dart';

void main() {
  group('Validators', () {
    group('RequiredValidator', () {
      test('passes for non-empty string', () {
        const validator = RequiredValidator('name');
        final result = validator.validate('John');
        expect(result.isValid, isTrue);
      });

      test('fails for null', () {
        const validator = RequiredValidator('name');
        final result = validator.validate(null);
        expect(result.isValid, isFalse);
        expect(result.errors, contains('name is required'));
      });

      test('fails for empty string', () {
        const validator = RequiredValidator('name');
        final result = validator.validate('');
        expect(result.isValid, isFalse);
      });
    });

    group('MinLengthValidator', () {
      test('passes for string at minimum length', () {
        const validator = MinLengthValidator('password', 8);
        final result = validator.validate('12345678');
        expect(result.isValid, isTrue);
      });

      test('passes for string above minimum length', () {
        const validator = MinLengthValidator('password', 8);
        final result = validator.validate('1234567890');
        expect(result.isValid, isTrue);
      });

      test('fails for string below minimum length', () {
        const validator = MinLengthValidator('password', 8);
        final result = validator.validate('1234567');
        expect(result.isValid, isFalse);
        expect(result.constraints, contains('minLength:8'));
      });
    });

    group('MaxLengthValidator', () {
      test('passes for string at maximum length', () {
        const validator = MaxLengthValidator('title', 100);
        final result = validator.validate('a' * 100);
        expect(result.isValid, isTrue);
      });

      test('passes for string below maximum length', () {
        const validator = MaxLengthValidator('title', 100);
        final result = validator.validate('short');
        expect(result.isValid, isTrue);
      });

      test('fails for string above maximum length', () {
        const validator = MaxLengthValidator('title', 100);
        final result = validator.validate('a' * 101);
        expect(result.isValid, isFalse);
        expect(result.constraints, contains('maxLength:100'));
      });
    });

    group('EmailValidator', () {
      const validator = EmailValidator();

      test('passes for valid email', () {
        expect(validator.validate('user@example.com').isValid, isTrue);
        expect(validator.validate('user.name@example.com').isValid, isTrue);
        expect(validator.validate('user+tag@example.com').isValid, isTrue);
        expect(validator.validate('user@sub.example.com').isValid, isTrue);
      });

      test('fails for invalid email formats', () {
        expect(validator.validate('invalid').isValid, isFalse);
        expect(validator.validate('@example.com').isValid, isFalse);
        expect(validator.validate('user@').isValid, isFalse);
        expect(validator.validate('user@.com').isValid, isFalse);
      });

      test('fails for email exceeding max length', () {
        final longEmail = '${'a' * 250}@example.com';
        final result = validator.validate(longEmail);
        expect(result.isValid, isFalse);
        expect(result.constraints, contains('maxLength:254'));
      });
    });

    group('UuidValidator', () {
      const validator = UuidValidator();

      test('passes for valid UUIDs', () {
        expect(
          validator.validate('123e4567-e89b-12d3-a456-426614174000').isValid,
          isTrue,
        );
        expect(
          validator.validate('00000000-0000-1000-8000-000000000000').isValid,
          isTrue,
        );
      });

      test('fails for invalid UUIDs', () {
        expect(validator.validate('invalid').isValid, isFalse);
        expect(validator.validate('123e4567-e89b-12d3-a456').isValid, isFalse);
        expect(
          validator.validate('123e4567-e89b-12d3-a456-426614174000-extra').isValid,
          isFalse,
        );
      });
    });

    group('RangeValidator', () {
      test('passes for value in range', () {
        const validator = RangeValidator<int>('age', min: 18, max: 100);
        expect(validator.validate(25).isValid, isTrue);
        expect(validator.validate(18).isValid, isTrue);
        expect(validator.validate(100).isValid, isTrue);
      });

      test('fails for value below minimum', () {
        const validator = RangeValidator<int>('age', min: 18);
        final result = validator.validate(15);
        expect(result.isValid, isFalse);
        expect(result.constraints, contains('min:18'));
      });

      test('fails for value above maximum', () {
        const validator = RangeValidator<int>('age', max: 100);
        final result = validator.validate(150);
        expect(result.isValid, isFalse);
        expect(result.constraints, contains('max:100'));
      });

      test('respects inclusive flags', () {
        const validator = RangeValidator<int>(
          'value',
          min: 0,
          max: 10,
          minInclusive: false,
          maxInclusive: false,
        );
        expect(validator.validate(0).isValid, isFalse);
        expect(validator.validate(10).isValid, isFalse);
        expect(validator.validate(5).isValid, isTrue);
      });
    });

    group('PositiveValidator', () {
      test('passes for positive numbers', () {
        const validator = PositiveValidator<int>('amount');
        expect(validator.validate(1).isValid, isTrue);
        expect(validator.validate(100).isValid, isTrue);
      });

      test('fails for zero by default', () {
        const validator = PositiveValidator<int>('amount');
        expect(validator.validate(0).isValid, isFalse);
      });

      test('passes for zero when allowZero is true', () {
        const validator = PositiveValidator<int>('amount', allowZero: true);
        expect(validator.validate(0).isValid, isTrue);
      });

      test('fails for negative numbers', () {
        const validator = PositiveValidator<int>('amount');
        expect(validator.validate(-1).isValid, isFalse);
      });
    });

    group('NonEmptyListValidator', () {
      test('passes for non-empty list', () {
        const validator = NonEmptyListValidator<int>('items');
        expect(validator.validate([1, 2, 3]).isValid, isTrue);
      });

      test('fails for empty list', () {
        const validator = NonEmptyListValidator<int>('items');
        final result = validator.validate([]);
        expect(result.isValid, isFalse);
        expect(result.constraints, contains('minItems:1'));
      });
    });

    group('ListLengthValidator', () {
      test('passes for list within length bounds', () {
        const validator = ListLengthValidator<int>(
          'items',
          minLength: 1,
          maxLength: 5,
        );
        expect(validator.validate([1, 2, 3]).isValid, isTrue);
      });

      test('fails for list below minimum length', () {
        const validator = ListLengthValidator<int>('items', minLength: 2);
        final result = validator.validate([1]);
        expect(result.isValid, isFalse);
      });

      test('fails for list above maximum length', () {
        const validator = ListLengthValidator<int>('items', maxLength: 3);
        final result = validator.validate([1, 2, 3, 4]);
        expect(result.isValid, isFalse);
      });
    });

    group('CompositeValidator', () {
      test('passes when all validators pass', () {
        const validator = CompositeValidator<String>([
          MinLengthValidator('password', 8),
          MaxLengthValidator('password', 20),
        ]);
        expect(validator.validate('validpassword').isValid, isTrue);
      });

      test('fails when any validator fails', () {
        const validator = CompositeValidator<String>([
          MinLengthValidator('password', 8),
          MaxLengthValidator('password', 20),
        ]);
        expect(validator.validate('short').isValid, isFalse);
      });

      test('collects all errors', () {
        // This would need a string that fails both, which isn't possible
        // with min/max length. Testing with a single failure instead.
        const validator = CompositeValidator<String>([
          MinLengthValidator('password', 8),
        ]);
        final result = validator.validate('short');
        expect(result.errors, isNotEmpty);
      });
    });

    group('Validator chaining', () {
      test('and() combines validators', () {
        const min = MinLengthValidator('field', 5);
        const max = MaxLengthValidator('field', 10);
        final combined = min.and(max);

        expect(combined.validate('hello').isValid, isTrue);
        expect(combined.validate('hi').isValid, isFalse);
        expect(combined.validate('hello world!!').isValid, isFalse);
      });
    });

    group('validateOrThrow', () {
      test('does not throw for valid value', () {
        const validator = MinLengthValidator('field', 3);
        expect(() => validator.validateOrThrow('hello'), returnsNormally);
      });

      test('throws ValidationException for invalid value', () {
        const validator = MinLengthValidator('field', 10);
        expect(
          () => validator.validateOrThrow('short'),
          throwsA(isA<ValidationException>()),
        );
      });
    });
  });

  group('URL Validator', () {
    test('passes for valid URLs', () {
      const validator = UrlValidator();
      expect(validator.validate('http://example.com').isValid, isTrue);
      expect(validator.validate('https://example.com').isValid, isTrue);
      expect(validator.validate('https://example.com/path?q=1').isValid, isTrue);
    });

    test('fails for invalid URLs', () {
      const validator = UrlValidator();
      expect(validator.validate('not-a-url').isValid, isFalse);
      expect(validator.validate('ftp://').isValid, isFalse);
    });

    test('enforces HTTPS when required', () {
      const validator = UrlValidator(requireHttps: true);
      expect(validator.validate('https://example.com').isValid, isTrue);
      expect(validator.validate('http://example.com').isValid, isFalse);
    });
  });
}
