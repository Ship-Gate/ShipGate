/**
 * ISL Adapters - GitHub Integration
 * 
 * @module @isl-lang/adapters/github
 */

export {
  isGitHubActions,
  getGitHubContext,
  parseRepository,
  isPullRequest,
  getPRNumber,
  setOutput,
  setFailed,
  logInfo,
  logWarning,
  logError,
  startGroup,
  endGroup,
} from './context.js';

export {
  generatePRComment,
  generateCompactComment,
  generateSARIF,
} from './pr-comment.js';

export type {
  ActionInputs,
  ActionOutputs,
  GitHubContext,
  PRComment,
  CheckStatus,
  CheckConclusion,
} from './types.js';
