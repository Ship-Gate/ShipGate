/**
 * ISL Import Resolver
 * 
 * Resolves `use stdlib-*` imports by loading and merging ISL definitions.
 */

// Standard library definitions (embedded)
// In production, these would be loaded from node_modules
const STDLIB_DEFINITIONS: Record<string, string> = {
  'stdlib-auth': `
enum UserStatus {
  ACTIVE
  INACTIVE
  LOCKED
  PENDING_VERIFICATION
}

entity User {
  id: UUID [immutable, unique]
  email: String [unique, indexed]
  password_hash: String [secret]
  status: UserStatus [default: ACTIVE]
  created_at: Timestamp [immutable]
  last_login: Timestamp?
  failed_attempts: Int [default: 0]
}

entity Session {
  id: UUID [immutable, unique]
  user_id: UUID [immutable, indexed]
  created_at: Timestamp [immutable]
  expires_at: Timestamp
  revoked: Boolean [default: false]
}

behavior Login {
  description: "Authenticate a user"
  
  input {
    email: String
    password: String [sensitive]
  }
  
  output {
    success: Session
    errors {
      INVALID_CREDENTIALS {
        when: "Email or password incorrect"
        retriable: true
      }
      USER_LOCKED {
        when: "Account is locked"
        retriable: true
        retry_after: 15m
      }
    }
  }
  
  preconditions {
    email.length > 0
    password.length >= 8
  }
  
  security {
    rate_limit: 10 per hour per email
  }
}

behavior Logout {
  description: "End a user session"
  
  input {
    session_id: UUID
  }
  
  output {
    success: Boolean
    errors {
      SESSION_NOT_FOUND {
        when: "Session does not exist"
      }
    }
  }
}

behavior Register {
  description: "Create a new user account"
  
  input {
    email: String
    password: String [sensitive]
  }
  
  output {
    success: User
    errors {
      EMAIL_EXISTS {
        when: "Email already registered"
      }
      WEAK_PASSWORD {
        when: "Password too weak"
        retriable: true
      }
    }
  }
  
  preconditions {
    email.length > 0
    password.length >= 8
  }
}
`,

  'stdlib-payments': `
enum PaymentStatus {
  PENDING
  COMPLETED
  FAILED
  REFUNDED
}

enum SubscriptionStatus {
  ACTIVE
  CANCELLED
  PAST_DUE
  TRIALING
}

entity Payment {
  id: UUID [immutable, unique]
  amount: Int
  currency: String [default: "USD"]
  status: PaymentStatus
  customer_id: UUID [indexed]
  created_at: Timestamp [immutable]
}

entity Subscription {
  id: UUID [immutable, unique]
  customer_id: UUID [indexed]
  plan_id: String
  status: SubscriptionStatus
  current_period_start: Timestamp
  current_period_end: Timestamp
  cancel_at_period_end: Boolean [default: false]
}

behavior Charge {
  description: "Charge a payment method"
  
  input {
    customer_id: UUID
    amount: Int
    currency: String?
  }
  
  output {
    success: Payment
    errors {
      CARD_DECLINED {
        when: "Payment method declined"
        retriable: true
      }
      INSUFFICIENT_FUNDS {
        when: "Not enough funds"
        retriable: true
      }
    }
  }
  
  preconditions {
    amount > 0
  }
}

behavior Refund {
  description: "Refund a payment"
  
  input {
    payment_id: UUID
    amount: Int?
  }
  
  output {
    success: Payment
    errors {
      PAYMENT_NOT_FOUND {
        when: "Payment does not exist"
      }
      ALREADY_REFUNDED {
        when: "Payment already refunded"
      }
    }
  }
}
`,

  'stdlib-saas': `
enum OrganizationStatus {
  ACTIVE
  SUSPENDED
  CANCELLED
}

enum TeamRole {
  OWNER
  ADMIN
  MEMBER
  VIEWER
}

entity Organization {
  id: UUID [immutable, unique]
  name: String
  slug: String [unique, indexed]
  status: OrganizationStatus [default: ACTIVE]
  created_at: Timestamp [immutable]
}

entity TeamMember {
  id: UUID [immutable, unique]
  organization_id: UUID [immutable, indexed]
  user_id: UUID [indexed]
  role: TeamRole
  invited_at: Timestamp [immutable]
}

entity Project {
  id: UUID [immutable, unique]
  organization_id: UUID [immutable, indexed]
  name: String
  created_at: Timestamp [immutable]
}

behavior CreateOrganization {
  description: "Create a new organization"
  
  input {
    name: String
    slug: String
  }
  
  output {
    success: Organization
    errors {
      SLUG_TAKEN {
        when: "Slug already exists"
      }
    }
  }
  
  preconditions {
    name.length > 0
    slug.length >= 3
  }
}

behavior InviteTeamMember {
  description: "Invite a user to an organization"
  
  input {
    organization_id: UUID
    email: String
    role: TeamRole
  }
  
  output {
    success: TeamMember
    errors {
      ORG_NOT_FOUND {
        when: "Organization does not exist"
      }
      ALREADY_MEMBER {
        when: "User is already a member"
      }
    }
  }
}
`,
};

