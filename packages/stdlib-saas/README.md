# @intentos/stdlib-saas

Complete SaaS foundation for IntentOS applications.

## What's Included

- **Multi-tenancy** - Organizations, teams, data isolation
- **Team Management** - Roles (Owner, Admin, Member, Viewer), invitations
- **Projects** - Multi-tenant resource management
- **Plan Limits** - Enforce usage based on subscription tier
- **Authentication** - via stdlib-auth
- **Payments** - via stdlib-payments

## Quick Start

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

## Behaviors

| Behavior | Description |
|----------|-------------|
| `CreateOrganization` | Create org, set up owner |
| `InviteTeamMember` | Invite user to org |
| `CreateProject` | Create project in org |

## Plan Limits

| Plan | Projects | Team Members |
|------|----------|--------------|
| FREE | 3 | 2 |
| STARTER | 10 | 5 |
| PROFESSIONAL | 50 | 20 |
| ENTERPRISE | Unlimited | Unlimited |

## Security

- All data scoped by `organization_id`
- Row-level security enforced
- Role-based access control
