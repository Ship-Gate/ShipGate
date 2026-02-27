/**
 * SARIF Service
 * 
 * Generates and uploads SARIF reports to GitHub Code Scanning.
 */

import type { App } from '@octokit/app';
import type { RuleViolation } from '@isl-lang/isl-policy-packs';

export interface SarifService {
  generateSarif(violations: RuleViolation[]): string;
  uploadSarif(params: UploadSarifParams): Promise<void>;
}

export interface UploadSarifParams {
  owner: string;
  repo: string;
  commitSha: string;
  ref: string;
  sarif: string;
}

/**
 * Create SARIF service
 */
export function createSarifService(): SarifService {
  return {
    generateSarif(violations: RuleViolation[]): string {
      // Convert violations to SARIF 2.1.0 format
      const sarif = {
        version: '2.1.0',
        $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema.json',
        runs: [
          {
            tool: {
              driver: {
                name: 'ISL Policy Packs',
                version: '1.0.0',
                informationUri: 'https://intentlang.dev',
                rules: violations.map((v, i) => ({
                  id: v.ruleId,
                  name: v.ruleName,
                  shortDescription: { text: v.message },
                  helpUri: `https://intentlang.dev/docs/policies/${v.ruleId}`,
                })),
              },
            },
            results: violations.map((v) => ({
              ruleId: v.ruleId,
              level: v.severity === 'error' ? 'error' : v.severity === 'warning' ? 'warning' : 'note',
              message: {
                text: v.message,
              },
              locations: [
                {
                  physicalLocation: {
                    artifactLocation: {
                      uri: v.location.file,
                    },
                    region: {
                      startLine: v.location.line || 1,
                      startColumn: v.location.column || 1,
                    },
                  },
                },
              ],
            })),
          },
        ],
      };

      return JSON.stringify(sarif, null, 2);
    },

    async uploadSarif(params: UploadSarifParams): Promise<void> {
      // TODO: Implement SARIF upload via GitHub API
      // This requires the App to have 'security_events: write' permission
      console.log('SARIF upload not yet implemented', params);
    },
  };
}
