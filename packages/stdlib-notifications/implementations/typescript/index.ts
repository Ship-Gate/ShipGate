/**
 * @isl-lang/stdlib-notifications
 * 
 * ISL Standard Library - Notifications
 * Multi-channel notification system: email, SMS, push notifications.
 */

// ============================================================================
// TEMPLATE TYPES & STORE
// ============================================================================

export type NotificationChannel = 'EMAIL' | 'SMS' | 'PUSH' | 'WEBHOOK';

export type VariableType = 
  | 'STRING' 
  | 'NUMBER' 
  | 'DATE' 
  | 'URL' 
  | 'EMAIL' 
  | 'PHONE' 
  | 'CURRENCY' 
  | 'HTML';

export interface TemplateVariable {
  name: string;
  type: VariableType;
  required: boolean;
  defaultValue?: string;
  description?: string;
  validation?: string;  // Regex pattern
}

export interface Template {
  id: string;
  channel: NotificationChannel;
  category?: string;
  subject?: string;
  body: string;
  htmlBody?: string;
  textBody?: string;
  variables: TemplateVariable[];
  locale: string;
  fallbackLocale?: string;
  name: string;
  description?: string;
  version: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  tags: Map<string, string>;
}

export interface CreateTemplateInput {
  id: string;
  channel: NotificationChannel;
  name: string;
  subject?: string;
  body: string;
  htmlBody?: string;
  textBody?: string;
  variables?: TemplateVariable[];
  locale?: string;
  category?: string;
  description?: string;
  tags?: Record<string, string>;
}

export interface RenderResult {
  subject?: string;
  body: string;
  htmlBody?: string;
}

export class TemplateError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'TemplateError';
  }
}

export class TemplateStore {
  private templates: Map<string, Template> = new Map();

  createTemplate(input: CreateTemplateInput, createdBy: string): Template {
    if (this.templates.has(input.id)) {
      throw new TemplateError('DUPLICATE_ID', `Template ${input.id} already exists`);
    }

    if (input.channel === 'EMAIL' && !input.subject) {
      throw new TemplateError('MISSING_SUBJECT', 'Email template requires subject');
    }

    // Extract variables from body and subject
    const detectedVars = this.extractVariables(input.body);
    if (input.subject) {
      for (const v of this.extractVariables(input.subject)) {
        if (!detectedVars.includes(v)) {
          detectedVars.push(v);
        }
      }
    }
    const declaredVars = input.variables ?? [];
    
    // Validate all detected variables are declared
    for (const v of detectedVars) {
      if (!declaredVars.some(dv => dv.name === v)) {
        declaredVars.push({
          name: v,
          type: 'STRING',
          required: true,
        });
      }
    }

    const template: Template = {
      id: input.id,
      channel: input.channel,
      category: input.category,
      name: input.name,
      subject: input.subject,
      body: input.body,
      htmlBody: input.htmlBody,
      textBody: input.textBody,
      variables: declaredVars,
      locale: input.locale ?? 'en',
      description: input.description,
      version: 1,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy,
      tags: new Map(Object.entries(input.tags ?? {})),
    };

    this.templates.set(input.id, template);
    return template;
  }

  getTemplate(id: string): Template | undefined {
    return this.templates.get(id);
  }

  updateTemplate(id: string, updates: Partial<Pick<Template, 
    'subject' | 'body' | 'htmlBody' | 'textBody' | 'variables' | 'active' | 'category' | 'description'
  >>): Template {
    const template = this.templates.get(id);
    if (!template) {
      throw new TemplateError('NOT_FOUND', `Template ${id} not found`);
    }

    Object.assign(template, updates, {
      version: template.version + 1,
      updatedAt: new Date(),
    });

    return template;
  }

  deleteTemplate(id: string): boolean {
    if (!this.templates.has(id)) {
      throw new TemplateError('NOT_FOUND', `Template ${id} not found`);
    }
    return this.templates.delete(id);
  }

