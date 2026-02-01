/**
 * Framework Detector
 * 
 * Detects web frameworks from package.json and configuration files.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { WebFramework, Confidence } from '../contextTypes.js';

export interface FrameworkDetection {
  framework: WebFramework;
  confidence: Confidence;
  source: string;
}

/**
 * Framework detection patterns
 */
const FRAMEWORK_PATTERNS: Record<WebFramework, { packages: string[]; configs: string[] }> = {
  next: {
    packages: ['next'],
    configs: ['next.config.js', 'next.config.mjs', 'next.config.ts'],
  },
  express: {
    packages: ['express'],
    configs: [],
  },
  fastify: {
    packages: ['fastify'],
    configs: [],
  },
  koa: {
    packages: ['koa'],
    configs: [],
  },
  hono: {
    packages: ['hono'],
    configs: [],
  },
  nestjs: {
    packages: ['@nestjs/core'],
    configs: ['nest-cli.json'],
  },
  remix: {
    packages: ['@remix-run/node', '@remix-run/react'],
    configs: ['remix.config.js'],
  },
  nuxt: {
    packages: ['nuxt'],
    configs: ['nuxt.config.js', 'nuxt.config.ts'],
  },
  sveltekit: {
    packages: ['@sveltejs/kit'],
    configs: ['svelte.config.js'],
  },
  django: {
    packages: ['django'],
    configs: ['manage.py'],
  },
  flask: {
    packages: ['flask'],
    configs: [],
  },
  fastapi: {
    packages: ['fastapi'],
    configs: [],
  },
  gin: {
    packages: ['github.com/gin-gonic/gin'],
    configs: [],
  },
  fiber: {
    packages: ['github.com/gofiber/fiber'],
    configs: [],
  },
  spring: {
    packages: ['org.springframework.boot'],
    configs: [],
  },
  aspnet: {
    packages: ['Microsoft.AspNetCore'],
    configs: [],
  },
  unknown: {
    packages: [],
    configs: [],
  },
};

/**
 * Detects web frameworks in the workspace
 */
export async function detectFrameworks(workspacePath: string): Promise<FrameworkDetection[]> {
  const detected: FrameworkDetection[] = [];

  // Check package.json for Node.js projects
  try {
    const packageJsonPath = path.join(workspacePath, 'package.json');
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);
    
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    for (const [framework, patterns] of Object.entries(FRAMEWORK_PATTERNS)) {
      if (framework === 'unknown') continue;

      // Check packages
      for (const pkg of patterns.packages) {
        if (allDeps[pkg]) {
          detected.push({
            framework: framework as WebFramework,
            confidence: 'high',
            source: `package.json (${pkg})`,
          });
          break;
        }
      }
    }
  } catch {
    // No package.json or invalid
  }

  // Check config files
  for (const [framework, patterns] of Object.entries(FRAMEWORK_PATTERNS)) {
    if (framework === 'unknown') continue;

    for (const config of patterns.configs) {
      try {
        await fs.access(path.join(workspacePath, config));
        // Only add if not already detected from package.json
        if (!detected.some(d => d.framework === framework)) {
          detected.push({
            framework: framework as WebFramework,
            confidence: 'high',
            source: config,
          });
        }
        break;
      } catch {
        // Config not found
      }
    }
  }

  // Check requirements.txt for Python projects
  try {
    const requirementsPath = path.join(workspacePath, 'requirements.txt');
    const requirements = await fs.readFile(requirementsPath, 'utf-8');
    
    if (requirements.includes('django')) {
      detected.push({ framework: 'django', confidence: 'high', source: 'requirements.txt' });
    }
    if (requirements.includes('flask')) {
      detected.push({ framework: 'flask', confidence: 'high', source: 'requirements.txt' });
    }
    if (requirements.includes('fastapi')) {
      detected.push({ framework: 'fastapi', confidence: 'high', source: 'requirements.txt' });
    }
  } catch {
    // No requirements.txt
  }

  // Check pyproject.toml
  try {
    const pyprojectPath = path.join(workspacePath, 'pyproject.toml');
    const pyproject = await fs.readFile(pyprojectPath, 'utf-8');
    
    if (pyproject.includes('django')) {
      if (!detected.some(d => d.framework === 'django')) {
        detected.push({ framework: 'django', confidence: 'high', source: 'pyproject.toml' });
      }
    }
    if (pyproject.includes('flask')) {
      if (!detected.some(d => d.framework === 'flask')) {
        detected.push({ framework: 'flask', confidence: 'high', source: 'pyproject.toml' });
      }
    }
    if (pyproject.includes('fastapi')) {
      if (!detected.some(d => d.framework === 'fastapi')) {
        detected.push({ framework: 'fastapi', confidence: 'high', source: 'pyproject.toml' });
      }
    }
  } catch {
    // No pyproject.toml
  }

  return detected;
}
