// ============================================================================
// Fraud Detection - Risk Assessment for Payments
// ============================================================================

import { FraudSignals, RiskLevel, Currency } from './types';

// ==========================================================================
// FRAUD DETECTOR INTERFACE
// ==========================================================================

export interface FraudCheckInput {
  amount: number;
  currency: Currency;
  paymentMethodToken: string;
  customerId?: string;
  ipAddress?: string;
  deviceFingerprint?: string;
  email?: string;
  shippingAddress?: Address;
  billingAddress?: Address;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

export interface FraudDetector {
  check(input: FraudCheckInput): Promise<FraudSignals>;
}

// ==========================================================================
// RULE-BASED FRAUD DETECTOR
// ==========================================================================

export interface FraudRule {
  name: string;
  weight: number;
  check: (input: FraudCheckInput, context: FraudContext) => Promise<boolean>;
}

export interface FraudContext {
  recentTransactions: TransactionHistory[];
  cardVelocity: number;
  ipRisk: IpRiskData;
}

export interface TransactionHistory {
  amount: number;
  currency: Currency;
  timestamp: Date;
  status: 'success' | 'failed' | 'disputed';
}

export interface IpRiskData {
  isProxy: boolean;
  isVpn: boolean;
  isTor: boolean;
  country: string;
  riskScore: number;
}

export class RuleBasedFraudDetector implements FraudDetector {
  private readonly rules: FraudRule[];
  private readonly thresholds: RiskThresholds;
  private readonly contextProvider: FraudContextProvider;
  
  constructor(
    rules: FraudRule[],
    thresholds: RiskThresholds,
    contextProvider: FraudContextProvider
  ) {
    this.rules = rules;
    this.thresholds = thresholds;
    this.contextProvider = contextProvider;
  }
  
  async check(input: FraudCheckInput): Promise<FraudSignals> {
    const context = await this.contextProvider.getContext(input);
    const checksPerformed: string[] = [];
    let totalScore = 0;
    
    for (const rule of this.rules) {
      const triggered = await rule.check(input, context);
      checksPerformed.push(rule.name);
      
      if (triggered) {
        totalScore += rule.weight;
      }
    }
    
    // Normalize score to 0-100
    const maxPossibleScore = this.rules.reduce((sum, r) => sum + r.weight, 0);
    const normalizedScore = (totalScore / maxPossibleScore) * 100;
    
    return {
      riskScore: Math.round(normalizedScore * 100) / 100,
      riskLevel: this.scoreToRiskLevel(normalizedScore),
      checksPerformed,
      ipAddress: input.ipAddress,
      deviceFingerprint: input.deviceFingerprint,
    };
  }
  
  private scoreToRiskLevel(score: number): RiskLevel {
    if (score >= this.thresholds.critical) return RiskLevel.CRITICAL;
    if (score >= this.thresholds.high) return RiskLevel.HIGH;
    if (score >= this.thresholds.medium) return RiskLevel.MEDIUM;
    return RiskLevel.LOW;
  }
}

export interface RiskThresholds {
  low: number;
  medium: number;
  high: number;
  critical: number;
}

export interface FraudContextProvider {
  getContext(input: FraudCheckInput): Promise<FraudContext>;
}

// ==========================================================================
// DEFAULT FRAUD RULES
// ==========================================================================

export const defaultFraudRules: FraudRule[] = [
  {
    name: 'high_amount',
    weight: 20,
    async check(input) {
      return input.amount > 10000;
    },
  },
  {
    name: 'velocity_check',
    weight: 30,
    async check(input, context) {
      // More than 5 transactions in the last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentCount = context.recentTransactions.filter(
        t => t.timestamp > oneHourAgo
      ).length;
      return recentCount > 5;
    },
  },
  {
    name: 'high_risk_ip',
    weight: 40,
    async check(input, context) {
      return context.ipRisk.isProxy || 
             context.ipRisk.isVpn || 
             context.ipRisk.isTor ||
             context.ipRisk.riskScore > 70;
    },
  },
  {
    name: 'address_mismatch',
    weight: 15,
    async check(input) {
      if (!input.billingAddress || !input.shippingAddress) {
        return false;
      }
      return input.billingAddress.country !== input.shippingAddress.country;
    },
  },
  {
    name: 'previous_disputes',
    weight: 50,
    async check(input, context) {
      const disputes = context.recentTransactions.filter(
        t => t.status === 'disputed'
      );
      return disputes.length > 0;
    },
  },
  {
    name: 'card_testing_pattern',
    weight: 35,
    async check(input, context) {
      // Multiple small transactions followed by large one
      const recentSmall = context.recentTransactions.filter(
        t => t.amount < 5 && t.timestamp > new Date(Date.now() - 10 * 60 * 1000)
      );
      return recentSmall.length >= 3 && input.amount > 100;
    },
  },
  {
    name: 'unusual_currency',
    weight: 10,
    async check(input) {
      const commonCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
      return !commonCurrencies.includes(input.currency);
    },
  },
];

// ==========================================================================
// MOCK FRAUD CONTEXT PROVIDER (for testing)
// ==========================================================================

export class MockFraudContextProvider implements FraudContextProvider {
  private readonly mockData: Partial<FraudContext>;
  
  constructor(mockData?: Partial<FraudContext>) {
    this.mockData = mockData ?? {};
  }
  
  async getContext(_input: FraudCheckInput): Promise<FraudContext> {
    return {
      recentTransactions: this.mockData.recentTransactions ?? [],
      cardVelocity: this.mockData.cardVelocity ?? 0,
      ipRisk: this.mockData.ipRisk ?? {
        isProxy: false,
        isVpn: false,
        isTor: false,
        country: 'US',
        riskScore: 0,
      },
    };
  }
}

// ==========================================================================
// FACTORY
// ==========================================================================

export function createFraudDetector(
  contextProvider?: FraudContextProvider,
  customRules?: FraudRule[],
  thresholds?: Partial<RiskThresholds>
): FraudDetector {
  const defaultThresholds: RiskThresholds = {
    low: 0,
    medium: 25,
    high: 50,
    critical: 75,
  };
  
  return new RuleBasedFraudDetector(
    customRules ?? defaultFraudRules,
    { ...defaultThresholds, ...thresholds },
    contextProvider ?? new MockFraudContextProvider()
  );
}
