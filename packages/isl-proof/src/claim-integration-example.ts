/**
 * Example: Integrating Claim Graph into Pipeline
 * 
 * This shows how to integrate the unified claim graph into the verification pipeline
 * so that all engines emit claims that get unified into a single graph.
 * 
 * @module @isl-lang/proof/claim-integration-example
 */

import {
  buildUnifiedClaimGraph,
  type ClaimCollection,
} from './claim-integration.js';
import {
  exportClaimGraphToJson,
  exportClaimGraphToHtml,
} from './claim-export.js';
import type { BundleClaim } from './bundle-hash.js';

/**
 * Example: Collect claims from multiple engines and build unified graph
 */
export async function exampleBuildClaimGraph(
  outputDir: string
): Promise<void> {
  // Collect claims from different engines
  const collection: ClaimCollection = {
    // Claims from proof bundle
    bundleClaims: [
      {
        clauseId: 'login:postcondition:1',
        clauseType: 'postcondition',
        status: 'proven',
        reason: 'Verified by test',
      } as BundleClaim,
    ],
    
    // Claims from verifier
    verifierClauses: [
      {
        clauseId: 'login:precondition:1',
        clauseType: 'precondition',
        expression: 'user != null',
        status: 'PASS',
        confidence: 95,
        evidence: [
          {
            file: 'src/auth.ts',
            line: 42,
            column: 10,
            kind: 'test_assertion',
          },
        ],
      },
    ],
    
    // Route claims from truthpack
    routes: [
      {
        route: '/api/users',
        method: 'GET',
        locations: [
          { file: 'src/routes/users.ts', line: 15 },
        ],
      },
    ],
    
    // Environment variable claims
    envVars: [
      {
        name: 'DATABASE_URL',
        locations: [
          { file: '.env.example', line: 5 },
          { file: 'src/config.ts', line: 10 },
        ],
      },
    ],
  };

  // Build unified graph
  const graph = buildUnifiedClaimGraph(collection, {
    deduplicate: true,
    linkRelated: true,
  });

  // Export to JSON
  await exportClaimGraphToJson(graph, `${outputDir}/claim-graph.json`);

  // Export to HTML viewer
  await exportClaimGraphToHtml(graph, `${outputDir}/claim-graph.html`, {
    title: 'Unified Claim Graph',
    includeJson: false,
  });

  console.log(`Claim graph built: ${graph.metadata.totalClaims} claims, ${graph.metadata.uniqueSubjects} unique subjects`);
}

/**
 * Example: Integrate into proof bundle creation
 * 
 * This shows how to add claim graph to proof bundle exports
 */
export function exampleAddToProofBundle(
  bundle: {
    claims?: BundleClaim[];
  },
  verifierReport?: {
    clauseResults?: Array<{
      clauseId: string;
      clauseType: string;
      expression: string;
      status: string;
      confidence: number;
      evidence: Array<{
        file: string;
        line: number;
        column: number;
        kind: string;
      }>;
    }>;
  }
): void {
  const collection: ClaimCollection = {
    bundleClaims: bundle.claims,
    verifierClauses: verifierReport?.clauseResults,
  };

  const graph = buildUnifiedClaimGraph(collection);
  
  // Graph is now available for inclusion in proof bundle
  // Multiple engines referencing same route collapse into one graph node
  console.log(`Unified graph: ${graph.metadata.totalClaims} claims from ${graph.metadata.engines.length} engines`);
}
