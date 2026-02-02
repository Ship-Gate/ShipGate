/**
 * Jenkins Pipeline Generator
 * 
 * Generates Jenkinsfile configurations.
 */

import type { PipelineConfig, GeneratedFile } from '../generator.js';
import { requiresSecurityScanning } from '../generator.js';
import { generateJenkinsCheckStage } from '../stages/check.js';
import { generateJenkinsTestStage } from '../stages/test.js';
import { generateJenkinsVerifyStage } from '../stages/verify.js';
import { generateJenkinsDeployStage } from '../stages/deploy.js';

/**
 * Generate Jenkinsfile
 */
export function generateJenkinsfile(config: PipelineConfig): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  files.push({
    path: 'Jenkinsfile',
    content: generateMainPipeline(config),
  });

  return files;
}

/**
 * Generate the main Jenkins pipeline
 */
function generateMainPipeline(config: PipelineConfig): string {
  const { domain, options } = config;
  const stages: string[] = [];

  // Check stage
  stages.push(generateJenkinsCheckStage(config));
  
  // Test stage
  stages.push(generateJenkinsTestStage(config));
  
  // Verify stage (parallel behaviors)
  stages.push(generateJenkinsVerifyStage(config));

  // Chaos testing stage
  if (domain.hasChaosScenarios || domain.hasTemporalRequirements) {
    stages.push(generateJenkinsChaosStage(config));
  }

  // Security scanning stage
  if (requiresSecurityScanning(domain.complianceStandards)) {
    stages.push(generateJenkinsSecurityStage(config, domain.complianceStandards));
  }

  // Performance testing stage
  if (domain.hasTemporalRequirements) {
    stages.push(generateJenkinsPerformanceStage(config));
  }

  // Deploy stage
  if (options.includeDeploy) {
    stages.push(generateJenkinsDeployStage(config));
  }

  return `// ISL Pipeline - Generated from ${domain.name} domain
// Do not edit manually - regenerate with: npx isl generate --pipeline

pipeline {
    agent any

    environment {
        ISL_VERSION = '${options.version}'
        NODE_VERSION = '${options.nodeVersion}'
    }

    tools {
        nodejs 'NodeJS-${options.nodeVersion}'
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        disableConcurrentBuilds()
        timeout(time: 30, unit: 'MINUTES')
    }

    stages {
${stages.join('\n\n')}
    }

    post {
        always {
            cleanWs()
        }
        success {
            echo 'Pipeline completed successfully!'
        }
        failure {
            echo 'Pipeline failed!'
            // Add notification here (Slack, email, etc.)
        }
    }
}
`;
}

/**
 * Generate chaos testing stage for Jenkins
 */
function generateJenkinsChaosStage(_config: PipelineConfig): string {
  return `        stage('Chaos Testing') {
            steps {
                sh 'npm ci'
                sh 'npx isl verify --chaos --scenarios=all'
            }
            post {
                always {
                    archiveArtifacts artifacts: 'chaos-report.json', allowEmptyArchive: true
                }
            }
        }`;
}

/**
 * Generate security scanning stage for Jenkins
 */
function generateJenkinsSecurityStage(_config: PipelineConfig, standards: string[]): string {
  const standardFlags = standards.map((s) => `--${s.toLowerCase().replace('_', '-')}`).join(' ');

  return `        stage('Security') {
            parallel {
                stage('ISL Security Scan') {
                    steps {
                        sh 'npm ci'
                        sh 'npx isl scan ${standardFlags}'
                    }
                }
                stage('Dependency Audit') {
                    steps {
                        sh 'npm audit --audit-level=high'
                    }
                }
            }
            post {
                always {
                    archiveArtifacts artifacts: 'security-report.json', allowEmptyArchive: true
                }
            }
        }`;
}

/**
 * Generate performance testing stage for Jenkins
 */
function generateJenkinsPerformanceStage(_config: PipelineConfig): string {
  return `        stage('Performance') {
            steps {
                sh 'npm ci'
                sh 'npx isl verify --temporal --percentiles=p50,p95,p99'
                sh 'npx isl verify --temporal --regression --threshold=10'
            }
            post {
                always {
                    archiveArtifacts artifacts: 'performance-report.json', allowEmptyArchive: true
                    perfReport sourceDataFiles: 'performance-report.json'
                }
            }
        }`;
}
