/**
 * ISL Translator - NL → ISL
 * 
 * Converts natural language requests into structured ISL specifications.
 * 
 * KEY RULE: Translator NEVER emits code. Only spec.
 * 
 * Output:
 * - JSON AST (structured, deterministic)
 * - Assumptions + confidence scores
 * - Open questions (when underspecified)
 * 
 * @module @isl-lang/translator
 */

// ============================================================================
// Types
// ============================================================================

export interface TranslationRequest {
  /** Natural language input */
  prompt: string;
  /** Optional context from repo */
  repoContext?: RepoContext;
  /** Pattern library to match against */
  patternLibrary?: PatternLibrary;
}

export interface RepoContext {
  framework: 'nextjs' | 'express' | 'fastify' | 'nestjs' | 'hono' | 'unknown';
  authLib?: string;         // e.g., 'clerk', 'nextauth', 'passport', 'jwt'
  validationLib?: string;   // e.g., 'zod', 'yup', 'joi'
  dbLib?: string;           // e.g., 'prisma', 'drizzle', 'typeorm'
  routingStyle: 'file-based' | 'explicit' | 'controller';
  conventions: {
    apiPrefix?: string;     // e.g., '/api'
    authMiddleware?: string;
    rateLimitMiddleware?: string;
  };
}

export interface PatternLibrary {
  patterns: Pattern[];
}

export interface Pattern {
  id: string;
  name: string;
  triggers: string[];       // Keywords that trigger this pattern
  template: ISLTemplate;
  requiredFields: string[];
  optionalFields: string[];
}

export interface ISLTemplate {
  domain: string;
  behaviors: BehaviorTemplate[];
  entities?: EntityTemplate[];
}

export interface BehaviorTemplate {
  name: string;
  description: string;
  input: FieldTemplate[];
  output: OutputTemplate;
  preconditions: string[];
  postconditions: string[];
  invariants: string[];
  intents: string[];        // Intent tags (rate-limit, audit, no-pii, etc.)
}

export interface EntityTemplate {
  name: string;
  fields: FieldTemplate[];
  invariants: string[];
}

export interface FieldTemplate {
  name: string;
  type: string;
  optional?: boolean;
  constraints?: string[];
}

export interface OutputTemplate {
  success: string;
  errors: ErrorTemplate[];
}

export interface ErrorTemplate {
  name: string;
  when: string;
}

// ============================================================================
// Translation Result
// ============================================================================

export interface TranslationResult {
  success: boolean;
  
  /** Structured ISL AST */
  ast?: ISLAST;
  
  /** Canonical ISL source (formatted from AST) */
  isl?: string;
  
  /** Assumptions made during translation */
  assumptions: Assumption[];
  
  /** Open questions that need human clarification */
  openQuestions: OpenQuestion[];
  
  /** Overall confidence score (0-1) */
  confidence: number;
  
  /** Matched pattern (if any) */
  matchedPattern?: string;
  
  /** Errors if translation failed */
  errors?: string[];
}

export interface Assumption {
  id: string;
  description: string;
  confidence: number;       // 0-1
  category: 'auth' | 'validation' | 'storage' | 'integration' | 'security' | 'behavior';
  defaultValue: string;
  alternatives?: string[];
}

export interface OpenQuestion {
  id: string;
  question: string;
  reason: string;
  options?: string[];
  required: boolean;
  category: 'clarification' | 'design-decision' | 'security-review';
}

// ============================================================================
// ISL AST Types
// ============================================================================

export interface ISLAST {
  kind: 'Domain';
  name: string;
  version: string;
  entities: EntityAST[];
  behaviors: BehaviorAST[];
  invariants: string[];
  metadata: {
    generatedFrom: 'nl-translator';
    prompt: string;
    timestamp: string;
    confidence: number;
  };
}

export interface EntityAST {
  kind: 'Entity';
  name: string;
  fields: FieldAST[];
  invariants: string[];
}

export interface FieldAST {
  kind: 'Field';
  name: string;
  type: TypeAST;
  optional: boolean;
  constraints: ConstraintAST[];
}

export interface TypeAST {
  kind: 'Type';
  name: string;
  generic?: TypeAST;
}

export interface ConstraintAST {
  kind: 'Constraint';
  expression: string;
}

