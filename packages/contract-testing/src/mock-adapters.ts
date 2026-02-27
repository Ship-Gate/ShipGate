/**
 * Mock Adapters
 * 
 * Provides mock implementations of adapters for testing without external services.
 */

// ============================================================================
// Types
// ============================================================================

export interface MockAuthAdapter {
  getUserByEmail(email: string): Promise<{ id: string; email: string; password_hash: string } | null>;
  createSession(userId: string, ipAddress: string): Promise<{ id: string; user_id: string; expires_at: Date; ip_address: string }>;
  revokeSession(sessionId: string): Promise<boolean>;
  validateSession(sessionId: string): Promise<{ id: string; user_id: string; expires_at: Date; revoked: boolean } | null>;
  createUser(email: string, passwordHash: string): Promise<{ id: string; email: string; password_hash: string }>;
  verifyPassword(password: string, hash: string): Promise<boolean>;
}

export interface MockPaymentAdapter {
  createPayment(amount: number, currency: string): Promise<{ id: string; amount: number; currency: string; status: string }>;
  capturePayment(paymentId: string): Promise<{ success: boolean }>;
  refundPayment(paymentId: string, amount?: number): Promise<{ id: string; amount: number }>;
}

export interface MockUserAdapter {
  createUser(data: { email: string; name: string }): Promise<{ id: string; email: string; name: string }>;
  getUserById(id: string): Promise<{ id: string; email: string; name: string } | null>;
  getUserByEmail(email: string): Promise<{ id: string; email: string; name: string } | null>;
  updateUser(id: string, data: Partial<{ email: string; name: string }>): Promise<{ id: string; email: string; name: string }>;
  deleteUser(id: string): Promise<boolean>;
}

// ============================================================================
// Mock Auth Adapter
// ============================================================================

export class InMemoryAuthAdapter implements MockAuthAdapter {
  private users: Map<string, { id: string; email: string; password_hash: string }> = new Map();
  private sessions: Map<string, { id: string; user_id: string; expires_at: Date; revoked: boolean; ip_address: string }> = new Map();
  private userCounter = 1;
  private sessionCounter = 1;

  async getUserByEmail(email: string) {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return null;
  }

  async createSession(userId: string, ipAddress: string) {
    const sessionId = `session_${this.sessionCounter++}`;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const session = {
      id: sessionId,
      user_id: userId,
      expires_at: expiresAt,
      revoked: false,
      ip_address: ipAddress,
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  async revokeSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.revoked = true;
      return true;
    }
    return false;
  }

  async validateSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    if (session.revoked) return null;
    if (session.expires_at < new Date()) return null;
    return session;
  }

  async createUser(email: string, passwordHash: string) {
    const userId = `user_${this.userCounter++}`;
    const user = {
      id: userId,
      email,
      password_hash: passwordHash,
    };
    this.users.set(userId, user);
    return user;
  }

  async verifyPassword(password: string, hash: string) {
    // Simple mock - in real implementation, use bcrypt
    return hash === `hash_${password}`;
  }

  reset() {
    this.users.clear();
    this.sessions.clear();
    this.userCounter = 1;
    this.sessionCounter = 1;
  }
}

// ============================================================================
// Mock Payment Adapter
// ============================================================================

export class InMemoryPaymentAdapter implements MockPaymentAdapter {
  private payments: Map<string, { id: string; amount: number; currency: string; status: string }> = new Map();
  private paymentCounter = 1;

  async createPayment(amount: number, currency: string) {
    const paymentId = `pay_${this.paymentCounter++}`;
    const payment = {
      id: paymentId,
      amount,
      currency,
      status: 'pending',
    };
    this.payments.set(paymentId, payment);
    return payment;
  }

  async capturePayment(paymentId: string) {
    const payment = this.payments.get(paymentId);
    if (payment) {
      payment.status = 'captured';
      return { success: true };
    }
    return { success: false };
  }

  async refundPayment(paymentId: string, amount?: number) {
    const payment = this.payments.get(paymentId);
    if (payment) {
      const refundAmount = amount || payment.amount;
      return {
        id: `refund_${Date.now()}`,
        amount: refundAmount,
      };
    }
    throw new Error('Payment not found');
  }

  reset() {
    this.payments.clear();
    this.paymentCounter = 1;
  }
}

// ============================================================================
// Mock User Adapter
// ============================================================================

export class InMemoryUserAdapter implements MockUserAdapter {
  private users: Map<string, { id: string; email: string; name: string }> = new Map();
  private userCounter = 1;

  async createUser(data: { email: string; name: string }) {
    const userId = `user_${this.userCounter++}`;
    const user = {
      id: userId,
      email: data.email,
      name: data.name,
    };
    this.users.set(userId, user);
    return user;
  }

  async getUserById(id: string) {
    return this.users.get(id) || null;
  }

  async getUserByEmail(email: string) {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return null;
  }

  async updateUser(id: string, data: Partial<{ email: string; name: string }>) {
    const user = this.users.get(id);
    if (!user) {
      throw new Error('User not found');
    }
    const updated = { ...user, ...data };
    this.users.set(id, updated);
    return updated;
  }

  async deleteUser(id: string) {
    return this.users.delete(id);
  }

  reset() {
    this.users.clear();
    this.userCounter = 1;
  }
}
