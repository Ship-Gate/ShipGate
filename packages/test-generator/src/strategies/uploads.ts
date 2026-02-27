// ============================================================================
// Uploads Domain Strategy
// Generates assertions for file upload behaviors
// ============================================================================

import type * as AST from '@isl-lang/parser';
import { BaseDomainStrategy } from './base';
import type {
  DomainType,
  GeneratedAssertion,
  StrategyContext,
} from '../types';

/**
 * Strategy for generating file upload domain tests
 * 
 * Supported patterns:
 * - File type preconditions
 * - File size preconditions
 * - result.url != null
 * - Content type validation
 */
export class UploadsStrategy extends BaseDomainStrategy {
  domain: DomainType = 'uploads';

  matches(behavior: AST.Behavior, domain: AST.Domain): boolean {
    // Check domain name
    if (this.domainNameMatches(domain, ['upload', 'file', 'storage', 'media', 'asset'])) {
      return true;
    }

    // Check behavior name patterns
    if (this.behaviorNameMatches(behavior, [
      'upload', 'download', 'file', 'image', 'video', 'document',
      'attachment', 'media', 'asset', 'blob', 'storage'
    ])) {
      return true;
    }

    // Check for upload-related input fields
    const inputFields = behavior.input.fields.map(f => f.name.name.toLowerCase());
    return inputFields.some(f => 
      ['file', 'content', 'data', 'mime_type', 'content_type', 'filename'].includes(f)
    );
  }

  generatePreconditionAssertions(
    precondition: AST.Expression,
    behavior: AST.Behavior,
    _context: StrategyContext
  ): GeneratedAssertion[] {
    const assertions: GeneratedAssertion[] = [];

    // Pattern: file type/mime type validation
    if (this.isFileTypeValidation(precondition)) {
      assertions.push(this.supported(
        `const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];\nexpect(allowedTypes).toContain(input.content_type);`,
        'File type must be in allowed list',
        'upload.file_type'
      ));

      assertions.push(this.supported(
        `const invalidTypeInput = { ...validInput, content_type: 'application/x-malicious' };\nconst result = await ${behavior.name.name}(invalidTypeInput);\nexpect(result.success).toBe(false);\nexpect(result.error).toBe('INVALID_FILE_TYPE');`,
        'Should reject invalid file types',
        'upload.file_type'
      ));
    }

    // Pattern: file size validation
    if (this.isFileSizeValidation(precondition)) {
      const maxSize = this.extractMaxSize(precondition);
      assertions.push(this.supported(
        `expect(input.file.size).toBeLessThanOrEqual(${maxSize || '10 * 1024 * 1024'});`,
        `File size must not exceed ${maxSize ? this.formatSize(maxSize) : '10MB'}`,
        'upload.file_size'
      ));

      assertions.push(this.supported(
        `const largeFileInput = { ...validInput, file: { ...validInput.file, size: ${(maxSize || 10 * 1024 * 1024) + 1} } };\nconst result = await ${behavior.name.name}(largeFileInput);\nexpect(result.success).toBe(false);\nexpect(result.error).toBe('FILE_TOO_LARGE');`,
        'Should reject files exceeding size limit',
        'upload.file_size'
      ));
    }

    // Pattern: filename validation
    if (this.isFilenameValidation(precondition)) {
      assertions.push(this.supported(
        `expect(input.filename).toBeDefined();\nexpect(input.filename.length).toBeGreaterThan(0);`,
        'Filename must be provided',
        'upload.file_type'
      ));

      assertions.push(this.supported(
        `// Check for dangerous filenames\nconst dangerousFilenames = ['../../../etc/passwd', 'shell.php', '<script>.jpg'];\nfor (const dangerous of dangerousFilenames) {\n  const result = await ${behavior.name.name}({ ...validInput, filename: dangerous });\n  expect(result.success).toBe(false);\n}`,
        'Should reject dangerous filenames',
        'upload.file_type'
      ));
    }

    // Pattern: content type header matches file extension
    if (this.isContentTypeExtensionMatch(precondition)) {
      assertions.push(this.supported(
        `const extension = input.filename.split('.').pop()?.toLowerCase();\nconst expectedTypes: Record<string, string[]> = {\n  'jpg': ['image/jpeg'],\n  'jpeg': ['image/jpeg'],\n  'png': ['image/png'],\n  'gif': ['image/gif'],\n  'pdf': ['application/pdf'],\n};\nif (extension && expectedTypes[extension]) {\n  expect(expectedTypes[extension]).toContain(input.content_type);\n}`,
        'Content type should match file extension',
        'upload.content_type'
      ));
    }

    // Pattern: file not empty
    if (this.isFileNotEmpty(precondition)) {
      assertions.push(this.supported(
        `expect(input.file.size).toBeGreaterThan(0);`,
        'File must not be empty',
        'upload.file_size'
      ));

      assertions.push(this.supported(
        `const emptyFileInput = { ...validInput, file: { ...validInput.file, size: 0 } };\nconst result = await ${behavior.name.name}(emptyFileInput);\nexpect(result.success).toBe(false);\nexpect(result.error).toBe('EMPTY_FILE');`,
        'Should reject empty files',
        'upload.file_size'
      ));
    }

    // Generic precondition if no specific pattern matched
    if (assertions.length === 0) {
      const exprStr = this.compileExpr(precondition);
      assertions.push(this.supported(
        `expect(${exprStr}).toBe(true);`,
        `Precondition: ${exprStr}`,
        'generic.precondition'
      ));
    }

    return assertions;
  }

