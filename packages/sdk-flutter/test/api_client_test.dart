import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:isl_flutter_sdk/isl_client.dart';

void main() {
  late Dio dio;
  late DioAdapter dioAdapter;
  late ISLClient client;
  late InMemorySecureStorage storage;

  setUp(() {
    dio = Dio(BaseOptions(baseUrl: 'https://api.test.com'));
    dioAdapter = DioAdapter(dio: dio);
    storage = InMemorySecureStorage();

    client = ISLClient(
      config: const ISLClientConfig(
        baseUrl: 'https://api.test.com',
        enableVerification: true,
      ),
      storage: storage,
      dio: dio,
    );
  });

  group('ISLClient', () {
    group('createUser', () {
      test('returns success when user is created', () async {
        final userData = {
          'id': '123e4567-e89b-12d3-a456-426614174000',
          'email': 'test@example.com',
          'username': 'testuser',
          'status': 'PENDING',
          'createdAt': DateTime.now().toIso8601String(),
          'updatedAt': DateTime.now().toIso8601String(),
        };

        dioAdapter.onPost(
          '/api/users',
          (server) => server.reply(201, userData),
          data: {'email': 'test@example.com', 'username': 'testuser'},
        );

        final result = await client.createUser(const CreateUserInput(
          email: 'test@example.com',
          username: 'testuser',
        ));

        expect(
          result,
          isA<CreateUserSuccess>().having(
            (r) => r.user.email,
            'email',
            'test@example.com',
          ),
        );
      });

      test('returns duplicateEmail when email exists', () async {
        dioAdapter.onPost(
          '/api/users',
          (server) => server.reply(409, {'field': 'email'}),
          data: {'email': 'test@example.com', 'username': 'testuser'},
        );

        final result = await client.createUser(const CreateUserInput(
          email: 'test@example.com',
          username: 'testuser',
        ));

        expect(result, isA<CreateUserDuplicateEmail>());
      });

      test('returns invalidInput for invalid email', () async {
        final result = await client.createUser(const CreateUserInput(
          email: 'invalid-email',
          username: 'testuser',
        ));

        expect(
          result,
          isA<CreateUserInvalidInput>().having(
            (r) => r.message,
            'message',
            contains('email'),
          ),
        );
      });

      test('returns invalidInput for short username', () async {
        final result = await client.createUser(const CreateUserInput(
          email: 'test@example.com',
          username: 'ab',
        ));

        expect(result, isA<CreateUserInvalidInput>());
      });

      test('returns rateLimited on 429', () async {
        dioAdapter.onPost(
          '/api/users',
          (server) => server.reply(
            429,
            {},
            headers: {'Retry-After': ['60']},
          ),
          data: {'email': 'test@example.com', 'username': 'testuser'},
        );

        final result = await client.createUser(const CreateUserInput(
          email: 'test@example.com',
          username: 'testuser',
        ));

        expect(
          result,
          isA<CreateUserRateLimited>().having(
            (r) => r.retryAfter.inSeconds,
            'retryAfter',
            60,
          ),
        );
      });
    });

    group('getUser', () {
      test('returns success when user exists', () async {
        final userId = '123e4567-e89b-12d3-a456-426614174000';
        final userData = {
          'id': userId,
          'email': 'test@example.com',
          'username': 'testuser',
          'status': 'ACTIVE',
          'createdAt': DateTime.now().toIso8601String(),
          'updatedAt': DateTime.now().toIso8601String(),
        };

        dioAdapter.onGet(
          '/api/users/$userId',
          (server) => server.reply(200, userData),
        );

        final result = await client.getUser(userId);

        expect(
          result,
          isA<GetUserSuccess>().having(
            (r) => r.user.id,
            'id',
            userId,
          ),
        );
      });

      test('returns notFound when user does not exist', () async {
        final userId = '123e4567-e89b-12d3-a456-426614174000';

        dioAdapter.onGet(
          '/api/users/$userId',
          (server) => server.reply(404, {}),
        );

        final result = await client.getUser(userId);

        expect(result, isA<GetUserNotFound>());
      });

      test('returns notFound for invalid UUID', () async {
        final result = await client.getUser('invalid-uuid');

        expect(result, isA<GetUserNotFound>());
      });
    });

    group('login', () {
      test('returns success with session and user', () async {
        final sessionData = {
          'session': {
            'id': 'session-123',
            'userId': 'user-123',
            'accessToken': 'access-token',
            'refreshToken': 'refresh-token',
            'expiresAt': DateTime.now().add(const Duration(hours: 1)).toIso8601String(),
            'createdAt': DateTime.now().toIso8601String(),
            'status': 'ACTIVE',
          },
          'user': {
            'id': 'user-123',
            'email': 'test@example.com',
            'username': 'testuser',
            'status': 'ACTIVE',
            'createdAt': DateTime.now().toIso8601String(),
            'updatedAt': DateTime.now().toIso8601String(),
          },
        };

        dioAdapter.onPost(
          '/api/auth/login',
          (server) => server.reply(200, sessionData),
          data: {'email': 'test@example.com', 'password': 'password123'},
        );

        final result = await client.login(const LoginInput(
          email: 'test@example.com',
          password: 'password123',
        ));

        expect(result, isA<LoginSuccess>());

        // Verify tokens were stored
        expect(await storage.getAccessToken(), 'access-token');
        expect(await storage.getRefreshToken(), 'refresh-token');
      });

      test('returns invalidCredentials on 401', () async {
        dioAdapter.onPost(
          '/api/auth/login',
          (server) => server.reply(401, {}),
          data: {'email': 'test@example.com', 'password': 'wrong'},
        );

        final result = await client.login(const LoginInput(
          email: 'test@example.com',
          password: 'wrong',
        ));

        expect(result, isA<LoginInvalidCredentials>());
      });

      test('returns mfaRequired on 428', () async {
        dioAdapter.onPost(
          '/api/auth/login',
          (server) => server.reply(428, {'mfaToken': 'mfa-123'}),
          data: {'email': 'test@example.com', 'password': 'password123'},
        );

        final result = await client.login(const LoginInput(
          email: 'test@example.com',
          password: 'password123',
        ));

        expect(
          result,
          isA<LoginMfaRequired>().having(
            (r) => r.mfaToken,
            'mfaToken',
            'mfa-123',
          ),
        );
      });
    });

    group('logout', () {
      test('clears tokens on logout', () async {
        await storage.saveTokens(
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        );

        dioAdapter.onPost(
          '/api/auth/logout',
          (server) => server.reply(200, {}),
        );

        await client.logout();

        expect(await storage.getAccessToken(), isNull);
        expect(await storage.getRefreshToken(), isNull);
      });

      test('clears tokens even on server error', () async {
        await storage.saveTokens(
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        );

        dioAdapter.onPost(
          '/api/auth/logout',
          (server) => server.reply(500, {}),
        );

        await client.logout();

        expect(await storage.getAccessToken(), isNull);
        expect(await storage.getRefreshToken(), isNull);
      });
    });
  });

  group('Value Objects', () {
    group('Email', () {
      test('accepts valid email', () {
        expect(() => Email('test@example.com'), returnsNormally);
      });

      test('rejects invalid email format', () {
        expect(
          () => Email('invalid'),
          throwsA(isA<ValidationException>()),
        );
      });

      test('rejects email exceeding max length', () {
        final longEmail = '${'a' * 250}@b.com';
        expect(
          () => Email(longEmail),
          throwsA(isA<ValidationException>()),
        );
      });

      test('equality is case insensitive', () {
        expect(Email('Test@Example.com'), equals(Email('test@example.com')));
      });
    });

    group('Username', () {
      test('accepts valid username', () {
        expect(() => Username('valid_user'), returnsNormally);
      });

      test('rejects username too short', () {
        expect(
          () => Username('ab'),
          throwsA(isA<ValidationException>()),
        );
      });

      test('rejects username too long', () {
        expect(
          () => Username('a' * 31),
          throwsA(isA<ValidationException>()),
        );
      });

      test('rejects username with invalid characters', () {
        expect(
          () => Username('invalid user!'),
          throwsA(isA<ValidationException>()),
        );
      });
    });

    group('UserId', () {
      test('accepts valid UUID', () {
        expect(
          () => UserId('123e4567-e89b-12d3-a456-426614174000'),
          returnsNormally,
        );
      });

      test('rejects invalid UUID', () {
        expect(
          () => UserId('invalid-uuid'),
          throwsA(isA<ValidationException>()),
        );
      });
    });
  });

  group('Validators', () {
    test('EmailValidator validates correctly', () {
      const validator = EmailValidator();

      expect(validator.validate('test@example.com').isValid, isTrue);
      expect(validator.validate('invalid').isValid, isFalse);
    });

    test('MinLengthValidator validates correctly', () {
      const validator = MinLengthValidator('field', 5);

      expect(validator.validate('hello').isValid, isTrue);
      expect(validator.validate('hi').isValid, isFalse);
    });

    test('RangeValidator validates correctly', () {
      const validator = RangeValidator<int>('age', min: 18, max: 100);

      expect(validator.validate(25).isValid, isTrue);
      expect(validator.validate(15).isValid, isFalse);
      expect(validator.validate(101).isValid, isFalse);
    });
  });

  group('Result', () {
    test('Success contains value', () {
      const result = Result<int, String>.success(42);

      expect(result.isSuccess, isTrue);
      expect(result.valueOrNull, 42);
      expect(result.errorOrNull, isNull);
    });

    test('Failure contains error', () {
      const result = Result<int, String>.failure('error');

      expect(result.isFailure, isTrue);
      expect(result.valueOrNull, isNull);
      expect(result.errorOrNull, 'error');
    });

    test('map transforms success value', () {
      const result = Result<int, String>.success(42);
      final mapped = result.map((v) => v * 2);

      expect(mapped.valueOrNull, 84);
    });

    test('map preserves failure', () {
      const result = Result<int, String>.failure('error');
      final mapped = result.map((v) => v * 2);

      expect(mapped.errorOrNull, 'error');
    });

    test('when handles both cases', () {
      const success = Result<int, String>.success(42);
      const failure = Result<int, String>.failure('error');

      final successResult = success.when(
        success: (v) => 'value: $v',
        failure: (e) => 'error: $e',
      );

      final failureResult = failure.when(
        success: (v) => 'value: $v',
        failure: (e) => 'error: $e',
      );

      expect(successResult, 'value: 42');
      expect(failureResult, 'error: error');
    });
  });
}
