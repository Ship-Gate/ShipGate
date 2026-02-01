# ISL codegen-graphql

Generate GraphQL schemas, resolvers, and type definitions from ISL specifications. Supports both schema-first and code-first approaches with full type safety.

## Features

- **Schema Generation**: SDL schema from ISL domain definitions
- **Resolver Generation**: Type-safe resolvers with verification
- **Federation Support**: Apollo Federation v2 compatible schemas
- **Subscriptions**: Real-time subscription resolvers
- **Input Validation**: Automatic validation based on ISL constraints
- **Error Handling**: ISL error types mapped to GraphQL errors
- **DataLoader Integration**: Automatic batching for N+1 prevention
- **Type Guards**: Runtime type checking for GraphQL inputs

## Installation

```bash
npm install @isl/codegen-graphql
```

## Quick Start

### Generate Schema

```typescript
import { generateGraphQLSchema } from '@isl/codegen-graphql';
import { parseISL } from '@isl/isl-core';

const ast = parseISL(`
  domain Users {
    entity User {
      id: ID
      email: Email
      username: String
      status: UserStatus
    }
    
    enum UserStatus { PENDING, ACTIVE, SUSPENDED }
    
    behavior GetUser {
      input { id: ID }
      output {
        | Success { user: User }
        | NotFound
      }
    }
    
    behavior CreateUser {
      input { email: Email, username: String }
      output {
        | Success { user: User }
        | DuplicateEmail
        | InvalidInput { message: String }
      }
    }
  }
`);

const schema = generateGraphQLSchema(ast, {
  federation: false,
  subscriptions: true,
});

console.log(schema);
```

### Generated Schema

```graphql
type Query {
  user(id: ID!): UserResult!
  users(first: Int, after: String): UserConnection!
}

type Mutation {
  createUser(input: CreateUserInput!): CreateUserResult!
  updateUser(id: ID!, input: UpdateUserInput!): UpdateUserResult!
  deleteUser(id: ID!): DeleteUserResult!
}

type Subscription {
  userUpdated(id: ID!): User!
}

type User {
  id: ID!
  email: String!
  username: String!
  status: UserStatus!
  createdAt: DateTime!
  updatedAt: DateTime!
}

enum UserStatus {
  PENDING
  ACTIVE
  SUSPENDED
}

input CreateUserInput {
  email: String!
  username: String!
}

union UserResult = UserSuccess | UserNotFound

type UserSuccess {
  user: User!
}

type UserNotFound {
  message: String!
}

union CreateUserResult = 
  | CreateUserSuccess 
  | DuplicateEmailError 
  | InvalidInputError

type CreateUserSuccess {
  user: User!
}

type DuplicateEmailError {
  message: String!
}

type InvalidInputError {
  message: String!
  field: String
}
```

### Generate Resolvers

```typescript
import { generateResolvers } from '@isl/codegen-graphql';

const resolvers = generateResolvers(ast, {
  framework: 'apollo',
  typescript: true,
  verification: true,
});

console.log(resolvers);
```

### Generated Resolvers (TypeScript)

```typescript
import { Resolvers } from './generated/types';
import { UserService } from './services/user-service';
import { verifyPreconditions, verifyPostconditions } from '@isl/verification';

export const resolvers: Resolvers = {
  Query: {
    user: async (_, { id }, { dataSources }) => {
      // Precondition verification
      verifyPreconditions('GetUser', { id });
      
      const result = await dataSources.users.getUser(id);
      
      if (result.ok) {
        return { __typename: 'UserSuccess', user: result.data };
      }
      
      return { __typename: 'UserNotFound', message: 'User not found' };
    },
    
    users: async (_, { first, after }, { dataSources }) => {
      return dataSources.users.listUsers({ first, after });
    },
  },
  
  Mutation: {
    createUser: async (_, { input }, { dataSources }) => {
      // Precondition verification
      verifyPreconditions('CreateUser', input);
      
      const result = await dataSources.users.createUser(input);
      
      // Postcondition verification
      if (result.ok) {
        verifyPostconditions('CreateUser', input, result.data);
        return { __typename: 'CreateUserSuccess', user: result.data };
      }
      
      switch (result.error.code) {
        case 'DUPLICATE_EMAIL':
          return { __typename: 'DuplicateEmailError', message: 'Email already exists' };
        case 'INVALID_INPUT':
          return { __typename: 'InvalidInputError', message: result.error.message };
        default:
          throw new Error('Unexpected error');
      }
    },
  },
  
  Subscription: {
    userUpdated: {
      subscribe: (_, { id }, { pubsub }) => {
        return pubsub.asyncIterator(`USER_UPDATED_${id}`);
      },
    },
  },
};
```

## Apollo Federation

```typescript
const federatedSchema = generateGraphQLSchema(ast, {
  federation: true,
  federationVersion: 2,
  subgraphName: 'users',
});
```

```graphql
extend schema
  @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key", "@shareable"])

type User @key(fields: "id") {
  id: ID!
  email: String!
  username: String!
  status: UserStatus!
}
```

## DataLoader Integration

```typescript
const resolvers = generateResolvers(ast, {
  dataLoader: true,
});
```

```typescript
// Generated DataLoader setup
export function createLoaders(services: Services) {
  return {
    userById: new DataLoader<string, User>(async (ids) => {
      const users = await services.users.getByIds(ids);
      return ids.map(id => users.find(u => u.id === id) ?? null);
    }),
  };
}
```

## Configuration

```typescript
interface GraphQLGeneratorConfig {
  // Schema options
  federation?: boolean;
  federationVersion?: 1 | 2;
  subscriptions?: boolean;
  
  // Resolver options
  framework?: 'apollo' | 'yoga' | 'mercurius';
  typescript?: boolean;
  verification?: boolean;
  dataLoader?: boolean;
  
  // Naming conventions
  inputSuffix?: string;
  resultSuffix?: string;
  
  // Custom scalars
  customScalars?: Record<string, string>;
  
  // Output
  outputDir?: string;
  schemaFile?: string;
  resolversFile?: string;
  typesFile?: string;
}
```

## License

MIT License
