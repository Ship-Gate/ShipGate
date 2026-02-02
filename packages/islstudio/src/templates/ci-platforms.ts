/**
 * ISL Studio - Multi-CI Platform Templates
 * 
 * Templates for GitLab, Bitbucket, and Azure DevOps
 */

// ============================================================================
// GitLab CI
// ============================================================================

export const gitlabCiTemplate = `# .gitlab-ci.yml
# ISL Studio Gate for GitLab

stages:
  - gate

isl-gate:
  stage: gate
  image: node:20
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
  script:
    - npx islstudio@latest gate --ci --output json > gate-result.json || true
    - |
      VERDICT=$(cat gate-result.json | jq -r '.verdict')
      SCORE=$(cat gate-result.json | jq -r '.score')
      echo "ISL Gate: $VERDICT (Score: $SCORE/100)"
      
      if [ "$VERDICT" = "NO_SHIP" ]; then
        echo "Gate blocked this merge request"
        cat gate-result.json | jq -r '.violations[]? | "ERROR: \\(.ruleId) - \\(.message)"'
        exit 1
      fi
  artifacts:
    reports:
      sast: gate-result.json
    paths:
      - gate-result.json
    when: always
`;

// ============================================================================
// Bitbucket Pipelines
// ============================================================================

export const bitbucketPipelinesTemplate = `# bitbucket-pipelines.yml
# ISL Studio Gate for Bitbucket

image: node:20

pipelines:
  pull-requests:
    '**':
      - step:
          name: ISL Gate
          script:
            - npx islstudio@latest gate --ci --output json > gate-result.json || true
            - |
              VERDICT=$(cat gate-result.json | jq -r '.verdict')
              SCORE=$(cat gate-result.json | jq -r '.score')
              echo "ISL Gate: $VERDICT (Score: $SCORE/100)"
              
              if [ "$VERDICT" = "NO_SHIP" ]; then
                echo "Gate blocked this pull request"
                cat gate-result.json | jq -r '.violations[]? | "ERROR: \\(.ruleId) - \\(.message)"'
                exit 1
              fi
          artifacts:
            - gate-result.json
`;

// ============================================================================
// Azure DevOps Pipelines
// ============================================================================

export const azureDevOpsTemplate = `# azure-pipelines.yml
# ISL Studio Gate for Azure DevOps

trigger: none

pr:
  branches:
    include:
      - main
      - develop

pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: NodeTool@0
    inputs:
      versionSpec: '20.x'
    displayName: 'Install Node.js'

  - script: |
      npx islstudio@latest gate --ci --output json > gate-result.json || true
      
      VERDICT=$(cat gate-result.json | jq -r '.verdict')
      SCORE=$(cat gate-result.json | jq -r '.score')
      echo "##vso[task.setvariable variable=VERDICT]$VERDICT"
      echo "##vso[task.setvariable variable=SCORE]$SCORE"
      
      echo "ISL Gate: $VERDICT (Score: $SCORE/100)"
    displayName: 'Run ISL Gate'

  - script: |
      if [ "$(VERDICT)" = "NO_SHIP" ]; then
        echo "##vso[task.logissue type=error]ISL Gate blocked this PR"
        cat gate-result.json | jq -r '.violations[]? | "##vso[task.logissue type=error]\\(.ruleId): \\(.message)"'
        exit 1
      fi
    displayName: 'Check Gate Result'
    condition: always()

  - task: PublishBuildArtifacts@1
    inputs:
      pathToPublish: 'gate-result.json'
      artifactName: 'isl-evidence'
    condition: always()
    displayName: 'Publish Evidence'
`;

// ============================================================================
// CircleCI
// ============================================================================

export const circleCiTemplate = `# .circleci/config.yml
# ISL Studio Gate for CircleCI

version: 2.1

jobs:
  isl-gate:
    docker:
      - image: cimg/node:20.0
    steps:
      - checkout
      - run:
          name: Run ISL Gate
          command: |
            npx islstudio@latest gate --ci --output json > gate-result.json || true
            
            VERDICT=$(cat gate-result.json | jq -r '.verdict')
            SCORE=$(cat gate-result.json | jq -r '.score')
            echo "ISL Gate: $VERDICT (Score: $SCORE/100)"
            
            if [ "$VERDICT" = "NO_SHIP" ]; then
              echo "Gate blocked this PR"
              cat gate-result.json | jq -r '.violations[]? | "ERROR: \\(.ruleId) - \\(.message)"'
              exit 1
            fi
      - store_artifacts:
          path: gate-result.json
          destination: isl-evidence

workflows:
  pr-gate:
    jobs:
      - isl-gate:
          filters:
            branches:
              ignore: main
`;

// ============================================================================
// Jenkins
// ============================================================================

export const jenkinsfileTemplate = `// Jenkinsfile
// ISL Studio Gate for Jenkins

pipeline {
    agent {
        docker {
            image 'node:20'
        }
    }
    
    stages {
        stage('ISL Gate') {
            when {
                changeRequest()
            }
            steps {
                sh '''
                    npx islstudio@latest gate --ci --output json > gate-result.json || true
                    
                    VERDICT=$(cat gate-result.json | jq -r '.verdict')
                    SCORE=$(cat gate-result.json | jq -r '.score')
                    echo "ISL Gate: $VERDICT (Score: $SCORE/100)"
                    
                    if [ "$VERDICT" = "NO_SHIP" ]; then
                        echo "Gate blocked this PR"
                        cat gate-result.json | jq -r '.violations[]? | "ERROR: \\(.ruleId) - \\(.message)"'
                        exit 1
                    fi
                '''
            }
            post {
                always {
                    archiveArtifacts artifacts: 'gate-result.json', fingerprint: true
                }
            }
        }
    }
}
`;

// ============================================================================
// Template Registry
// ============================================================================

export interface CiTemplate {
  id: string;
  name: string;
  filename: string;
  content: string;
}

export const ciTemplates: Record<string, CiTemplate> = {
  github: {
    id: 'github',
    name: 'GitHub Actions',
    filename: '.github/workflows/isl-gate.yml',
    content: '', // Uses main template
  },
  gitlab: {
    id: 'gitlab',
    name: 'GitLab CI',
    filename: '.gitlab-ci.yml',
    content: gitlabCiTemplate,
  },
  bitbucket: {
    id: 'bitbucket',
    name: 'Bitbucket Pipelines',
    filename: 'bitbucket-pipelines.yml',
    content: bitbucketPipelinesTemplate,
  },
  azure: {
    id: 'azure',
    name: 'Azure DevOps',
    filename: 'azure-pipelines.yml',
    content: azureDevOpsTemplate,
  },
  circleci: {
    id: 'circleci',
    name: 'CircleCI',
    filename: '.circleci/config.yml',
    content: circleCiTemplate,
  },
  jenkins: {
    id: 'jenkins',
    name: 'Jenkins',
    filename: 'Jenkinsfile',
    content: jenkinsfileTemplate,
  },
};

export function getCiTemplate(platform: string): CiTemplate | undefined {
  return ciTemplates[platform];
}

export function listCiTemplates(): CiTemplate[] {
  return Object.values(ciTemplates);
}