export interface BehaviorAST {
  kind: 'Behavior';
  name: string;
  description: string;
  input: FieldAST[];
  output: OutputAST;
  preconditions: ExpressionAST[];
  postconditions: PostconditionAST[];
  invariants: ExpressionAST[];
  intents: IntentAST[];
}

export interface OutputAST {
  kind: 'Output';
  success: TypeAST;
  errors: ErrorAST[];
}

export interface ErrorAST {
  kind: 'Error';
  name: string;
  when: string;
}

export interface ExpressionAST {
  kind: 'Expression';
  source: string;
}

export interface PostconditionAST {
  kind: 'Postcondition';
  condition: string;
  predicates: ExpressionAST[];
}

export interface IntentAST {
  kind: 'Intent';
  tag: string;
  description?: string;
}

// ============================================================================
// Built-in Pattern Library
// ============================================================================

export const AUTH_PATTERNS: Pattern[] = [
  {
    id: 'user-login',
    name: 'User Login',
    triggers: ['login', 'sign in', 'signin', 'authenticate', 'auth'],
    template: {
      domain: 'Auth',
      behaviors: [{
        name: 'UserLogin',
        description: 'Authenticate user with email and password',
        input: [
          { name: 'email', type: 'Email', constraints: ['valid email format'] },
          { name: 'password', type: 'String', constraints: ['min length 8'] },
        ],
        output: {
          success: 'AuthToken',
          errors: [
            { name: 'InvalidCredentials', when: 'email or password incorrect' },
            { name: 'AccountLocked', when: 'too many failed attempts' },
            { name: 'AccountDisabled', when: 'account is deactivated' },
          ],
        },
        preconditions: [
          'email is valid format',
          'password.length >= 8',
          'rate limit not exceeded',
        ],
        postconditions: [
          'token is issued with valid expiry',
          'login attempt is recorded',
          'failed attempts counter updated',
        ],
        invariants: [
          'password is never logged',
          'token is cryptographically secure',
        ],
        intents: ['rate-limit-required', 'audit-required', 'no-pii-logging'],
      }],
      entities: [{
        name: 'AuthToken',
        fields: [
          { name: 'accessToken', type: 'String' },
          { name: 'refreshToken', type: 'String', optional: true },
          { name: 'expiresAt', type: 'DateTime' },
        ],
        invariants: ['accessToken is JWT', 'expiresAt > now'],
      }],
    },
    requiredFields: ['email', 'password'],
    optionalFields: ['rememberMe', 'deviceId'],
  },
  {
    id: 'user-register',
    name: 'User Registration',
    triggers: ['register', 'signup', 'sign up', 'create account', 'new user'],
    template: {
      domain: 'Auth',
      behaviors: [{
        name: 'UserRegister',
        description: 'Create new user account',
        input: [
          { name: 'email', type: 'Email', constraints: ['valid email format', 'unique'] },
          { name: 'password', type: 'String', constraints: ['min length 8', 'complexity requirements'] },
          { name: 'confirmPassword', type: 'String', constraints: ['matches password'] },
        ],
        output: {
          success: 'User',
          errors: [
            { name: 'EmailAlreadyExists', when: 'email is taken' },
            { name: 'WeakPassword', when: 'password does not meet requirements' },
            { name: 'PasswordMismatch', when: 'passwords do not match' },
          ],
        },
        preconditions: [
          'email is valid format',
          'email is not already registered',
          'password meets complexity requirements',
          'password == confirmPassword',
          'rate limit not exceeded',
        ],
        postconditions: [
          'user record created in database',
          'password is hashed (never stored plain)',
          'welcome email queued',
          'audit event recorded',
        ],
        invariants: [
          'password is never stored in plain text',
          'email is verified before full access',
        ],
        intents: ['rate-limit-required', 'audit-required', 'encrypt-at-rest', 'no-pii-logging'],
      }],
    },
    requiredFields: ['email', 'password', 'confirmPassword'],
    optionalFields: ['name', 'username'],
  },
  {
    id: 'password-reset',
    name: 'Password Reset',
    triggers: ['reset password', 'forgot password', 'password recovery', 'recover account'],
    template: {
      domain: 'Auth',
      behaviors: [
        {
          name: 'RequestPasswordReset',
          description: 'Request password reset email',
          input: [
            { name: 'email', type: 'Email' },
          ],
          output: {
            success: 'Void',
            errors: [],
          },
          preconditions: [
            'rate limit not exceeded',
          ],
          postconditions: [
            'if email exists, reset token generated',
            'if email exists, reset email sent',
            'response does not reveal if email exists',
          ],
          invariants: [
            'timing is constant (prevent enumeration)',
          ],
          intents: ['rate-limit-required', 'audit-required', 'prevent-enumeration'],
        },
        {
          name: 'ResetPassword',
          description: 'Set new password using reset token',
          input: [
            { name: 'token', type: 'String' },
            { name: 'newPassword', type: 'String', constraints: ['min length 8'] },
            { name: 'confirmPassword', type: 'String' },
          ],
          output: {
            success: 'Void',
            errors: [
              { name: 'InvalidToken', when: 'token is invalid or expired' },
              { name: 'WeakPassword', when: 'password does not meet requirements' },
              { name: 'PasswordMismatch', when: 'passwords do not match' },
            ],
          },
          preconditions: [
            'token is valid and not expired',
            'newPassword meets complexity',
            'newPassword == confirmPassword',
          ],
          postconditions: [
            'password is updated (hashed)',
            'reset token is invalidated',
            'all sessions are invalidated',
            'notification sent to user',
          ],
          invariants: [
            'token can only be used once',
          ],
          intents: ['rate-limit-required', 'audit-required', 'session-invalidation'],
        },
      ],
    },
    requiredFields: ['email'],
    optionalFields: [],
  },
];

