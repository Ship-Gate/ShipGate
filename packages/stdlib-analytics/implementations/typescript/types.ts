/**
 * Analytics Types
 */

// ============================================
// Configuration
// ============================================

export interface AnalyticsConfig {
  /** Interval between flushes (ms) */
  flushInterval: number;
  
  /** Number of events before auto-flush */
  flushAt: number;
  
  /** Maximum queue size */
  maxQueueSize: number;
  
  /** Number of retries on failure */
  retryCount: number;
  
  /** Enable debug logging */
  debug: boolean;
}

export interface ProviderConfig {
  /** Write key / API key */
  writeKey: string;
  
  /** Custom data plane URL */
  dataPlaneUrl?: string;
  
  /** Enable debug mode */
  debug?: boolean;
  
  /** Request timeout (ms) */
  timeout?: number;
}

// ============================================
// Provider Interface
// ============================================

export interface AnalyticsProvider {
  /** Provider name */
  name: string;
  
  /** Send events to provider */
  send(events: QueuedEvent[]): Promise<void>;
  
  /** Shutdown provider */
  shutdown?(): Promise<void>;
}

// ============================================
// Context Types
// ============================================

export interface Context {
  ip?: string;
  userAgent?: string;
  locale?: string;
  timezone?: string;
  page?: PageContext;
  device?: DeviceContext;
  campaign?: CampaignContext;
  referrer?: ReferrerContext;
  library?: LibraryContext;
}

export interface PageContext {
  path: string;
  url: string;
  title?: string;
  search?: string;
  referrer?: string;
}

export interface DeviceContext {
  type?: 'mobile' | 'tablet' | 'desktop' | string;
  manufacturer?: string;
  model?: string;
  osName?: string;
  osVersion?: string;
  browser?: string;
  browserVersion?: string;
  screenWidth?: number;
  screenHeight?: number;
}

export interface CampaignContext {
  name?: string;
  source?: string;
  medium?: string;
  term?: string;
  content?: string;
}

export interface ReferrerContext {
  type?: 'search' | 'social' | 'direct' | 'email' | string;
  name?: string;
  url?: string;
  link?: string;
}

export interface LibraryContext {
  name: string;
  version: string;
}

// ============================================
// Input Types
// ============================================

export interface TrackInput {
  event: string;
  userId?: string;
  anonymousId?: string;
  properties?: Record<string, unknown>;
  context?: Context;
  timestamp?: Date;
  integrations?: Record<string, boolean>;
}

export interface IdentifyInput {
  userId: string;
  anonymousId?: string;
  traits?: Record<string, unknown>;
  context?: Context;
  timestamp?: Date;
}

export interface PageInput {
  userId?: string;
  anonymousId?: string;
  name?: string;
  category?: string;
  properties?: Record<string, unknown>;
  context: Context;
}

export interface GroupInput {
  userId: string;
  groupId: string;
  traits?: Record<string, unknown>;
  context?: Context;
}

export interface AliasInput {
  previousId: string;
  userId: string;
  context?: Context;
}

// ============================================
// Result Types
// ============================================

export type TrackResult = 
  | { ok: true; data: { id: string; queued: boolean } }
  | { ok: false; error: TrackError };

export type IdentifyResult =
  | { ok: true; data: { id: string; merged: boolean } }
  | { ok: false; error: IdentifyError };

export type PageResult =
  | { ok: true; data: { id: string } }
  | { ok: false; error: PageError };

export type GroupResult =
  | { ok: true; data: { id: string } }
  | { ok: false; error: GroupError };

export type AliasResult =
  | { ok: true; data: { id: string } }
  | { ok: false; error: AliasError };

// ============================================
// Error Types
// ============================================

export interface BaseError {
  code: string;
  message: string;
  retriable?: boolean;
}

export interface TrackError extends BaseError {
  code: 'INVALID_EVENT_NAME' | 'MISSING_IDENTIFIER' | 'QUEUE_FULL' | 'RATE_LIMITED';
}

export interface IdentifyError extends BaseError {
  code: 'INVALID_USER_ID' | 'MERGE_FAILED';
}

export interface PageError extends BaseError {
  code: 'MISSING_IDENTIFIER' | 'MISSING_PAGE_CONTEXT';
}

export interface GroupError extends BaseError {
  code: 'INVALID_USER_ID' | 'INVALID_GROUP_ID';
}