  listTemplates(filter?: {
    channel?: NotificationChannel;
    category?: string;
    active?: boolean;
    locale?: string;
  }): Template[] {
    let results = Array.from(this.templates.values());

    if (filter?.channel) {
      results = results.filter(t => t.channel === filter.channel);
    }
    if (filter?.category) {
      results = results.filter(t => t.category === filter.category);
    }
    if (filter?.active !== undefined) {
      results = results.filter(t => t.active === filter.active);
    }
    if (filter?.locale) {
      results = results.filter(t => t.locale === filter.locale);
    }

    return results;
  }

  private extractVariables(body: string): string[] {
    const regex = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;
    const variables: string[] = [];
    let match;
    
    while ((match = regex.exec(body)) !== null) {
      const varName = match[1];
      if (varName && !variables.includes(varName)) {
        variables.push(varName);
      }
    }
    
    return variables;
  }
}

export const templateStore = new TemplateStore();

// ============================================================================
// TEMPLATE RENDERING
// ============================================================================

export function renderTemplate(
  template: Template, 
  variables: Map<string, string>
): RenderResult {
  // Validate required variables
  for (const v of template.variables) {
    if (v.required && !variables.has(v.name) && !v.defaultValue) {
      throw new TemplateError(
        'MISSING_VARIABLE',
        `Missing required variable: ${v.name}`
      );
    }
  }

  // Build variable map with defaults
  const fullVariables = new Map<string, string>();
  for (const v of template.variables) {
    const value = variables.get(v.name) ?? v.defaultValue;
    if (value !== undefined) {
      fullVariables.set(v.name, value);
    }
  }

  // Render body
  const body = interpolate(template.body, fullVariables);
  
  // Render subject (if email)
  const subject = template.subject 
    ? interpolate(template.subject, fullVariables) 
    : undefined;
  
  // Render HTML body (if present)
  const htmlBody = template.htmlBody 
    ? interpolate(template.htmlBody, fullVariables) 
    : undefined;

  return { subject, body, htmlBody };
}

function interpolate(text: string, variables: Map<string, string>): string {
  return text.replace(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g, (_, name) => {
    return variables.get(name) ?? `{{${name}}}`;
  });
}

