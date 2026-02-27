/**
 * Code Extraction from LLM Responses
 * 
 * Extracts and cleans code blocks from AI-generated responses.
 */

export interface ExtractedCode {
  code: string;
  language: string;
  raw: string;
  confidence: number;
}

export interface ExtractionOptions {
  expectedLanguage?: string;
  allowMultiple?: boolean;
  stripImports?: boolean;
  stripTypes?: boolean;
}

/**
 * Extract code from an LLM response
 */
export function extractCode(
  response: string, 
  options: ExtractionOptions = {}
): ExtractedCode {
  const { 
    expectedLanguage = 'typescript',
    stripImports = false,
    stripTypes = false 
  } = options;

  // Try to find code blocks in order of preference
  const extracted = 
    extractMarkdownCodeBlock(response, expectedLanguage) ??
    extractIndentedCodeBlock(response) ??
    extractRawCode(response);

  if (!extracted) {
    throw new ExtractionError('No code found in response', response);
  }

  let code = extracted.code;
  const confidence = calculateConfidence(code, expectedLanguage);

  // Post-process the code
  if (stripImports) {
    code = removeImports(code);
  }
  
  if (stripTypes) {
    code = removeTypeDefinitions(code);
  }

  code = cleanCode(code);

  return {
    code,
    language: extracted.language,
    raw: response,
    confidence,
  };
}

/**
 * Extract multiple code blocks from a response
 */
export function extractMultipleCodeBlocks(
  response: string,
  options: ExtractionOptions = {}
): ExtractedCode[] {
  const { expectedLanguage = 'typescript' } = options;
  const blocks: ExtractedCode[] = [];

  // Match all markdown code blocks
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  let match;

  while ((match = codeBlockRegex.exec(response)) !== null) {
    const language = match[1] || expectedLanguage;
    const code = match[2]!.trim();
    const confidence = calculateConfidence(code, expectedLanguage);

    blocks.push({
      code: cleanCode(code),
      language,
      raw: match[0],
      confidence,
    });
  }

  // If no markdown blocks found, try to extract as single block
  if (blocks.length === 0) {
    const single = extractCode(response, options);
    if (single) {
      blocks.push(single);
    }
  }

  return blocks;
}

/**
 * Extract the primary implementation code (highest confidence)
 */
export function extractPrimaryCode(
  response: string,
  expectedLanguage: string = 'typescript'
): ExtractedCode {
  const blocks = extractMultipleCodeBlocks(response, { expectedLanguage });
  
  if (blocks.length === 0) {
    throw new ExtractionError('No code blocks found in response', response);
  }

  // Sort by confidence (descending) and return the best match
  blocks.sort((a, b) => b.confidence - a.confidence);
  
  return blocks[0]!;
}

/**
 * Extract code from markdown code blocks
 */
function extractMarkdownCodeBlock(
  response: string, 
  expectedLanguage: string
): { code: string; language: string } | null {
  // Try exact language match first
  const exactMatch = new RegExp(
    `\`\`\`${expectedLanguage}\\s*\\n([\\s\\S]*?)\`\`\``,
    'i'
  ).exec(response);
  
  if (exactMatch) {
    return { code: exactMatch[1]!.trim(), language: expectedLanguage };
  }

  // Try common aliases
  const aliases: Record<string, string[]> = {
    'typescript': ['ts', 'typescript', 'tsx'],
    'javascript': ['js', 'javascript', 'jsx'],
    'python': ['py', 'python'],
  };

  const languageAliases = aliases[expectedLanguage.toLowerCase()] ?? [expectedLanguage];
  
  for (const alias of languageAliases) {
    const match = new RegExp(
      `\`\`\`${alias}\\s*\\n([\\s\\S]*?)\`\`\``,
      'i'
    ).exec(response);
    
    if (match) {
      return { code: match[1]!.trim(), language: expectedLanguage };
    }
  }

  // Try any code block
  const anyMatch = /```(\w*)\n([\s\S]*?)```/.exec(response);
  if (anyMatch) {
    return { 
      code: anyMatch[2]!.trim(), 
      language: anyMatch[1] || expectedLanguage 
    };
  }

  return null;
}

/**
 * Extract indented code blocks (4+ spaces)
 */
function extractIndentedCodeBlock(response: string): { code: string; language: string } | null {
  const lines = response.split('\n');
  const codeLines: string[] = [];
  let inCodeBlock = false;

  for (const line of lines) {
    if (/^    /.test(line) || /^\t/.test(line)) {
      inCodeBlock = true;
      codeLines.push(line.replace(/^    |\t/, ''));
    } else if (inCodeBlock && line.trim() === '') {
      codeLines.push('');
    } else if (inCodeBlock) {
      break;
    }
  }

  if (codeLines.length > 0) {
    return { code: codeLines.join('\n').trim(), language: 'unknown' };
  }

  return null;
}

/**
 * Extract raw code (assume entire response is code)
 */
function extractRawCode(response: string): { code: string; language: string } | null {
  const trimmed = response.trim();
  
  // Check if it looks like code
  if (looksLikeCode(trimmed)) {
    return { code: trimmed, language: 'unknown' };
  }

  return null;
}

/**
 * Check if text looks like code
 */
