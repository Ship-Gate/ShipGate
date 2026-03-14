import { mkdtemp, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

export type ProjectSize = 10 | 100 | 1000 | 10000;

export interface GeneratedProject {
  dir: string;
  files: string[];
}

const MODEL_NAMES = [
  'User', 'Product', 'Order', 'Payment', 'Invoice', 'Subscription',
  'Notification', 'Session', 'Audit', 'Setting', 'Team', 'Role',
  'Permission', 'Webhook', 'ApiKey', 'Event', 'Comment', 'Review',
  'Category', 'Tag', 'Media', 'Upload', 'Report', 'Dashboard',
  'Metric', 'Alert', 'Integration', 'Connection', 'Pipeline', 'Task',
];

const SERVICE_VERBS = [
  'create', 'update', 'delete', 'find', 'list', 'search',
  'validate', 'process', 'sync', 'export', 'import', 'archive',
  'restore', 'merge', 'split', 'transform', 'enrich', 'filter',
];

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

function pick<T>(arr: T[], idx: number): T {
  return arr[idx % arr.length];
}

function generateModelFile(name: string, idx: number): string {
  const fields = [
    `id: string;`,
    `createdAt: Date;`,
    `updatedAt: Date;`,
    `name: string;`,
    idx % 3 === 0 ? `email: string;` : `slug: string;`,
    idx % 2 === 0 ? `isActive: boolean;` : `status: 'active' | 'inactive' | 'pending';`,
    idx % 4 === 0 ? `metadata: Record<string, unknown>;` : `tags: string[];`,
    `version: number;`,
  ];

  const validationRules = idx % 2 === 0
    ? `
  static validate(data: Partial<${name}>): string[] {
    const errors: string[] = [];
    if (!data.name || data.name.trim().length === 0) {
      errors.push('Name is required');
    }
    if (data.name && data.name.length > 255) {
      errors.push('Name must be 255 characters or less');
    }
    ${idx % 3 === 0 ? `if (data.email && !data.email.includes('@')) {
      errors.push('Invalid email format');
    }` : `if (data.slug && !/^[a-z0-9-]+$/.test(data.slug)) {
      errors.push('Slug must contain only lowercase letters, numbers, and hyphens');
    }`}
    return errors;
  }`
    : '';

  return `export interface ${name} {
  ${fields.join('\n  ')}
}

export interface ${name}CreateInput {
  name: string;
  ${idx % 3 === 0 ? 'email: string;' : 'slug?: string;'}
  ${idx % 2 === 0 ? 'isActive?: boolean;' : "status?: 'active' | 'inactive' | 'pending';"}
}

export interface ${name}UpdateInput {
  name?: string;
  ${idx % 2 === 0 ? 'isActive?: boolean;' : "status?: 'active' | 'inactive' | 'pending';"}
  ${idx % 4 === 0 ? 'metadata?: Record<string, unknown>;' : 'tags?: string[];'}
}

export class ${name}Model {
  private items: Map<string, ${name}> = new Map();

  async findById(id: string): Promise<${name} | null> {
    return this.items.get(id) ?? null;
  }

  async findMany(filter?: Partial<${name}>): Promise<${name}[]> {
    let results = Array.from(this.items.values());
    if (filter) {
      results = results.filter(item => {
        for (const [key, value] of Object.entries(filter)) {
          if (item[key as keyof ${name}] !== value) return false;
        }
        return true;
      });
    }
    return results;
  }

  async create(input: ${name}CreateInput): Promise<${name}> {
    const id = crypto.randomUUID();
    const now = new Date();
    const record: ${name} = {
      id,
      createdAt: now,
      updatedAt: now,
      name: input.name,
      ${idx % 3 === 0 ? 'email: input.email,' : "slug: input.slug ?? input.name.toLowerCase().replace(/\\s+/g, '-'),"}
      ${idx % 2 === 0 ? 'isActive: input.isActive ?? true,' : "status: input.status ?? 'active',"}
      ${idx % 4 === 0 ? 'metadata: {},' : 'tags: [],'}
      version: 1,
    };
    this.items.set(id, record);
    return record;
  }

  async update(id: string, input: ${name}UpdateInput): Promise<${name} | null> {
    const existing = this.items.get(id);
    if (!existing) return null;
    const updated: ${name} = {
      ...existing,
      ...input,
      updatedAt: new Date(),
      version: existing.version + 1,
    };
    this.items.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.items.delete(id);
  }
${validationRules}
}
`;
}

function generateServiceFile(modelName: string, idx: number): string {
  const verb = pick(SERVICE_VERBS, idx);
  const hasAuth = idx % 3 === 0;

  return `import type { ${modelName}, ${modelName}CreateInput, ${modelName}UpdateInput } from '../models/${modelName.toLowerCase()}.js';
import { ${modelName}Model } from '../models/${modelName.toLowerCase()}.js';
${hasAuth ? `import { validateToken } from '../middleware/auth.js';` : ''}

export class ${modelName}Service {
  private model = new ${modelName}Model();

  async ${verb}(${hasAuth ? 'token: string, ' : ''}id: string): Promise<${modelName} | null> {
    ${hasAuth ? `const user = await validateToken(token);
    if (!user) throw new Error('Unauthorized');
    ` : ''}const result = await this.model.findById(id);
    if (!result) {
      throw new Error(\`${modelName} not found: \${id}\`);
    }
    return result;
  }

  async list(${hasAuth ? 'token: string, ' : ''}options?: {
    limit?: number;
    offset?: number;
    filter?: Partial<${modelName}>;
  }): Promise<{ items: ${modelName}[]; total: number }> {
    ${hasAuth ? `const user = await validateToken(token);
    if (!user) throw new Error('Unauthorized');
    ` : ''}const all = await this.model.findMany(options?.filter);
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 50;
    return {
      items: all.slice(offset, offset + limit),
      total: all.length,
    };
  }

  async create(${hasAuth ? 'token: string, ' : ''}input: ${modelName}CreateInput): Promise<${modelName}> {
    ${hasAuth ? `const user = await validateToken(token);
    if (!user) throw new Error('Unauthorized');
    ` : ''}if (!input.name || input.name.trim().length === 0) {
      throw new Error('Name is required');
    }
    return this.model.create(input);
  }

  async update(${hasAuth ? 'token: string, ' : ''}id: string, input: ${modelName}UpdateInput): Promise<${modelName}> {
    ${hasAuth ? `const user = await validateToken(token);
    if (!user) throw new Error('Unauthorized');
    ` : ''}const result = await this.model.update(id, input);
    if (!result) {
      throw new Error(\`${modelName} not found: \${id}\`);
    }
    return result;
  }

  async remove(${hasAuth ? 'token: string, ' : ''}id: string): Promise<void> {
    ${hasAuth ? `const user = await validateToken(token);
    if (!user) throw new Error('Unauthorized');
    ` : ''}const deleted = await this.model.delete(id);
    if (!deleted) {
      throw new Error(\`${modelName} not found: \${id}\`);
    }
  }
}
`;
}

function generateRouteFile(modelName: string, idx: number): string {
  const method = pick(HTTP_METHODS, idx);
  const path = `/${modelName.toLowerCase()}s`;
  const hasValidation = idx % 2 === 0;

  return `import type { Request, Response, NextFunction } from 'express';
import { ${modelName}Service } from '../services/${modelName.toLowerCase()}-service.js';

const service = new ${modelName}Service();

export async function handle${modelName}${method.charAt(0).toUpperCase() + method.slice(1)}(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    ${method === 'get' ? `const { id } = req.params;
    if (id) {
      const item = await service.${pick(SERVICE_VERBS, idx)}(id);
      res.json({ data: item });
    } else {
      const { limit, offset } = req.query;
      const result = await service.list({
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined,
      });
      res.json(result);
    }` : ''}${method === 'post' ? `const input = req.body;
    ${hasValidation ? `if (!input || typeof input.name !== 'string') {
      res.status(400).json({ error: 'Invalid input: name is required' });
      return;
    }` : ''}
    const created = await service.create(input);
    res.status(201).json({ data: created });` : ''}${method === 'put' || method === 'patch' ? `const { id } = req.params;
    const input = req.body;
    ${hasValidation ? `if (!id) {
      res.status(400).json({ error: 'ID is required' });
      return;
    }` : ''}
    const updated = await service.update(id, input);
    res.json({ data: updated });` : ''}${method === 'delete' ? `const { id } = req.params;
    await service.remove(id);
    res.status(204).send();` : ''}
  } catch (error) {
    next(error);
  }
}

export const ${modelName.toLowerCase()}Routes = {
  path: '${path}',
  method: '${method}',
  handler: handle${modelName}${method.charAt(0).toUpperCase() + method.slice(1)},
};
`;
}

function generateMiddleware(): string {
  return `export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
}

const TOKEN_STORE = new Map<string, AuthUser>();

export async function validateToken(token: string): Promise<AuthUser | null> {
  if (!token || token.length < 10) return null;
  return TOKEN_STORE.get(token) ?? null;
}

export function errorHandler(err: Error, _req: unknown, res: { status: (n: number) => { json: (o: unknown) => void } }): void {
  const status = err.message.includes('not found') ? 404
    : err.message.includes('Unauthorized') ? 401
    : 400;
  res.status(status).json({ error: err.message });
}

export function requestLogger(req: { method: string; url: string }, _res: unknown, next: () => void): void {
  const start = Date.now();
  next();
  const duration = Date.now() - start;
  void duration;
}
`;
}

function generateUtilFile(idx: number): string {
  const utils = [
    `export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\\w\\s-]/g, '')
    .replace(/[\\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}`,

    `export function paginate<T>(items: T[], page: number, pageSize: number): {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
} {
  const total = items.length;
  const totalPages = Math.ceil(total / pageSize);
  const offset = (page - 1) * pageSize;
  return {
    items: items.slice(offset, offset + pageSize),
    total,
    page,
    pageSize,
    totalPages,
  };
}

export function sortBy<T>(items: T[], key: keyof T, direction: 'asc' | 'desc' = 'asc'): T[] {
  return [...items].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });
}`,

    `export function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 100,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const attempt = async () => {
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        attempts++;
        if (attempts >= maxRetries) {
          reject(error);
        } else {
          setTimeout(attempt, delayMs * Math.pow(2, attempts - 1));
        }
      }
    };
    attempt();
  });
}

export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delayMs: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delayMs);
  };
}`,

    `export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as T;
  if (Array.isArray(obj)) return obj.map(item => deepClone(item)) as T;
  const cloned = {} as Record<string, unknown>;
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    cloned[key] = deepClone(value);
  }
  return cloned as T;
}

export function pick<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[],
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) result[key] = obj[key];
  }
  return result;
}

export function omit<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[],
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result as Omit<T, K>;
}`,
  ];
  return utils[idx % utils.length];
}

function generateVulnerableFile(idx: number): string {
  const patterns = [
    `import { query } from '../db.js';

export async function searchUsers(term: string) {
  const sql = "SELECT * FROM users WHERE name LIKE '%" + term + "%'";
  return query(sql);
}`,

    `const JWT_SECRET = 'super-secret-key-12345';

export function signToken(payload: Record<string, unknown>) {
  return JSON.stringify({ ...payload, secret: JWT_SECRET });
}`,

    `export function renderComment(html: string): string {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el.outerHTML;
}`,

    `export async function fetchData(userUrl: string) {
  const response = await fetch(userUrl);
  return response.json();
}`,
  ];
  return patterns[idx % patterns.length];
}

function generateAppEntry(models: string[]): string {
  const imports = models
    .map(m => `import { ${m}Service } from './services/${m.toLowerCase()}-service.js';`)
    .join('\n');
  const inits = models
    .map(m => `  const ${m.toLowerCase()}Service = new ${m}Service();`)
    .join('\n');

  return `${imports}
import { errorHandler, requestLogger } from './middleware/auth.js';

export async function bootstrap() {
${inits}

  console.log('Application bootstrapped with services:', [
    ${models.map(m => `'${m}'`).join(', ')}
  ]);

  return {
    ${models.map(m => `${m.toLowerCase()}: ${m.toLowerCase()}Service`).join(',\n    ')},
  };
}

export { errorHandler, requestLogger };
`;
}

export async function generateProject(size: ProjectSize): Promise<GeneratedProject> {
  const dir = await mkdtemp(join(tmpdir(), `shipgate-bench-${size}-`));
  const files: string[] = [];

  const modelCount = Math.min(size, MODEL_NAMES.length);
  const models = MODEL_NAMES.slice(0, modelCount);

  await mkdir(join(dir, 'src', 'models'), { recursive: true });
  await mkdir(join(dir, 'src', 'services'), { recursive: true });
  await mkdir(join(dir, 'src', 'routes'), { recursive: true });
  await mkdir(join(dir, 'src', 'middleware'), { recursive: true });
  await mkdir(join(dir, 'src', 'utils'), { recursive: true });

  const authFile = 'src/middleware/auth.ts';
  await writeFile(join(dir, authFile), generateMiddleware());
  files.push(authFile);

  for (let i = 0; i < modelCount; i++) {
    const model = models[i];
    const modelFile = `src/models/${model.toLowerCase()}.ts`;
    await writeFile(join(dir, modelFile), generateModelFile(model, i));
    files.push(modelFile);

    const serviceFile = `src/services/${model.toLowerCase()}-service.ts`;
    await writeFile(join(dir, serviceFile), generateServiceFile(model, i));
    files.push(serviceFile);

    const routeFile = `src/routes/${model.toLowerCase()}-route.ts`;
    await writeFile(join(dir, routeFile), generateRouteFile(model, i));
    files.push(routeFile);
  }

  const utilCount = Math.ceil(size / 10);
  for (let i = 0; i < Math.min(utilCount, 40); i++) {
    const utilFile = `src/utils/helpers-${i}.ts`;
    await writeFile(join(dir, utilFile), generateUtilFile(i));
    files.push(utilFile);
  }

  const vulnCount = Math.max(1, Math.floor(size / 20));
  for (let i = 0; i < Math.min(vulnCount, 20); i++) {
    const vulnFile = `src/routes/legacy-${i}.ts`;
    await writeFile(join(dir, vulnFile), generateVulnerableFile(i));
    files.push(vulnFile);
  }

  const remaining = size - files.length;
  if (remaining > 0) {
    await mkdir(join(dir, 'src', 'generated'), { recursive: true });
    for (let i = 0; i < remaining; i++) {
      const moduleIdx = i % modelCount;
      const model = models[moduleIdx];
      const genFile = `src/generated/${model.toLowerCase()}-ext-${i}.ts`;
      const content = i % 5 === 0
        ? generateVulnerableFile(i)
        : generateUtilFile(i);
      await writeFile(join(dir, genFile), content);
      files.push(genFile);
    }
  }

  const appFile = 'src/app.ts';
  await writeFile(join(dir, appFile), generateAppEntry(models));
  files.push(appFile);

  return { dir, files };
}

export async function cleanup(dir: string): Promise<void> {
  const { rm } = await import('fs/promises');
  await rm(dir, { recursive: true, force: true });
}