export const CRUD_PATTERNS: Pattern[] = [
  {
    id: 'crud-resource',
    name: 'CRUD Resource',
    triggers: ['crud', 'resource', 'api for', 'endpoints for'],
    template: {
      domain: 'Resource',
      behaviors: [
        {
          name: 'Create{Resource}',
          description: 'Create a new {resource}',
          input: [],
          output: { success: '{Resource}', errors: [] },
          preconditions: ['user is authenticated', 'user has permission'],
          postconditions: ['{resource} is created', 'audit event recorded'],
          invariants: [],
          intents: ['auth-required', 'audit-required'],
        },
        {
          name: 'Get{Resource}',
          description: 'Get {resource} by ID',
          input: [{ name: 'id', type: 'UUID' }],
          output: { success: '{Resource}', errors: [{ name: 'NotFound', when: '{resource} does not exist' }] },
          preconditions: ['user is authenticated'],
          postconditions: [],
          invariants: [],
          intents: ['auth-required'],
        },
        {
          name: 'Update{Resource}',
          description: 'Update existing {resource}',
          input: [{ name: 'id', type: 'UUID' }],
          output: { success: '{Resource}', errors: [{ name: 'NotFound', when: '{resource} does not exist' }] },
          preconditions: ['user is authenticated', 'user owns {resource} or is admin'],
          postconditions: ['{resource} is updated', 'audit event recorded'],
          invariants: [],
          intents: ['auth-required', 'audit-required'],
        },
        {
          name: 'Delete{Resource}',
          description: 'Delete {resource}',
          input: [{ name: 'id', type: 'UUID' }],
          output: { success: 'Void', errors: [{ name: 'NotFound', when: '{resource} does not exist' }] },
          preconditions: ['user is authenticated', 'user owns {resource} or is admin'],
          postconditions: ['{resource} is deleted (soft or hard)', 'audit event recorded'],
          invariants: [],
          intents: ['auth-required', 'audit-required'],
        },
      ],
    },
    requiredFields: ['id'],
    optionalFields: [],
  },
];

