/**
 * ISL Policy Packs - Registry
 * 
 * Central registry for policy packs.
 * 
 * @module @isl-lang/policy-packs
 */

import type { PolicyPack, PolicyPackConfig, PolicyPackRegistry, PolicyRule } from './types.js';

/**
 * Default policy pack registry implementation
 */
class PolicyPackRegistryImpl implements PolicyPackRegistry {
  private packs: Map<string, PolicyPack> = new Map();

  /**
   * Get a pack by ID
   */
  getPack(id: string): PolicyPack | undefined {
    return this.packs.get(id);
  }

  /**
   * Get all registered packs
   */
  getAllPacks(): PolicyPack[] {
    return [...this.packs.values()];
  }

  /**
   * Register a policy pack
   */
  registerPack(pack: PolicyPack): void {
    if (!pack.id) {
      throw new Error('Policy pack must have an ID');
    }
    if (this.packs.has(pack.id)) {
      throw new Error(`Policy pack "${pack.id}" is already registered`);
    }
    this.packs.set(pack.id, pack);
  }

  /**
   * Get all enabled rules from registered packs
   */
  getEnabledRules(config?: Record<string, PolicyPackConfig>): PolicyRule[] {
    const rules: PolicyRule[] = [];
    const deprecationWarnings: Array<{ ruleId: string; message: string }> = [];

    for (const pack of this.packs.values()) {
      const packConfig = config?.[pack.id];
      
      // Skip if pack is disabled
      if (packConfig?.enabled === false) {
        continue;
      }

      for (const rule of pack.rules) {
        const ruleOverride = packConfig?.ruleOverrides?.[rule.id];
        
        // Skip if rule is disabled
        if (ruleOverride?.enabled === false) {
          continue;
        }

        // Check for deprecation
        if (rule.deprecated) {
          const replacement = rule.replacementRuleId 
            ? ` Use ${rule.replacementRuleId} instead.`
            : '';
          deprecationWarnings.push({
            ruleId: rule.id,
            message: `Rule ${rule.id} is deprecated since ${rule.deprecatedSince || pack.version}.${replacement} ${rule.deprecationMessage || ''}`,
          });
        }

        // Apply overrides
        const finalRule: PolicyRule = {
          ...rule,
          severity: ruleOverride?.severity ?? rule.severity,
          config: { ...rule.config, ...ruleOverride?.config },
        };

        rules.push(finalRule);
      }
    }

    // Emit deprecation warnings (in non-production environments)
    if (deprecationWarnings.length > 0 && typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
      for (const warning of deprecationWarnings) {
        console.warn(`[Deprecation] ${warning.message}`);
      }
    }

    return rules;
  }

  /**
   * Clear all registered packs
   */
  clear(): void {
    this.packs.clear();
  }
}

/**
 * Global policy pack registry instance
 */
export const registry = new PolicyPackRegistryImpl();

/**
 * Create a new isolated registry
 */
export function createRegistry(): PolicyPackRegistry {
  return new PolicyPackRegistryImpl();
}

/**
 * Load built-in policy packs into a registry
 */
export async function loadBuiltinPacks(reg: PolicyPackRegistry): Promise<void> {
  // Dynamic imports to avoid circular dependencies
  const [
    { authPolicyPack },
    { paymentsPolicyPack },
    { piiPolicyPack },
    { rateLimitPolicyPack },
    { intentPolicyPack },
    { qualityPolicyPack },
    { securityPolicyPack },
    { starterPolicyPack },
  ] = await Promise.all([
    import('./packs/auth.js'),
    import('./packs/payments.js'),
    import('./packs/pii.js'),
    import('./packs/rate-limit.js'),
    import('./packs/intent.js'),
    import('./packs/quality.js'),
    import('./packs/security.js'),
    import('./packs/starter.js'),
  ]);

  reg.registerPack(authPolicyPack);
  reg.registerPack(paymentsPolicyPack);
  reg.registerPack(piiPolicyPack);
  reg.registerPack(rateLimitPolicyPack);
  reg.registerPack(intentPolicyPack);
  reg.registerPack(qualityPolicyPack);
  reg.registerPack(securityPolicyPack);
  reg.registerPack(starterPolicyPack);
}
