# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in ShipGate, please report it responsibly:

1. **Do not** open a public GitHub issue for security vulnerabilities
2. Email security concerns to: [security@shipgate.dev](mailto:security@shipgate.dev)
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

## Security Architecture

### Dashboard (`packages/shipgate-dashboard`)

- **Authentication**: GitHub and Google OAuth; cookie-based sessions; no password storage
- **Authorization**: RBAC with admin/member/viewer roles enforced on all API routes
- **Token storage**: OAuth tokens (GitHub, Slack) encrypted with AES-256-GCM at rest
- **Audit logging**: All actions logged with IP address, user agent, request ID, session ID
- **Webhook verification**: Vercel (`x-vercel-signature`) and Railway (`x-railway-signature`) webhooks verified with HMAC
- **Billing**: Stripe handles all payment data; no card numbers stored

### CLI & Core Engine

- **Proof bundles**: HMAC-SHA256 signed for tamper detection
- **Truthpack**: Auto-extracted contracts (routes, env vars, auth rules) stored locally
- **MCP Firewall**: Real-time AI suggestion filtering against policy rules

### Dependencies

- **Database**: PostgreSQL with Prisma ORM
- **Frontend**: Next.js 14, React, Radix UI, Tailwind CSS
- **Payments**: Stripe (PCI-compliant)
- **Package manager**: pnpm with lockfile enforcement

## Security Best Practices

When using ShipGate in your projects:

1. **Keep dependencies updated** - Run `pnpm update` regularly
2. **Review generated code** - ShipGate generates code; always review before deploying
3. **Validate inputs** - ISL specs define contracts; ensure runtime validation
4. **Use environment variables** - Never hardcode secrets in `.isl` files or source code
5. **Set `TOKEN_ENCRYPTION_KEY`** - Required for secure storage of integration OAuth tokens
6. **Run the gate in CI** - Use `shipgate go . --ci` in enforce mode to block unsafe merges

## Scope

This security policy applies to:

- The ShipGate CLI tool and core engine
- The ShipGate dashboard web application
- ISL language parser and compiler
- Official code generators
- The VS Code extension
- The MCP server / AI Firewall
- Official npm packages under `shipgate` and `@isl-lang/*`

Third-party integrations and community packages are not covered by this policy.
