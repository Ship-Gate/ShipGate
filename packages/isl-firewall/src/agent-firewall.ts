/**
 * ISL Firewall - Agent Firewall
 * 
 * Main orchestrator for file write governance.
 * Intercepts and validates AI-generated content to prevent hallucinations.
 * 
 * @module @isl-lang/firewall
 */

import type {
  FirewallMode,
  FirewallConfig,
  FirewallResult,
  FirewallRequest,
  Claim,
  Evidence,
  PolicyViolation,
  DEFAULT_FIREWALL_CONFIG,
} from './types.js';

import { ClaimExtractor } from './claim-extractor.js';
import { EvidenceResolver } from './evidence-resolver.js';
import { PolicyEngine } from './policy-engine.js';
import { AllowlistManager } from './allowlist.js';

/**
 * Agent Firewall - prevents hallucinated code from being written
 */
export class AgentFirewall {
  private config: FirewallConfig;
  private mode: FirewallMode;
  private claimExtractor: ClaimExtractor;
  private evidenceResolver: EvidenceResolver;
  private policyEngine: PolicyEngine;
  private allowlistManager: AllowlistManager;

  constructor(config: Partial<FirewallConfig> = {}) {
    this.config = {
      mode: 'observe',
      projectRoot: process.cwd(),
      truthpackPath: '.shipgate/truthpack',
      policies: ['ghost-route', 'ghost-env', 'ghost-import', 'ghost-file'],
      timeout: 5000,
      enableCaching: true,
      ...config,
    };
    if (this.config.projectRoot == null) {
      this.config.projectRoot = process.cwd();
    }
    this.mode = this.config.mode;
    
    this.claimExtractor = new ClaimExtractor();
    this.evidenceResolver = new EvidenceResolver({
      projectRoot: this.config.projectRoot,
      truthpackPath: this.config.truthpackPath,
      timeout: this.config.timeout,
    });
    this.policyEngine = new PolicyEngine(this.config.policies);
    this.allowlistManager = new AllowlistManager(this.config.projectRoot);
  }

  /**
   * Evaluate content for policy violations
   */
  async evaluate(request: FirewallRequest): Promise<FirewallResult> {
    const startTime = Date.now();

    // Load allowlist
    await this.allowlistManager.load();

    // Check if path is ignored
    if (this.allowlistManager.isPathIgnored(request.filePath)) {
      return this.createPassResult(startTime, [], [], []);
    }

    // Extract claims from content
    const claims = await this.claimExtractor.extract(request.content, request.filePath);

    // Filter claims by allowlist
    const filteredClaims = this.filterClaimsByAllowlist(claims);

    // Resolve evidence for claims
    const evidence = await this.evidenceResolver.resolveAll(filteredClaims);

    // Create evidence map
    const evidenceMap = new Map<string, Evidence>();
    for (const e of evidence) {
      evidenceMap.set(e.claimId, e);
    }

    // Evaluate policies
    const decision = this.policyEngine.evaluateAll(filteredClaims, evidenceMap);

    // Build result
    const result = this.buildResult(
      startTime,
      filteredClaims,
      evidence,
      decision.violations,
      decision.allowed
    );

    return result;
  }

  /**
   * Quick check - returns just allow/deny without full analysis
   */
  async quickCheck(request: FirewallRequest): Promise<{ allowed: boolean; reason: string }> {
    const result = await this.evaluate(request);
    return {
      allowed: result.allowed,
      reason: result.violations.length > 0
        ? `${result.violations.length} violation(s) found`
        : 'All checks passed',
    };
  }

  /**
   * Get current firewall mode
   */
  getMode(): FirewallMode {
    return this.mode;
  }

  /**
   * Set firewall mode
   */
  setMode(mode: FirewallMode): void {
    this.mode = mode;
  }

  /**
   * Enter lockdown mode - block all writes except allowlisted
   */
  lockdown(): void {
    this.mode = 'lockdown';
  }

  /**
   * Get firewall status
   */
  getStatus(): {
    mode: FirewallMode;
    policies: string[];
    projectRoot: string;
  } {
    return {
      mode: this.mode,
      policies: this.policyEngine.getPolicies().map(p => p.id),
      projectRoot: this.config.projectRoot,
    };
  }

  /**
   * Clear caches
   */
  clearCache(): void {
    this.evidenceResolver.clearCache();
  }

  private filterClaimsByAllowlist(claims: Claim[]): Claim[] {
    return claims.filter(claim => {
      switch (claim.type) {
        case 'api_endpoint':
          return !this.allowlistManager.isRouteAllowed(claim.value);
        case 'env_variable':
          return !this.allowlistManager.isEnvVarAllowed(claim.value);
        default:
          return true;
      }
    });
  }

  private buildResult(
    startTime: number,
    claims: Claim[],
    evidence: Evidence[],
    violations: PolicyViolation[],
    allowed: boolean
  ): FirewallResult {
    const evidenceFound = evidence.filter(e => e.found).length;
    const evidenceMissing = evidence.filter(e => !e.found).length;
    const hardBlocks = violations.filter(v => v.tier === 'hard_block').length;
    const softBlocks = violations.filter(v => v.tier === 'soft_block').length;
    const warnings = violations.filter(v => v.tier === 'warn').length;

    // In observe mode, always allow
    const finalAllowed = this.mode === 'observe' ? true : allowed;

    return {
      allowed: finalAllowed,
      mode: this.mode,
      claims,
      evidence,
      violations,
      stats: {
        claimsExtracted: claims.length,
        evidenceFound,
        evidenceMissing,
        violationsTotal: violations.length,
        hardBlocks,
        softBlocks,
        warnings,
      },
      durationMs: Date.now() - startTime,
    };
  }

  private createPassResult(
    startTime: number,
    claims: Claim[],
    evidence: Evidence[],
    violations: PolicyViolation[]
  ): FirewallResult {
    return {
      allowed: true,
      mode: this.mode,
      claims,
      evidence,
      violations,
      stats: {
        claimsExtracted: 0,
        evidenceFound: 0,
        evidenceMissing: 0,
        violationsTotal: 0,
        hardBlocks: 0,
        softBlocks: 0,
        warnings: 0,
      },
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Create an agent firewall instance
 */
export function createAgentFirewall(config?: Partial<FirewallConfig>): AgentFirewall {
  return new AgentFirewall(config);
}
