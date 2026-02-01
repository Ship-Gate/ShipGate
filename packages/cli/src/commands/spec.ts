/**
 * Spec Command
 *
 * Create, manage, and list ISL specification templates.
 *
 * Usage:
 *   isl spec --templates                    # List available templates
 *   isl spec --template <name>              # Create spec from template
 *   isl spec --template <name> --out <path> # Create spec at path
 *   isl spec --json                         # JSON output for tooling
 */

import { writeFile, mkdir, access } from 'fs/promises';
import { resolve, dirname, basename, join } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { output } from '../output.js';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Pro features billing URL */
const PRO_BILLING_URL = 'https://intentos.dev/billing';

/** Pro upgrade message */
const PRO_UPGRADE_MESSAGE = `Upgrade to ISL Pro for advanced templates and features → ${PRO_BILLING_URL}`;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SpecOptions {
  /** List available templates */
  templates?: boolean;
  /** Template name to use */
  template?: string;
  /** Output file path */
  out?: string;
  /** JSON output format */
  json?: boolean;
  /** Force overwrite existing files */
  force?: boolean;
  /** Domain/spec name */
  name?: string;
  /** Verbose output */
  verbose?: boolean;
}

export interface SpecResult {
  success: boolean;
  /** Created file path (if applicable) */
  filePath?: string;
  /** Template used (if applicable) */
  templateUsed?: string;
  /** List of templates (if listing) */
  templates?: TemplateInfo[];
  /** Error messages */
  errors: string[];
}

