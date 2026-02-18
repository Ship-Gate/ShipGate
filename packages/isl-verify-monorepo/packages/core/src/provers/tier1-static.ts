import { BaseProver, type ProverContext } from './base-prover';
import type { ProverResult, PropertyResult } from '../types';

export class Tier1StaticProver extends BaseProver {
  readonly name = 'tier1-static';
  readonly tier = 1;
  readonly properties = [
    'null_safety',
    'bounds_checking',
    'type_safety',
    'unused_code',
    'error_handling',
    'input_validation',
    'resource_leaks',
  ];

  async verify(context: ProverContext): Promise<ProverResult> {
    const startTime = Date.now();
    const properties: PropertyResult[] = [];

    properties.push(await this.checkNullSafety(context));
    properties.push(await this.checkBoundsChecking(context));
    properties.push(await this.checkTypeSafety(context));
    properties.push(await this.checkUnusedCode(context));
    properties.push(await this.checkErrorHandling(context));
    properties.push(await this.checkInputValidation(context));
    properties.push(await this.checkResourceLeaks(context));

    const passed = properties.filter((p) => p.status === 'pass').length;
    const failed = properties.filter((p) => p.status === 'fail').length;
    const skipped = properties.filter((p) => p.status === 'skip').length;

    return {
      name: this.name,
      tier: this.tier,
      passed,
      failed,
      skipped,
      duration: Date.now() - startTime,
      properties,
    };
  }

  private async checkNullSafety(context: ProverContext): Promise<PropertyResult> {
    const nullPatterns = [
      /\?\./g,
      /\?\?/g,
      /if\s*\(\s*\w+\s*===?\s*null/g,
      /if\s*\(\s*\w+\s*!==?\s*null/g,
    ];

    const hasNullChecks = nullPatterns.some((pattern) => pattern.test(context.source));

    return {
      property: 'null_safety',
      status: hasNullChecks ? 'pass' : 'skip',
      message: hasNullChecks ? 'Null safety checks present' : 'No null checks found',
    };
  }

  private async checkBoundsChecking(context: ProverContext): Promise<PropertyResult> {
    const arrayAccess = /\w+\[\w+\]/g;
    const hasArrayAccess = arrayAccess.test(context.source);
    const hasBoundsCheck = /\.length\s*[<>=]/g.test(context.source);

    if (!hasArrayAccess) {
      return { property: 'bounds_checking', status: 'skip', message: 'No array access' };
    }

    return {
      property: 'bounds_checking',
      status: hasBoundsCheck ? 'pass' : 'fail',
      message: hasBoundsCheck ? 'Bounds checks present' : 'Missing bounds checks',
    };
  }

  private async checkTypeSafety(context: ProverContext): Promise<PropertyResult> {
    const hasAny = /:\s*any\b/g.test(context.source);
    const hasUnknown = /:\s*unknown\b/g.test(context.source);

    return {
      property: 'type_safety',
      status: !hasAny ? 'pass' : 'fail',
      message: hasAny ? 'Unsafe "any" types found' : 'Type-safe',
    };
  }

  private async checkUnusedCode(context: ProverContext): Promise<PropertyResult> {
    const exports = context.source.match(/export\s+(function|class|const|let|var)\s+(\w+)/g);
    const hasExports = exports && exports.length > 0;

    return {
      property: 'unused_code',
      status: hasExports ? 'pass' : 'fail',
      message: hasExports ? 'Code is exported' : 'Potentially unused code',
    };
  }

  private async checkErrorHandling(context: ProverContext): Promise<PropertyResult> {
    const hasTryCatch = /try\s*\{[\s\S]*?\}\s*catch/g.test(context.source);
    const hasAsyncFunctions = /async\s+function/g.test(context.source);

    if (hasAsyncFunctions && !hasTryCatch) {
      return {
        property: 'error_handling',
        status: 'fail',
        message: 'Async functions without error handling',
      };
    }

    return {
      property: 'error_handling',
      status: hasTryCatch ? 'pass' : 'skip',
      message: hasTryCatch ? 'Error handling present' : 'No async functions',
    };
  }

  private async checkInputValidation(context: ProverContext): Promise<PropertyResult> {
    const hasFunctionParams = /function\s+\w+\s*\([^)]+\)/g.test(context.source);
    const hasValidation = /if\s*\(/.test(context.source) || /throw\s+new\s+Error/g.test(context.source);

    if (!hasFunctionParams) {
      return { property: 'input_validation', status: 'skip', message: 'No function parameters' };
    }

    return {
      property: 'input_validation',
      status: hasValidation ? 'pass' : 'fail',
      message: hasValidation ? 'Input validation present' : 'Missing input validation',
    };
  }

  private async checkResourceLeaks(context: ProverContext): Promise<PropertyResult> {
    const hasFileOps = /fs\.(readFile|writeFile|createReadStream)/g.test(context.source);
    const hasCleanup = /\.close\(\)|finally\s*\{/g.test(context.source);

    if (!hasFileOps) {
      return { property: 'resource_leaks', status: 'skip', message: 'No resource usage' };
    }

    return {
      property: 'resource_leaks',
      status: hasCleanup ? 'pass' : 'fail',
      message: hasCleanup ? 'Resource cleanup present' : 'Potential resource leak',
    };
  }
}