function looksLikeCode(text: string): boolean {
  const codeIndicators = [
    /^(export|import|const|let|var|function|class|interface|type|async|await)\s/m,
    /^(def|class|import|from|async)\s/m, // Python
    /\{[\s\S]*\}/,
    /=>/,
    /\(\s*\)\s*{/,
    /;\s*$/m,
  ];

  return codeIndicators.some(pattern => pattern.test(text));
}

/**
 * Calculate confidence score for extracted code
 */
function calculateConfidence(code: string, expectedLanguage: string): number {
  let score = 0.5; // Base score

  // Check for language-specific indicators
  const tsIndicators = [
    /: (string|number|boolean|void|any|unknown)/,
    /interface\s+\w+/,
    /type\s+\w+\s*=/,
    /async function/,
    /Promise</,
    /export (function|const|class|interface|type)/,
  ];

  const jsIndicators = [
    /async function/,
    /Promise\./,
    /export (function|const|class)/,
    /=>/,
  ];

  const pyIndicators = [
    /def\s+\w+\s*\(/,
    /async def/,
    /class\s+\w+:/,
    /import\s+\w+/,
    /from\s+\w+\s+import/,
  ];

  const indicators = expectedLanguage.toLowerCase().includes('typescript') 
    ? tsIndicators
    : expectedLanguage.toLowerCase().includes('python')
    ? pyIndicators
    : jsIndicators;

  for (const pattern of indicators) {
    if (pattern.test(code)) {
      score += 0.1;
    }
  }

  // Penalize for obvious issues
  if (code.includes('TODO') || code.includes('FIXME')) {
    score -= 0.1;
  }
  
  if (code.includes('// ...') || code.includes('# ...')) {
    score -= 0.15;
  }

  // Check for proper structure
  const braceCount = (code.match(/\{/g) ?? []).length;
  const closeBraceCount = (code.match(/\}/g) ?? []).length;
  if (braceCount !== closeBraceCount) {
    score -= 0.2;
  }

  // Check for exports (good sign for implementation)
  if (/export\s+(function|const|class|async function)/.test(code)) {
    score += 0.15;
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Remove import statements from code
 */
function removeImports(code: string): string {
  const lines = code.split('\n');
  const filtered = lines.filter(line => {
    const trimmed = line.trim();
    return !trimmed.startsWith('import ') && 
           !trimmed.startsWith('from ') &&
           !trimmed.startsWith('require(');
  });
  return filtered.join('\n');
}

/**
 * Remove type definitions from code
 */
function removeTypeDefinitions(code: string): string {
  const lines = code.split('\n');
  const filtered: string[] = [];
  let inTypeBlock = false;
  let braceDepth = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Start of type/interface block
    if (/^(export\s+)?(type|interface)\s+\w+/.test(trimmed)) {
      inTypeBlock = true;
      braceDepth = 0;
    }

    if (inTypeBlock) {
      braceDepth += (line.match(/\{/g) ?? []).length;
      braceDepth -= (line.match(/\}/g) ?? []).length;
      
      if (braceDepth <= 0 && trimmed.endsWith('}') || trimmed.endsWith(';')) {
        inTypeBlock = false;
      }
      continue;
    }

    filtered.push(line);
  }

  return filtered.join('\n');
}

/**
 * Clean and normalize extracted code
 */
function cleanCode(code: string): string {
  let cleaned = code;

  // Remove leading/trailing whitespace
  cleaned = cleaned.trim();

  // Normalize line endings
  cleaned = cleaned.replace(/\r\n/g, '\n');

  // Remove excessive blank lines (more than 2 consecutive)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // Remove trailing whitespace from lines
  cleaned = cleaned.split('\n')
    .map(line => line.trimEnd())
    .join('\n');

  return cleaned;
}

/**
 * Custom error for extraction failures
 */
export class ExtractionError extends Error {
  constructor(
    message: string,
    public readonly rawResponse: string
  ) {
    super(message);
    this.name = 'ExtractionError';
  }
}

/**
 * Validate that extracted code appears complete
 */
export function validateExtraction(extracted: ExtractedCode): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check for balanced braces/brackets
  const openBraces = (extracted.code.match(/\{/g) ?? []).length;
  const closeBraces = (extracted.code.match(/\}/g) ?? []).length;
  if (openBraces !== closeBraces) {
    issues.push(`Unbalanced braces: ${openBraces} open, ${closeBraces} close`);
  }

  const openParens = (extracted.code.match(/\(/g) ?? []).length;
  const closeParens = (extracted.code.match(/\)/g) ?? []).length;
  if (openParens !== closeParens) {
    issues.push(`Unbalanced parentheses: ${openParens} open, ${closeParens} close`);
  }

  // Check for truncation indicators
  if (extracted.code.includes('// ...') || extracted.code.includes('/* ... */')) {
    issues.push('Code appears truncated (contains placeholder comments)');
  }

  // Check for obvious incomplete code
  if (extracted.code.endsWith(',') || extracted.code.endsWith('(')) {
    issues.push('Code appears incomplete (ends with comma or open paren)');
  }

  // Check for export statement
  if (!extracted.code.includes('export')) {
    issues.push('No export statement found');
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
