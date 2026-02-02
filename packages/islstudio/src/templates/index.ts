/**
 * ISL Studio - Golden Workflow Templates
 * 
 * Framework-specific configurations for common stacks.
 */

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  framework: string;
  config: object;
  workflow: string;
  intentFile?: string;
}

// ============================================================================
// Next.js API Routes
// ============================================================================

export const nextjsTemplate: WorkflowTemplate = {
  id: 'nextjs',
  name: 'Next.js',
  description: 'Next.js with API routes and server actions',
  framework: 'next',
  config: {
    preset: 'startup-default',
    packs: {
      auth: { enabled: true },
      pii: { enabled: true },
      payments: { enabled: true },
      'rate-limit': { enabled: true },
      intent: { enabled: true },
    },
    paths: {
      include: ['app/api/**/*.ts', 'pages/api/**/*.ts', 'src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts'],
    },
    threshold: 70,
  },
  workflow: `name: ISL Gate

on:
  pull_request:
    paths:
      - 'app/api/**'
      - 'pages/api/**'
      - 'src/**'
      - 'lib/**'

permissions:
  contents: read
  pull-requests: write
  security-events: write

jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: ISL-Studio/islstudio-gate-action@v1
        with:
          # Start with warn mode - switch to enforce when ready
          mode: warn
          upload-sarif: true
          changed-only: true
`,
  intentFile: `# Next.js API Intent Declarations
# Add @intent tags to enforce behavior

# All auth endpoints must be rate-limited
# @intent rate-limit-auth

# No PII in application logs  
# @intent no-pii-in-logs

# Encrypt sensitive data at rest
# @intent encrypt-pii
`,
};

// ============================================================================
// Express.js
// ============================================================================

export const expressTemplate: WorkflowTemplate = {
  id: 'express',
  name: 'Express.js',
  description: 'Express.js REST API',
  framework: 'express',
  config: {
    preset: 'startup-default',
    packs: {
      auth: { enabled: true },
      pii: { enabled: true },
      payments: { enabled: true },
      'rate-limit': { enabled: true },
      intent: { enabled: true },
    },
    paths: {
      include: ['src/**/*.ts', 'src/**/*.js', 'routes/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts', 'node_modules/**'],
    },
    threshold: 70,
  },
  workflow: `name: ISL Gate

on:
  pull_request:
    paths:
      - 'src/**'
      - 'routes/**'
      - 'controllers/**'
      - 'middleware/**'

permissions:
  contents: read
  pull-requests: write
  security-events: write

jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: ISL-Studio/islstudio-gate-action@v1
        with:
          # Start with warn mode - switch to enforce when ready
          mode: warn
          upload-sarif: true
          changed-only: true
`,
};

// ============================================================================
// Fastify
// ============================================================================

export const fastifyTemplate: WorkflowTemplate = {
  id: 'fastify',
  name: 'Fastify',
  description: 'Fastify REST API',
  framework: 'fastify',
  config: {
    preset: 'startup-default',
    packs: {
      auth: { enabled: true },
      pii: { enabled: true },
      payments: { enabled: true },
      'rate-limit': { enabled: true },
      intent: { enabled: true },
    },
    paths: {
      include: ['src/**/*.ts', 'routes/**/*.ts', 'plugins/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts'],
    },
    threshold: 70,
  },
  workflow: `name: ISL Gate

on:
  pull_request:
    paths:
      - 'src/**'
      - 'routes/**'
      - 'plugins/**'

permissions:
  contents: read
  pull-requests: write
  security-events: write

jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: ISL-Studio/islstudio-gate-action@v1
        with:
          # Start with warn mode - switch to enforce when ready
          mode: warn
          upload-sarif: true
          changed-only: true
`,
};

// ============================================================================
// NestJS
// ============================================================================

export const nestjsTemplate: WorkflowTemplate = {
  id: 'nestjs',
  name: 'NestJS',
  description: 'NestJS enterprise API',
  framework: 'nestjs',
  config: {
    preset: 'strict-security',
    packs: {
      auth: { enabled: true },
      pii: { enabled: true },
      payments: { enabled: true },
      'rate-limit': { enabled: true },
      intent: { enabled: true },
    },
    paths: {
      include: ['src/**/*.ts'],
      exclude: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
    },
    threshold: 80,
  },
  workflow: `name: ISL Gate

on:
  pull_request:
    paths:
      - 'src/**'

permissions:
  contents: read
  pull-requests: write
  security-events: write

jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: ISL-Studio/islstudio-gate-action@v1
        with:
          # Start with warn mode - switch to enforce when ready
          mode: warn
          upload-sarif: true
          changed-only: true
          threshold: '80'
`,
};

// ============================================================================
// Hono (Edge)
// ============================================================================

export const honoTemplate: WorkflowTemplate = {
  id: 'hono',
  name: 'Hono',
  description: 'Hono edge-first API',
  framework: 'hono',
  config: {
    preset: 'startup-default',
    packs: {
      auth: { enabled: true },
      pii: { enabled: true },
      payments: { enabled: false },
      'rate-limit': { enabled: true },
      intent: { enabled: true },
    },
    paths: {
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts'],
    },
    threshold: 70,
  },
  workflow: `name: ISL Gate

on:
  pull_request:
    paths:
      - 'src/**'

permissions:
  contents: read
  pull-requests: write

jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: ISL-Studio/islstudio-gate-action@v1
        with:
          # Start with warn mode - switch to enforce when ready
          mode: warn
          upload-sarif: true
          changed-only: true
`,
};

// ============================================================================
// Template Registry
// ============================================================================

export const templates: Record<string, WorkflowTemplate> = {
  nextjs: nextjsTemplate,
  express: expressTemplate,
  fastify: fastifyTemplate,
  nestjs: nestjsTemplate,
  hono: honoTemplate,
};

export function getTemplate(id: string): WorkflowTemplate | undefined {
  return templates[id];
}

export function listTemplates(): WorkflowTemplate[] {
  return Object.values(templates);
}

export function detectFramework(packageJson: any): string | null {
  const deps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  if (deps['next']) return 'nextjs';
  if (deps['@nestjs/core']) return 'nestjs';
  if (deps['fastify']) return 'fastify';
  if (deps['hono']) return 'hono';
  if (deps['express']) return 'express';

  return null;
}
