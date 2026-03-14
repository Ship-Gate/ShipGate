export const SAAS_TEMPLATE_ISL = `
domain SaaSApp {
  version: "1.0.0"

  enum SubscriptionStatus { TRIALING ACTIVE PAST_DUE CANCELED INCOMPLETE }
  enum MemberRole         { OWNER ADMIN MEMBER VIEWER }
  enum InviteStatus       { PENDING ACCEPTED EXPIRED REVOKED }

  entity User {
    id:           UUID     [immutable, unique]
    email:        String   [unique]
    name:         String
    passwordHash: String   [sensitive]
    avatarUrl:    String   [optional]
    createdAt:    DateTime [immutable]
    updatedAt:    DateTime
    invariants {
      email.is_valid
      name.length > 0
    }
  }

  entity Organization {
    id:        UUID   [immutable, unique]
    name:      String
    slug:      String [unique]
    logoUrl:   String [optional]
    createdAt: DateTime [immutable]
    updatedAt: DateTime
    invariants {
      name.length > 0
      slug.length > 2
    }
  }

  entity Membership {
    id:             UUID       [immutable, unique]
    userId:         UUID
    organizationId: UUID
    role:           MemberRole [default: MEMBER]
    joinedAt:       DateTime   [immutable]
    updatedAt:      DateTime
  }

  entity Subscription {
    id:                  UUID               [immutable, unique]
    organizationId:      UUID
    stripeCustomerId:    String             [optional]
    stripeSubscriptionId: String            [optional]
    status:              SubscriptionStatus [default: TRIALING]
    plan:                String
    seats:               Int                [default: 1]
    currentPeriodEnd:    DateTime           [optional]
    cancelAtPeriodEnd:   Boolean            [default: false]
    createdAt:           DateTime           [immutable]
    updatedAt:           DateTime
    invariants {
      seats > 0
    }
  }

  entity Invite {
    id:             UUID         [immutable, unique]
    organizationId: UUID
    email:          String
    role:           MemberRole   [default: MEMBER]
    token:          String       [unique, sensitive]
    status:         InviteStatus [default: PENDING]
    expiresAt:      DateTime
    createdAt:      DateTime     [immutable]
    updatedAt:      DateTime
    invariants {
      email.is_valid
      expiresAt > createdAt
    }
  }

  behavior RegisterUser {
    input  { email: String; name: String; password: String }
    output {
      success: User
      errors {
        EMAIL_TAKEN   { when: "Email is already registered" }
        WEAK_PASSWORD { when: "Password does not meet requirements" }
        INVALID_EMAIL { when: "Email format is invalid" }
      }
    }
    pre  { email.is_valid && password.length >= 8 && not User.exists(email) }
    post success {
      result.email == input.email
      result.id != null
    }
    temporal { within 500ms (p99): response returned }
  }

  behavior InviteMember {
    input  { organizationId: UUID; email: String; role: MemberRole }
    output {
      success: Invite
      errors {
        ALREADY_MEMBER  { when: "User is already a member of this organization" }
        INVITE_EXISTS   { when: "A pending invite already exists for this email" }
        SEATS_EXHAUSTED { when: "Subscription seat limit reached" }
        UNAUTHORIZED    { when: "Caller is not an admin or owner" }
      }
    }
    pre  { email.is_valid && Organization.exists(organizationId) }
    post success {
      result.email == input.email
      result.status == PENDING
      result.expiresAt > old(result.expiresAt)
    }
  }

  behavior UpgradePlan {
    input  { organizationId: UUID; plan: String; seats: Int }
    output {
      success: Subscription
      errors {
        INVALID_PLAN     { when: "Plan does not exist" }
        PAYMENT_FAILED   { when: "Stripe payment failed" }
        ALREADY_ON_PLAN  { when: "Organization is already on this plan" }
      }
    }
    pre  { seats > 0 && Organization.exists(organizationId) }
    post success {
      result.plan == input.plan
      result.seats >= input.seats
      result.status == ACTIVE
    }
  }
}
`.trim();

export const MARKETPLACE_TEMPLATE_ISL = `
domain Marketplace {
  version: "1.0.0"

  enum ListingStatus  { DRAFT ACTIVE PAUSED SOLD REMOVED }
  enum OrderStatus    { PENDING CONFIRMED SHIPPED DELIVERED CANCELLED REFUNDED }
  enum PaymentStatus  { PENDING AUTHORIZED CAPTURED FAILED REFUNDED }

  entity User {
    id:           UUID     [immutable, unique]
    email:        String   [unique]
    name:         String
    avatarUrl:    String   [optional]
    stripeAccountId: String [optional, sensitive]
    createdAt:    DateTime [immutable]
    updatedAt:    DateTime
  }

  entity Listing {
    id:          UUID          [immutable, unique]
    sellerId:    UUID
    title:       String
    description: String
    price:       Decimal
    currency:    String        [default: "USD"]
    status:      ListingStatus [default: DRAFT]
    images:      String        [optional]
    createdAt:   DateTime      [immutable]
    updatedAt:   DateTime
    invariants {
      price > 0
      title.length > 0
    }
  }

  entity Order {
    id:        UUID        [immutable, unique]
    buyerId:   UUID
    listingId: UUID
    sellerId:  UUID
    amount:    Decimal
    currency:  String
    status:    OrderStatus [default: PENDING]
    createdAt: DateTime    [immutable]
    updatedAt: DateTime
    invariants {
      amount > 0
      buyerId != sellerId
    }
  }

  entity Review {
    id:        UUID     [immutable, unique]
    orderId:   UUID
    reviewerId: UUID
    rating:    Int
    comment:   String   [optional]
    createdAt: DateTime [immutable]
    updatedAt: DateTime
    invariants {
      rating >= 1 && rating <= 5
    }
  }

  behavior CreateListing {
    input  { title: String; description: String; price: Decimal }
    output {
      success: Listing
      errors {
        INVALID_PRICE    { when: "Price must be greater than zero" }
        TITLE_REQUIRED   { when: "Title is empty" }
        UNAUTHORIZED     { when: "Seller account not verified" }
      }
    }
    pre  { price > 0 && title.length > 0 }
    post success {
      result.status == DRAFT
      result.price == input.price
    }
  }

  behavior PurchaseListing {
    input  { listingId: UUID; buyerId: UUID; paymentMethodId: String }
    output {
      success: Order
      errors {
        NOT_AVAILABLE    { when: "Listing is not active" }
        SELF_PURCHASE    { when: "Cannot buy your own listing" }
        PAYMENT_FAILED   { when: "Payment authorization failed" }
      }
    }
    pre  { Listing.exists(listingId) && buyerId != null }
    post success {
      result.status == CONFIRMED
      result.listingId == input.listingId
    }
  }
}
`.trim();

