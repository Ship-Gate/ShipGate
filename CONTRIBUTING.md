# Contributing to ShipGate

Thank you for your interest in contributing to ShipGate! This document provides guidelines and instructions for contributing.

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/Ship-Gate/ShipGate.git
   cd ShipGate
   ```
3. Install dependencies:
   ```bash
   pnpm install
   ```
4. Build all packages:
   ```bash
   pnpm build
   ```

### Build Reproducibility

**Important:** This project enforces reproducible builds. The `pnpm-lock.yaml` file must be kept in sync with `package.json` files.

- **Always use `pnpm install --frozen-lockfile` in CI** - This ensures installs are deterministic
- **Never commit lockfile changes without corresponding package.json changes** - If you modify dependencies, run `pnpm install` and commit both files together
- **Verify reproducibility locally** - Run `pnpm -w verify:repro` to ensure your changes don't break reproducibility:
  ```bash
  pnpm -w verify:repro
  ```
  This runs:
  - `pnpm install --frozen-lockfile` (must succeed)
  - `pnpm -w lint`
  - `pnpm -w typecheck`
  - `pnpm -w test`

CI will fail if the lockfile changes after install, indicating drift that needs to be fixed.

## Repository Structure

ShipGate is a monorepo with 248 packages managed by pnpm workspaces and Turborepo.

| Directory | Contents |
|-----------|----------|
| `packages/core/` | Core verification engine (62k lines) |
| `packages/cli/` | CLI binary — `shipgate` (46k lines) |
| `packages/isl-*/` | 38 ISL language packages (parser, gate, pipeline, proof, PBT, healer, etc.) |
| `packages/codegen-*/` | 30 code generation targets (TypeScript, Python, Rust, Go, GraphQL, gRPC, Terraform, WASM, etc.) |
| `packages/stdlib-*/` | 31 standard library modules (payments, rate-limit, cache, auth, billing, queue, workflow, etc.) |
| `packages/verifier-*/` | 6 verification engines (chaos, temporal, formal, security, sandbox) |
| `packages/sdk-*/` | 8 client SDKs (Flutter/Dart, Kotlin, Swift, Python, TypeScript, Web, React Native) |
| `packages/shipgate-dashboard/` | Next.js 14 web dashboard with GitHub/Slack/Deploy integrations |
| `docs/` | 146 documentation files |
| `samples/` | ISL spec samples and tutorials |
| `demos/` | Demo projects and showcases |

## Development Workflow

### Branching Strategy

- Create a feature branch from `main`:
  ```bash
  git checkout -b feature/your-feature-name
  ```
- Use descriptive branch names:
  - `feature/` - New features
  - `fix/` - Bug fixes
  - `docs/` - Documentation updates
  - `refactor/` - Code refactoring

### Making Changes

1. **If adding or changing behaviors/APIs:** Prefer an ISL spec-first workflow: create or update a spec in `specs/**/*.isl` (or `examples/*.isl`), run `shipgate verify`, then implement and run `shipgate gate`. See [docs/ISL_DEVELOPMENT_LOOP.md](docs/ISL_DEVELOPMENT_LOOP.md).
2. Make your changes in the appropriate package(s)
3. Write or update tests as needed
4. Ensure all tests pass:
   ```bash
   pnpm test
   ```
5. Run type checking:
   ```bash
   pnpm typecheck
   ```
6. Run linting:
   ```bash
   pnpm lint
   ```

### Commit Messages

Follow conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
- `feat(parser): add support for generic types`
- `fix(typechecker): resolve infinite loop in recursive types`
- `docs(readme): update installation instructions`
- `feat(dashboard): add Slack notification config component`

## Pull Request Process

1. Update documentation if your changes affect public APIs
2. Add tests for new functionality
3. Ensure CI passes on your PR
4. Request review from maintainers
5. Address any feedback

### PR Checklist

- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Changelog entry added (for significant changes)
- [ ] PR description explains the change

## Testing

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter @isl-lang/core test

# Run tests for the dashboard
pnpm --filter shipgate-dashboard test

# Run tests in watch mode
pnpm --filter @isl-lang/core test:watch
```

### Writing Tests

- Place tests in `__tests__` directories or `*.test.ts` files
- Use Vitest for unit tests
- Use Playwright for E2E tests (dashboard)
- Aim for high coverage on core packages (parser, typechecker, evaluator)

## Dashboard Development

The dashboard (`packages/shipgate-dashboard`) is a Next.js 14 App Router application:

```bash
cd packages/shipgate-dashboard
cp .env.example .env.local   # Configure OAuth, Stripe, Slack, encryption
pnpm dev                      # http://localhost:3001
```

Key areas:
- `app/` — Next.js App Router pages and API routes
- `components/` — React components (UI primitives + dashboard-specific)
- `hooks/` — Custom React hooks (`useApi`, `useData`, `useIntegrations`, etc.)
- `lib/` — Shared utilities (auth, encryption, GitHub helpers, Prisma client)
- `prisma/schema.prisma` — Database schema (PostgreSQL)

## Code Style

- TypeScript strict mode enabled
- Use explicit types for public APIs
- Prefer functional patterns where appropriate
- Use `@/` path alias for imports within the dashboard package
- Follow existing naming conventions (kebab-case files, PascalCase components)

## Getting Help

- Open an issue for bugs or feature requests
- Join discussions in GitHub Discussions
- Check existing issues before creating new ones

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
