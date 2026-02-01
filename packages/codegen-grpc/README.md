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

### `generateProtoMessages(entities, options)`

Generate proto messages from ISL entities.

### `generateProtoServices(behaviors, entities, options)`

Generate proto services from ISL behaviors.

### `generateCrudService(entity, options)`

Generate a complete CRUD service for an entity.

## License

MIT