export const CRM_TEMPLATE_ISL = `
domain CRM {
  version: "1.0.0"

  enum DealStage   { LEAD QUALIFIED PROPOSAL NEGOTIATION CLOSED_WON CLOSED_LOST }
  enum ActivityType { CALL EMAIL MEETING NOTE TASK }

  entity Contact {
    id:          UUID     [immutable, unique]
    firstName:   String
    lastName:    String
    email:       String   [unique, optional]
    phone:       String   [optional]
    companyId:   UUID     [optional]
    ownerId:     UUID
    createdAt:   DateTime [immutable]
    updatedAt:   DateTime
    invariants {
      firstName.length > 0 || lastName.length > 0
    }
  }

  entity Company {
    id:        UUID     [immutable, unique]
    name:      String
    domain:    String   [optional]
    industry:  String   [optional]
    ownerId:   UUID
    createdAt: DateTime [immutable]
    updatedAt: DateTime
  }

  entity Deal {
    id:        UUID      [immutable, unique]
    title:     String
    contactId: UUID
    companyId: UUID      [optional]
    value:     Decimal   [optional]
    stage:     DealStage [default: LEAD]
    ownerId:   UUID
    closedAt:  DateTime  [optional]
    createdAt: DateTime  [immutable]
    updatedAt: DateTime
    invariants {
      stage == CLOSED_WON implies closedAt != null
      stage == CLOSED_LOST implies closedAt != null
    }
  }

  entity Activity {
    id:        UUID         [immutable, unique]
    type:      ActivityType
    contactId: UUID         [optional]
    dealId:    UUID         [optional]
    notes:     String       [optional]
    dueAt:     DateTime     [optional]
    completed: Boolean      [default: false]
    createdBy: UUID
    createdAt: DateTime     [immutable]
    updatedAt: DateTime
  }

  behavior CreateDeal {
    input  { title: String; contactId: UUID; value: Decimal; stage: DealStage }
    output {
      success: Deal
      errors {
        CONTACT_NOT_FOUND { when: "Contact does not exist" }
        INVALID_VALUE     { when: "Deal value must be positive" }
      }
    }
    pre  { title.length > 0 && Contact.exists(contactId) }
    post success {
      result.title == input.title
      result.stage == input.stage
    }
  }

  behavior AdvanceDealStage {
    input  { dealId: UUID; newStage: DealStage }
    output {
      success: Deal
      errors {
        NOT_FOUND       { when: "Deal does not exist" }
        INVALID_STAGE   { when: "Cannot skip stages" }
        ALREADY_CLOSED  { when: "Deal is already closed" }
      }
    }
    pre  { Deal.exists(dealId) }
    post success {
      result.stage == input.newStage
      result.id == input.dealId
    }
  }
}
`.trim();

export const INTERNAL_TOOL_TEMPLATE_ISL = `
domain InternalTool {
  version: "1.0.0"

  enum UserRole     { SUPER_ADMIN ADMIN OPERATOR VIEWER }
  enum ResourceType { RECORD DOCUMENT REPORT SETTING }
  enum ActionType   { CREATE READ UPDATE DELETE EXPORT IMPORT }

  entity User {
    id:        UUID     [immutable, unique]
    email:     String   [unique]
    name:      String
    role:      UserRole [default: VIEWER]
    isActive:  Boolean  [default: true]
    createdAt: DateTime [immutable]
    updatedAt: DateTime
  }

  entity Resource {
    id:        UUID         [immutable, unique]
    type:      ResourceType
    name:      String
    data:      String
    createdBy: UUID
    updatedBy: UUID
    createdAt: DateTime     [immutable]
    updatedAt: DateTime
  }

  entity AuditLog {
    id:         UUID       [immutable, unique]
    userId:     UUID
    action:     ActionType
    resourceId: UUID       [optional]
    resourceType: String   [optional]
    details:    String     [optional]
    ipAddress:  String     [optional]
    createdAt:  DateTime   [immutable]
  }

  behavior CreateResource {
    input  { type: ResourceType; name: String; data: String }
    output {
      success: Resource
      errors {
        NAME_TAKEN   { when: "A resource with this name already exists" }
        UNAUTHORIZED { when: "User does not have permission to create resources" }
      }
    }
    pre  { name.length > 0 }
    post success {
      result.name == input.name
      result.type == input.type
    }
  }

  behavior ExportData {
    input  { resourceType: ResourceType; format: String }
    output {
      success: String
      errors {
        UNAUTHORIZED    { when: "Only admins can export data" }
        UNSUPPORTED_FMT { when: "Export format is not supported" }
      }
    }
    pre  { format.length > 0 }
    post success { result.length > 0 }
    temporal { within 30s (p99): export complete }
  }
}
`.trim();