export const TODO_APP_PATTERNS: Pattern[] = [
  {
    id: 'todo-app',
    name: 'Todo App with Auth',
    triggers: ['todo app', 'todo list', 'todo lists', 'todos', 'task app', 'task list'],
    template: {
      domain: 'TodoApp',
      entities: [
        {
          name: 'User',
          fields: [
            { name: 'id', type: 'UUID', constraints: ['unique'] },
            { name: 'email', type: 'Email', constraints: ['unique'] },
            { name: 'username', type: 'String', constraints: ['min length 3'] },
            { name: 'password', type: 'String', constraints: ['hashed'] },
          ],
          invariants: ['email contains @', 'password never stored plain'],
        },
        {
          name: 'Todo',
          fields: [
            { name: 'id', type: 'UUID', constraints: ['unique'] },
            { name: 'title', type: 'String', constraints: ['required'] },
            { name: 'description', type: 'String', optional: true },
            { name: 'dueDate', type: 'DateTime', optional: true },
            { name: 'priority', type: 'String', constraints: ['low|medium|high'] },
            { name: 'completed', type: 'Boolean', constraints: ['default false'] },
            { name: 'order', type: 'Int', optional: true },
            { name: 'userId', type: 'UUID', constraints: ['references User'] },
          ],
          invariants: ['title length > 0', 'priority in [low,medium,high]'],
        },
      ],
      behaviors: [
        {
          name: 'RegisterUser',
          description: 'Register a new user account',
          input: [
            { name: 'email', type: 'Email' },
            { name: 'username', type: 'String' },
            { name: 'password', type: 'String' },
          ],
          output: {
            success: 'User',
            errors: [
              { name: 'DuplicateEmail', when: 'email already registered' },
              { name: 'InvalidUsername', when: 'username too short' },
            ],
          },
          preconditions: ['email valid', 'username length >= 3'],
          postconditions: ['user created', 'password hashed'],
          invariants: ['password never logged'],
          intents: ['rate-limit-required', 'audit-required', 'no-pii-logging'],
        },
        {
          name: 'LoginUser',
          description: 'Log in with email and password',
          input: [
            { name: 'email', type: 'Email' },
            { name: 'password', type: 'String' },
          ],
          output: {
            success: 'AuthToken',
            errors: [
              { name: 'InvalidCredentials', when: 'email or password wrong' },
            ],
          },
          preconditions: ['rate limit not exceeded'],
          postconditions: ['token issued', 'login recorded'],
          invariants: ['password never logged'],
          intents: ['rate-limit-required', 'audit-required', 'no-pii-logging'],
        },
        {
          name: 'CreateTodo',
          description: 'Create a new todo',
          input: [
            { name: 'title', type: 'String' },
            { name: 'description', type: 'String', optional: true },
            { name: 'dueDate', type: 'DateTime', optional: true },
            { name: 'priority', type: 'String', optional: true },
          ],
          output: {
            success: 'Todo',
            errors: [{ name: 'ValidationError', when: 'invalid input' }],
          },
          preconditions: ['user authenticated', 'title length > 0'],
          postconditions: ['todo created', 'todo belongs to user'],
          invariants: [],
          intents: ['auth-required', 'audit-required'],
        },
        {
          name: 'UpdateTodo',
          description: 'Edit an existing todo',
          input: [
            { name: 'id', type: 'UUID' },
            { name: 'title', type: 'String', optional: true },
            { name: 'description', type: 'String', optional: true },
            { name: 'dueDate', type: 'DateTime', optional: true },
            { name: 'priority', type: 'String', optional: true },
            { name: 'completed', type: 'Boolean', optional: true },
          ],
          output: {
            success: 'Todo',
            errors: [
              { name: 'NotFound', when: 'todo does not exist' },
              { name: 'Forbidden', when: 'user does not own todo' },
            ],
          },
          preconditions: ['user authenticated', 'user owns todo'],
          postconditions: ['todo updated'],
          invariants: [],
          intents: ['auth-required', 'audit-required'],
        },
        {
          name: 'DeleteTodo',
          description: 'Delete a todo',
          input: [{ name: 'id', type: 'UUID' }],
          output: {
            success: 'Void',
            errors: [
              { name: 'NotFound', when: 'todo does not exist' },
              { name: 'Forbidden', when: 'user does not own todo' },
            ],
          },
          preconditions: ['user authenticated', 'user owns todo'],
          postconditions: ['todo deleted'],
          invariants: [],
          intents: ['auth-required', 'audit-required'],
        },
        {
          name: 'ReorderTodos',
          description: 'Reorder todos',
          input: [{ name: 'todoIds', type: 'List<UUID>' }],
          output: {
            success: 'Void',
            errors: [{ name: 'ValidationError', when: 'invalid order' }],
          },
          preconditions: ['user authenticated', 'user owns all todos'],
          postconditions: ['order updated'],
          invariants: [],
          intents: ['auth-required', 'audit-required'],
        },
      ],
    },
    requiredFields: ['title'],
    optionalFields: ['description', 'dueDate', 'priority'],
  },
];

