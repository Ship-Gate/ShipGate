import 'package:flutter_test/flutter_test.dart';
import 'package:isl_flutter_sdk/isl_client.dart';

void main() {
  group('ContractVerifier', () {
    group('Preconditions', () {
      test('passes when all preconditions are met', () {
        final verifier = ContractVerifier(
          enabled: true,
          mode: VerificationMode.strict,
        );

        expect(
          () => verifier.verifyPreconditions('testBehavior', [
            PreconditionCheck(
              name: 'positive',
              condition: () => true,
              errorMessage: 'Value must be positive',
            ),
          ]),
          returnsNormally,
        );
      });

      test('throws when precondition fails in strict mode', () {
        final verifier = ContractVerifier(
          enabled: true,
          mode: VerificationMode.strict,
        );

        expect(
          () => verifier.verifyPreconditions('testBehavior', [
            PreconditionCheck(
              name: 'positive',
              condition: () => false,
              errorMessage: 'Value must be positive',
            ),
          ]),
          throwsA(isA<ContractViolationException>()),
        );
      });

      test('does not throw when disabled', () {
        final verifier = ContractVerifier(
          enabled: false,
          mode: VerificationMode.strict,
        );

        expect(
          () => verifier.verifyPreconditions('testBehavior', [
            PreconditionCheck(
              name: 'positive',
              condition: () => false,
              errorMessage: 'Value must be positive',
            ),
          ]),
          returnsNormally,
        );
      });

      test('does not throw in logOnly mode', () {
        final verifier = ContractVerifier(
          enabled: true,
          mode: VerificationMode.logOnly,
        );

        expect(
          () => verifier.verifyPreconditions('testBehavior', [
            PreconditionCheck(
              name: 'positive',
              condition: () => false,
              errorMessage: 'Value must be positive',
            ),
          ]),
          returnsNormally,
        );
      });
    });

    group('Postconditions', () {
      test('passes when all postconditions are met', () {
        final verifier = ContractVerifier(
          enabled: true,
          mode: VerificationMode.strict,
        );

        expect(
          () => verifier.verifyPostconditions('testBehavior', [
            PostconditionCheck(
              name: 'result_valid',
              condition: () => true,
              expected: 'valid',
              actual: 'valid',
            ),
          ]),
          returnsNormally,
        );
      });

      test('throws when postcondition fails in strict mode', () {
        final verifier = ContractVerifier(
          enabled: true,
          mode: VerificationMode.strict,
        );

        expect(
          () => verifier.verifyPostconditions('testBehavior', [
            PostconditionCheck(
              name: 'result_valid',
              condition: () => false,
              expected: 'valid',
              actual: 'invalid',
            ),
          ]),
          throwsA(isA<ContractViolationException>()),
        );
      });

      test('includes expected and actual in exception', () {
        final verifier = ContractVerifier(
          enabled: true,
          mode: VerificationMode.strict,
        );

        try {
          verifier.verifyPostconditions('testBehavior', [
            PostconditionCheck(
              name: 'email_matches',
              condition: () => false,
              expected: 'test@example.com',
              actual: 'wrong@example.com',
            ),
          ]);
          fail('Expected exception');
        } on ContractViolationException catch (e) {
          expect(e.expected, 'test@example.com');
          expect(e.actual, 'wrong@example.com');
          expect(e.contractType, 'postcondition');
        }
      });
    });

    group('Invariants', () {
      test('passes when all invariants hold', () {
        final verifier = ContractVerifier(
          enabled: true,
          mode: VerificationMode.strict,
        );

        expect(
          () => verifier.verifyInvariants('Entity', [
            InvariantCheck(
              name: 'balance_positive',
              condition: () => true,
              expected: '>= 0',
              actual: '100',
            ),
          ]),
          returnsNormally,
        );
      });

      test('throws when invariant is violated', () {
        final verifier = ContractVerifier(
          enabled: true,
          mode: VerificationMode.strict,
        );

        expect(
          () => verifier.verifyInvariants('Account', [
            InvariantCheck(
              name: 'balance_positive',
              condition: () => false,
              expected: '>= 0',
              actual: '-50',
            ),
          ]),
          throwsA(isA<ContractViolationException>()),
        );
      });
    });

    group('Callback notification', () {
      test('calls onViolation callback', () {
        ContractViolation? capturedViolation;

        final verifier = ContractVerifier(
          enabled: true,
          mode: VerificationMode.logOnly,
          onViolation: (violation) {
            capturedViolation = violation;
          },
        );

        verifier.verifyPostconditions('testBehavior', [
          PostconditionCheck(
            name: 'failed_check',
            condition: () => false,
            expected: 'A',
            actual: 'B',
          ),
        ]);

        expect(capturedViolation, isNotNull);
        expect(capturedViolation!.behaviorName, 'testBehavior');
        expect(capturedViolation!.checkName, 'failed_check');
        expect(capturedViolation!.type, ContractViolationType.postcondition);
      });
    });

    group('Multiple checks', () {
      test('verifies all checks in order', () {
        final verifier = ContractVerifier(
          enabled: true,
          mode: VerificationMode.strict,
        );

        final checkOrder = <String>[];

        expect(
          () => verifier.verifyPostconditions('testBehavior', [
            PostconditionCheck(
              name: 'check1',
              condition: () {
                checkOrder.add('check1');
                return true;
              },
              expected: 'A',
              actual: 'A',
            ),
            PostconditionCheck(
              name: 'check2',
              condition: () {
                checkOrder.add('check2');
                return true;
              },
              expected: 'B',
              actual: 'B',
            ),
          ]),
          returnsNormally,
        );

        expect(checkOrder, ['check1', 'check2']);
      });

      test('stops on first failure', () {
        final verifier = ContractVerifier(
          enabled: true,
          mode: VerificationMode.strict,
        );

        final checkOrder = <String>[];

        expect(
          () => verifier.verifyPostconditions('testBehavior', [
            PostconditionCheck(
              name: 'check1',
              condition: () {
                checkOrder.add('check1');
                return false; // Fails
              },
              expected: 'A',
              actual: 'B',
            ),
            PostconditionCheck(
              name: 'check2',
              condition: () {
                checkOrder.add('check2');
                return true;
              },
              expected: 'C',
              actual: 'C',
            ),
          ]),
          throwsA(isA<ContractViolationException>()),
        );

        // Second check should not be reached
        expect(checkOrder, ['check1']);
      });
    });
  });

  group('ContractViolation', () {
    test('toString includes all information', () {
      final violation = ContractViolation(
        type: ContractViolationType.postcondition,
        behaviorName: 'createUser',
        checkName: 'email_matches',
        message: 'Email mismatch',
        expected: 'a@b.com',
        actual: 'c@d.com',
      );

      final str = violation.toString();
      expect(str, contains('postcondition'));
      expect(str, contains('createUser'));
      expect(str, contains('email_matches'));
      expect(str, contains('a@b.com'));
      expect(str, contains('c@d.com'));
    });

    test('toJson serializes correctly', () {
      final violation = ContractViolation(
        type: ContractViolationType.precondition,
        behaviorName: 'login',
        checkName: 'email_valid',
        message: 'Invalid email',
      );

      final json = violation.toJson();
      expect(json['type'], 'precondition');
      expect(json['behaviorName'], 'login');
      expect(json['checkName'], 'email_valid');
      expect(json['timestamp'], isA<String>());
    });
  });

  group('Contract Extensions', () {
    test('verify extension validates condition', () {
      expect(() => 10.verify((v) => v > 0, 'Must be positive'), returnsNormally);
      expect(
        () => (-5).verify((v) => v > 0, 'Must be positive'),
        throwsA(isA<ContractViolationException>()),
      );
    });

    test('verifyNotNull extension validates non-null', () {
      const String? validValue = 'hello';
      const String? nullValue = null;

      expect(() => validValue.verifyNotNull('value'), returnsNormally);
      expect(
        () => nullValue.verifyNotNull('value'),
        throwsA(isA<ValidationException>()),
      );
    });
  });
}
