# @isl-lang/stdlib-saas

Complete foundation for building SaaS applications with ISL. Includes multi-tenancy, feature flags, plan entitlements, and onboarding provisioning.

## Features

### 🔐 Multi-Tenancy
- **Tenant Management**: Create, update, and manage tenant organizations
- **Context Propagation**: AsyncLocalStorage-based tenant context propagation
- **Data Isolation**: Automatic tenant scoping for data queries
- **Tenant Store**: In-memory and extensible storage interfaces

### 🚩 Feature Flags
- **Dynamic Flag Management**: Create and update feature flags at runtime
- **Advanced Rules Engine**: Support for plan-based, tenant-specific, percentage rollouts, and user targeting
- **Deterministic Rollouts**: Consistent percentage-based rollouts using tenant hashing
- **Real-time Evaluation**: Fast feature flag evaluation with rule priority

### 💳 Plan & Entitlements
- **Plan Management**: Versioned, immutable plan definitions
- **Limit Enforcement**: Automatic enforcement of plan limits (projects, users, API calls, etc.)
- **Feature Entitlements**: Check feature availability based on tenant plans
- **Usage Tracking**: Monitor usage against plan limits with percentages
- **Upgrade Paths**: Support for plan upgrades and downgrades

### 🎯 Onboarding Provisioner
- **Step-based Flows**: Configurable onboarding steps with dependencies
- **Plan-specific Flows**: Different onboarding experiences per plan
- **Rollback Support**: Automatic rollback on step failures
- **Retry Logic**: Configurable retry policies with exponential backoff
- **Session Management**: Pause, resume, and track onboarding progress

## Installation

```bash
npm install @isl-lang/stdlib-saas
```

## Quick Start

```typescript
import {
  TenantService,
  TenantContextManager,
  FeatureFlagService,
  PlanManager,
  OnboardingProvisioner,
  InMemoryTenantStore,
  InMemoryFeatureFlagStore,
  InMemoryPlanStore,
  InMemoryOnboardingStore,
  PlanEntitlements,
  DataIsolation
} from '@isl-lang/stdlib-saas';

// Initialize stores
const tenantStore = new InMemoryTenantStore();
const featureStore = new InMemoryFeatureFlagStore();
const planStore = new InMemoryPlanStore();
const onboardingStore = new InMemoryOnboardingStore();

// Initialize services
const tenantService = new TenantService(tenantStore);
const featureService = new FeatureFlagService(featureStore);
const planManager = new PlanManager(planStore);
const provisioner = new OnboardingProvisioner(onboardingStore);

// Initialize default plans
PlanEntitlements.initializeDefaults();

// Create a tenant
const tenant = await tenantService.create({
  organizationId: { value: 'org-123' },
  plan: 'STARTER'
});

// Assign plan to tenant
await planManager.assignPlan(
  tenant.id.value,
  'STARTER',
  'admin-123'
);

// Start onboarding
const session = await provisioner.startOnboarding(
  tenant.id.value,
  'user-123',
  'STARTER',
  {
    projectName: 'My First Project',
    teamEmails: ['team@example.com']
  }
);

// Execute in tenant context
const context = TenantContextManager.createContext({
  tenantId: tenant.id,
  userId: { value: 'user-123' },
  plan: 'STARTER',
  features: PlanEntitlements.getFeatures('STARTER')
});

await TenantContextManager.run(context, async () => {
  // All operations here have tenant context
  const query = DataIsolation.enforceTenantScope({});
  // query.where.tenant_id is automatically set
});
```

## ISL Integration

```isl
domain MyApp {
  version: "1.0.0"
  
  use stdlib-saas  # Includes auth, payments, multi-tenancy
  
  # Your custom behaviors
  behavior MyFeature {
    actors {
      User {
        must: authenticated
        in: organization_id  # Multi-tenant scoping
      }
    }
    ...
  }
}
```

## Architecture

### Core Components

1. **Tenancy Module** (`src/tenancy/`)
   - `tenant.ts`: Tenant entity management
   - `context.ts`: AsyncLocalStorage context propagation
   - `isolation.ts`: Data isolation enforcement
   - `store.ts`: Storage interface and implementations

