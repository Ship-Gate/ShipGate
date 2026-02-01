/**
 * ISL Standard Library: Email
 * 
 * Provides email composition, templating, and delivery capabilities.
 */

domain Email version "1.0.0"

// ============================================
// Core Types
// ============================================

type EmailAddress = String where {
  matches(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)
}

type EmailSubject = String where {
  length(1, 998)
}

type MessageId = String where {
  matches(/^<[^>]+>$/)
}

// ============================================
// Entities
// ============================================

entity EmailMessage {
  id: UUID
  from: EmailAddress
  to: EmailAddress[]
  cc?: EmailAddress[]
  bcc?: EmailAddress[]
  replyTo?: EmailAddress
  subject: EmailSubject
  text?: String
  html?: String
  attachments?: Attachment[]
  headers?: Map<String, String>
  priority?: EmailPriority
  tags?: String[]
  metadata?: JSON
  templateId?: String
  templateData?: JSON
  scheduledAt?: DateTime
  createdAt: DateTime
  sentAt?: DateTime
  status: EmailStatus
  
  invariant {
    text != null or html != null or templateId != null
      -> "Email must have content or template"
    to.length > 0
      -> "Email must have at least one recipient"
  }
}

entity Attachment {
  filename: String
  content: Bytes
  contentType: String
  contentId?: String
  disposition: AttachmentDisposition
  size: Int where { value > 0, value <= 25_000_000 }
}

entity EmailTemplate {
  id: UUID
  name: String
  slug: String where { matches(/^[a-z0-9-]+$/) }
  description?: String
  subject: String
  textTemplate?: String
  htmlTemplate?: String
  variables: TemplateVariable[]
  category?: String
  locale?: String
  version: Int
  isActive: Boolean
  createdAt: DateTime
  updatedAt: DateTime
  
  invariant {
    textTemplate != null or htmlTemplate != null
      -> "Template must have text or HTML content"
  }
}

entity TemplateVariable {
  name: String
  type: VariableType
  required: Boolean
  defaultValue?: String
  description?: String
  validation?: String
}

entity EmailDeliveryResult {
  messageId: MessageId
  email: EmailAddress
  status: DeliveryStatus
  provider: String
  providerId?: String
  timestamp: DateTime
  error?: DeliveryError
  attempts: Int
  metadata?: JSON
}

entity DeliveryError {
  code: String
  message: String
  category: ErrorCategory
  permanent: Boolean
  retryAfter?: DateTime
}

entity EmailBatch {
  id: UUID
  name: String
  templateId: UUID
  recipients: BatchRecipient[]
  status: BatchStatus
  totalCount: Int
  sentCount: Int
  failedCount: Int
  startedAt?: DateTime
  completedAt?: DateTime
  createdAt: DateTime
}

entity BatchRecipient {
  email: EmailAddress
  data: JSON
  status: DeliveryStatus
  sentAt?: DateTime
  error?: String
}

// ============================================
// Enums
// ============================================

enum EmailPriority {
  Low
  Normal
  High
  Urgent
}

enum EmailStatus {
  Draft
  Queued
  Sending
  Sent
  Delivered
  Bounced
  Failed
  Cancelled
}

enum DeliveryStatus {
  Pending
  Sent
  Delivered
  Opened
  Clicked
  Bounced
  Complained
  Unsubscribed
  Failed
}

enum AttachmentDisposition {
  Attachment
  Inline
}

enum VariableType {
  String
  Number
  Boolean
  Date
  Array
  Object
}

enum ErrorCategory {
  InvalidEmail
  Bounce
  Block
  Spam
  RateLimit
  Authentication
  Configuration
  Network
  Unknown
}

enum BatchStatus {
  Created
  Processing
  Completed
  Failed
  Cancelled
}

// ============================================
// Behaviors
// ============================================

behavior SendEmail {
  description: "Send a single email message"
  
  actors {
    sender must be_authenticated
  }
  
  input {
    message: EmailMessage
    immediate?: Boolean
  }
  
  output {
    success: EmailDeliveryResult
    errors {
      InvalidRecipient when "recipient email is invalid"
      TemplateNotFound when "template does not exist"
      RateLimitExceeded when "too many emails sent" retriable retryAfter(60s)
      ProviderError when "email provider failed" retriable
      AttachmentTooLarge when "attachment exceeds size limit"
    }
  }
  
  preconditions {
    message.status == Draft or message.status == Queued
      -> "Email must be in draft or queued status"
    message.to.length <= 50
      -> "Cannot send to more than 50 recipients at once"
  }
  
  postconditions {
    success implies message.status in [Sending, Sent]
      -> "Email status should be updated"
    success implies message.sentAt != null
      -> "Sent timestamp should be set"
  }
  
  temporal {
    eventually within(30s) {
      message.status != Sending
    }
  }
}

