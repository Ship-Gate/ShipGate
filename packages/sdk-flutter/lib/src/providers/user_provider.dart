import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../client/api_client.dart';
import '../models/generated.dart';
import '../models/pagination.dart';
import 'isl_provider.dart';

/// Controller for user operations
class UserController extends StateNotifier<UserControllerState> {
  final ISLClient _client;

  UserController({required ISLClient client})
      : _client = client,
        super(const UserControllerState.initial());

  /// Create a new user
  Future<CreateUserResult> create(CreateUserInput input) async {
    state = const UserControllerState.loading();

    final result = await _client.createUser(input);

    result.when(
      success: (user) {
        state = UserControllerState.loaded(user: user);
      },
      duplicateEmail: () {
        state = const UserControllerState.error('Email already exists');
      },
      duplicateUsername: () {
        state = const UserControllerState.error('Username already exists');
      },
      invalidInput: (message) {
        state = UserControllerState.error(message);
      },
      rateLimited: (retry) {
        state = UserControllerState.error(
          'Too many requests. Try again in ${retry.inSeconds}s',
        );
      },
    );

    return result;
  }

  /// Load a user by ID
  Future<void> load(String userId) async {
    state = const UserControllerState.loading();

    final result = await _client.getUser(userId);

    result.when(
      success: (user) {
        state = UserControllerState.loaded(user: user);
      },
      notFound: () {
        state = const UserControllerState.error('User not found');
      },
      forbidden: () {
        state = const UserControllerState.error('Access denied');
      },
    );
  }

  /// Update the current user
  Future<UpdateUserResult?> update(UpdateUserInput input) async {
    final currentUser = state.user;
    if (currentUser == null) return null;

    state = UserControllerState.loading(user: currentUser);

    final result = await _client.updateUser(currentUser.id, input);

    result.when(
      success: (user) {
        state = UserControllerState.loaded(user: user);
      },
      notFound: () {
        state = const UserControllerState.error('User not found');
      },
      duplicateEmail: () {
        state = UserControllerState.error(
          'Email already exists',
          user: currentUser,
        );
      },
      duplicateUsername: () {
        state = UserControllerState.error(
          'Username already exists',
          user: currentUser,
        );
      },
      invalidInput: (message) {
        state = UserControllerState.error(message, user: currentUser);
      },
      forbidden: () {
        state = UserControllerState.error('Access denied', user: currentUser);
      },
    );

    return result;
  }

  /// Clear the current user
  void clear() {
    state = const UserControllerState.initial();
  }
}

/// State for UserController
abstract class UserControllerState {
  const UserControllerState();

  const factory UserControllerState.initial() = _InitialUserState;
  const factory UserControllerState.loading({User? user}) = _LoadingUserState;
  const factory UserControllerState.loaded({required User user}) =
      _LoadedUserState;
  const factory UserControllerState.error(String message, {User? user}) =
      _ErrorUserState;

  bool get isLoading;
  bool get hasError;
  User? get user;
  String? get errorMessage;

  T when<T>({
    required T Function() initial,
    required T Function(User? user) loading,
    required T Function(User user) loaded,
    required T Function(String message, User? user) error,
  });
}

class _InitialUserState extends UserControllerState {
  const _InitialUserState();

  @override
  bool get isLoading => false;

  @override
  bool get hasError => false;

  @override
  User? get user => null;

  @override
  String? get errorMessage => null;

  @override
  T when<T>({
    required T Function() initial,
    required T Function(User? user) loading,
    required T Function(User user) loaded,
    required T Function(String message, User? user) error,
  }) =>
      initial();
}

class _LoadingUserState extends UserControllerState {
  @override
  final User? user;

  const _LoadingUserState({this.user});

  @override
  bool get isLoading => true;

  @override
  bool get hasError => false;

  @override
  String? get errorMessage => null;

  @override
  T when<T>({
    required T Function() initial,
    required T Function(User? user) loading,
    required T Function(User user) loaded,
    required T Function(String message, User? user) error,
  }) =>
      loading(user);
}

class _LoadedUserState extends UserControllerState {
  @override
  final User user;

  const _LoadedUserState({required this.user});

  @override
  bool get isLoading => false;

  @override
  bool get hasError => false;

  @override
  String? get errorMessage => null;

  @override
  T when<T>({
    required T Function() initial,
    required T Function(User? user) loading,
    required T Function(User user) loaded,
    required T Function(String message, User? user) error,
  }) =>
      loaded(user);
}

class _ErrorUserState extends UserControllerState {
  final String message;
  @override
  final User? user;

  const _ErrorUserState(this.message, {this.user});

  @override
  bool get isLoading => false;

  @override
  bool get hasError => true;

  @override
  String? get errorMessage => message;

  @override
  T when<T>({
    required T Function() initial,
    required T Function(User? user) loading,
    required T Function(User user) loaded,
    required T Function(String message, User? user) error,
  }) =>
      error(message, user);
}

/// Provider for UserController
final userControllerProvider =
    StateNotifierProvider<UserController, UserControllerState>((ref) {
  final client = ref.watch(islClientProvider);
  return UserController(client: client);
});

/// Provider for listing users with pagination
final usersListProvider = FutureProvider.family<PaginatedResponse<User>,
    UsersListParams>((ref, params) async {
  final client = ref.watch(islClientProvider);
  return client.listUsers(
    pagination: params.pagination,
    status: params.status,
  );
});

/// Parameters for users list provider
class UsersListParams {
  final PaginationParams? pagination;
  final UserStatus? status;

  const UsersListParams({
    this.pagination,
    this.status,
  });

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is UsersListParams &&
          pagination?.page == other.pagination?.page &&
          pagination?.pageSize == other.pagination?.pageSize &&
          status == other.status;

  @override
  int get hashCode => Object.hash(
        pagination?.page,
        pagination?.pageSize,
        status,
      );
}

/// Provider for a single user by ID
final userByIdProvider =
    FutureProvider.family<User?, String>((ref, userId) async {
  final client = ref.watch(islClientProvider);
  final result = await client.getUser(userId);

  return result.when(
    success: (user) => user,
    notFound: () => null,
    forbidden: () => null,
  );
});

/// Provider for user search
final userSearchProvider =
    FutureProvider.family<List<User>, String>((ref, query) async {
  if (query.length < 2) return [];

  final client = ref.watch(islClientProvider);
  final response = await client.listUsers(
    pagination: const PaginationParams(pageSize: 10),
  );

  // Filter client-side for now (in real app, this would be server-side)
  return response.items
      .where((user) =>
          user.username.toLowerCase().contains(query.toLowerCase()) ||
          user.email.toLowerCase().contains(query.toLowerCase()) ||
          (user.displayName?.toLowerCase().contains(query.toLowerCase()) ??
              false))
      .toList();
});