export function validateTemplate(input: {
  channel: NotificationChannel;
  subject?: string;
  body: string;
  variables?: TemplateVariable[];
}): {
  valid: boolean;
  errors: Array<{ location: string; message: string }>;
  detectedVariables: string[];
} {
  const errors: Array<{ location: string; message: string }> = [];
  
  // Check subject for email
  if (input.channel === 'EMAIL' && !input.subject) {
    errors.push({ location: 'subject', message: 'Email template requires subject' });
  }

  // Check body not empty
  if (!input.body || input.body.trim().length === 0) {
    errors.push({ location: 'body', message: 'Body cannot be empty' });
  }

  // Extract and validate variables
  const regex = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;
  const detectedVariables: string[] = [];
  let match;
  
  while ((match = regex.exec(input.body)) !== null) {
    const varName = match[1];
    if (varName && !detectedVariables.includes(varName)) {
      detectedVariables.push(varName);
    }
  }

  // Check detected variables are declared
  if (input.variables) {
    for (const v of detectedVariables) {
      if (!input.variables.some(dv => dv.name === v)) {
        errors.push({
          location: `variable:${v}`,
          message: `Variable ${v} used in body but not declared`,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    detectedVariables,
  };
}

// ============================================================================
// RE-EXPORT CHANNEL IMPLEMENTATIONS
// ============================================================================

// Re-export from channel implementations (avoiding duplicate exports)
export { 
  emailStore, 
  EmailStore, 
  EmailError,
  type Email,
  type Attachment,
  type BounceType,
  type EmailNotification,
  type SendEmailInput,
  type SendEmailDirectInput,
} from './email.js';

export { 
  smsStore, 
  SMSStore, 
  SMSError,
  type Phone,
  type SMSNotification,
  type SendSMSInput,
  type SendSMSDirectInput,
  type SendVerificationSMSInput,
  type VerificationResult,
} from './sms.js';

export { 
  pushStore, 
  PushStore, 
  PushError,
  type DeviceToken,
  type PushPlatform,
  type PushNotification,
  type SendPushInput,
  type SendPushDirectInput,
  type DeviceRegistration,
} from './push.js';

// ============================================================================
// UNIFIED NOTIFICATION TYPES
// ============================================================================

export type NotificationStatus = 
  | 'PENDING'
  | 'QUEUED'
  | 'SENT'
  | 'DELIVERED'
  | 'OPENED'
  | 'CLICKED'
  | 'FAILED'
  | 'BOUNCED'
  | 'UNSUBSCRIBED';

export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface Recipient {
  channel: NotificationChannel;
  address: string;
  variables?: Record<string, string>;
  metadata?: Record<string, string>;
}

export interface BatchResult {
  total: number;
  successful: number;
  failed: number;
  notifications: string[];
  errors: Array<{
    index: number;
    recipient: string;
    errorCode: string;
    errorMessage: string;
  }>;
}

// ============================================================================
// BEHAVIOR IMPLEMENTATIONS
// ============================================================================

import { emailStore, type SendEmailInput, type EmailNotification } from './email.js';
import { smsStore, type SendSMSInput, type SMSNotification } from './sms.js';
import { pushStore, type SendPushInput, type PushNotification } from './push.js';

type AnyNotification = EmailNotification | SMSNotification | PushNotification;
type Result<T> = { success: true; data: T } | { success: false; error: string; code: string };

/**
 * Send an email notification
 */
export async function SendEmail(
  input: Omit<SendEmailInput, 'templateId'> & { templateId: string },
  senderId: string = 'default'
): Promise<Result<EmailNotification>> {
  try {
    const notification = await emailStore.sendEmail(input, senderId);
    return { success: true, data: notification };
  } catch (error) {
    const code = (error as { code?: string }).code ?? 'UNKNOWN_ERROR';
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      code,
    };
  }
}

/**
 * Send an SMS notification
 */
export async function SendSMS(
  input: Omit<SendSMSInput, 'templateId'> & { templateId: string },
  senderId: string = 'default'
): Promise<Result<SMSNotification>> {
  try {
    const notification = await smsStore.sendSMS(input, senderId);
    return { success: true, data: notification };
  } catch (error) {
    const code = (error as { code?: string }).code ?? 'UNKNOWN_ERROR';
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      code,
    };
  }
}

/**
 * Send a push notification
 */
export async function SendPush(
  input: Omit<SendPushInput, 'templateId'> & { templateId: string },
  senderId: string = 'default'
): Promise<Result<PushNotification>> {
  try {
    const notification = await pushStore.sendPush(input, senderId);
    return { success: true, data: notification };
  } catch (error) {
    const code = (error as { code?: string }).code ?? 'UNKNOWN_ERROR';
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      code,
    };
  }
}

/**
 * Send notification to multiple recipients (batch)
 */
export async function BatchSend(input: {
  templateId: string;
  recipients: Recipient[];
  sharedVariables?: Record<string, string>;
  priority?: NotificationPriority;
  campaignId: string;
  failFast?: boolean;
}, senderId: string = 'default'): Promise<Result<BatchResult>> {
  if (input.recipients.length > 1000) {
    return {
      success: false,
      error: 'Exceeds 1000 recipient limit',
      code: 'TOO_MANY_RECIPIENTS',
    };
  }

  const template = templateStore.getTemplate(input.templateId);
  if (!template) {
    return {
      success: false,
      error: `Template not found: ${input.templateId}`,
      code: 'TEMPLATE_NOT_FOUND',
    };
  }

  const result: BatchResult = {
    total: input.recipients.length,
    successful: 0,
    failed: 0,
    notifications: [],
    errors: [],
  };

  for (let i = 0; i < input.recipients.length; i++) {
    const recipient = input.recipients[i];
    if (!recipient) continue;
    
    // Merge shared variables with recipient-specific
    const variables = {
      ...input.sharedVariables,
      ...recipient.variables,
    };

    try {
      let notification: AnyNotification;

      switch (recipient.channel) {
        case 'EMAIL':
          notification = await emailStore.sendEmail({
            to: recipient.address,
            templateId: input.templateId,
            variables,
            priority: input.priority,
            campaignId: input.campaignId,
          }, senderId);
          break;
        
        case 'SMS':
          notification = await smsStore.sendSMS({
            to: recipient.address,
            templateId: input.templateId,
            variables,
            priority: input.priority,
            campaignId: input.campaignId,
          }, senderId);
          break;
        
        case 'PUSH':
          notification = await pushStore.sendPush({
            deviceToken: recipient.address,
            templateId: input.templateId,
            variables,
            priority: input.priority,
            campaignId: input.campaignId,
          }, senderId);
          break;
        
        default:
          throw new Error(`Unsupported channel: ${recipient.channel}`);
      }

      result.successful++;
      result.notifications.push(notification.id);
    } catch (error) {
      result.failed++;
      result.errors.push({
        index: i,
        recipient: recipient.address,
        errorCode: (error as { code?: string }).code ?? 'SEND_FAILED',
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      if (input.failFast) {
        break;
      }
    }
  }

  return { success: true, data: result };
}

/**
 * Create a notification template
 */
export async function CreateTemplate(
  input: CreateTemplateInput,
  createdBy: string = 'default'
): Promise<Result<Template>> {
  try {
    const template = templateStore.createTemplate(input, createdBy);
    return { success: true, data: template };
  } catch (error) {
    const code = (error as { code?: string }).code ?? 'UNKNOWN_ERROR';
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      code,
    };
  }
}

/**
 * Get a template by ID
 */
export async function GetTemplate(
  id: string
): Promise<Result<Template>> {
  const template = templateStore.getTemplate(id);
  if (!template) {
    return { success: false, error: `Template not found: ${id}`, code: 'NOT_FOUND' };
  }
  return { success: true, data: template };
}

/**
 * Delete a template
 */
export async function DeleteTemplate(
  id: string
): Promise<Result<boolean>> {
  try {
    const result = templateStore.deleteTemplate(id);
    return { success: true, data: result };
  } catch (error) {
    const code = (error as { code?: string }).code ?? 'UNKNOWN_ERROR';
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      code,
    };
  }
}

/**
 * Get notification by ID
 */
export async function GetNotification(
  id: string,
  channel: NotificationChannel
): Promise<Result<AnyNotification>> {
  let notification: AnyNotification | undefined;
  
  switch (channel) {
    case 'EMAIL':
      notification = emailStore.getNotification(id);
      break;
    case 'SMS':
      notification = smsStore.getNotification(id);
      break;
    case 'PUSH':
      notification = pushStore.getNotification(id);
      break;
  }

  if (!notification) {
    return { success: false, error: `Notification not found: ${id}`, code: 'NOT_FOUND' };
  }
  return { success: true, data: notification };
}

/**
 * Send verification SMS
 */
export async function SendVerificationSMS(input: {
  to: string;
  code: string;
  expiresIn?: number;
}, senderId: string = 'default'): Promise<Result<{
  notification: SMSNotification;
  verificationId: string;
  expiresAt: Date;
}>> {
  try {
    const result = await smsStore.sendVerificationSMS(input, senderId);
    return { success: true, data: result };
  } catch (error) {
    const code = (error as { code?: string }).code ?? 'UNKNOWN_ERROR';
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      code,
    };
  }
}

/**
 * Register a device for push notifications
 */
export async function RegisterDevice(input: {
  userId: string;
  deviceToken: string;
  platform: 'IOS' | 'ANDROID' | 'WEB';
  deviceName?: string;
  appVersion?: string;
}): Promise<Result<{ deviceId: string; userId: string; registeredAt: Date }>> {
  try {
    const result = pushStore.registerDevice(input);
    return { 
      success: true, 
      data: { 
        deviceId: result.id, 
        userId: result.userId, 
        registeredAt: result.registeredAt 
      } 
    };
  } catch (error) {
    const code = (error as { code?: string }).code ?? 'UNKNOWN_ERROR';
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      code,
    };
  }
}

/**
 * Unregister a device from push notifications
 */
export async function UnregisterDevice(
  deviceToken: string
): Promise<Result<boolean>> {
  try {
    const result = pushStore.unregisterDevice(deviceToken);
    return { success: true, data: result };
  } catch (error) {
    const code = (error as { code?: string }).code ?? 'UNKNOWN_ERROR';
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      code,
    };
  }
}
