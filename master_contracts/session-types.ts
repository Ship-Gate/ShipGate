// ============================================================================
// ISL Session Types - Protocol-Level Type Safety
// Version: 0.1.0
// ============================================================================

/**
 * Session Types provide compile-time guarantees about communication protocols.
 * They ensure that participants follow the expected message exchange patterns.
 * 
 * Use cases:
 * - WebSocket protocols
 * - API request/response sequences
 * - State machine transitions
 * - Distributed system coordination
 */

// ============================================================================
// SESSION TYPE PRIMITIVES
// ============================================================================

/**
 * Send a message of type T then continue with S
 */
export interface Send<T, S extends Session> {
  readonly _tag: 'Send';
  readonly messageType: T;
  readonly continuation: S;
}

/**
 * Receive a message of type T then continue with S
 */
export interface Receive<T, S extends Session> {
  readonly _tag: 'Receive';
  readonly messageType: T;
  readonly continuation: S;
}

/**
 * End of session
 */
export interface End {
  readonly _tag: 'End';
}

/**
 * Internal choice - sender decides which branch to take
 */
export interface Select<Branches extends Record<string, Session>> {
  readonly _tag: 'Select';
  readonly branches: Branches;
}

/**
 * External choice - receiver decides which branch to take
 */
export interface Offer<Branches extends Record<string, Session>> {
  readonly _tag: 'Offer';
  readonly branches: Branches;
}

/**
 * Recursive session
 */
export interface Rec<Name extends string, Body extends Session> {
  readonly _tag: 'Rec';
  readonly name: Name;
  readonly body: Body;
}

/**
 * Reference to recursive variable
 */
export interface Var<Name extends string> {
  readonly _tag: 'Var';
  readonly name: Name;
}

/**
 * Session type union
 */
export type Session = 
  | Send<unknown, Session>
  | Receive<unknown, Session>
  | End
  | Select<Record<string, Session>>
  | Offer<Record<string, Session>>
  | Rec<string, Session>
  | Var<string>;

// ============================================================================
// SESSION TYPE DUALITY
// ============================================================================

/**
 * Dual of a session type - the complement protocol
 * If one party follows S, the other follows Dual<S>
 */
export type Dual<S extends Session> = 
  S extends Send<infer T, infer Cont>
    ? Receive<T, Dual<Cont>>
    : S extends Receive<infer T, infer Cont>
      ? Send<T, Dual<Cont>>
      : S extends End
        ? End
        : S extends Select<infer Branches>
          ? Offer<{ [K in keyof Branches]: Dual<Branches[K]> }>
          : S extends Offer<infer Branches>
            ? Select<{ [K in keyof Branches]: Dual<Branches[K]> }>
            : S extends Rec<infer Name, infer Body>
              ? Rec<Name, Dual<Body>>
              : S extends Var<infer Name>
                ? Var<Name>
                : never;

// ============================================================================
// SESSION TYPE EXAMPLES (ISL Syntax)
// ============================================================================

/**
 * Example: Simple request-response protocol
 * 
 * ```isl
 * session RequestResponse {
 *   client -> server: Request
 *   server -> client: Response
 *   end
 * }
 * ```
 */
export type RequestResponseClient = 
  Send<Request, Receive<Response, End>>;

export type RequestResponseServer = 
  Dual<RequestResponseClient>; // = Receive<Request, Send<Response, End>>

interface Request { type: 'request'; payload: unknown; }
interface Response { type: 'response'; data: unknown; }

/**
 * Example: Authentication protocol with branching
 * 
 * ```isl
 * session AuthProtocol {
 *   client -> server: Credentials
 *   
 *   choice {
 *     // Success branch
 *     success {
 *       server -> client: AuthToken
 *       rec MainLoop {
 *         choice {
 *           request {
 *             client -> server: APIRequest
 *             server -> client: APIResponse
 *             continue MainLoop
 *           }
 *           logout {
 *             client -> server: Logout
 *             server -> client: LogoutAck
 *             end
 *           }
 *         }
 *       }
 *     }
 *     // Failure branch
 *     failure {
 *       server -> client: AuthError
 *       end
 *     }
 *   }
 * }
 * ```
 */

interface Credentials { username: string; password: string; }
interface AuthToken { token: string; }
interface AuthError { message: string; }
interface APIRequest { endpoint: string; data: unknown; }
interface APIResponse { status: number; body: unknown; }
interface Logout { }
interface LogoutAck { }

// Client-side session type
export type AuthClient = 
  Send<Credentials, 
    Offer<{
      success: Receive<AuthToken, 
        Rec<'MainLoop',
          Select<{
            request: Send<APIRequest, Receive<APIResponse, Var<'MainLoop'>>>;
            logout: Send<Logout, Receive<LogoutAck, End>>;
          }>>>;
      failure: Receive<AuthError, End>;
    }>>;

// Server-side session type (dual)
export type AuthServer = Dual<AuthClient>;