behavior SendTemplatedEmail {
  description: "Send email using a template"
  
  input {
    templateSlug: String
    to: EmailAddress[]
    cc?: EmailAddress[]
    bcc?: EmailAddress[]
    replyTo?: EmailAddress
    data: JSON
    tags?: String[]
    scheduledAt?: DateTime
  }
  
  output {
    success: EmailDeliveryResult
    errors {
      TemplateNotFound when "template does not exist"
      InvalidTemplateData when "data does not match template variables"
      ValidationFailed when "template variable validation failed"
    }
  }
  
  preconditions {
    to.length > 0
      -> "Must have at least one recipient"
  }
}

behavior SendBatchEmail {
  description: "Send emails to multiple recipients using a template"
  
  input {
    templateId: UUID
    recipients: BatchRecipient[]
    name?: String
    rateLimit?: Int
  }
  
  output {
    success: EmailBatch
    errors {
      TemplateNotFound when "template does not exist"
      TooManyRecipients when "exceeds maximum batch size"
      InvalidRecipientData when "recipient data is invalid"
    }
  }
  
  preconditions {
    recipients.length > 0
      -> "Must have at least one recipient"
    recipients.length <= 10000
      -> "Cannot exceed 10000 recipients per batch"
  }
  
  temporal {
    eventually {
      result.status in [Completed, Failed]
    }
  }
}

behavior CreateTemplate {
  description: "Create a new email template"
  
  input {
    name: String
    slug: String
    description?: String
    subject: String
    textTemplate?: String
    htmlTemplate?: String
    variables?: TemplateVariable[]
    category?: String
    locale?: String
  }
  
  output {
    success: EmailTemplate
    errors {
      DuplicateSlug when "slug already exists"
      InvalidTemplate when "template syntax is invalid"
      MissingContent when "template must have text or HTML"
    }
  }
  
  postconditions {
    success implies result.isActive == true
    success implies result.version == 1
  }
}

behavior UpdateTemplate {
  description: "Update an existing email template"
  
  input {
    templateId: UUID
    name?: String
    description?: String
    subject?: String
    textTemplate?: String
    htmlTemplate?: String
    variables?: TemplateVariable[]
    category?: String
    locale?: String
  }
  
  output {
    success: EmailTemplate
    errors {
      TemplateNotFound when "template does not exist"
      InvalidTemplate when "template syntax is invalid"
    }
  }
  
  postconditions {
    success implies result.version == old(result.version) + 1
    success implies result.updatedAt > old(result.updatedAt)
  }
}

behavior RenderTemplate {
  description: "Render a template with provided data"
  
  input {
    templateId: UUID
    data: JSON
    preview?: Boolean
  }
  
  output {
    success: {
      subject: String
      text?: String
      html?: String
    }
    errors {
      TemplateNotFound when "template does not exist"
      MissingVariable when "required variable not provided"
      RenderError when "template rendering failed"
    }
  }
}

behavior TrackEmailEvent {
  description: "Track email delivery events"
  
  input {
    messageId: MessageId
    event: DeliveryStatus
    timestamp: DateTime
    metadata?: JSON
  }
  
  output {
    success: EmailDeliveryResult
    errors {
      MessageNotFound when "message does not exist"
      InvalidEvent when "invalid event type"
    }
  }
}

behavior GetDeliveryStats {
  description: "Get email delivery statistics"
  
  input {
    startDate: DateTime
    endDate: DateTime
    groupBy?: String
    tags?: String[]
  }
  
  output {
    success: {
      sent: Int
      delivered: Int
      opened: Int
      clicked: Int
      bounced: Int
      complained: Int
      failed: Int
      deliveryRate: Float
      openRate: Float
      clickRate: Float
    }
    errors {
      InvalidDateRange when "date range is invalid"
    }
  }
}

// ============================================
// Domain Invariants
// ============================================

invariants EmailDelivery {
  description: "Email delivery constraints"
  
  "Bounce rate should not exceed threshold"
  all emails in EmailMessage where {
    emails.createdAt > now() - 24h
  } satisfy {
    count(status == Bounced) / count(*) < 0.05
  }
  
  "Complaint rate should not exceed threshold"
  all emails in EmailMessage where {
    emails.createdAt > now() - 24h
  } satisfy {
    count(status == Failed and error.category == Spam) / count(*) < 0.001
  }
}
