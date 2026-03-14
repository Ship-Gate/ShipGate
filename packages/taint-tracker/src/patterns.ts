import type { TaintSourceCategory, TaintSinkCategory, SanitizerMethod } from './model.js';

export interface SourcePattern {
  pattern: RegExp | string;
  category: TaintSourceCategory;
  description: string;
}

export interface SinkPattern {
  pattern: RegExp | string;
  category: TaintSinkCategory;
  severity: 'critical' | 'high' | 'medium';
  description: string;
}

export interface SanitizerPattern {
  pattern: RegExp | string;
  method: SanitizerMethod;
  sanitizes: TaintSinkCategory[];
  description: string;
}

export const SOURCE_PATTERNS: SourcePattern[] = [
  { pattern: 'req.body', category: 'user-input', description: 'Request body data' },
  { pattern: 'req.query', category: 'user-input', description: 'URL query parameters' },
  { pattern: 'req.params', category: 'user-input', description: 'URL path parameters' },
  { pattern: 'req.headers', category: 'user-input', description: 'HTTP request headers' },
  { pattern: 'request.body', category: 'user-input', description: 'Request body data' },
  { pattern: 'request.query', category: 'user-input', description: 'URL query parameters' },
  { pattern: 'request.params', category: 'user-input', description: 'URL path parameters' },
  { pattern: 'request.headers', category: 'user-input', description: 'HTTP request headers' },
  { pattern: 'ctx.request.body', category: 'user-input', description: 'Koa request body' },
  { pattern: 'ctx.query', category: 'user-input', description: 'Koa query parameters' },

  { pattern: 'process.env', category: 'environment', description: 'Environment variable' },

  { pattern: /\bfs\.readFile\b/, category: 'file-system', description: 'Async file read' },
  { pattern: /\bfs\.readFileSync\b/, category: 'file-system', description: 'Synchronous file read' },
  { pattern: /\breadFileSync\b/, category: 'file-system', description: 'Synchronous file read' },
  { pattern: /\breadFile\b/, category: 'file-system', description: 'File read operation' },

  { pattern: /\bfetch\(/, category: 'external-api', description: 'Fetch API call' },
  { pattern: /\baxios\b/, category: 'external-api', description: 'Axios HTTP client' },
  { pattern: /\.json\(\)/, category: 'external-api', description: 'Parsed JSON response data' },
  { pattern: /\.text\(\)/, category: 'external-api', description: 'Response text data' },

  { pattern: /\.findOne\b/, category: 'database', description: 'Database findOne result' },
  { pattern: /\.findMany\b/, category: 'database', description: 'Database findMany results' },
  { pattern: /\.findFirst\b/, category: 'database', description: 'Database findFirst result' },
  { pattern: /\.findUnique\b/, category: 'database', description: 'Database findUnique result' },
];

export const SINK_PATTERNS: SinkPattern[] = [
  { pattern: /\.query\b/, category: 'sql-query', severity: 'critical', description: 'SQL query execution' },
  { pattern: /\.\$queryRaw\b/, category: 'sql-query', severity: 'critical', description: 'Prisma raw SQL query' },
  { pattern: /\.\$executeRaw\b/, category: 'sql-query', severity: 'critical', description: 'Prisma raw SQL execution' },
  { pattern: /\.raw\(/, category: 'sql-query', severity: 'critical', description: 'Raw SQL query' },

  { pattern: /\bexec\b/, category: 'shell-exec', severity: 'critical', description: 'Shell command execution' },
  { pattern: /\bexecSync\b/, category: 'shell-exec', severity: 'critical', description: 'Synchronous shell execution' },
  { pattern: /\bspawn\b/, category: 'shell-exec', severity: 'critical', description: 'Process spawn' },
  { pattern: /\bexecFile\b/, category: 'shell-exec', severity: 'critical', description: 'File execution' },

  { pattern: /\.innerHTML\b/, category: 'html-render', severity: 'high', description: 'innerHTML assignment' },
  { pattern: /dangerouslySetInnerHTML/, category: 'html-render', severity: 'high', description: 'React dangerouslySetInnerHTML' },
  { pattern: /document\.write\b/, category: 'html-render', severity: 'high', description: 'document.write' },

  { pattern: /\beval\b/, category: 'eval', severity: 'critical', description: 'eval() execution' },
  { pattern: /\bnew Function\b/, category: 'eval', severity: 'critical', description: 'Function constructor' },

  { pattern: /\bfs\.writeFile\b/, category: 'file-write', severity: 'high', description: 'Async file write' },
  { pattern: /\bfs\.writeFileSync\b/, category: 'file-write', severity: 'high', description: 'Synchronous file write' },

  { pattern: /\bres\.send\b/, category: 'http-response', severity: 'medium', description: 'HTTP response send' },
  { pattern: /\bres\.json\b/, category: 'http-response', severity: 'medium', description: 'JSON response' },
  { pattern: /\bres\.end\b/, category: 'http-response', severity: 'medium', description: 'HTTP response end' },
  { pattern: /\bres\.render\b/, category: 'http-response', severity: 'medium', description: 'Template render response' },
  { pattern: /\bres\.write\b/, category: 'http-response', severity: 'medium', description: 'HTTP response write' },

  { pattern: /\bconsole\.log\b/, category: 'log-output', severity: 'medium', description: 'Console log output' },
  { pattern: /\bconsole\.error\b/, category: 'log-output', severity: 'medium', description: 'Console error output' },
  { pattern: /\bconsole\.warn\b/, category: 'log-output', severity: 'medium', description: 'Console warn output' },
  { pattern: /\blogger\.\w+\b/, category: 'log-output', severity: 'medium', description: 'Logger output' },
];

export const SANITIZER_PATTERNS: SanitizerPattern[] = [
  {
    pattern: /\.parse\b/,
    method: 'validation',
    sanitizes: ['sql-query', 'shell-exec', 'html-render', 'eval'],
    description: 'Schema validation (zod/joi)',
  },
  {
    pattern: /\.validate\b/,
    method: 'validation',
    sanitizes: ['sql-query', 'shell-exec', 'html-render', 'eval'],
    description: 'Input validation (joi/yup)',
  },
  {
    pattern: /\bparseInt\b/,
    method: 'validation',
    sanitizes: ['sql-query', 'shell-exec', 'eval'],
    description: 'Integer parsing',
  },
  {
    pattern: /\bparseFloat\b/,
    method: 'validation',
    sanitizes: ['sql-query', 'shell-exec', 'eval'],
    description: 'Float parsing',
  },
  {
    pattern: /\bNumber\(/,
    method: 'validation',
    sanitizes: ['sql-query', 'shell-exec', 'eval'],
    description: 'Number conversion',
  },
  {
    pattern: /\bBoolean\(/,
    method: 'validation',
    sanitizes: ['sql-query', 'shell-exec', 'eval', 'html-render'],
    description: 'Boolean conversion',
  },

  {
    pattern: /validator\.escape\b/,
    method: 'escaping',
    sanitizes: ['html-render'],
    description: 'HTML escaping via validator.js',
  },
  {
    pattern: /DOMPurify\.sanitize\b/,
    method: 'escaping',
    sanitizes: ['html-render', 'eval'],
    description: 'DOMPurify HTML sanitization',
  },
  {
    pattern: /\.escapeHtml\b/,
    method: 'escaping',
    sanitizes: ['html-render'],
    description: 'HTML entity escaping',
  },
  {
    pattern: /\bsqlstring\.escape\b/,
    method: 'escaping',
    sanitizes: ['sql-query'],
    description: 'SQL string escaping',
  },

  {
    pattern: /\bencodeURIComponent\b/,
    method: 'encoding',
    sanitizes: ['html-render', 'http-response'],
    description: 'URI component encoding',
  },
  {
    pattern: /\bencodeURI\b/,
    method: 'encoding',
    sanitizes: ['html-render', 'http-response'],
    description: 'URI encoding',
  },
];
