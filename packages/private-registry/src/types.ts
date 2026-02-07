/**
 * Types for private registry detection and dependency verdict classification.
 * @module @isl-lang/private-registry/types
 */

/** Supported package ecosystems */
export type Ecosystem = 'npm' | 'pypi' | 'maven';

/**
 * Result of classifying a dependency that could not be verified on the public registry.
 * - verified: dependency was successfully verified (e.g. found on public registry)
 * - unverifiable_private: dependency is from a detected private registry — valid but not verifiable by us
 * - broken: not found and not from a known private registry (true failure)
 */
export type DependencyVerdict = 'verified' | 'unverifiable_private' | 'broken';

/** Detected private registry configuration per ecosystem */
export interface PrivateRegistryConfig {
  /** npm: registry URLs (default registry + scoped registries) */
  npm: string[];
  /** PyPI: index URLs */
  pypi: string[];
  /** Maven: repository URLs */
  maven: string[];
}

/** Options for detecting private registries */
export interface DetectOptions {
  /** Project root directory (for reading .npmrc, pip.conf, settings.xml) */
  projectRoot?: string;
  /** Override env (for tests); defaults to process.env */
  env?: NodeJS.ProcessEnv;
}

/** Input for classifying a dependency verdict */
export interface ClassifyInput {
  ecosystem: Ecosystem;
  /** Package name (npm: name or @scope/name, pypi: name, maven: groupId:artifactId) */
  name: string;
  /** Whether resolution/verification against public registry failed */
  resolutionFailed: boolean;
  /** Optional: registry URL the package was resolved from (if known) */
  resolvedRegistryUrl?: string;
}

/** Result of classifying a single dependency */
export interface ClassifyResult {
  verdict: DependencyVerdict;
  /** Human-readable reason */
  reason: string;
  /** If unverifiable_private, which detected private registry matched */
  matchedPrivateRegistry?: string;
}
