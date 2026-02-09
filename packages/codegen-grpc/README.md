# @intentos/codegen-grpc

Generate Protocol Buffers definitions and gRPC service stubs from ISL (Intent Specification Language) domain definitions.

## Features

- **Proto Generation**: Convert ISL types, entities, and behaviors to `.proto` files
- **Validation**: Include protoc-gen-validate rules from ISL constraints
- **Buf Integration**: Generate `buf.yaml` and `buf.gen.yaml` for the Buf ecosystem
- **TypeScript Stubs**: Generate gRPC client and server stubs for TypeScript
- **Go Stubs**: Generate gRPC client and server stubs for Go
- **Connect-RPC**: Generate Connect-RPC clients with React hooks

## Installation

```bash
pnpm add @intentos/codegen-grpc
```

## Usage

### Basic Proto Generation

```typescript
import { generate } from '@intentos/codegen-grpc';
import type { Domain } from '@intentos/isl-core';

const domain: Domain = /* ... your parsed ISL domain ... */;

const files = generate(domain, {
  package: 'domain.users.v1',
  includeValidation: true,
});

// Write files to disk
for (const file of files) {
  fs.writeFileSync(file.path, file.content);
}
```

### Generate Proto Only

```typescript
import { generateProtoOnly } from '@intentos/codegen-grpc';

const protoContent = generateProtoOnly(domain, {
  package: 'domain.users.v1',
  includeValidation: true,
});

console.log(protoContent);
```

### Generate Complete Buf Project

```typescript
import { generateBufProject } from '@intentos/codegen-grpc';

const files = generateBufProject(
  domain,
  'myorganization',  // buf.build organization
  'users'            // module name
);

// Generates:
// - users.proto
// - buf.yaml
// - buf.gen.yaml
// - gen/ts/... (TypeScript stubs)
// - gen/go/... (Go stubs)
// - gen/connect/... (Connect-RPC client)
```

## Output Examples

### Proto File

```protobuf
syntax = "proto3";

package domain.users.v1;

import "google/protobuf/timestamp.proto";
import "validate/validate.proto";

// Types
message Email {
  string value = 1 [(validate.rules).string.pattern = "^[^\\s@]+@[^\\s@]+$"];
}

// Enums
enum UserStatus {
  USER_STATUS_UNSPECIFIED = 0;
  USER_STATUS_PENDING = 1;
  USER_STATUS_ACTIVE = 2;
  USER_STATUS_SUSPENDED = 3;
}

// Entities
message User {
  string id = 1;
  Email email = 2;
  UserStatus status = 3;
  google.protobuf.Timestamp created_at = 4;
}

// Behavior: CreateUser
message CreateUserRequest {
  Email email = 1 [(validate.rules).message.required = true];
  string idempotency_key = 2;
}

message CreateUserResponse {
  oneof result {
    User user = 1;
    CreateUserError error = 2;
  }
}

message CreateUserError {
  enum Code {
    CODE_UNSPECIFIED = 0;
    CODE_DUPLICATE_EMAIL = 1;
    CODE_INVALID_INPUT = 2;
  }
  Code code = 1;
  string message = 2;
  bool retriable = 3;
}

// Service
service UserService {
  rpc CreateUser(CreateUserRequest) returns (CreateUserResponse) {
    option idempotency_level = IDEMPOTENT;
  }
  
  rpc GetUser(GetUserRequest) returns (GetUserResponse);
  rpc UpdateUser(UpdateUserRequest) returns (UpdateUserResponse);
  rpc DeleteUser(DeleteUserRequest) returns (DeleteUserResponse);
  rpc ListUsers(ListUsersRequest) returns (ListUsersResponse);
  
  // Streaming
  rpc WatchUser(WatchUserRequest) returns (stream UserEvent);
}
```

### buf.yaml

```yaml
version: v1
name: buf.build/myorg/users
deps:
  - buf.build/envoyproxy/protoc-gen-validate
breaking:
  use:
    - FILE
lint:
  use:
    - DEFAULT
```

### Connect-RPC TypeScript Client

```typescript
import { createUserServiceClient, UserServiceTypedClient } from './gen/connect/users_connect';

// Simple client
const client = createUserServiceClient({
  baseUrl: 'https://api.example.com',
  useBrowser: true,
});

// Type-safe response handling
const response = await client.createUser({
  email: { value: 'user@example.com' },
  idempotencyKey: 'key-123',
});

if (response.result.case === 'user') {
  console.log('Created:', response.result.value);
} else {
  console.log('Error:', response.result.value.code);
}

// Typed wrapper with Result pattern
const typedClient = new UserServiceTypedClient({
  baseUrl: 'https://api.example.com',
});

const result = await typedClient.createUser({ email: { value: 'user@example.com' } });
if (result.success) {
  console.log('User:', result.data.user);
} else {
  console.error('Error:', result.error.message);
}
```

### React Hooks

```tsx
import { UserServiceProvider, useUser, useCreateUser } from './gen/connect/users_hooks';

function App() {
  return (
    <UserServiceProvider options={{ baseUrl: 'https://api.example.com' }}>
      <UserList />
    </UserServiceProvider>
  );
}

function UserList() {
  const { data, isLoading } = useUserList();
  const createMutation = useCreateUser();

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      {data?.users.map(user => (
        <div key={user.id}>{user.email.value}</div>
      ))}
      <button onClick={() => createMutation.mutate({ email: { value: 'new@example.com' } })}>
        Create User
      </button>
    </div>
  );
}
```

## Mapping Rules

### Type Mapping (ISL → Proto)

