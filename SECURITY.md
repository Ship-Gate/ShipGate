# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in ISL, please report it responsibly:

1. **Do not** open a public GitHub issue for security vulnerabilities
2. Email security concerns to: [security@intentlang.dev](mailto:security@intentlang.dev)
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 1 week
- **Resolution**: Depends on severity
  - Critical: 24-72 hours
  - High: 1-2 weeks
  - Medium: 2-4 weeks
  - Low: Next release cycle

## Security Best Practices

When using ISL in your projects:

1. **Keep dependencies updated** - Run `pnpm update` regularly
2. **Review generated code** - ISL generates code; always review before deploying
3. **Validate inputs** - ISL specs define contracts; ensure runtime validation
4. **Use environment variables** - Never hardcode secrets in `.isl` files

## Scope

This security policy applies to:

- The ISL language parser and compiler
- Official code generators
- The VS Code extension
- The CLI tool
- Official npm packages under `@isl-lang/*`

Third-party integrations and community packages are not covered by this policy.
