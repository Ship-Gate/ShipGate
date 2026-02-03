# ISL GitHub App Documentation

This directory contains documentation for the ISL GitHub App, which provides org-wide enforcement of ISL verification policies.

## Documents

- **[DESIGN.md](./DESIGN.md)** - GitHub App architecture, permissions, and webhook events
- **[POLICY_BUNDLE_DISTRIBUTION.md](./POLICY_BUNDLE_DISTRIBUTION.md)** - Policy bundle distribution model and versioning
- **[MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)** - Step-by-step migration from GitHub Action to App
- **[SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md)** - Security review checklist for production deployment

## Quick Links

### For Administrators
- [Installing the App](./DESIGN.md#installation)
- [Pinning Policy Bundles](./POLICY_BUNDLE_DISTRIBUTION.md#pinning-model)
- [Managing Repository Overrides](./POLICY_BUNDLE_DISTRIBUTION.md#repository-overrides)

### For Developers
- [Architecture Overview](./DESIGN.md#architecture)
- [API Design](./POLICY_BUNDLE_DISTRIBUTION.md#api-design)
- [Implementation Structure](../../packages/github-app/README.md)

### For Security Teams
- [Security Checklist](./SECURITY_CHECKLIST.md)
- [Permission Model](./DESIGN.md#minimal-permissions)
- [Audit Logging](./SECURITY_CHECKLIST.md#audit-logging)

## Getting Started

1. **Review the Design** - Understand the architecture and permissions
2. **Security Review** - Complete the security checklist
3. **Plan Migration** - Follow the migration guide
4. **Install App** - Install on your organization
5. **Pin Bundle** - Configure your policy bundle
6. **Test** - Verify checks run correctly
7. **Migrate** - Move repositories from Action to App

## Support

- **Documentation**: https://docs.isl.dev/github-app
- **Issues**: https://github.com/isl-lang/github-app/issues
- **Support**: support@isl.dev
