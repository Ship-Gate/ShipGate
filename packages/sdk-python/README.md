# ISL Python SDK

Native Python SDK for ISL-verified APIs with async support, Pydantic models, and runtime verification.

## Features

- **Async/Await First**: Built on `httpx` for native async support
- **Pydantic Models**: Type-safe request/response handling with validation
- **Runtime Verification**: Automatic pre/postcondition checking
- **Retry Logic**: Exponential backoff with `tenacity`
- **WebSocket Support**: Real-time updates via async generators
- **Structured Logging**: Built-in `structlog` integration
- **Type Hints**: Full typing support for IDE completion

## Installation

```bash
pip install isl-sdk
```

Or with Poetry:

```bash
poetry add isl-sdk
```

## Quick Start

### Initialize the Client

```python
from isl import ISLClient

# Simple initialization
client = ISLClient(
    base_url="https://api.example.com",
    auth_token="your-token"
)

# With full configuration
client = ISLClient(
    base_url="https://api.example.com",
    auth_token="your-token",
    timeout=30.0,
    retry_config=RetryConfig(max_retries=3),
    verification_config=VerificationConfig(
        enable_preconditions=True,
        enable_postconditions=True
    )
)
```

### Make API Calls

```python
from isl.models import CreateUserInput, UserStatus
from isl.results import CreateUserResult

# Async context
async def create_user():
    result = await client.users.create_user(
        CreateUserInput(
            email="user@example.com",
            username="newuser"
        )
    )
    
    match result:
        case CreateUserResult.Success(user=user):
            print(f"User created: {user.id}")
        case CreateUserResult.DuplicateEmail():
            print("Email already exists")
        case CreateUserResult.InvalidInput(message=msg):
            print(f"Invalid input: {msg}")
        case CreateUserResult.RateLimited(retry_after=seconds):
            print(f"Rate limited, retry after {seconds}s")

# Or use the sync wrapper
from isl import SyncISLClient

sync_client = SyncISLClient(base_url="https://api.example.com")
result = sync_client.users.create_user(input_data)
```

### Real-time Updates with WebSocket

```python
async def watch_user_updates():
    async for user in client.users.observe_user("user-123"):
        print(f"User updated: {user.status}")
```

### Context Manager Support

```python
async with ISLClient(base_url="https://api.example.com") as client:
    result = await client.users.get_user("user-123")
```

## Pydantic Models

All models are Pydantic v2 models with full validation:

```python
from isl.models import User, UserStatus, Email, Username

# Value types with validation
email = Email("user@example.com")  # Validates email format
username = Username("validuser")   # Validates 3-30 chars

# Entity models
user = User(
    id="user-123",
    email="user@example.com",
    username="testuser",
    status=UserStatus.ACTIVE,
    created_at=datetime.now(),
    updated_at=datetime.now()
)

# Automatic validation
try:
    invalid_email = Email("invalid")  # Raises ValidationError
except ValidationError as e:
    print(e)
```

## Result Types

Results use Python's structural pattern matching (3.10+):

```python
from isl.results import GetUserResult

result = await client.users.get_user("user-123")

# Pattern matching
match result:
    case GetUserResult.Success(user=user):
        print(f"Found: {user.username}")
    case GetUserResult.NotFound():
        print("User not found")
    case GetUserResult.Unauthorized():
        print("Not authorized")
    case GetUserResult.ServerError(message=msg):
        print(f"Server error: {msg}")

# Or use helper methods
user = result.unwrap()  # Raises on error
user = result.unwrap_or(default_user)
user = result.unwrap_or_else(lambda: create_default())

if result.is_success:
    print(result.value.username)
```

## Verification

The SDK automatically verifies preconditions and postconditions:

### Precondition Checking

```python
# This will raise PreconditionError before making the request
result = await client.users.create_user(
    CreateUserInput(
        email="invalid-email",  # Missing @
        username="ab"           # Too short
    )
)
# Raises: PreconditionError("Email must contain @")
```

### Postcondition Checking

```python
# The SDK verifies server responses match ISL contracts
result = await client.users.create_user(input_data)

match result:
    case CreateUserResult.Success(user=user):
        # Guaranteed by postcondition verification:
        assert user.email == input_data.email
        assert user.status == UserStatus.PENDING
```

### Disable Verification

```python
client = ISLClient(
    base_url="https://api.example.com",
    verification_config=VerificationConfig(
        enable_preconditions=False,
        enable_postconditions=False
    )
)
```

## Advanced Configuration

### Custom HTTP Client

```python
import httpx

custom_client = httpx.AsyncClient(
    timeout=60.0,
    limits=httpx.Limits(max_connections=100)
)

client = ISLClient(
    base_url="https://api.example.com",
    http_client=custom_client
)
```

### Interceptors

```python
from isl.interceptors import RequestInterceptor, ResponseInterceptor

async def add_trace_id(request: httpx.Request) -> httpx.Request:
    request.headers["X-Trace-ID"] = str(uuid.uuid4())
    return request

async def log_response(response: httpx.Response) -> httpx.Response:
    logger.info(f"Response: {response.status_code}")
    return response

client = ISLClient(
    base_url="https://api.example.com",
    request_interceptors=[add_trace_id],
    response_interceptors=[log_response]
)
```

### Retry Configuration

```python
from isl.config import RetryConfig

client = ISLClient(
    base_url="https://api.example.com",
    retry_config=RetryConfig(
        max_retries=5,
        retry_on_status=[429, 500, 502, 503, 504],
        exponential_base=2.0,
        max_delay=60.0
    )
)
```

## Testing

### Mock Client

```python
from isl.testing import MockISLClient, mock_user

mock_client = MockISLClient()
mock_client.users.create_user.returns(
    CreateUserResult.Success(user=mock_user())
)
mock_client.users.get_user.with_args("404").returns(
    GetUserResult.NotFound()
)

# Use in tests
result = await mock_client.users.create_user(input_data)
assert result.is_success
```

### Fixtures

```python
from isl.testing import fixtures

user = fixtures.user(status=UserStatus.ACTIVE)
users = fixtures.users(count=10)
input_data = fixtures.create_user_input()
```

## FastAPI Integration

```python
from fastapi import FastAPI, Depends
from isl import ISLClient

app = FastAPI()

async def get_isl_client() -> ISLClient:
    return ISLClient(base_url=settings.API_URL)

@app.post("/users")
async def create_user(
    input_data: CreateUserInput,
    client: ISLClient = Depends(get_isl_client)
):
    result = await client.users.create_user(input_data)
    match result:
        case CreateUserResult.Success(user=user):
            return user
        case CreateUserResult.DuplicateEmail():
            raise HTTPException(409, "Email already exists")
        case _:
            raise HTTPException(500, "Internal error")
```

## Django Integration

```python
from django.conf import settings
from isl import SyncISLClient

def get_client():
    return SyncISLClient(
        base_url=settings.ISL_API_URL,
        auth_token=settings.ISL_API_TOKEN
    )

# In views
def user_detail(request, user_id):
    client = get_client()
    result = client.users.get_user(user_id)
    
    if result.is_success:
        return render(request, "user.html", {"user": result.value})
    return HttpResponseNotFound()
```

## API Reference

Full API documentation is available at [docs.intentlang.dev/python](https://docs.intentlang.dev/python)

## License

MIT License - see [LICENSE](LICENSE) for details.
