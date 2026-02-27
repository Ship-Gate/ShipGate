// ============================================================================
// Documentation Generator - Main
// ============================================================================

import type { Domain, DocOptions, GeneratedFile } from './types';
import { generateMarkdown } from './formats/markdown';
import { generateHTML } from './formats/html';
import { generateOpenAPI } from './formats/openapi';

export function generate(domain: Domain, options: DocOptions): GeneratedFile[] {
  return generateDocs(domain, options);
}

export function generateDocs(domain: Domain, options: DocOptions): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const { format, outputDir } = options;

  if (format === 'markdown' || format === 'all') {
    files.push(...generateMarkdown(domain, { ...options, outputDir: `${outputDir}/markdown` }));
  }

  if (format === 'html' || format === 'all') {
    files.push(...generateHTML(domain, { ...options, outputDir: `${outputDir}/html` }));
  }

  if (format === 'openapi' || format === 'all') {
    files.push(...generateOpenAPI(domain, { ...options, outputDir: `${outputDir}/openapi` }));
  }

  return files;
}
