import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import type { PropertyProver, PropertyProof, ProofBundle, FileHash, ProjectContext } from './types.js';
import { createSignature, verifySignature } from './signature.js';
import { calculateTrustScore } from './trust-score.js';
import { generateResidualRisks } from './residual-risks.js';

export interface BundleGeneratorOptions {
  projectPath: string;
  provers: PropertyProver[];
  config?: Record<string, unknown>;
  signingSecret?: string;
}

export interface ProverResult {
  prover: string;
  proof: PropertyProof | null;
  error: Error | null;
  duration_ms: number;
}

export class ProofBundleGenerator {
  private projectPath: string;
  private provers: PropertyProver[];
  private config: Record<string, unknown>;
  private signingSecret?: string;

  constructor(options: BundleGeneratorOptions) {
    this.projectPath = path.resolve(options.projectPath);
    this.provers = options.provers;
    this.config = this.sanitizeConfig(options.config || {});
    this.signingSecret = options.signingSecret;
  }

  async generateBundle(): Promise<ProofBundle> {
    const startTime = Date.now();

    // Build project context
    const projectContext = await this.buildProjectContext();

    // Run all provers in parallel
    const proverResults = await this.runProversInParallel(projectContext);

    // Extract successful proofs
    const properties = proverResults
      .filter(r => r.proof !== null)
      .map(r => r.proof!);

    // Get project metadata
    const projectMetadata = await this.getProjectMetadata();

    // Hash all scanned files
    const fileHashes = await this.hashAllFiles(projectContext.sourceFiles);

    // Calculate summary
    const summary = this.calculateSummary(properties);

    // Build the bundle (without signature)
    const bundleWithoutSignature: Omit<ProofBundle, 'signature'> = {
      version: '1.0',
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      project: projectMetadata,
      fileHashes,
      properties,
      summary,
      metadata: {
        toolVersion: this.getToolVersion(),
        proversRun: proverResults.map(r => r.prover),
        duration_ms: Date.now() - startTime,
        config: this.config,
      },
    };

    // Sign the bundle
    const signature = await createSignature(bundleWithoutSignature, {
      projectPath: this.projectPath,
      secret: this.signingSecret,
    });

    return {
      ...bundleWithoutSignature,
      signature,
    };
  }

  private async buildProjectContext(): Promise<ProjectContext> {
    const sourceFiles = this.findSourceFiles();
    
    let packageJson: Record<string, unknown> | undefined;
    const packageJsonPath = path.join(this.projectPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    }

    const tsconfigPath = this.findTsConfig();
    const gitignorePath = path.join(this.projectPath, '.gitignore');

    return {
      rootPath: this.projectPath,
      sourceFiles,
      packageJson,
      tsconfigPath: tsconfigPath || undefined,
      gitignorePath: fs.existsSync(gitignorePath) ? gitignorePath : undefined,
    };
  }

  private async runProversInParallel(projectContext: ProjectContext): Promise<ProverResult[]> {
    const proverPromises = this.provers.map(async (prover): Promise<ProverResult> => {
      const startTime = Date.now();
      
      try {
        const proof = await prover.prove(projectContext);
        return {
          prover: prover.id,
          proof,
          error: null,
          duration_ms: Date.now() - startTime,
        };
      } catch (error) {
        console.error(`Prover ${prover.id} failed:`, error);
        return {
          prover: prover.id,
          proof: null,
          error: error instanceof Error ? error : new Error(String(error)),
          duration_ms: Date.now() - startTime,
        };
      }
    });

    return Promise.all(proverPromises);
  }

