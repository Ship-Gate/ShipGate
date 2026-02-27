/**
 * Security Verifier Enhancer
 * Main class for detecting auth drift
 */

import type {
  ISLAuthRequirement,
  ObservedAuthPolicy,
  AuthDriftResult,
  AuthDriftConfig,
} from './types.js';
import {
  extractAllISLAuthRequirements,
} from './isl-extractor.js';
import {
  extractAllObservedAuthPolicies,
} from './route-detector.js';
import {
  detectAuthDrift,
} from './drift-detector.js';

/**
 * Security Verifier Enhancer
 * 
 * Detects auth drift between ISL specifications and route implementations.
 */
export class SecurityVerifierEnhancer {
  private workspaceRoot: string;
  private config: AuthDriftConfig;

  constructor(workspaceRoot: string, config?: AuthDriftConfig) {
    this.workspaceRoot = workspaceRoot;
    this.config = config || {};
  }

  /**
   * Run full auth drift detection
   */
  async detectDrift(
    islFiles?: string[],
    routeFiles?: string[]
  ): Promise<AuthDriftResult> {
    // Extract ISL auth requirements
    const islRequirements = await extractAllISLAuthRequirements(
      this.workspaceRoot,
      islFiles
    );

    // Extract observed auth policies from routes
    const observedPolicies = await extractAllObservedAuthPolicies(
      this.workspaceRoot,
      routeFiles,
      {
        ignoreDirs: this.config.ignoreDirs,
        includeExtensions: this.config.includeExtensions,
      }
    );

    // Detect drift
    const result = detectAuthDrift(islRequirements, observedPolicies, this.config);

    return result;
  }

  /**
   * Get ISL auth requirements only
   */
  async getISLRequirements(islFiles?: string[]): Promise<ISLAuthRequirement[]> {
    return extractAllISLAuthRequirements(this.workspaceRoot, islFiles);
  }

  /**
   * Get observed auth policies only
   */
  async getObservedPolicies(routeFiles?: string[]): Promise<ObservedAuthPolicy[]> {
    return extractAllObservedAuthPolicies(
      this.workspaceRoot,
      routeFiles,
      {
        ignoreDirs: this.config.ignoreDirs,
        includeExtensions: this.config.includeExtensions,
      }
    );
  }
}