  generatePostconditionAssertions(
    postcondition: AST.PostconditionBlock,
    _behavior: AST.Behavior,
    _context: StrategyContext
  ): GeneratedAssertion[] {
    const assertions: GeneratedAssertion[] = [];
    const condition = this.getConditionName(postcondition.condition);

    for (const predicate of postcondition.predicates) {
      // Pattern: result.url != null
      if (this.isUrlPresent(predicate)) {
        assertions.push(this.supported(
          `expect(result.url).toBeDefined();\nexpect(result.url).not.toBeNull();\nexpect(typeof result.url).toBe('string');\nexpect(result.url.length).toBeGreaterThan(0);`,
          'Result should contain valid URL',
          'upload.result_url'
        ));

        assertions.push(this.supported(
          `// Validate URL format\nexpect(() => new URL(result.url)).not.toThrow();`,
          'URL should be valid format',
          'upload.result_url'
        ));

        assertions.push(this.supported(
          `// Optionally verify URL is accessible\n// const response = await fetch(result.url, { method: 'HEAD' });\n// expect(response.ok).toBe(true);`,
          'URL should be accessible (optional integration test)',
          'upload.result_url'
        ));
      }

      // Pattern: file record created
      if (this.isFileRecordCreated(predicate)) {
        assertions.push(this.supported(
          `expect(result.id).toBeDefined();\nconst uploadedFile = await File.findById(result.id);\nexpect(uploadedFile).toBeDefined();`,
          'File record should be persisted',
          'generic.postcondition'
        ));
      }

      // Pattern: content type preserved
      if (this.isContentTypePreserved(predicate)) {
        assertions.push(this.supported(
          `expect(result.content_type).toEqual(input.content_type);`,
          'Content type should be preserved',
          'upload.content_type'
        ));
      }

      // Pattern: size matches
      if (this.isSizeMatch(predicate)) {
        assertions.push(this.supported(
          `expect(result.size).toEqual(input.file.size);`,
          'File size should match input',
          'upload.file_size'
        ));
      }

      // Pattern: filename sanitized
      if (this.isFilenameSanitized(predicate)) {
        assertions.push(this.supported(
          `expect(result.filename).toBeDefined();\n// Filename should be sanitized (no path traversal, safe characters)\nexpect(result.filename).not.toMatch(/[\\\\/<>:"|?*]/);`,
          'Filename should be sanitized',
          'upload.file_type'
        ));
      }

      // Pattern: checksum/hash generated
      if (this.isChecksumGenerated(predicate)) {
        assertions.push(this.supported(
          `expect(result.checksum).toBeDefined();\nexpect(result.checksum.length).toBeGreaterThan(0);`,
          'Checksum should be generated',
          'generic.postcondition'
        ));
      }
    }

    // If no specific patterns matched, generate generic assertions
    if (assertions.length === 0) {
      for (const predicate of postcondition.predicates) {
        const exprStr = this.compileExpr(predicate);
        assertions.push(this.supported(
          `expect(${exprStr}).toBe(true);`,
          `Postcondition (${condition}): ${this.truncate(exprStr, 50)}`,
          'generic.postcondition'
        ));
      }
    }

    return assertions;
  }