export const PAYMENT_PATTERNS: Pattern[] = [
  {
    id: 'process-payment',
    name: 'Process Payment',
    triggers: ['payment', 'charge', 'checkout', 'purchase', 'buy'],
    template: {
      domain: 'Payments',
      behaviors: [{
        name: 'ProcessPayment',
        description: 'Process a payment for an order',
        input: [
          { name: 'orderId', type: 'UUID' },
          { name: 'paymentMethodId', type: 'String' },
        ],
        output: {
          success: 'PaymentResult',
          errors: [
            { name: 'PaymentFailed', when: 'payment processor declined' },
            { name: 'InsufficientFunds', when: 'card has insufficient funds' },
            { name: 'InvalidPaymentMethod', when: 'payment method is invalid' },
          ],
        },
        preconditions: [
          'order exists and is pending payment',
          'amount is calculated server-side',
          'payment method belongs to user',
        ],
        postconditions: [
          'payment is recorded',
          'order status updated',
          'receipt sent to user',
          'webhook dispatched',
        ],
        invariants: [
          'amount NEVER comes from client',
          'idempotency key is used',
          'card details never logged',
        ],
        intents: ['idempotency-required', 'audit-required', 'no-pii-logging', 'server-side-amount'],
      }],
    },
    requiredFields: ['orderId', 'paymentMethodId'],
    optionalFields: ['idempotencyKey'],
  },
];

export const BLOG_PATTERNS: Pattern[] = [
  {
    id: 'blog-platform',
    name: 'Blog Platform',
    triggers: ['blog platform', 'blog', 'authors', 'posts', 'comments', 'moderate comments', 'admin panel'],
    template: {
      domain: 'Blog',
      entities: [
        {
          name: 'Author',
          fields: [
            { name: 'id', type: 'UUID', constraints: ['unique'] },
            { name: 'email', type: 'Email', constraints: ['unique'] },
            { name: 'name', type: 'String' },
            { name: 'passwordHash', type: 'String' },
          ],
          invariants: ['password never stored plain'],
        },
        {
          name: 'Post',
          fields: [
            { name: 'id', type: 'UUID', constraints: ['unique'] },
            { name: 'title', type: 'String', constraints: ['required'] },
            { name: 'content', type: 'String' },
            { name: 'status', type: 'String', constraints: ['draft|published'] },
            { name: 'featuredImageUrl', type: 'String', optional: true },
            { name: 'authorId', type: 'UUID', constraints: ['references Author'] },
            { name: 'tags', type: 'String', optional: true },
          ],
          invariants: ['status in [draft, published]'],
        },
        {
          name: 'Comment',
          fields: [
            { name: 'id', type: 'UUID', constraints: ['unique'] },
            { name: 'postId', type: 'UUID', constraints: ['references Post'] },
            { name: 'authorId', type: 'UUID', optional: true },
            { name: 'content', type: 'String' },
            { name: 'status', type: 'String', constraints: ['pending|approved|deleted'] },
          ],
          invariants: ['status in [pending, approved, deleted]'],
        },
      ],
      behaviors: [
        {
          name: 'RegisterAuthor',
          description: 'Author registration',
          input: [
            { name: 'email', type: 'Email' },
            { name: 'password', type: 'String' },
            { name: 'name', type: 'String' },
          ],
          output: {
            success: 'Author',
            errors: [
              { name: 'EmailAlreadyExists', when: 'email is taken' },
              { name: 'WeakPassword', when: 'password does not meet requirements' },
            ],
          },
          preconditions: ['email valid', 'password meets complexity', 'rate limit not exceeded'],
          postconditions: ['author created', 'password hashed', 'audit event recorded'],
          invariants: ['password never logged'],
          intents: ['rate-limit-required', 'audit-required', 'no-pii-logging'],
        },
        {
          name: 'CreatePost',
          description: 'Create post (draft or published)',
          input: [
            { name: 'title', type: 'String' },
            { name: 'content', type: 'String' },
            { name: 'tags', type: 'String', optional: true },
            { name: 'featuredImageUrl', type: 'String', optional: true },
            { name: 'status', type: 'String', optional: true },
          ],
          output: {
            success: 'Post',
            errors: [{ name: 'ValidationError', when: 'invalid input' }],
          },
          preconditions: ['user authenticated as author', 'title length > 0'],
          postconditions: ['post created', 'post belongs to author'],
          invariants: [],
          intents: ['auth-required', 'audit-required'],
        },
        {
          name: 'SearchPosts',
          description: 'Search posts by title/content',
          input: [
            { name: 'query', type: 'String' },
            { name: 'tag', type: 'String', optional: true },
          ],
          output: {
            success: 'Post',
            errors: [],
          },
          preconditions: [],
          postconditions: ['returns matching published posts'],
          invariants: [],
          intents: [],
        },
        {
          name: 'CreateComment',
          description: 'Reader leaves comment',
          input: [
            { name: 'postId', type: 'UUID' },
            { name: 'content', type: 'String' },
          ],
          output: {
            success: 'Comment',
            errors: [
              { name: 'PostNotFound', when: 'post does not exist' },
              { name: 'ValidationError', when: 'content empty' },
            ],
          },
          preconditions: ['post exists and is published', 'rate limit not exceeded'],
          postconditions: ['comment created with status pending'],
          invariants: [],
          intents: ['rate-limit-required', 'audit-required'],
        },
        {
          name: 'ModerateComment',
          description: 'Author approves or deletes comment',
          input: [
            { name: 'commentId', type: 'UUID' },
            { name: 'action', type: 'String', constraints: ['approve|delete'] },
          ],
          output: {
            success: 'Comment',
            errors: [
              { name: 'NotFound', when: 'comment does not exist' },
              { name: 'Forbidden', when: 'user is not post author' },
            ],
          },
          preconditions: ['user authenticated', 'user is author of post'],
          postconditions: ['comment status updated'],
          invariants: [],
          intents: ['auth-required', 'audit-required'],
        },
      ],
    },
    requiredFields: ['title', 'content'],
    optionalFields: ['tags', 'featuredImageUrl', 'status'],
  },
];

