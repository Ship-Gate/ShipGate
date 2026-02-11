isl_version: "0.1"

intent:
  name: 5280-remodeling-landing
  description: Marketing landing page for 5280 Remodeling handyman service
  domain: marketing

entities:
  - name: Lead
    fields:
      - name: id
        type: uuid
        required: true
        unique: true
        constraints: null
        relation: null
      - name: name
        type: string
        required: true
        unique: false
        constraints: { min: 1, max: 255 }
        relation: null
      - name: email
        type: email
        required: true
        unique: false
        constraints: null
        relation: null
      - name: phone
        type: string
        required: false
        unique: false
        constraints: { min: 10, max: 20 }
        relation: null
      - name: message
        type: string
        required: true
        unique: false
        constraints: { min: 1, max: 2000 }
        relation: null
      - name: serviceInterest
        type: string
        required: false
        unique: false
        constraints: null
        relation: null
      - name: createdAt
        type: date
        required: true
        unique: false
        constraints: null
        relation: null
  - name: Service
    fields:
      - name: id
        type: uuid
        required: true
        unique: true
        constraints: null
        relation: null
      - name: name
        type: string
        required: true
        unique: false
        constraints: { min: 1, max: 100 }
        relation: null
      - name: description
        type: string
        required: false
        unique: false
        constraints: { max: 500 }
        relation: null
      - name: sortOrder
        type: number
        required: false
        unique: false
        constraints: null
        relation: null

auth:
  enabled: false
  provider: none
  roles: []
  mfa: false

endpoints:
  - path: /api/contact
    method: POST
    auth_required: false
    roles_allowed: ["*"]
    input:
      type: object
      required: [name, email, message]
      properties:
        name: { type: string, minLength: 1, maxLength: 255 }
        email: { type: string, format: email }
        phone: { type: string, minLength: 10, maxLength: 20 }
        message: { type: string, minLength: 1, maxLength: 2000 }
        serviceInterest: { type: string }
    output:
      type: object
      properties:
        success: { type: boolean }
        message: { type: string }
    description: Submit contact/quote request from landing page
    side_effects: ["creates audit log", "sends notification to owner"]
  - path: /api/services
    method: GET
    auth_required: false
    roles_allowed: ["*"]
    input: null
    output:
      type: array
      items:
        type: object
        properties:
          id: { type: string, format: uuid }
          name: { type: string }
          description: { type: string }
    description: List handyman services offered
    side_effects: []

business_rules:
  - id: BR-001
    rule: Contact form submissions must be rate-limited to prevent spam
    enforced_at: api
    entities_involved: [Lead]
  - id: BR-002
    rule: All contact form submissions must be logged for follow-up
    enforced_at: both
    entities_involved: [Lead]

security:
  rate_limiting: true
  input_validation: true
  audit_logging: true
  data_encryption_at_rest: true
  notes:
    - Public landing page; no user auth for visitors
    - Protect contact endpoint from spam/bots
    - Sanitize all form input before storage

ambiguities:
  - id: AMB-001
    question: Should services be editable via an admin panel or hardcoded?
    assumption: Static/hardcoded initially; can add CMS later
    impact: low
  - id: AMB-002
    question: Where should lead notifications go (email, CRM, both)?
    assumption: Email to business owner; can integrate CRM later
    impact: medium
  - id: AMB-003
    question: Do you need quote scheduling or job booking on the landing page?
    assumption: No; contact form only for initial inquiry
    impact: medium