export interface ResolvedImport {
  name: string;
  source: string;
  entities: string[];
  behaviors: string[];
  enums: string[];
}

export interface ImportResolution {
  success: boolean;
  imports: ResolvedImport[];
  mergedSource: string;
  errors: string[];
}

/**
 * Resolve imports in an ISL source file
 */
export function resolveImports(source: string): ImportResolution {
  const errors: string[] = [];
  const imports: ResolvedImport[] = [];
  
  // Find all `use stdlib-*` statements
  const usePattern = /^\s*use\s+(stdlib-\w+)\s*$/gm;
  const usedLibraries: string[] = [];
  
  let match;
  while ((match = usePattern.exec(source)) !== null) {
    const libName = match[1] as string;
    if (!libName) continue;
    usedLibraries.push(libName);
    
    const libSource = STDLIB_DEFINITIONS[libName];
    if (libSource) {
      
      // Extract what the library provides
      const entities = extractNames(libSource, /entity\s+(\w+)/g);
      const behaviors = extractNames(libSource, /behavior\s+(\w+)/g);
      const enums = extractNames(libSource, /enum\s+(\w+)/g);
      
      imports.push({
        name: libName,
        source: libSource,
        entities,
        behaviors,
        enums,
      });
    } else {
      errors.push(`Unknown stdlib: ${libName}. Available: ${Object.keys(STDLIB_DEFINITIONS).join(', ')}`);
    }
  }
  
  // Remove use statements and prepend library definitions
  let mergedSource = source.replace(usePattern, '');
  
  // Insert library definitions at the start of the domain
  const libraryDefs = imports.map(i => {
    // Extract just the content (entities, behaviors, enums) without domain wrapper
    return extractContent(i.source);
  }).join('\n\n');
  
  // Insert after version field (or after domain opening if no version)
  const versionPattern = /(version:\s*"[^"]*"\s*)/;
  if (versionPattern.test(mergedSource)) {
    mergedSource = mergedSource.replace(
      versionPattern,
      `$1\n\n${libraryDefs}\n`
    );
  } else {
    mergedSource = mergedSource.replace(
      /(domain\s+\w+\s*\{)/,
      `$1\n\n${libraryDefs}\n`
    );
  }
  
  return {
    success: errors.length === 0,
    imports,
    mergedSource,
    errors,
  };
}

/**
 * Extract names matching a pattern
 */
function extractNames(source: string, pattern: RegExp): string[] {
  const names: string[] = [];
  let match;
  while ((match = pattern.exec(source)) !== null) {
    const name = match[1];
    if (name) {
      names.push(name);
    }
  }
  return names;
}

/**
 * Extract content (entities, behaviors, enums) from library source
 */
function extractContent(source: string): string {
  // Remove comments at the start
  const lines = source.trim().split('\n');
  const contentLines: string[] = [];
  let inContent = false;
  
  for (const line of lines) {
    if (line.trim().startsWith('#')) {
      continue; // Skip comment lines
    }
    if (line.trim().startsWith('enum') || 
        line.trim().startsWith('entity') || 
        line.trim().startsWith('behavior') ||
        inContent) {
      contentLines.push('  ' + line); // Indent for domain context
      inContent = true;
    }
  }
  
  return contentLines.join('\n');
}

/**
 * Get list of available stdlib libraries
 */
export function getAvailableLibraries(): string[] {
  return Object.keys(STDLIB_DEFINITIONS);
}

/**
 * Get library info
 */
export function getLibraryInfo(name: string): ResolvedImport | null {
  const source = STDLIB_DEFINITIONS[name];
  if (!source) return null;
  
  return {
    name,
    source,
    entities: extractNames(source, /entity\s+(\w+)/g),
    behaviors: extractNames(source, /behavior\s+(\w+)/g),
    enums: extractNames(source, /enum\s+(\w+)/g),
  };
}

export default {
  resolveImports,
  getAvailableLibraries,
  getLibraryInfo,
};
