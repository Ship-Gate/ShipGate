/**
 * SpecInferenceEngine - Core differentiator of ISL Verify.
 * Analyzes TypeScript/JavaScript codebases and produces ISL specs.
 *
 * Entity inference: Prisma, Zod, TS interfaces, Mongoose, Drizzle, TypeORM
 * Endpoint inference: Next.js App Router, Express, Fastify
 * Behavior inference: Service functions, CRUD, pre/post conditions
 * Actor inference: Auth middleware, role checks
 */

import * as fs from 'fs';
import * as path from 'path';
import { detectFramework } from './detect-framework.js';
import { inferEntities } from './inferrers/entity/index.js';
import { inferEndpoints } from './inferrers/endpoint/index.js';
import { inferBehaviors } from './inferrers/behavior-inferrer.js';
import { inferActors } from './inferrers/actor-inferrer.js';
import { writeInferredSpec } from './spec-writer.js';
import type { InferredSpec, FrameworkDetection } from './types.js';

export interface SpecInferenceOptions {
  /** Project root directory */
  projectRoot: string;
  /** Domain name for the generated spec */
  domainName?: string;
  /** Source files to analyze (default: auto-discover) */
  sourceFiles?: string[];
  /** Output path (default: .isl-verify/inferred-spec.isl) */
  outputPath?: string;
  /** Whether to write the spec file */
  writeFile?: boolean;
}

export interface SpecInferenceResult {
  spec: InferredSpec;
  outputPath?: string;
  /** Average confidence score 0-1 */
  confidenceScore: number;
}

export class SpecInferenceEngine {
  private projectRoot: string;
  private domainName: string;
  private sourceFiles: string[];

  constructor(options: SpecInferenceOptions) {
    this.projectRoot = path.resolve(options.projectRoot);
    this.domainName =
      options.domainName ?? this.inferDomainNameFromPath(this.projectRoot);
    this.sourceFiles = options.sourceFiles ?? this.discoverSourceFiles();
  }

  /**
   * Run full inference and optionally write the spec file.
   */
  async infer(options: Pick<SpecInferenceOptions, 'writeFile' | 'outputPath'> = {}): Promise<SpecInferenceResult> {
    const writeFile = options.writeFile ?? true;
    const outputPath =
      options.outputPath ?? path.join(this.projectRoot, '.isl-verify', 'inferred-spec.isl');

    const framework = await detectFramework(this.projectRoot);

    const [entitiesResult, endpoints, behaviors, actors] = await Promise.all([
      inferEntities(this.projectRoot, this.sourceFiles, framework.orm),
      inferEndpoints(this.projectRoot, framework.web),
      inferBehaviors(this.projectRoot, this.sourceFiles),
      inferActors(this.projectRoot),
    ]);

    const spec: InferredSpec = {
      domainName: this.domainName,
      entities: entitiesResult.entities,
      enums: entitiesResult.enums,
      endpoints,
      behaviors,
      actors,
      framework,
    };

    const confidenceScore = this.computeConfidenceScore(spec);

    if (writeFile) {
      await writeInferredSpec(spec, outputPath);
    }

    return {
      spec,
      outputPath: writeFile ? outputPath : undefined,
      confidenceScore,
    };
  }

  /**
   * Infer spec without writing to disk.
   */
  async inferSpec(): Promise<InferredSpec> {
    const result = await this.infer({ writeFile: false });
    return result.spec;
  }

  /**
   * Get detected framework and ORM.
   */
  async detectFramework(): Promise<FrameworkDetection> {
    return detectFramework(this.projectRoot);
  }

  private discoverSourceFiles(): string[] {
    const files: string[] = [];
    const dirs = [
      this.projectRoot,
      path.join(this.projectRoot, 'src'),
      path.join(this.projectRoot, 'app'),
      path.join(this.projectRoot, 'lib'),
      path.join(this.projectRoot, 'services'),
    ];

    for (const dir of dirs) {
      if (fs.existsSync(dir)) {
        this.collectTsFiles(dir, files);
      }
    }

    return [...new Set(files)];
  }

  private collectTsFiles(dir: string, out: string[]): void {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (
          !entry.name.startsWith('.') &&
          entry.name !== 'node_modules' &&
          entry.name !== 'dist' &&
          entry.name !== '.next'
        ) {
          this.collectTsFiles(full, out);
        }
      } else if (
        (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
        !entry.name.endsWith('.d.ts')
      ) {
        out.push(full);
      }
    }
  }

  private inferDomainNameFromPath(projectRoot: string): string {
    const base = path.basename(projectRoot);
    return base
      .split(/[-_.]/)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join('');
  }

  private computeConfidenceScore(spec: InferredSpec): number {
    const scores: number[] = [];

    const levelToScore = (l: string) => {
      if (l === 'high') return 1;
      if (l === 'medium') return 0.6;
      return 0.3;
    };

    for (const e of spec.entities) {
      scores.push(levelToScore(e.confidence));
    }
    for (const e of spec.enums) {
      scores.push(levelToScore(e.confidence));
    }
    for (const e of spec.endpoints) {
      scores.push(levelToScore(e.confidence));
    }
    for (const b of spec.behaviors) {
      scores.push(levelToScore(b.confidence));
    }
    for (const a of spec.actors) {
      scores.push(levelToScore(a.confidence));
    }

    if (scores.length === 0) return 0;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }
}