export const DEFAULT_PATTERN_LIBRARY: PatternLibrary = {
  // Blog first (high trigger score for "blog platform"), then todo, auth, crud, payment
  patterns: [...BLOG_PATTERNS, ...TODO_APP_PATTERNS, ...AUTH_PATTERNS, ...CRUD_PATTERNS, ...PAYMENT_PATTERNS],
};

// ============================================================================
// Translator Implementation
// ============================================================================

export class ISLTranslator {
  private patternLibrary: PatternLibrary;

  constructor(patternLibrary: PatternLibrary = DEFAULT_PATTERN_LIBRARY) {
    this.patternLibrary = patternLibrary;
  }

  /**
   * Translate natural language to ISL
   */
  translate(request: TranslationRequest): TranslationResult {
    const { prompt, repoContext } = request;
    const promptLower = prompt.toLowerCase();

    // Step 1: Match against pattern library
    const matchedPattern = this.matchPattern(promptLower);

    // Step 2: Extract assumptions and open questions
    const assumptions: Assumption[] = [];
    const openQuestions: OpenQuestion[] = [];

    // Step 3: Build AST from pattern or generate generic
    let ast: ISLAST;
    let confidence: number;

    if (matchedPattern) {
      ast = this.buildASTFromPattern(matchedPattern, prompt, repoContext);
      confidence = 0.85;

      // Add context-specific assumptions
      if (repoContext) {
        assumptions.push({
          id: 'framework',
          description: `Using ${repoContext.framework} framework conventions`,
          confidence: 0.95,
          category: 'integration',
          defaultValue: repoContext.framework,
        });

        if (repoContext.authLib) {
          assumptions.push({
            id: 'auth-lib',
            description: `Using ${repoContext.authLib} for authentication`,
            confidence: 0.9,
            category: 'auth',
            defaultValue: repoContext.authLib,
          });
        }
      }
    } else {
      // No pattern match - create generic behavior
      ast = this.buildGenericAST(prompt);
      confidence = 0.5;

      openQuestions.push({
        id: 'behavior-type',
        question: 'What type of behavior is this?',
        reason: 'Could not match to known pattern',
        options: ['auth', 'crud', 'payment', 'integration', 'custom'],
        required: true,
        category: 'clarification',
      });
    }

    // Step 4: Add security-related assumptions
    if (promptLower.includes('auth') || promptLower.includes('login') || promptLower.includes('password')) {
      assumptions.push({
        id: 'rate-limiting',
        description: 'Auth endpoints require rate limiting',
        confidence: 0.99,
        category: 'security',
        defaultValue: 'enabled',
      });

      assumptions.push({
        id: 'audit-logging',
        description: 'Auth events require audit logging',
        confidence: 0.95,
        category: 'security',
        defaultValue: 'enabled',
      });
    }

    // Step 5: Generate canonical ISL from AST
    const isl = this.formatISL(ast);

    // Step 6: Round-trip validation (AST → ISL → AST must match)
    // In production, this would parse the ISL back and compare

    return {
      success: true,
      ast,
      isl,
      assumptions,
      openQuestions,
      confidence,
      matchedPattern: matchedPattern?.id,
    };
  }