// ============================================================================
// SESSION RUNTIME
// ============================================================================

/**
 * Channel for session-typed communication
 */
export interface Channel<S extends Session> {
  readonly session: S;
  
  // Type-safe operations based on current session state
  send<T>(message: T): S extends Send<T, infer Cont> ? Channel<Cont> : never;
  receive<T>(): S extends Receive<T, infer Cont> ? Promise<[T, Channel<Cont>]> : never;
  select<K extends string>(branch: K): S extends Select<infer B> ? Channel<B[K]> : never;
  offer<K extends string>(): S extends Offer<infer B> ? Promise<[K, Channel<B[K]>]> : never;
  close(): S extends End ? void : never;
}

/**
 * Create a pair of dual channels
 */
export function createChannelPair<S extends Session>(): [Channel<S>, Channel<Dual<S>>] {
  // Implementation would create linked channels
  throw new Error('Not implemented - this is a type-level specification');
}

// ============================================================================
// ISL SESSION TYPE AST
// ============================================================================

export interface SessionTypeAST {
  kind: 'SessionType';
  name: string;
  participants: string[];
  body: SessionBodyAST;
}

export type SessionBodyAST =
  | MessageAST
  | ChoiceAST
  | RecursionAST
  | ContinueAST
  | EndAST;

export interface MessageAST {
  kind: 'Message';
  from: string;
  to: string;
  messageType: string;
  next: SessionBodyAST;
}

export interface ChoiceAST {
  kind: 'Choice';
  branches: Record<string, SessionBodyAST>;
}

export interface RecursionAST {
  kind: 'Recursion';
  name: string;
  body: SessionBodyAST;
}

export interface ContinueAST {
  kind: 'Continue';
  name: string;
}

export interface EndAST {
  kind: 'End';
}

// ============================================================================
// SESSION TYPE VALIDATION
// ============================================================================

/**
 * Validate that a session type is well-formed
 */
export function validateSessionType(session: SessionTypeAST): ValidationResult {
  const errors: string[] = [];
  
  // Check for unbound recursive variables
  // Check for unreachable branches
  // Check for deadlock potential
  // Check for type consistency
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Check if two session types are compatible (dual)
 */
export function areDual(s1: SessionTypeAST, s2: SessionTypeAST): boolean {
  // Implementation would structurally compare session types
  return true;
}

// ============================================================================
// SESSION TYPE PROJECTION
// ============================================================================

/**
 * Project a global session type to a local type for a specific participant
 * 
 * Global type: A -> B: M1, B -> C: M2, C -> A: M3
 * 
 * Projection for A: Send<M1, Receive<M3, End>>
 * Projection for B: Receive<M1, Send<M2, End>>
 * Projection for C: Receive<M2, Send<M3, End>>
 */
export function projectSession(
  global: SessionTypeAST,
  participant: string
): Session {
  // Implementation would project global type to local type
  throw new Error('Not implemented');
}

// ============================================================================
// MULTIPARTY SESSION TYPES
// ============================================================================

/**
 * Multiparty session with more than two participants
 * 
 * ```isl
 * session ThreePartyTransaction {
 *   participants { Buyer, Seller, Bank }
 *   
 *   Buyer -> Seller: Order
 *   Seller -> Bank: PaymentRequest
 *   Bank -> Buyer: PaymentChallenge
 *   Buyer -> Bank: PaymentConfirmation
 *   
 *   choice {
 *     approved {
 *       Bank -> Seller: PaymentApproved
 *       Bank -> Buyer: PaymentApproved
 *       Seller -> Buyer: OrderConfirmation
 *       end
 *     }
 *     declined {
 *       Bank -> Seller: PaymentDeclined
 *       Bank -> Buyer: PaymentDeclined
 *       Seller -> Buyer: OrderCancelled
 *       end
 *     }
 *   }
 * }
 * ```
 */
export interface MultipartySession<Participants extends string[]> {
  participants: Participants;
  protocol: SessionTypeAST;
  localTypes: Record<Participants[number], Session>;
}

// ============================================================================
// BEHAVIORAL TYPE INTEGRATION
// ============================================================================

/**
 * ISL behaviors can specify their session type for API interactions
 * 
 * ```isl
 * behavior ProcessPayment {
 *   session PaymentProtocol {
 *     // Payment service protocol
 *     client -> payment_service: PaymentRequest
 *     payment_service -> client: PaymentIntent
 *     client -> payment_service: ConfirmPayment
 *     choice {
 *       success {
 *         payment_service -> client: PaymentSuccess
 *       }
 *       failure {
 *         payment_service -> client: PaymentFailure
 *       }
 *     }
 *   }
 *   
 *   // Behavior implementation must follow the session type
 * }
 * ```
 */
export interface BehaviorWithSession {
  name: string;
  session?: SessionTypeAST;
  // When session is specified, implementation is verified against it
}