| ISL Type     | Proto Type                      | Notes                          |
|--------------|---------------------------------|--------------------------------|
| `String`     | `string`                        |                                |
| `Int`        | `int64`                         |                                |
| `Decimal`    | `double`                        |                                |
| `Boolean`    | `bool`                          |                                |
| `Timestamp`  | `google.protobuf.Timestamp`     | Adds import                    |
| `UUID`       | `string`                        |                                |
| `Duration`   | `google.protobuf.Duration`      | Adds import                    |
| `List<T>`    | `repeated T`                    |                                |
| `Map<K,V>`   | `map<K, V>`                     | Keys must be scalar            |
| `Optional<T>`| `optional T`                    |                                |
| Enum         | `enum` with `_UNSPECIFIED = 0`  | SCREAMING_SNAKE_CASE values    |
| Struct       | `message`                       | Fields get sequential numbers  |
| Union        | `message` with `oneof`          | Each variant is a nested type  |
| Constrained  | Wrapper `message` + validation  | e.g., `Email { string value }` |

### Naming Rules

| Context         | Convention            | Example                        |
|-----------------|-----------------------|--------------------------------|
| Package         | `lower.dot.separated` | `domain.users.v1`             |
| Service         | `PascalCase + Service`| `UserService`                  |
| RPC             | `PascalCase`          | `CreateUser`                   |
| Message         | `PascalCase`          | `CreateUserRequest`            |
| Field           | `snake_case`          | `created_at`                   |
| Enum            | `PascalCase`          | `UserStatus`                   |
| Enum value      | `PREFIX_SCREAMING`    | `USER_STATUS_ACTIVE`           |
| Field numbers   | Sequential from 1     | Deterministic per declaration  |

### Error-to-gRPC-Status-Code Mapping

ISL error names are pattern-matched to gRPC status codes:

| ISL Error Pattern                        | gRPC Status Code       | Code |
|------------------------------------------|------------------------|------|
| `CREDENTIALS`, `AUTH_FAILED`, `TOKEN_*`  | `UNAUTHENTICATED`      | 16   |
| `NOT_FOUND`, `MISSING`, `NO_SUCH`        | `NOT_FOUND`            | 5    |
| `DUPLICATE`, `ALREADY_EXISTS`, `CONFLICT`| `ALREADY_EXISTS`       | 6    |
| `DENIED`, `FORBIDDEN`, `LOCKED`          | `PERMISSION_DENIED`    | 7    |
| `INVALID`, `VALIDATION`, `MALFORMED`     | `INVALID_ARGUMENT`     | 3    |
| `PRECONDITION`, `INACTIVE`, `EXPIRED`    | `FAILED_PRECONDITION`  | 9    |
| `RATE_LIMIT`, `THROTTLE`, `QUOTA`        | `RESOURCE_EXHAUSTED`   | 8    |
| `TIMEOUT`, `DEADLINE`, `TIMED_OUT`       | `DEADLINE_EXCEEDED`    | 4    |
| `ABORT`, `CONCURRENT`, `STALE`           | `ABORTED`              | 10   |
| Retriable (no pattern match)             | `UNAVAILABLE`          | 14   |
| Non-retriable (no pattern match)         | `INTERNAL`             | 13   |

Use the error mapping API directly:

```typescript
import { mapErrorToGrpcStatus, mapBehaviorErrors, GrpcStatusCode } from '@intentos/codegen-grpc';

const mapped = mapErrorToGrpcStatus(error);
// { islErrorName: 'DUPLICATE_EMAIL', grpcCode: 6, grpcCodeName: 'ALREADY_EXISTS', ... }
```

## Binding Behaviors to gRPC Methods

Each ISL `behavior` maps to one gRPC RPC method:

1. **Behavior name** → RPC name (PascalCase)
2. **`input` block fields** → `<Behavior>Request` message fields
3. **`output.success` type** → `<Behavior>Response` `oneof result` success branch
4. **`output.errors`** → `<Behavior>Error` message with error code enum
5. **Behaviors are grouped by entity** into a single `service` (heuristic: name prefix matching like `CreateUser` → `UserService`)

### Behavior grouping example

```
behavior CreateUser → UserService.CreateUser
behavior GetUser   → UserService.GetUser
behavior Login     → UserService.Login  (matched to User entity)
```

### CRUD generation

When `generateCrud: true`, each entity automatically gets:
- `Create<Entity>`, `Get<Entity>`, `Update<Entity>`, `Delete<Entity>`, `List<Entity>s`
- `Watch<Entity>` (if `generateStreaming: true`)

## Golden Tests

Golden output files live in `samples/golden/`. To regenerate after intentional changes:

```bash
UPDATE_GOLDEN=1 npx vitest run tests/generate-golden.test.ts
```

## API Reference

### `generate(domain, options)`

Main function to generate all proto and stub files.

**Options:**
- `package`: Proto package name (required)
- `includeValidation`: Include protoc-gen-validate rules
- `includeConnect`: Generate Connect-RPC TypeScript client
- `goPackage`: Go package path
- `generateGo`: Generate Go stubs
- `generateTypeScript`: Generate TypeScript stubs
- `generateStreaming`: Include streaming RPCs
- `generateCrud`: Generate CRUD services for entities
- `bufOrganization`: Buf.build organization name
- `bufModule`: Buf.build module name

### `generateProtoTypes(types, options)`

Generate proto type definitions from ISL type declarations.

### `generateProtoEnums(enums, options)`

Generate proto enums from ISL enum declarations.

### `generateProtoMessages(entities, options)`

Generate proto messages from ISL entities.

### `generateProtoServices(behaviors, entities, options)`

Generate proto services from ISL behaviors.

### `generateCrudService(entity, options)`

Generate a complete CRUD service for an entity.

### `mapErrorToGrpcStatus(error)`

Map a single ISL error to a gRPC status code.

### `mapBehaviorErrors(errors)`

Map all errors from a behavior to gRPC status codes.

## License

MIT
