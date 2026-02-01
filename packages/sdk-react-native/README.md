# @intentos/sdk-react-native

React Native SDK for ISL-verified APIs with hooks, offline support, and full TypeScript integration.

## Features

- **Type-safe API Client** - Fully typed requests and responses from ISL schemas
- **React Hooks** - `useQuery`, `useMutation`, `useSubscription` for data fetching
- **Offline Support** - Automatic request queuing and sync when back online
- **Real-time Updates** - WebSocket subscriptions for live data
- **Secure Storage** - Encrypted token storage using Expo SecureStore
- **Input Validation** - Client-side validation matching ISL preconditions
- **Automatic Retry** - Configurable retry with exponential backoff
- **Cache Management** - Built-in query caching with TTL support

## Installation

```bash
npm install @intentos/sdk-react-native
# or
yarn add @intentos/sdk-react-native
```

### Peer Dependencies

```bash
npm install react react-native @react-native-async-storage/async-storage expo-secure-store zod
```

## Quick Start

### 1. Setup Provider

```tsx
import { ISLProvider } from '@intentos/sdk-react-native';

function App() {
  return (
    <ISLProvider
      config={{
        baseUrl: 'https://api.example.com',
        enableOffline: true,
      }}
      wsConfig={{
        url: 'wss://api.example.com/ws',
      }}
    >
      <YourApp />
    </ISLProvider>
  );
}
```

### 2. Use Hooks

```tsx
import { useQuery, useMutation } from '@intentos/sdk-react-native';
import { useCreateUser, useUser } from '@intentos/sdk-react-native/generated';

function UserProfile({ userId }) {
  // Fetch user data
  const { data: user, isLoading, error, refetch } = useUser(userId);

  if (isLoading) return <ActivityIndicator />;
  if (error) return <Text>Error: {error.message}</Text>;

  return (
    <View>
      <Text>{user.name}</Text>
      <Text>{user.email}</Text>
    </View>
  );
}

function CreateUserForm() {
  const { mutate, isLoading, error } = useCreateUser({
    onSuccess: (user) => {
      navigation.navigate('Profile', { userId: user.id });
    },
  });

  const handleSubmit = () => {
    mutate({
      email: 'user@example.com',
      username: 'newuser',
      password: 'SecurePass123',
    });
  };

  return (
    <Button
      title={isLoading ? 'Creating...' : 'Create User'}
      onPress={handleSubmit}
      disabled={isLoading}
    />
  );
}
```

### 3. Real-time Subscriptions

```tsx
import { useSubscription } from '@intentos/sdk-react-native';

function NotificationListener() {
  const { data, isConnected } = useSubscription('notifications', {
    onData: (notification) => {
      showLocalNotification(notification);
    },
  });

  return (
    <View>
      <Text>Status: {isConnected ? 'Connected' : 'Disconnected'}</Text>
    </View>
  );
}
```

## API Reference

### ISLProvider

Provider component that initializes the SDK.

```tsx
<ISLProvider
  config={{
    baseUrl: string;           // API base URL
    authToken?: string;        // Initial auth token
    enableOffline?: boolean;   // Enable offline support
    enableVerification?: boolean; // Enable ISL verification
    timeout?: number;          // Request timeout (ms)
    retry?: RetryConfig;       // Retry configuration
  }}
  wsConfig={{
    url: string;               // WebSocket URL
    reconnect?: boolean;       // Auto-reconnect
    reconnectInterval?: number; // Reconnect delay (ms)
  }}
/>
```

### useQuery

Hook for fetching data.

```tsx
const { data, error, isLoading, isRefetching, refetch, invalidate } = useQuery<TData, TError>(
  endpoint: string,
  options?: {
    enabled?: boolean;         // Enable/disable query
    params?: Record<string, unknown>; // Query params
    refetchInterval?: number;  // Auto-refetch interval (ms)
    staleTime?: number;        // Cache TTL (ms)
    onSuccess?: (data: TData) => void;
    onError?: (error: TError) => void;
  }
);
```

### useMutation

Hook for creating/updating/deleting data.

```tsx
const { mutate, mutateAsync, data, error, isLoading, reset } = useMutation<TInput, TData, TError>(
  endpoint: string,
  options?: {
    method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    validate?: (input: TInput) => ValidationResult;
    onSuccess?: (data: TData, input: TInput) => void;
    onError?: (error: TError, input: TInput) => void;
    invalidateKeys?: string[]; // Cache keys to invalidate
  }
);
```

### useSubscription

Hook for WebSocket subscriptions.

```tsx
const { data, isConnected, subscribe, unsubscribe, send } = useSubscription<TData>(
  channel: string,
  options?: {
    enabled?: boolean;
    onData?: (data: TData) => void;
    onConnect?: () => void;
    onDisconnect?: () => void;
  }
);
```

### Validation

```tsx
import { createValidator, Schemas, Validators } from '@intentos/sdk-react-native';

// Create validator from Zod schema
const validateEmail = createValidator(Schemas.Email);

// Use built-in validators
const result = Validators.length(3, 50)('test');

// Validate objects
const validation = validateObject(
  { email: 'test@example.com', age: 25 },
  {
    email: createValidator(Schemas.Email),
    age: Validators.range(18, 120),
  }
);
```

### Secure Storage

```tsx
import { SecureStorage, TokenStorage } from '@intentos/sdk-react-native';

// Store secure data
await SecureStorage.set('api_key', 'secret', { secure: true });

// Token management
await TokenStorage.setTokens(accessToken, refreshToken, expiresIn);
const token = await TokenStorage.getAccessToken();
const expired = await TokenStorage.isTokenExpired();
```

## Offline Support

The SDK automatically queues requests when offline and syncs when connectivity returns.

```tsx
import { useSyncStatus } from '@intentos/sdk-react-native';

function SyncIndicator() {
  const { isOnline, pendingCount, isSyncing, lastSyncAt } = useSyncStatus();

  return (
    <View>
      <Text>Status: {isOnline ? 'Online' : 'Offline'}</Text>
      {pendingCount > 0 && (
        <Text>{pendingCount} pending requests</Text>
      )}
      {isSyncing && <ActivityIndicator />}
    </View>
  );
}
```

## Generated Code

The SDK includes generated hooks and types from ISL schemas:

```tsx
// Generated from ISL User domain
import {
  useCreateUser,
  useUser,
  useUsers,
  useUpdateUser,
  useLogin,
  useRegister,
} from '@intentos/sdk-react-native/generated';

// Type-safe with full TypeScript support
const { mutate } = useCreateUser({
  onSuccess: (user) => {
    // user is typed as User
  },
  onError: (error) => {
    // error is typed as CreateUserError
    if (error.code === 'DUPLICATE_EMAIL') {
      // Handle specific error
    }
  },
});
```

## Error Handling

```tsx
const { error } = useCreateUser();

// Type-safe error handling
if (error) {
  switch (error.code) {
    case 'DUPLICATE_EMAIL':
      showError('Email already exists');
      break;
    case 'RATE_LIMITED':
      showError(`Try again in ${error.retryAfter} seconds`);
      break;
    case 'VALIDATION_ERROR':
      showFieldErrors(error.errors);
      break;
  }
}
```

## License

MIT
