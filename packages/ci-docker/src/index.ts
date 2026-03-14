/**
 * @isl-lang/ci-docker
 *
 * Docker image configuration and Dockerfile generation for ShipGate CI.
 * Produces optimized, multi-stage Docker images that include the ShipGate CLI
 * and all verification dependencies.
 */

// ============================================================================
// Types
// ============================================================================

export interface DockerConfig {
  /** Base image (default: node:20-alpine) */
  baseImage?: string;
  /** ShipGate CLI version to install */
  cliVersion?: string;
  /** Additional system packages to install */
  systemPackages?: string[];
  /** Working directory inside the container */
  workdir?: string;
  /** Environment variables to bake in */
  env?: Record<string, string>;
  /** Labels for the Docker image */
  labels?: Record<string, string>;
  /** Include SMT solver (z3) for formal verification */
  includeSMT?: boolean;
  /** Include Semgrep for security scanning */
  includeSemgrep?: boolean;
}

export interface GeneratedDockerfile {
  content: string;
  stages: string[];
  estimatedSizeMb: number;
}

// ============================================================================
// Dockerfile Generation
// ============================================================================

const DEFAULT_CONFIG: Required<DockerConfig> = {
  baseImage: 'node:20-alpine',
  cliVersion: 'latest',
  systemPackages: ['git', 'curl'],
  workdir: '/app',
  env: {},
  labels: {},
  includeSMT: false,
  includeSemgrep: false,
};

/**
 * Generate a Dockerfile for ShipGate CI.
 */
export function generateDockerfile(config: DockerConfig = {}): GeneratedDockerfile {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const stages: string[] = ['base'];
  const lines: string[] = [];

  lines.push(`FROM ${cfg.baseImage} AS base`);
  lines.push('');

  if (cfg.systemPackages.length > 0) {
    lines.push(`RUN apk add --no-cache ${cfg.systemPackages.join(' ')}`);
  }

  lines.push(`WORKDIR ${cfg.workdir}`);
  lines.push('');

  lines.push(`RUN npm install -g shipgate@${cfg.cliVersion}`);
  lines.push('');

  if (cfg.includeSMT) {
    lines.push('RUN apk add --no-cache z3');
    stages.push('smt');
  }

  if (cfg.includeSemgrep) {
    lines.push('RUN pip3 install semgrep');
    stages.push('semgrep');
  }

  for (const [key, value] of Object.entries(cfg.env)) {
    lines.push(`ENV ${key}="${value}"`);
  }

  for (const [key, value] of Object.entries(cfg.labels)) {
    lines.push(`LABEL ${key}="${value}"`);
  }

  lines.push('');
  lines.push('COPY . .');
  lines.push('');
  lines.push('ENTRYPOINT ["shipgate"]');
  lines.push('CMD ["go"]');
  lines.push('');

  let estimatedSizeMb = 150; // base node:alpine
  if (cfg.includeSMT) estimatedSizeMb += 80;
  if (cfg.includeSemgrep) estimatedSizeMb += 200;

  return {
    content: lines.join('\n'),
    stages,
    estimatedSizeMb,
  };
}

/**
 * Generate a docker-compose.yml snippet for ShipGate CI.
 */
export function generateComposeService(config: DockerConfig = {}): string {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const envLines = Object.entries(cfg.env)
    .map(([k, v]) => `      - ${k}=${v}`)
    .join('\n');

  return [
    '  shipgate:',
    '    build: .',
    `    working_dir: ${cfg.workdir}`,
    '    volumes:',
    '      - .:/app',
    '    environment:',
    envLines || '      - CI=true',
    '    command: ["go"]',
  ].join('\n');
}
