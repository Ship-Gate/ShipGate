# Contributing to ISL

Thank you for your interest in contributing to ISL (Intent Specification Language)! This document provides guidelines and instructions for contributing.

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/isl-lang.git
   cd isl-lang
   ```
3. Install dependencies:
   ```bash
   pnpm install
   ```
4. Build all packages:
   ```bash
   pnpm build
   ```

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

1. Make your changes in the appropriate package(s)
2. Write or update tests as needed
3. Ensure all tests pass:
   ```bash
   pnpm test
   ```
4. Run type checking:
   ```bash
   pnpm typecheck
   ```
5. Run linting:
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
pnpm --filter @isl-lang/parser test

# Run tests in watch mode
pnpm --filter @isl-lang/parser test:watch
```

### Writing Tests

- Place tests in `__tests__` directories or `*.test.ts` files
- Use Vitest for unit tests
- Aim for high coverage on core packages (parser, typechecker)

## Code Style

- TypeScript strict mode enabled
- Use explicit types for public APIs
- Prefer functional patterns where appropriate
- Document complex logic with comments

## Getting Help

- Open an issue for bugs or feature requests
- Join discussions in GitHub Discussions
- Check existing issues before creating new ones

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
