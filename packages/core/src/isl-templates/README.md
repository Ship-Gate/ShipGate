# ISL Template Library

A comprehensive collection of 30 production-ready ISL templates for common software patterns.

## Overview

This library provides ready-to-use ISL templates covering authentication, authorization, payments, file handling, and more. Each template includes:

- Complete domain specifications
- Type definitions
- Entity models
- Behavior contracts with pre/postconditions
- Security constraints
- Temporal guarantees
- Test scenarios

## Categories

| Category | Templates |
|----------|-----------|
| **Authentication** | OAuth, Magic Link, Social Login, 2FA, Password Reset, Email Verification |
| **Authorization** | RBAC, API Keys, Session Management, JWT Tokens |
| **Payments** | Stripe Subscriptions, Webhooks, Billing |
| **Data Management** | File Uploads, Search, Pagination, Caching, Data Export |
| **User Management** | Profiles, Teams, Invitations, Onboarding, Account Deletion |
| **Operations** | Audit Logs, Rate Limiting, Feature Flags, A/B Testing |
| **Support** | Notifications, Feedback, Content Moderation, Multi-tenancy |

## Usage

### Import a Template

```typescript
import { templates, getTemplateBySlug, getTemplatesByTag } from '@intentos/core/isl-templates';

// Get specific template
const oauthTemplate = getTemplateBySlug('oauth');

// Get all auth templates
const authTemplates = getTemplatesByTag('auth');

// Access template content
console.log(oauthTemplate.content); // ISL source
console.log(oauthTemplate.questions); // Setup questions
```

### Generate from Template

```typescript
import { getTemplateBySlug } from '@intentos/core/isl-templates';

const template = getTemplateBySlug('stripe-subscriptions');

// Template includes required questions for customization
template.questions.forEach(q => {
  console.log(`${q.id}: ${q.question}`);
  // stripe_api_key: What is your Stripe API key?
  // webhook_secret: What is your Stripe webhook secret?
});
```

## Template Structure

Each template follows a consistent structure:

```isl
domain TemplateName {
  version: "1.0.0"
  
  // Types
  type CustomType = ...
  
  // Enums
  enum Status { ... }
  
  // Entities
  entity MainEntity { ... }
  
  // Behaviors
  behavior MainAction { ... }
  
  // Scenarios
  scenarios MainAction { ... }
}
```

## Template Registry

The registry provides metadata for each template:

- `slug`: Unique identifier
- `name`: Display name
- `description`: What the template does
- `tags`: Categories for filtering
- `questions`: Required configuration questions
- `content`: The ISL source code

## Contributing

To add a new template:

1. Create the `.isl` file in `templates/`
2. Add metadata to `registry.ts`
3. Export from `templates/index.ts`
4. Add tests if applicable

## License

MIT - See LICENSE file in repository root.
