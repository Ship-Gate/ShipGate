# Golden Auth Template

Hand-crafted, verified, production-quality auth implementation for Next.js App Router.

## Stack

- **Framework:** Next.js App Router
- **ORM:** Prisma
- **Language:** TypeScript (strict mode)
- **Validation:** Zod
- **Password:** bcrypt (cost 12)
- **JWT:** jose (HS256)

## Security

| Setting | Value |
|---------|-------|
| Access token TTL | 15 minutes |
| Refresh token TTL | 7 days |
| bcrypt cost | 12 |
| Cookies | httpOnly, sameSite=lax, secure in production |
| Refresh rotation | Yes — old token invalidated on every refresh |

## Files

```
templates/auth-golden/
├── prisma/schema.prisma          # User + RefreshToken models
├── src/
│   ├── app/api/auth/
│   │   ├── register/route.ts     # POST — register, JWT pair
│   │   ├── login/route.ts        # POST — login, JWT pair
│   │   ├── logout/route.ts       # POST — invalidate refresh token
│   │   └── refresh/route.ts      # POST — refresh token rotation
│   ├── lib/
│   │   ├── auth.ts               # JWT sign/verify, token pair, cookies
│   │   ├── db.ts                 # Prisma singleton
│   │   ├── middleware/auth.ts   # withAuth HOF, role-based access
│   │   └── validators/auth.ts    # Zod schemas
│   └── types/auth.ts             # AuthUser, TokenPair, JWTPayload
├── auth-template.isl             # ISL specification
├── template-metadata.json        # Codegen metadata
└── README.md
```

## Usage

### 1. Copy template into your project

```bash
cp -r templates/auth-golden/* your-project/
```

### 2. Install dependencies

```bash
pnpm add next prisma @prisma/client zod bcrypt jose
pnpm add -D typescript @types/bcrypt @types/node
```

### 3. Environment variables

```env
DATABASE_URL="postgresql://..."
JWT_SECRET="your-secret-at-least-32-chars"
```

### 4. Database

```bash
pnpm prisma generate
pnpm prisma db push
```

### 5. Protect a route

```ts
// app/api/protected/route.ts
import { withAuth } from '@/lib/middleware/auth';

export const GET = withAuth(async (request, { user }) => {
  return Response.json({ user });
});

// Admin-only
export const POST = withAuth(
  async (request, { user }) => { /* ... */ },
  { roles: ['ADMIN'] }
);
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/register | Register, returns user + sets cookies |
| POST | /api/auth/login | Login, returns user + sets cookies |
| POST | /api/auth/logout | Invalidate refresh token, clear cookies |
| POST | /api/auth/refresh | Rotate refresh token, issue new pair |

## Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| EMAIL_TAKEN | 409 | Email already registered |
| INVALID_CREDENTIALS | 401 | Wrong email or password |
| MISSING_TOKEN | 401 | No access token in cookie |
| INVALID_TOKEN | 401 | Token invalid or expired |
| TOKEN_REVOKED | 401 | Refresh token already used |
| INSUFFICIENT_ROLE | 403 | User lacks required role |

## Customization (Codegen)

See `template-metadata.json` for:

- **Customizable:** entity name, fields, role types, password policy
- **Fixed:** security patterns, error handling, file structure

## Verification

```bash
pnpm tsc --strict --noEmit
```

All files pass strict TypeScript checks.