2. **Features Module** (`src/features/`)
   - `flags.ts`: Feature flag CRUD operations
   - `rules.ts`: Rule evaluation engine
   - `store.ts`: Feature flag storage

3. **Plans Module** (`src/plans/`)
   - `manager.ts`: Plan assignment and management
   - `entitlements.ts`: Feature and limit enforcement
   - `store.ts`: Plan and usage storage

4. **Onboarding Module** (`src/onboarding/`)
   - `provisioner.ts`: Onboarding flow orchestration
   - `steps.ts`: Predefined onboarding steps
   - `store.ts`: Session and flow storage

## Included Entities

### Organization
```isl
entity Organization {
  id: UUID
  name: String
  slug: String [unique]
  plan: SubscriptionPlan
  status: OrganizationStatus
}
```

### TeamMember
```isl
entity TeamMember {
  id: UUID
  organization_id: UUID
  user_id: UUID
  role: TeamRole  # OWNER, ADMIN, MEMBER, VIEWER
}
```

### Project
```isl
entity Project {
  id: UUID
  organization_id: UUID
  name: String
  status: ProjectStatus
}
```

## Plan Limits

| Plan | Projects | Team Members | API Calls | Storage |
|------|----------|--------------|-----------|---------|
| FREE | 3 | 2 | 1,000/month | 100 MB |
| STARTER | 10 | 5 | 10,000/month | 1 GB |
| PROFESSIONAL | 50 | 20 | 100,000/month | 10 GB |
| ENTERPRISE | Unlimited | Unlimited | Unlimited | Unlimited |

## Advanced Usage

### Custom Feature Flag Rules

```typescript
// Create a feature flag with multiple rules
await featureService.create({
  key: 'advanced_analytics',
  enabled: true,
  rules: [
    {
      type: 'plan',
      value: 'PROFESSIONAL',
      enabled: true
    },
    {
      type: 'percentage',
      value: 10, // 10% of FREE plan users
      enabled: true
    },
    {
      type: 'tenant',
      value: 'early-adopter-tenant-id',
      enabled: true
    }
  ]
});
```

### Custom Onboarding Steps

```typescript
import { OnboardingStep } from '@isl-lang/stdlib-saas';

const customStep: OnboardingStep = {
  id: 'custom_integration',
  name: 'Setup Custom Integration',
  description: 'Configure your custom integration',
  required: false,
  order: 10,
  rollback: true,
  handler: {
    async execute(context) {
      // Custom logic here
      return { success: true, data: { integrated: true } };
    },
    async rollback(context) {
      // Rollback logic here
    }
  }
};
```

### Plan Limit Enforcement

```typescript
// Check if tenant can perform action
const canCreateProject = await planManager.canPerformAction(
  tenantId,
  'maxProjects',
  1 // Count of projects to create
);

if (!canCreateProject) {
  throw new Error('Project limit reached');
}

// Track usage
await planManager.trackUsage(tenantId, {
  maxProjects: currentProjectCount + 1
});
```

## Storage Interfaces

All modules use storage interfaces that can be implemented for your preferred database:

```typescript
// Example: Implementing with PostgreSQL
export class PostgresTenantStore implements TenantStore {
  async save(tenant: Tenant): Promise<Tenant> {
    // PostgreSQL implementation
  }
  
  async findById(id: string): Promise<Tenant | null> {
    // PostgreSQL implementation
  }
  
  // ... other methods
}
```

## Security

- All data scoped by `organization_id`
- Row-level security enforced via DataIsolation
- Role-based access control
- Tenant context propagation prevents cross-tenant data access

## Testing

The package includes comprehensive tests covering:

- Tenant CRUD operations
- AsyncLocalStorage context propagation
- Feature flag rules and evaluation
- Plan limits enforcement
- Onboarding step execution and rollback
- End-to-end integration scenarios

Run tests with:

```bash
npm test
```

## Dependencies

- **@isl-lang/stdlib-core**: Core ISL types and utilities
- **@isl-lang/stdlib-auth**: Authentication functionality
- **@isl-lang/stdlib-payments**: Payment processing
- **uuid**: For generating unique IDs
- **node:async_hooks**: For AsyncLocalStorage (polyfilled if unavailable)

## License

MIT
