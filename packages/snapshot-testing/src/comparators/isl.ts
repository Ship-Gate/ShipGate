/**
 * ISL-Aware Comparator
 * 
 * Specialized comparison for ISL domain specifications.
 * Understands ISL structure and provides semantic comparison.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** ISL comparison options */
export interface IslCompareOptions {
  /** Ignore whitespace differences */
  ignoreWhitespace?: boolean;
  /** Ignore comment differences */
  ignoreComments?: boolean;
  /** Ignore field/property ordering */
  ignoreOrdering?: boolean;
  /** Ignore version differences */
  ignoreVersion?: boolean;
  /** Custom entity comparator */
  entityComparator?: (name: string, expected: string, actual: string) => boolean;
  /** Custom behavior comparator */
  behaviorComparator?: (name: string, expected: string, actual: string) => boolean;
}

/** ISL element type */
export type IslElementType = 
  | 'domain' 
  | 'entity' 
  | 'enum' 
  | 'type' 
  | 'behavior' 
  | 'invariant' 
  | 'scenario'
  | 'comment'
  | 'unknown';

/** Parsed ISL element */
export interface IslElement {
  type: IslElementType;
  name: string;
  content: string;
  startLine: number;
  endLine: number;
}

/** ISL difference */
export interface IslDiff {
  type: 'added' | 'removed' | 'changed';
  elementType: IslElementType;
  name: string;
  expected?: string;
  actual?: string;
  details?: string;
}

