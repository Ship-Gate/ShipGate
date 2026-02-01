// ============================================================================
// SDK Generator - Main
// ============================================================================

import type { Domain, SDKOptions, GeneratedFile } from './types';
import { generateTypeScript } from './languages/typescript';
import { generatePython } from './languages/python';
import { generateGo } from './languages/go';

export function generate(domain: Domain, options: SDKOptions): GeneratedFile[] {
  return generateSDK(domain, options);
}

export function generateSDK(domain: Domain, options: SDKOptions): GeneratedFile[] {
  const { language } = options;

  switch (language) {
    case 'typescript':
      return generateTypeScript(domain, options);
    case 'python':
      return generatePython(domain, options);
    case 'go':
      return generateGo(domain, options);
    default:
      throw new Error(`Unknown language: ${language}`);
  }
}
