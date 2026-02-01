/**
 * ISL Pipeline Generator
 * 
 * Generates CI/CD pipeline configurations from ISL domain specifications.
 */

export { generate, type GeneratorOptions, type GeneratedFile } from './generator.js';
export { generateGitHubActions } from './platforms/github.js';
export { generateGitLabCI } from './platforms/gitlab.js';
export { generateCircleCI } from './platforms/circle.js';
export { generateJenkinsfile } from './platforms/jenkins.js';

export { generateCheckStage } from './stages/check.js';
export { generateTestStage } from './stages/test.js';
export { generateVerifyStage } from './stages/verify.js';
export { generateDeployStage } from './stages/deploy.js';