/** ISL comparison result */
export interface IslCompareResult {
  match: boolean;
  differences: IslDiff[];
  structuralChanges: boolean;
  semanticChanges: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// ISL Parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Remove comments from ISL content
 */
export function removeComments(content: string): string {
  // Remove single-line comments
  let result = content.replace(/\/\/.*$/gm, '');
  
  // Remove multi-line comments
  result = result.replace(/\/\*[\s\S]*?\*\//g, '');
  
  // Remove doc comments
  result = result.replace(/\/\*\*[\s\S]*?\*\//g, '');
  
  return result;
}

/**
 * Normalize whitespace in ISL content
 */
export function normalizeWhitespace(content: string): string {
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
}

/**
 * Extract domain name from ISL content
 */
export function extractDomainName(content: string): string | null {
  const match = content.match(/domain\s+(\w+)\s*\{/);
  return match ? match[1] : null;
}

/**
 * Extract version from ISL content
 */
export function extractVersion(content: string): string | null {
  const match = content.match(/version:\s*["']([^"']+)["']/);
  return match ? match[1] : null;
}

/**
 * Parse ISL content into elements
 */
export function parseIslElements(content: string): IslElement[] {
  const elements: IslElement[] = [];
  const lines = content.split('\n');
  
  let currentElement: Partial<IslElement> | null = null;
  let braceDepth = 0;
  let contentLines: string[] = [];
  let startLine = 0;

  const elementPatterns: Array<{ pattern: RegExp; type: IslElementType }> = [
    { pattern: /^\s*domain\s+(\w+)\s*\{/, type: 'domain' },
    { pattern: /^\s*entity\s+(\w+)/, type: 'entity' },
    { pattern: /^\s*enum\s+(\w+)/, type: 'enum' },
    { pattern: /^\s*type\s+(\w+)/, type: 'type' },
    { pattern: /^\s*behavior\s+(\w+)/, type: 'behavior' },
    { pattern: /^\s*invariant\s+["']?([^"'{]+)["']?\s*\{/, type: 'invariant' },
    { pattern: /^\s*scenario\s+["']([^"']+)["']\s*\{/, type: 'scenario' },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines and comments when looking for elements
    if (trimmed === '' || trimmed.startsWith('//')) continue;

    // Check for new element start
    if (currentElement === null) {
      for (const { pattern, type } of elementPatterns) {
        const match = line.match(pattern);
        if (match) {
          currentElement = {
            type,
            name: match[1].trim(),
          };
          startLine = i;
          braceDepth = 0;
          contentLines = [];
          break;
        }
      }
    }

    if (currentElement) {
      contentLines.push(line);
      
      // Count braces
      for (const char of line) {
        if (char === '{') braceDepth++;
        if (char === '}') braceDepth--;
      }

      // Element complete when braces are balanced
      if (braceDepth === 0 && contentLines.length > 0) {
        elements.push({
          type: currentElement.type!,
          name: currentElement.name!,
          content: contentLines.join('\n'),
          startLine,
          endLine: i,
        });
        currentElement = null;
        contentLines = [];
      }
    }
  }

  return elements;
}

/**
 * Extract element by type and name
 */
export function extractElement(
  elements: IslElement[],
  type: IslElementType,
  name: string
): IslElement | undefined {
  return elements.find(e => e.type === type && e.name === name);
}

// ─────────────────────────────────────────────────────────────────────────────
// Comparison Logic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compare two ISL elements
 */
function compareElement(
  expected: IslElement,
  actual: IslElement,
  options: IslCompareOptions
): boolean {
  let expectedContent = expected.content;
  let actualContent = actual.content;

  if (options.ignoreComments) {
    expectedContent = removeComments(expectedContent);
    actualContent = removeComments(actualContent);
  }

  if (options.ignoreWhitespace) {
    expectedContent = normalizeWhitespace(expectedContent);
    actualContent = normalizeWhitespace(actualContent);
  }

  // Use custom comparators if provided
  if (expected.type === 'entity' && options.entityComparator) {
    return options.entityComparator(expected.name, expectedContent, actualContent);
  }

  if (expected.type === 'behavior' && options.behaviorComparator) {
    return options.behaviorComparator(expected.name, expectedContent, actualContent);
  }

  return expectedContent === actualContent;
}

/**
 * Compare two ISL specifications
 */
export function compareIsl(
  expected: string,
  actual: string,
  options: IslCompareOptions = {}
): IslCompareResult {
  const differences: IslDiff[] = [];
  let structuralChanges = false;
  let semanticChanges = false;

  // Compare domain names
  const expectedDomain = extractDomainName(expected);
  const actualDomain = extractDomainName(actual);
  
  if (expectedDomain !== actualDomain) {
    differences.push({
      type: 'changed',
      elementType: 'domain',
      name: expectedDomain ?? 'unknown',
      expected: expectedDomain ?? undefined,
      actual: actualDomain ?? undefined,
      details: 'Domain name changed',
    });
    structuralChanges = true;
  }

  // Compare versions (unless ignored)
  if (!options.ignoreVersion) {
    const expectedVersion = extractVersion(expected);
    const actualVersion = extractVersion(actual);
    
    if (expectedVersion !== actualVersion) {
      differences.push({
        type: 'changed',
        elementType: 'domain',
        name: 'version',
        expected: expectedVersion ?? undefined,
        actual: actualVersion ?? undefined,
        details: 'Version changed',
      });
    }
  }

  // Parse elements
  const expectedElements = parseIslElements(expected);
  const actualElements = parseIslElements(actual);

  // Build maps
  const expectedMap = new Map(expectedElements.map(e => [`${e.type}:${e.name}`, e]));
  const actualMap = new Map(actualElements.map(e => [`${e.type}:${e.name}`, e]));

  // Find removed elements
  for (const [key, element] of expectedMap) {
    if (!actualMap.has(key)) {
      differences.push({
        type: 'removed',
        elementType: element.type,
        name: element.name,
        expected: element.content,
      });
      
      if (['entity', 'behavior', 'enum'].includes(element.type)) {
        structuralChanges = true;
      }
    }
  }

  // Find added elements
  for (const [key, element] of actualMap) {
    if (!expectedMap.has(key)) {
      differences.push({
        type: 'added',
        elementType: element.type,
        name: element.name,
        actual: element.content,
      });
      
      if (['entity', 'behavior', 'enum'].includes(element.type)) {
        structuralChanges = true;
      }
    }
  }

  // Compare existing elements
  for (const [key, expectedElement] of expectedMap) {
    const actualElement = actualMap.get(key);
    if (!actualElement) continue;

    if (!compareElement(expectedElement, actualElement, options)) {
      differences.push({
        type: 'changed',
        elementType: expectedElement.type,
        name: expectedElement.name,
        expected: expectedElement.content,
        actual: actualElement.content,
      });
      
      // Determine if semantic change
      if (['behavior', 'invariant', 'scenario'].includes(expectedElement.type)) {
        semanticChanges = true;
      }
    }
  }

  return {
    match: differences.length === 0,
    differences,
    structuralChanges,
    semanticChanges,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ISL Serializer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize ISL for snapshot storage
 */
export function normalizeIsl(content: string, options: IslCompareOptions = {}): string {
  let normalized = content;

  if (options.ignoreComments) {
    normalized = removeComments(normalized);
  }

  if (options.ignoreWhitespace) {
    normalized = normalizeWhitespace(normalized);
  }

  return normalized;
}

/**
 * Create ISL serializer with options
 */
export function createIslSerializer(options: IslCompareOptions = {}): (value: unknown) => string {
  return (value: unknown) => {
    if (typeof value !== 'string') {
      throw new Error('ISL serializer expects string input');
    }
    return normalizeIsl(value, options);
  };
}

/**
 * Create ISL comparator with options
 */
export function createIslComparator(options: IslCompareOptions = {}): (expected: string, actual: string) => boolean {
  return (expected: string, actual: string) => {
    const result = compareIsl(expected, actual, options);
    return result.match;
  };
}