export interface AliasError extends BaseError {
  code: 'INVALID_PREVIOUS_ID' | 'INVALID_USER_ID' | 'ALIAS_CONFLICT';
}

// ============================================
// Queue Types
// ============================================

export interface EventQueue {
  events: QueuedEvent[];
  size: number;
}

export interface QueuedEvent {
  id: string;
  type: 'track' | 'identify' | 'page' | 'group' | 'alias';
  payload: TrackPayload | IdentifyPayload | PagePayload | GroupPayload | AliasPayload;
  timestamp: Date;
  retries: number;
}

export interface TrackPayload {
  event: string;
  userId?: string;
  anonymousId?: string;
  properties?: Record<string, unknown>;
  context?: Context;
  timestamp: Date;
  integrations?: Record<string, boolean>;
}

export interface IdentifyPayload {
  userId: string;
  anonymousId?: string;
  traits?: Record<string, unknown>;
  context?: Context;
  timestamp: Date;
}

export interface PagePayload {
  userId?: string;
  anonymousId?: string;
  name?: string;
  category?: string;
  properties?: Record<string, unknown>;
  context: Context;
  timestamp: Date;
}

export interface GroupPayload {
  userId: string;
  groupId: string;
  traits?: Record<string, unknown>;
  context?: Context;
  timestamp: Date;
}

export interface AliasPayload {
  previousId: string;
  userId: string;
  context?: Context;
  timestamp: Date;
}

// ============================================
// Standard Event Names
// ============================================

export const StandardEvents = {
  // E-commerce
  PRODUCTS_SEARCHED: 'Products_Searched',
  PRODUCT_LIST_VIEWED: 'Product_List_Viewed',
  PRODUCT_VIEWED: 'Product_Viewed',
  PRODUCT_ADDED: 'Product_Added',
  PRODUCT_REMOVED: 'Product_Removed',
  CART_VIEWED: 'Cart_Viewed',
  CHECKOUT_STARTED: 'Checkout_Started',
  CHECKOUT_STEP_COMPLETED: 'Checkout_Step_Completed',
  PAYMENT_INFO_ENTERED: 'Payment_Info_Entered',
  ORDER_COMPLETED: 'Order_Completed',
  ORDER_REFUNDED: 'Order_Refunded',
  
  // User Lifecycle
  SIGNED_UP: 'Signed_Up',
  SIGNED_IN: 'Signed_In',
  SIGNED_OUT: 'Signed_Out',
  PASSWORD_RESET_REQUESTED: 'Password_Reset_Requested',
  PASSWORD_RESET_COMPLETED: 'Password_Reset_Completed',
  
  // Engagement
  PAGE_VIEWED: 'Page_Viewed',
  BUTTON_CLICKED: 'Button_Clicked',
  FORM_SUBMITTED: 'Form_Submitted',
  VIDEO_PLAYED: 'Video_Played',
  VIDEO_PAUSED: 'Video_Paused',
  VIDEO_COMPLETED: 'Video_Completed',
  FILE_DOWNLOADED: 'File_Downloaded',
  
  // B2B
  ACCOUNT_CREATED: 'Account_Created',
  ACCOUNT_DELETED: 'Account_Deleted',
  TRIAL_STARTED: 'Trial_Started',
  TRIAL_ENDED: 'Trial_Ended',
  SUBSCRIPTION_CREATED: 'Subscription_Created',
  SUBSCRIPTION_CANCELLED: 'Subscription_Cancelled',
  PLAN_CHANGED: 'Plan_Changed',
  INVOICE_PAID: 'Invoice_Paid',
} as const;

export type StandardEventName = typeof StandardEvents[keyof typeof StandardEvents];

// ============================================
// User Traits
// ============================================

export interface StandardUserTraits {
  // Personal
  email?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  
  // Demographics
  age?: number;
  birthday?: string;
  gender?: string;
  
  // Location
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  city?: string;
  state?: string;
  country?: string;
  
  // Professional
  title?: string;
  company?: string;
  industry?: string;
  
  // Account
  createdAt?: Date | string;
  plan?: string;
  logins?: number;
  
  // Custom
  avatar?: string;
  website?: string;
  description?: string;
}

// ============================================
// Group Traits
// ============================================

export interface StandardGroupTraits {
  name?: string;
  industry?: string;
  employees?: number;
  website?: string;
  plan?: string;
  monthlySpend?: number;
  createdAt?: Date | string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
}