  generateErrorAssertions(
    errorSpec: AST.ErrorSpec,
    behavior: AST.Behavior,
    _context: StrategyContext
  ): GeneratedAssertion[] {
    const assertions: GeneratedAssertion[] = [];
    const errorName = errorSpec.name.name;
    const when = errorSpec.when?.value || 'specific conditions';

    switch (errorName) {
      case 'INVALID_FILE_TYPE':
      case 'UNSUPPORTED_FILE_TYPE':
        assertions.push(this.supported(
          `const invalidTypeInput = { ...validInput, content_type: 'application/x-executable' };\nconst result = await ${behavior.name.name}(invalidTypeInput);\nexpect(result.success).toBe(false);\nexpect(result.error).toBe('${errorName}');\nexpect(result.retriable).toBe(false);`,
          `Should return ${errorName} for unsupported file types`,
          'upload.file_type'
        ));
        break;

      case 'FILE_TOO_LARGE':
        assertions.push(this.supported(
          `const largeFileInput = { ...validInput, file: { size: 100 * 1024 * 1024, data: Buffer.alloc(0) } };\nconst result = await ${behavior.name.name}(largeFileInput);\nexpect(result.success).toBe(false);\nexpect(result.error).toBe('FILE_TOO_LARGE');\nexpect(result.retriable).toBe(false);`,
          'Should return FILE_TOO_LARGE for oversized files',
          'upload.file_size'
        ));
        break;

      case 'EMPTY_FILE':
        assertions.push(this.supported(
          `const emptyFileInput = { ...validInput, file: { size: 0, data: Buffer.alloc(0) } };\nconst result = await ${behavior.name.name}(emptyFileInput);\nexpect(result.success).toBe(false);\nexpect(result.error).toBe('EMPTY_FILE');`,
          'Should return EMPTY_FILE for zero-byte files',
          'upload.file_size'
        ));
        break;

      case 'STORAGE_FULL':
      case 'QUOTA_EXCEEDED':
        assertions.push(this.supported(
          `// Mock storage to return full\nconst result = await ${behavior.name.name}(validInput);\nexpect(result.success).toBe(false);\nexpect(result.error).toBe('${errorName}');\nexpect(result.retriable).toBe(true);`,
          `Should return ${errorName} when storage limit reached`,
          'upload.file_size'
        ));
        break;

      case 'VIRUS_DETECTED':
      case 'MALWARE_DETECTED':
        assertions.push(this.supported(
          `// File containing EICAR test signature\nconst maliciousInput = { ...validInput, file: { data: Buffer.from('X5O!P%@AP[4\\\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'), size: 68 } };\nconst result = await ${behavior.name.name}(maliciousInput);\nexpect(result.success).toBe(false);\nexpect(result.error).toBe('${errorName}');`,
          `Should return ${errorName} for malicious files`,
          'upload.file_type'
        ));
        break;

      case 'INVALID_FILENAME':
        assertions.push(this.supported(
          `const invalidFilenameInput = { ...validInput, filename: '../../../etc/passwd' };\nconst result = await ${behavior.name.name}(invalidFilenameInput);\nexpect(result.success).toBe(false);\nexpect(result.error).toBe('INVALID_FILENAME');`,
          'Should return INVALID_FILENAME for path traversal attempts',
          'upload.file_type'
        ));
        break;

      default:
        assertions.push(this.supported(
          `const result = await ${behavior.name.name}(inputFor${errorName}());\nexpect(result.success).toBe(false);\nexpect(result.error).toBe('${errorName}');\nexpect(result.retriable).toBe(${errorSpec.retriable});`,
          `Should return ${errorName} when ${when}`,
          'generic.postcondition'
        ));
    }

    return assertions;
  }

  // ============================================================================
  // PATTERN DETECTION HELPERS
  // ============================================================================

  private isFileTypeValidation(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return (str.includes('type') || str.includes('mime') || str.includes('content_type')) &&
           (str.includes('in') || str.includes('allowed') || str.includes('valid'));
  }

  private isFileSizeValidation(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('size') && (str.includes('<') || str.includes('<=') || str.includes('max'));
  }

  private extractMaxSize(expr: AST.Expression): number | null {
    if (expr.kind === 'BinaryExpr' && expr.right.kind === 'NumberLiteral') {
      return expr.right.value;
    }
    return null;
  }

  private formatSize(bytes: number): string {
    if (bytes >= 1024 * 1024 * 1024) return `${Math.round(bytes / (1024 * 1024 * 1024))}GB`;
    if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))}MB`;
    if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
    return `${bytes}B`;
  }

  private isFilenameValidation(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('filename') && (str.includes('length') || str.includes('valid'));
  }

  private isContentTypeExtensionMatch(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('content_type') && str.includes('extension');
  }

  private isFileNotEmpty(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('size') && str.includes('> 0');
  }

  private isUrlPresent(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('url') && (str.includes('result') || str.includes('!= null') || str.includes('!== null'));
  }

  private isFileRecordCreated(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('file') && str.includes('exists');
  }

  private isContentTypePreserved(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('content_type') && str.includes('input');
  }

  private isSizeMatch(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('size') && str.includes('input') && str.includes('result');
  }

  private isFilenameSanitized(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('filename') && str.includes('result');
  }

  private isChecksumGenerated(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('checksum') || str.includes('hash') || str.includes('md5') || str.includes('sha');
  }

  private getConditionName(condition: AST.Identifier | 'success' | 'any_error'): string {
    if (condition === 'success') return 'success';
    if (condition === 'any_error') return 'any error';
    return condition.name;
  }

  private truncate(str: string, maxLen: number): string {
    return str.length > maxLen ? str.substring(0, maxLen - 3) + '...' : str;
  }
}