export interface TemplateInfo {
  /** Template identifier */
  name: string;
  /** Human-readable description */
  description: string;
  /** Category for grouping */
  category: 'starter' | 'domain' | 'integration' | 'advanced' | 'pro';
  /** Whether this is a Pro-only template */
  isPro: boolean;
  /** Tags for searchability */
  tags: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Templates Registry
// ─────────────────────────────────────────────────────────────────────────────

export const TEMPLATES: TemplateInfo[] = [
  // Starter templates
  {
    name: 'minimal',
    description: 'Minimal spec with a single entity and behavior',
    category: 'starter',
    isPro: false,
    tags: ['basic', 'beginner', 'simple'],
  },
  {
    name: 'crud',
    description: 'CRUD operations for a resource entity',
    category: 'starter',
    isPro: false,
    tags: ['crud', 'rest', 'api', 'resource'],
  },
  {
    name: 'api',
    description: 'REST API contract with pagination and error handling',
    category: 'starter',
    isPro: false,
    tags: ['api', 'rest', 'http', 'pagination'],
  },

  // Domain templates
  {
    name: 'auth',
    description: 'User authentication with registration, login, and tokens',
    category: 'domain',
    isPro: false,
    tags: ['auth', 'authentication', 'login', 'user', 'security'],
  },
  {
    name: 'payment',
    description: 'Payment processing with transactions and refunds',
    category: 'domain',
    isPro: false,
    tags: ['payment', 'billing', 'transaction', 'money'],
  },
  {
    name: 'workflow',
    description: 'State machine workflow with transitions and approvals',
    category: 'domain',
    isPro: false,
    tags: ['workflow', 'state-machine', 'approval', 'process'],
  },

  // Integration templates
  {
    name: 'webhook',
    description: 'Webhook receiver with signature verification',
    category: 'integration',
    isPro: false,
    tags: ['webhook', 'integration', 'events', 'callback'],
  },
  {
    name: 'graphql',
    description: 'GraphQL API with queries and mutations',
    category: 'integration',
    isPro: false,
    tags: ['graphql', 'api', 'query', 'mutation'],
  },

  // Advanced templates (Pro)
  {
    name: 'distributed',
    description: 'Distributed system with saga patterns and compensation',
    category: 'advanced',
    isPro: true,
    tags: ['distributed', 'saga', 'microservices', 'compensation'],
  },
  {
    name: 'event-sourcing',
    description: 'Event sourcing with aggregates and projections',
    category: 'advanced',
    isPro: true,
    tags: ['event-sourcing', 'cqrs', 'aggregate', 'projection'],
  },
  {
    name: 'ml-pipeline',
    description: 'ML pipeline with data validation and model versioning',
    category: 'pro',
    isPro: true,
    tags: ['ml', 'machine-learning', 'pipeline', 'data'],
  },
  {
    name: 'compliance',
    description: 'Compliance spec with audit trails and policy enforcement',
    category: 'pro',
    isPro: true,
    tags: ['compliance', 'audit', 'policy', 'regulation', 'gdpr'],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Template Content
// ─────────────────────────────────────────────────────────────────────────────

const TEMPLATE_CONTENT: Record<string, string> = {
  minimal: `/**
 * {{name}} Domain
 *
 * A minimal ISL specification.
 */

domain {{pascalName}} {
  /**
   * Example entity
   */
  entity Item {
    id: ID
    name: String
    createdAt: DateTime
  }

  /**
   * Create a new item
   */
  behavior CreateItem {
    input {
      name: String
    }

    output Item

    postconditions {
      ensure result.id != null
      ensure result.name == input.name
    }

    scenario "creates item successfully" {
      given { name: "Test Item" }
      then {
        result.name == "Test Item"
        result.id != null
      }
    }
  }
}
`,

  crud: `/**
 * {{name}} CRUD Domain
 *
 * Standard CRUD operations for a resource.
 */

domain {{pascalName}} {
  /**
   * Resource entity
   */
  entity Resource {
    id: ID
    name: String
    description: String?
    status: "active" | "inactive" | "archived"
    createdAt: DateTime
    updatedAt: DateTime
  }

  /**
   * List resources with pagination
   */
  behavior ListResources {
    input {
      page: Integer
      limit: Integer
      status: String?
    }

    output {
      items: List<Resource>
      total: Integer
      page: Integer
      hasMore: Boolean
    }

    preconditions {
      require input.page >= 1
      require input.limit >= 1 && input.limit <= 100
    }

    postconditions {
      ensure result.items.length <= input.limit
      ensure result.page == input.page
    }
  }

  /**
   * Get a single resource
   */
  behavior GetResource {
    input { id: ID }
    output Resource?

    postconditions {
      ensure result == null || result.id == input.id
    }
  }

  /**
   * Create a new resource
   */
  behavior CreateResource {
    input {
      name: String
      description: String?
    }

    output Resource

    preconditions {
      require input.name.length > 0
      require input.name.length <= 255
    }

    postconditions {
      ensure result.name == input.name
      ensure result.status == "active"
      ensure result.id != null
    }

    scenario "creates resource" {
      given { name: "New Resource" }
      then {
        result.name == "New Resource"
        result.status == "active"
      }
    }
  }

  /**
   * Update a resource
   */
  behavior UpdateResource {
    input {
      id: ID
      name: String?
      description: String?
      status: String?
    }

    output Resource

    postconditions {
      ensure result.id == input.id
      ensure input.name != null implies result.name == input.name
      ensure result.updatedAt >= old(result.updatedAt)
    }
  }

  /**
   * Delete a resource
   */
  behavior DeleteResource {
    input { id: ID }
    output { success: Boolean }

    postconditions {
      ensure result.success implies !exists(Resource where id == input.id)
    }
  }

  // Invariants
  invariant "names are non-empty" {
    forall r: Resource => r.name.length > 0
  }

  invariant "timestamps are valid" {
    forall r: Resource => r.updatedAt >= r.createdAt
  }
}
`,

  api: `/**
 * {{name}} API Domain
 *
 * REST API contract with pagination and error handling.
 */

domain {{pascalName}}API {
  /**
   * Standard API response wrapper
   */
  entity ApiResponse<T> {
    success: Boolean
    data: T?
    error: ApiError?
    meta: ResponseMeta?
  }

  entity ApiError {
    code: String
    message: String
    details: Map<String, Any>?
  }

  entity ResponseMeta {
    requestId: String
    timestamp: DateTime
    version: String
  }

  /**
   * Pagination parameters
   */
  entity PaginationParams {
    page: Integer
    limit: Integer
    sortBy: String?
    sortOrder: "asc" | "desc"
  }

  /**
   * Paginated response
   */
  entity PaginatedResponse<T> {
    items: List<T>
    pagination: {
      page: Integer
      limit: Integer
      total: Integer
      totalPages: Integer
      hasNext: Boolean
      hasPrev: Boolean
    }
  }

  /**
   * Resource entity
   */
  entity Resource {
    id: ID
    name: String
    type: String
    createdAt: DateTime
    updatedAt: DateTime
  }

  /**
   * List resources endpoint
   */
  behavior ListResources {
    input PaginationParams
    output ApiResponse<PaginatedResponse<Resource>>

    preconditions {
      require input.page >= 1
      require input.limit >= 1 && input.limit <= 100
    }

    postconditions {
      ensure result.success implies result.data != null
      ensure result.success implies result.data.pagination.page == input.page
      ensure !result.success implies result.error != null
    }

    scenario "successful pagination" {
      given { page: 1, limit: 10, sortOrder: "asc" }
      then {
        result.success == true
        result.data.pagination.page == 1
      }
    }

    scenario "invalid page number" {
      given { page: 0, limit: 10, sortOrder: "asc" }
      then fails with "Invalid page number"
    }
  }

  /**
   * Get single resource endpoint
   */
  behavior GetResource {
    input { id: ID }
    output ApiResponse<Resource>

    postconditions {
      ensure result.success implies result.data.id == input.id
      ensure !result.success implies result.error.code == "NOT_FOUND"
    }

    scenario "resource exists" {
      given { id: "res_123" }
      when { resource exists with id "res_123" }
      then {
        result.success == true
        result.data.id == "res_123"
      }
    }

    scenario "resource not found" {
      given { id: "res_nonexistent" }
      then {
        result.success == false
        result.error.code == "NOT_FOUND"
      }
    }
  }

  // Global invariants
  invariant "all responses have meta" {
    forall r: ApiResponse<Any> => r.meta != null
  }

  invariant "errors have messages" {
    forall e: ApiError => e.message.length > 0
  }
}
`,

  auth: `/**
 * {{name}} Authentication Domain
 *
 * User authentication with registration, login, and token management.
 */

domain {{pascalName}}Auth {
  /**
   * User account
   */
  entity User {
    id: ID
    email: String
    username: String
    passwordHash: String
    role: UserRole
    status: "active" | "suspended" | "pending"
    emailVerified: Boolean
    createdAt: DateTime
    lastLoginAt: DateTime?
  }

  enum UserRole {
    ADMIN
    MEMBER
    GUEST
  }

  /**
   * Authentication token
   */
  entity AuthToken {
    token: String
    userId: ID
    type: "access" | "refresh"
    expiresAt: DateTime
    scopes: List<String>
    issuedAt: DateTime
  }

  /**
   * Session
   */
  entity Session {
    id: ID
    userId: ID
    userAgent: String?
    ipAddress: String?
    createdAt: DateTime
    expiresAt: DateTime
    isActive: Boolean
  }

  /**
   * Register a new user
   */
  behavior Register {
    input {
      email: String
      username: String
      password: String
    }

    output {
      user: User
      token: AuthToken
    }

    preconditions {
      require input.email.contains("@")
      require input.username.length >= 3
      require input.password.length >= 8
    }

    postconditions {
      ensure result.user.email == input.email
      ensure result.user.username == input.username
      ensure result.user.passwordHash != input.password
      ensure result.user.role == UserRole.MEMBER
      ensure result.user.status == "pending"
      ensure result.token.userId == result.user.id
    }

    scenario "successful registration" {
      given {
        email: "user@example.com"
        username: "newuser"
        password: "securepass123"
      }
      then {
        result.user.email == "user@example.com"
        result.user.role == UserRole.MEMBER
        result.token != null
      }
    }

    scenario "weak password" {
      given {
        email: "user@example.com"
        username: "newuser"
        password: "weak"
      }
      then fails with "Password too short"
    }
  }

  /**
   * Login with credentials
   */
  behavior Login {
    input {
      email: String
      password: String
    }

    output {
      user: User
      accessToken: AuthToken
      refreshToken: AuthToken
    }

    preconditions {
      require input.email.length > 0
      require input.password.length > 0
    }

    postconditions {
      ensure result.accessToken.type == "access"
      ensure result.refreshToken.type == "refresh"
      ensure result.accessToken.expiresAt > now()
      ensure result.user.lastLoginAt == now()
    }

    scenario "successful login" {
      given {
        email: "user@example.com"
        password: "correctpassword"
      }
      when { user exists with email "user@example.com" }
      then {
        result.user.email == "user@example.com"
        result.accessToken.type == "access"
      }
    }

    scenario "invalid credentials" {
      given {
        email: "user@example.com"
        password: "wrongpassword"
      }
      then fails with "Invalid credentials"
    }
  }

  /**
   * Refresh access token
   */
  behavior RefreshToken {
    input { refreshToken: String }
    output AuthToken

    preconditions {
      require input.refreshToken.length > 0
    }

    postconditions {
      ensure result.type == "access"
      ensure result.expiresAt > now()
    }
  }

  /**
   * Logout (invalidate session)
   */
  behavior Logout {
    input { sessionId: ID }
    output { success: Boolean }

    postconditions {
      ensure result.success implies !exists(Session where id == input.sessionId && isActive)
    }
  }

  // Security invariants
  invariant "passwords are never stored plaintext" {
    forall u: User => u.passwordHash != u.email && u.passwordHash.length >= 60
  }

  invariant "tokens have valid expiry" {
    forall t: AuthToken => t.expiresAt > t.issuedAt
  }

  invariant "active sessions have valid expiry" {
    forall s: Session => s.isActive implies s.expiresAt > now()
  }
}
`,

  payment: `/**
 * {{name}} Payment Domain
 *
 * Payment processing with transactions and refunds.
 */

domain {{pascalName}}Payment {
  /**
   * Money amount with currency
   */
  entity Money {
    amount: Decimal
    currency: "USD" | "EUR" | "GBP"
  }

  /**
   * Payment method
   */
  entity PaymentMethod {
    id: ID
    type: "card" | "bank" | "wallet"
    lastFour: String
    expiryMonth: Integer?
    expiryYear: Integer?
    isDefault: Boolean
  }

  /**
   * Transaction record
   */
  entity Transaction {
    id: ID
    type: "charge" | "refund" | "transfer"
    status: "pending" | "processing" | "completed" | "failed"
    amount: Money
    paymentMethodId: ID
    metadata: Map<String, String>?
    createdAt: DateTime
    completedAt: DateTime?
    failureReason: String?
  }

  /**
   * Process a payment
   */
  behavior ProcessPayment {
    input {
      amount: Money
      paymentMethodId: ID
      idempotencyKey: String
      metadata: Map<String, String>?
    }

    output Transaction

    preconditions {
      require input.amount.amount > 0
      require input.idempotencyKey.length > 0
    }

    postconditions {
      ensure result.type == "charge"
      ensure result.amount == input.amount
      ensure result.paymentMethodId == input.paymentMethodId
      ensure result.status in ["pending", "processing", "completed", "failed"]
    }

    scenario "successful payment" {
      given {
        amount: { amount: 99.99, currency: "USD" }
        paymentMethodId: "pm_123"
        idempotencyKey: "idem_abc"
      }
      then {
        result.type == "charge"
        result.amount.amount == 99.99
        result.status in ["completed", "processing"]
      }
    }

    scenario "zero amount rejected" {
      given {
        amount: { amount: 0, currency: "USD" }
        paymentMethodId: "pm_123"
        idempotencyKey: "idem_def"
      }
      then fails with "Amount must be positive"
    }
  }

  /**
   * Refund a transaction
   */
  behavior RefundTransaction {
    input {
      transactionId: ID
      amount: Money?
      reason: String?
    }

    output Transaction

    preconditions {
      require exists(Transaction where id == input.transactionId && type == "charge" && status == "completed")
    }

    postconditions {
      ensure result.type == "refund"
      ensure input.amount != null implies result.amount == input.amount
      ensure result.status in ["pending", "processing", "completed"]
    }

    scenario "full refund" {
      given { transactionId: "txn_123" }
      when { transaction "txn_123" is completed charge of 50.00 USD }
      then {
        result.type == "refund"
        result.amount.amount == 50.00
      }
    }

    scenario "partial refund" {
      given {
        transactionId: "txn_123"
        amount: { amount: 25.00, currency: "USD" }
      }
      then {
        result.type == "refund"
        result.amount.amount == 25.00
      }
    }
  }

  /**
   * Get transaction history
   */
  behavior GetTransactionHistory {
    input {
      startDate: DateTime?
      endDate: DateTime?
      status: String?
      limit: Integer
    }

    output List<Transaction>

    preconditions {
      require input.limit >= 1 && input.limit <= 100
      require input.startDate == null || input.endDate == null || input.startDate <= input.endDate
    }

    postconditions {
      ensure result.length <= input.limit
      ensure input.status != null implies forall t in result => t.status == input.status
    }
  }

  // Financial invariants
  invariant "amounts are non-negative" {
    forall t: Transaction => t.amount.amount >= 0
  }

  invariant "refunds don't exceed original charge" {
    forall refund: Transaction where refund.type == "refund" =>
      refund.amount <= original(refund).amount
  }

  invariant "completed transactions are immutable" {
    forall t: Transaction where t.status == "completed" =>
      old(t.amount) == t.amount && old(t.type) == t.type
  }
}
`,

  workflow: `/**
 * {{name}} Workflow Domain
 *
 * State machine workflow with transitions and approvals.
 */

domain {{pascalName}}Workflow {
  /**
   * Workflow states
   */
  enum WorkflowState {
    DRAFT
    PENDING_REVIEW
    IN_REVIEW
    APPROVED
    REJECTED
    CANCELLED
  }

  /**
   * Workflow item
   */
  entity WorkflowItem {
    id: ID
    state: WorkflowState
    title: String
    description: String?
    submittedBy: ID
    assignedTo: ID?
    priority: "low" | "medium" | "high" | "urgent"
    createdAt: DateTime
    updatedAt: DateTime
    completedAt: DateTime?
  }

  /**
   * State transition record
   */
  entity Transition {
    id: ID
    itemId: ID
    fromState: WorkflowState
    toState: WorkflowState
    performedBy: ID
    comment: String?
    timestamp: DateTime
  }

  /**
   * Submit item for review
   */
  behavior SubmitForReview {
    input {
      itemId: ID
      comment: String?
    }

    output WorkflowItem

    preconditions {
      require exists(WorkflowItem where id == input.itemId && state == WorkflowState.DRAFT)
    }

    postconditions {
      ensure result.state == WorkflowState.PENDING_REVIEW
      ensure result.id == input.itemId
    }

    scenario "submit draft" {
      given { itemId: "item_123" }
      when { item "item_123" is in DRAFT state }
      then {
        result.state == WorkflowState.PENDING_REVIEW
      }
    }
  }

  /**
   * Approve item
   */
  behavior Approve {
    input {
      itemId: ID
      approverId: ID
      comment: String?
    }

    output WorkflowItem

    preconditions {
      require exists(WorkflowItem where id == input.itemId && state == WorkflowState.IN_REVIEW)
    }

    postconditions {
      ensure result.state == WorkflowState.APPROVED
      ensure result.completedAt != null
    }
  }

  /**
   * Reject item
   */
  behavior Reject {
    input {
      itemId: ID
      reviewerId: ID
      reason: String
    }

    output WorkflowItem

    preconditions {
      require exists(WorkflowItem where id == input.itemId && state == WorkflowState.IN_REVIEW)
      require input.reason.length > 0
    }

    postconditions {
      ensure result.state == WorkflowState.REJECTED
      ensure result.completedAt != null
    }
  }

  // State machine invariants
  invariant "valid state transitions" {
    forall t: Transition =>
      (t.fromState == WorkflowState.DRAFT implies t.toState == WorkflowState.PENDING_REVIEW) &&
      (t.fromState == WorkflowState.PENDING_REVIEW implies t.toState in [WorkflowState.IN_REVIEW, WorkflowState.CANCELLED]) &&
      (t.fromState == WorkflowState.IN_REVIEW implies t.toState in [WorkflowState.APPROVED, WorkflowState.REJECTED])
  }

  invariant "completed items are terminal" {
    forall i: WorkflowItem where i.state in [WorkflowState.APPROVED, WorkflowState.REJECTED, WorkflowState.CANCELLED] =>
      i.completedAt != null
  }
}
`,

  webhook: `/**
 * {{name}} Webhook Domain
 *
 * Webhook receiver with signature verification.
 */

domain {{pascalName}}Webhook {
  /**
   * Webhook endpoint configuration
   */
  entity WebhookEndpoint {
    id: ID
    url: String
    secret: String
    events: List<String>
    isActive: Boolean
    createdAt: DateTime
  }

  /**
   * Received webhook event
   */
  entity WebhookEvent {
    id: ID
    endpointId: ID
    eventType: String
    payload: Map<String, Any>
    signature: String
    receivedAt: DateTime
    processedAt: DateTime?
    status: "pending" | "processed" | "failed" | "retrying"
    retryCount: Integer
    lastError: String?
  }

  /**
   * Receive and validate webhook
   */
  behavior ReceiveWebhook {
    input {
      endpointId: ID
      eventType: String
      payload: Map<String, Any>
      signature: String
      timestamp: DateTime
    }

    output WebhookEvent

    preconditions {
      require exists(WebhookEndpoint where id == input.endpointId && isActive)
      require input.eventType.length > 0
      require input.signature.length > 0
    }

    postconditions {
      ensure result.endpointId == input.endpointId
      ensure result.eventType == input.eventType
      ensure result.status == "pending"
      ensure result.retryCount == 0
    }

    scenario "valid webhook received" {
      given {
        endpointId: "ep_123"
        eventType: "payment.completed"
        payload: { "id": "pay_abc" }
        signature: "sha256=abc123..."
        timestamp: now()
      }
      then {
        result.status == "pending"
        result.eventType == "payment.completed"
      }
    }
  }

  /**
   * Process webhook event
   */
  behavior ProcessWebhook {
    input { eventId: ID }

    output WebhookEvent

    preconditions {
      require exists(WebhookEvent where id == input.eventId && status in ["pending", "retrying"])
    }

    postconditions {
      ensure result.status in ["processed", "failed", "retrying"]
      ensure result.status == "processed" implies result.processedAt != null
      ensure result.status == "failed" implies result.lastError != null
    }
  }

  // Webhook invariants
  invariant "signatures are verified" {
    forall e: WebhookEvent where e.status == "processed" =>
      verifySignature(e.signature, e.payload)
  }

  invariant "retry limit respected" {
    forall e: WebhookEvent => e.retryCount <= 5
  }
}
`,

  graphql: `/**
 * {{name}} GraphQL Domain
 *
 * GraphQL API with queries and mutations.
 */

domain {{pascalName}}GraphQL {
  /**
   * GraphQL context
   */
  entity GraphQLContext {
    userId: ID?
    roles: List<String>
    requestId: String
  }

  /**
   * User type
   */
  entity User {
    id: ID
    email: String
    name: String
    avatar: String?
    createdAt: DateTime
  }

  /**
   * Post type
   */
  entity Post {
    id: ID
    title: String
    content: String
    authorId: ID
    status: "draft" | "published" | "archived"
    publishedAt: DateTime?
    createdAt: DateTime
  }

  /**
   * Connection type for pagination
   */
  entity PostConnection {
    edges: List<PostEdge>
    pageInfo: PageInfo
    totalCount: Integer
  }

  entity PostEdge {
    node: Post
    cursor: String
  }

  entity PageInfo {
    hasNextPage: Boolean
    hasPreviousPage: Boolean
    startCursor: String?
    endCursor: String?
  }

  /**
   * Query: Get user by ID
   */
  behavior QueryUser {
    input { id: ID }
    output User?

    postconditions {
      ensure result == null || result.id == input.id
    }
  }

  /**
   * Query: Get posts with pagination
   */
  behavior QueryPosts {
    input {
      first: Integer?
      after: String?
      authorId: ID?
      status: String?
    }

    output PostConnection

    preconditions {
      require input.first == null || (input.first >= 1 && input.first <= 100)
    }

    postconditions {
      ensure input.first != null implies result.edges.length <= input.first
      ensure input.authorId != null implies forall e in result.edges => e.node.authorId == input.authorId
    }
  }

  /**
   * Mutation: Create post
   */
  behavior MutationCreatePost {
    input {
      title: String
      content: String
      status: String?
    }

    output Post

    preconditions {
      require context.userId != null
      require input.title.length > 0
      require input.title.length <= 200
    }

    postconditions {
      ensure result.title == input.title
      ensure result.content == input.content
      ensure result.authorId == context.userId
      ensure result.status == (input.status ?? "draft")
    }
  }

  /**
   * Mutation: Update post
   */
  behavior MutationUpdatePost {
    input {
      id: ID
      title: String?
      content: String?
      status: String?
    }

    output Post

    preconditions {
      require exists(Post where id == input.id && authorId == context.userId)
    }

    postconditions {
      ensure result.id == input.id
      ensure input.title != null implies result.title == input.title
    }
  }

  // Authorization invariants
  invariant "users can only edit own posts" {
    forall mutation: MutationUpdatePost =>
      getPost(mutation.input.id).authorId == context.userId
  }
}
`,
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function toPascalCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^(.)/, (c) => c.toUpperCase());
}

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function applyTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Spec Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * List available templates
 */
export function listTemplates(): TemplateInfo[] {
  return TEMPLATES;
}

/**
 * Get template by name
 */
export function getTemplate(name: string): TemplateInfo | undefined {
  return TEMPLATES.find((t) => t.name === name);
}

/**
 * Create spec from template
 */
export async function spec(options: SpecOptions = {}): Promise<SpecResult> {
  const errors: string[] = [];

  // Handle --templates flag
  if (options.templates) {
    return {
      success: true,
      templates: TEMPLATES,
      errors: [],
    };
  }

  // Handle --template <name> flag
  if (options.template) {
    const templateInfo = getTemplate(options.template);

    if (!templateInfo) {
      return {
        success: false,
        errors: [`Unknown template: ${options.template}. Use --templates to see available templates.`],
      };
    }

    // Check for Pro templates
    if (templateInfo.isPro) {
      return {
        success: false,
        errors: [
          `Template "${options.template}" requires ISL Pro.`,
          PRO_UPGRADE_MESSAGE,
        ],
      };
    }

    const templateContent = TEMPLATE_CONTENT[options.template];
    if (!templateContent) {
      return {
        success: false,
        errors: [`Template content not found for: ${options.template}`],
      };
    }

    // Determine output path and name
    const specName = options.name ?? options.template;
    const outputPath = options.out ?? `./${toKebabCase(specName)}.isl`;
    const resolvedPath = resolve(outputPath);

    // Check if file exists
    if (!options.force && (await fileExists(resolvedPath))) {
      return {
        success: false,
        errors: [`File already exists: ${outputPath}. Use --force to overwrite.`],
      };
    }

    // Apply template variables
    const vars = {
      name: toKebabCase(specName),
      pascalName: toPascalCase(specName),
    };
    const content = applyTemplate(templateContent, vars);

    // Write file
    const spinner = ora(`Creating ${outputPath}...`).start();

    try {
      // Ensure directory exists
      const dir = dirname(resolvedPath);
      if (dir !== '.' && !(await fileExists(dir))) {
        await mkdir(dir, { recursive: true });
      }

      await writeFile(resolvedPath, content, 'utf-8');
      spinner.succeed(`Created ${outputPath}`);

      return {
        success: true,
        filePath: resolvedPath,
        templateUsed: options.template,
        errors: [],
      };
    } catch (err) {
      spinner.fail('Failed to create spec file');
      return {
        success: false,
        errors: [err instanceof Error ? err.message : String(err)],
      };
    }
  }

  // No valid options provided
  return {
    success: false,
    errors: ['No action specified. Use --templates to list templates or --template <name> to create a spec.'],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Output Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Print spec results to console (pretty format)
 */
export function printSpecResult(result: SpecResult, options?: { json?: boolean }): void {
  // JSON output
  if (options?.json) {
    console.log(
      JSON.stringify(
        {
          success: result.success,
          filePath: result.filePath ?? null,
          templateUsed: result.templateUsed ?? null,
          templates: result.templates ?? null,
          errors: result.errors,
        },
        null,
        2
      )
    );
    return;
  }

  // Pretty output
  console.log('');

  // List templates
  if (result.templates) {
    printTemplateList(result.templates);
    return;
  }

  // File creation result
  if (result.success && result.filePath) {
    console.log(chalk.green('✓') + ` Created spec from template ${chalk.cyan(result.templateUsed)}`);
    console.log('');
    output.filePath(result.filePath, 'created');
    console.log('');
    output.box('Next Steps', ['isl check ' + basename(result.filePath), 'isl generate'], 'info');
  } else {
    console.log(chalk.red('✗') + ' Failed to create spec');
    console.log('');
    for (const error of result.errors) {
      if (error.includes('Pro')) {
        console.log(chalk.yellow(`  ${error}`));
      } else {
        console.log(chalk.red(`  ${error}`));
      }
    }
  }
}

/**
 * Print template list
 */
function printTemplateList(templates: TemplateInfo[]): void {
  // Group by category
  const categories: Record<string, TemplateInfo[]> = {};
  for (const t of templates) {
    if (!categories[t.category]) {
      categories[t.category] = [];
    }
    categories[t.category]!.push(t);
  }

  const categoryOrder = ['starter', 'domain', 'integration', 'advanced', 'pro'];
  const categoryLabels: Record<string, string> = {
    starter: 'Starter Templates',
    domain: 'Domain Templates',
    integration: 'Integration Templates',
    advanced: 'Advanced Templates',
    pro: 'Pro Templates',
  };

  for (const category of categoryOrder) {
    const categoryTemplates = categories[category];
    if (!categoryTemplates || categoryTemplates.length === 0) continue;

    output.section(categoryLabels[category] ?? category);
    console.log('');

    for (const t of categoryTemplates) {
      const proLabel = t.isPro ? chalk.yellow(' [Pro]') : '';
      const name = chalk.cyan(t.name.padEnd(20));
      console.log(`  ${name} ${t.description}${proLabel}`);
    }
    console.log('');
  }

  // Pro upgrade message
  console.log(chalk.gray('─'.repeat(60)));
  console.log('');
  console.log(chalk.yellow(`  ${PRO_UPGRADE_MESSAGE}`));
  console.log('');

  // Usage hint
  console.log(chalk.gray('  Usage: isl spec --template <name> [--out <path>] [--name <domain>]'));
  console.log('');
}

/**
 * Get exit code for spec result
 */
export function getSpecExitCode(result: SpecResult): number {
  return result.success ? 0 : 1;
}

export default spec;