  private findSourceFiles(): string[] {
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs'];
    const files: string[] = [];
    const excludeDirs = ['node_modules', '.git', 'dist', 'build', 'coverage', '.turbo', '.next', '.shipgate', '.isl-verify'];

    const walk = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            if (!excludeDirs.includes(entry.name)) {
              walk(fullPath);
            }
          } else if (entry.isFile()) {
            if (extensions.some(ext => entry.name.endsWith(ext))) {
              files.push(fullPath);
            }
          }
        }
      } catch {
        // Skip directories we can't read
      }
    };

    walk(this.projectPath);
    return files;
  }

  private findTsConfig(): string | null {
    const candidates = [
      path.join(this.projectPath, 'tsconfig.json'),
      path.join(this.projectPath, 'jsconfig.json'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  private async getProjectMetadata() {
    const packageJsonPath = path.join(this.projectPath, 'package.json');
    let packageJson: any = {};
    
    if (fs.existsSync(packageJsonPath)) {
      packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    }

    const name = packageJson.name || path.basename(this.projectPath);
    const framework = this.detectFramework(packageJson);
    const language = this.detectLanguage();

    // Git metadata
    let commit: string | null = null;
    let branch: string | null = null;
    
    try {
      commit = execSync('git rev-parse HEAD', { cwd: this.projectPath, encoding: 'utf-8' }).trim();
      branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: this.projectPath, encoding: 'utf-8' }).trim();
    } catch {
      // Not a git repo or git not available
    }

    // Count files and lines of code
    const sourceFiles = this.findSourceFiles();
    const loc = this.countLinesOfCode(sourceFiles);

    return {
      name,
      path: this.projectPath,
      commit,
      branch,
      framework,
      language,
      fileCount: sourceFiles.length,
      loc,
    };
  }

  private detectFramework(packageJson: any): string {
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    if (deps.next) return 'nextjs';
    if (deps.express) return 'express';
    if (deps.fastify) return 'fastify';
    if (deps.react) return 'react';
    if (deps.vue) return 'vue';
    if (deps['@nestjs/core']) return 'nestjs';
    
    return 'unknown';
  }

  private detectLanguage(): 'typescript' | 'javascript' {
    const hasTsConfig = fs.existsSync(path.join(this.projectPath, 'tsconfig.json'));
    const sourceFiles = this.findSourceFiles();
    const tsFiles = sourceFiles.filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
    
    if (hasTsConfig || tsFiles.length > 0) {
      return 'typescript';
    }
    
    return 'javascript';
  }

  private countLinesOfCode(files: string[]): number {
    let total = 0;
    
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        total += content.split('\n').length;
      } catch {
        // Skip files we can't read
      }
    }
    
    return total;
  }

  private async hashAllFiles(files: string[]): Promise<FileHash[]> {
    const { createHash } = await import('node:crypto');
    
    return files.map(file => {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const hash = createHash('sha256').update(content).digest('hex');
        
        return {
          path: path.relative(this.projectPath, file),
          hash,
        };
      } catch {
        return {
          path: path.relative(this.projectPath, file),
          hash: 'error',
        };
      }
    });
  }

  private calculateSummary(properties: PropertyProof[]) {
    const proven = properties.filter(p => p.status === 'PROVEN').length;
    const partial = properties.filter(p => p.status === 'PARTIAL').length;
    const failed = properties.filter(p => p.status === 'FAILED').length;
    const notVerified = properties.filter(p => p.status === 'NOT_VERIFIED').length;

    const trustScore = calculateTrustScore(properties);
    const residualRisks = generateResidualRisks(properties);

    let overallVerdict: 'VERIFIED' | 'PARTIAL' | 'INSUFFICIENT';
    if (trustScore >= 80 && failed === 0) {
      overallVerdict = 'VERIFIED';
    } else if (trustScore >= 50) {
      overallVerdict = 'PARTIAL';
    } else {
      overallVerdict = 'INSUFFICIENT';
    }

    return {
      proven,
      partial,
      failed,
      notVerified,
      overallVerdict,
      trustScore,
      residualRisks,
    };
  }

  private getToolVersion(): string {
    try {
      const packageJsonPath = path.join(__dirname, '../../package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      return packageJson.version || '0.0.0';
    } catch {
      return '0.0.0';
    }
  }

  private sanitizeConfig(config: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    const secretKeys = ['apiKey', 'secret', 'password', 'token', 'key'];
    
    for (const [key, value] of Object.entries(config)) {
      const lowerKey = key.toLowerCase();
      if (secretKeys.some(sk => lowerKey.includes(sk))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeConfig(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }
}