  /**
   * Match prompt against pattern library
   */
  private matchPattern(promptLower: string): Pattern | null {
    let bestMatch: Pattern | null = null;
    let bestScore = 0;

    for (const pattern of this.patternLibrary.patterns) {
      let score = 0;
      for (const trigger of pattern.triggers) {
        if (promptLower.includes(trigger.toLowerCase())) {
          score += trigger.length; // Longer matches score higher
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = pattern;
      }
    }

    return bestScore > 0 ? bestMatch : null;
  }

  /**
   * Build AST from matched pattern
   */
  private buildASTFromPattern(pattern: Pattern, prompt: string, context?: RepoContext): ISLAST {
    const template = pattern.template;

    return {
      kind: 'Domain',
      name: template.domain,
      version: '1.0.0',
      entities: (template.entities || []).map(e => ({
        kind: 'Entity' as const,
        name: e.name,
        fields: e.fields.map(f => ({
          kind: 'Field' as const,
          name: f.name,
          type: { kind: 'Type' as const, name: f.type },
          optional: f.optional || false,
          constraints: (f.constraints || []).map(c => ({
            kind: 'Constraint' as const,
            expression: c,
          })),
        })),
        invariants: e.invariants,
      })),
      behaviors: template.behaviors.map(b => ({
        kind: 'Behavior' as const,
        name: b.name,
        description: b.description,
        input: b.input.map(f => ({
          kind: 'Field' as const,
          name: f.name,
          type: { kind: 'Type' as const, name: f.type },
          optional: f.optional || false,
          constraints: (f.constraints || []).map(c => ({
            kind: 'Constraint' as const,
            expression: c,
          })),
        })),
        output: {
          kind: 'Output' as const,
          success: { kind: 'Type' as const, name: b.output.success },
          errors: b.output.errors.map(e => ({
            kind: 'Error' as const,
            name: e.name,
            when: e.when,
          })),
        },
        preconditions: b.preconditions.map(p => ({
          kind: 'Expression' as const,
          source: p,
        })),
        postconditions: b.postconditions.map(p => ({
          kind: 'Postcondition' as const,
          condition: 'success',
          predicates: [{ kind: 'Expression' as const, source: p }],
        })),
        invariants: b.invariants.map(i => ({
          kind: 'Expression' as const,
          source: i,
        })),
        intents: b.intents.map(i => ({
          kind: 'Intent' as const,
          tag: i,
        })),
      })),
      invariants: [],
      metadata: {
        generatedFrom: 'nl-translator',
        prompt,
        timestamp: new Date().toISOString(),
        confidence: 0.85,
      },
    };
  }

  /**
   * Build generic AST when no pattern matches
   */
  private buildGenericAST(prompt: string): ISLAST {
    // Extract likely behavior name from prompt
    const words = prompt.split(/\s+/);
    const actionWord = words.find(w => 
      ['create', 'get', 'update', 'delete', 'send', 'process', 'generate', 'validate'].includes(w.toLowerCase())
    ) || 'Process';
    
    const subjectWord = words.find(w => 
      w.length > 3 && !['the', 'for', 'with', 'and'].includes(w.toLowerCase())
    ) || 'Request';

    const behaviorName = `${capitalize(actionWord)}${capitalize(subjectWord)}`;

    return {
      kind: 'Domain',
      name: 'Custom',
      version: '1.0.0',
      entities: [],
      behaviors: [{
        kind: 'Behavior',
        name: behaviorName,
        description: prompt,
        input: [],
        output: {
          kind: 'Output',
          success: { kind: 'Type', name: 'Result' },
          errors: [{ kind: 'Error', name: 'OperationFailed', when: 'operation could not complete' }],
        },
        preconditions: [{ kind: 'Expression', source: 'user is authenticated' }],
        postconditions: [{ kind: 'Postcondition', condition: 'success', predicates: [] }],
        invariants: [],
        intents: [{ kind: 'Intent', tag: 'audit-required' }],
      }],
      invariants: [],
      metadata: {
        generatedFrom: 'nl-translator',
        prompt,
        timestamp: new Date().toISOString(),
        confidence: 0.5,
      },
    };
  }

  /**
   * Format AST as canonical ISL source
   */
  formatISL(ast: ISLAST): string {
    const lines: string[] = [];

    // Domain header
    lines.push(`domain ${ast.name} version "${ast.version}"`);
    lines.push('');

    // Metadata comment
    lines.push(`// Generated from: "${ast.metadata.prompt}"`);
    lines.push(`// Confidence: ${(ast.metadata.confidence * 100).toFixed(0)}%`);
    lines.push(`// Timestamp: ${ast.metadata.timestamp}`);
    lines.push('');

    // Entities
    for (const entity of ast.entities) {
      lines.push(`entity ${entity.name} {`);
      for (const field of entity.fields) {
        const optional = field.optional ? '?' : '';
        lines.push(`  ${field.name}${optional}: ${field.type.name}`);
      }
      for (const inv of entity.invariants) {
        lines.push(`  invariant ${inv}`);
      }
      lines.push('}');
      lines.push('');
    }

    // Behaviors
    for (const behavior of ast.behaviors) {
      lines.push(`behavior ${behavior.name} {`);
      lines.push(`  // ${behavior.description}`);
      lines.push('');

      // Input
      if (behavior.input.length > 0) {
        lines.push('  input {');
        for (const field of behavior.input) {
          const optional = field.optional ? '?' : '';
          lines.push(`    ${field.name}${optional}: ${field.type.name}`);
        }
        lines.push('  }');
        lines.push('');
      }

      // Output
      lines.push('  output {');
      lines.push(`    success: ${behavior.output.success.name}`);
      if (behavior.output.errors.length > 0) {
        lines.push('    errors {');
        for (const error of behavior.output.errors) {
          lines.push(`      ${error.name} when "${error.when}"`);
        }
        lines.push('    }');
      }
      lines.push('  }');
      lines.push('');

      // Intents
      if (behavior.intents.length > 0) {
        lines.push('  // Intent declarations');
        for (const intent of behavior.intents) {
          lines.push(`  @intent ${intent.tag}`);
        }
        lines.push('');
      }

      // Preconditions
      if (behavior.preconditions.length > 0) {
        for (const pre of behavior.preconditions) {
          lines.push(`  pre ${pre.source}`);
        }
        lines.push('');
      }

      // Postconditions
      if (behavior.postconditions.length > 0) {
        for (const post of behavior.postconditions) {
          lines.push(`  post ${post.condition} {`);
          for (const pred of post.predicates) {
            lines.push(`    ${pred.source}`);
          }
          lines.push('  }');
        }
        lines.push('');
      }

      // Invariants
      if (behavior.invariants.length > 0) {
        for (const inv of behavior.invariants) {
          lines.push(`  invariant ${inv.source}`);
        }
        lines.push('');
      }

      lines.push('}');
      lines.push('');
    }

    return lines.join('\n');
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// ============================================================================
// Exports
// ============================================================================

export function createTranslator(patternLibrary?: PatternLibrary): ISLTranslator {
  return new ISLTranslator(patternLibrary);
}

export { DEFAULT_PATTERN_LIBRARY as patternLibrary };
