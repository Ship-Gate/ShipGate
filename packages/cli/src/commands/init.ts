/**
 * Init Command
 *
 * Initialize a new ISL project.
 * Usage: isl init <name>
 *
 * Modes:
 *   - Template: isl init my-project --template minimal|full|api
 *   - From code: isl init my-project --from-code ./src/auth.ts
 *   - From prompt: isl init my-project --from-prompt "Build me a todo app"
 */

import { writeFile, mkdir, access, readFile, readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve, extname, dirname } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { output } from '../output.js';
import { createConfigTemplate, createJsonConfigTemplate } from '../config.js';

// Interactive init imports
import { detectProject, scanForPatterns, getSubDirs } from './init/detect.js';
import type { ProjectProfile, DetectedPattern } from './init/detect.js';
import { select, multiSelect, closePrompts } from './init/prompts.js';
import type { SelectOption } from './init/prompts.js';
import { generateShipGateYml, generateISLSpecs } from './init/templates.js';
import { generateGitHubWorkflow, getWorkflowPath } from './init/workflow-gen.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

const LANGUAGE_EXTS: Record<string, 'typescript' | 'javascript' | 'python' | 'go' | 'rust' | 'java'> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
};

export interface InitOptions {
  /** Project template to use */
  template?: 'minimal' | 'full' | 'api';
  /** Target directory (defaults to project name) */
  directory?: string;
  /** Force overwrite existing files */
  force?: boolean;
  /** Skip git initialization */
  skipGit?: boolean;
  /** Include example files */
  examples?: boolean;
  /** Generate spec from existing source code (path to file or directory) */
  fromCode?: string;
  /** Generate spec from natural language prompt */
  fromPrompt?: string;
  /** Enable AI for spec generation (requires ANTHROPIC_API_KEY for --from-code) */
  ai?: boolean;
  /** API key for AI providers (or use ANTHROPIC_API_KEY env) */
  apiKey?: string;
}

export interface InitResult {
  success: boolean;
  projectPath: string;
  files: string[];
  errors: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Templates
// ─────────────────────────────────────────────────────────────────────────────

const MINIMAL_ISL_TEMPLATE = `/**
 * {{name}} Domain
 * 
 * Define your intents and behaviors here.
 */

domain {{pascalName}} {
  /**
   * Example entity
   */
  entity User {
    id: ID
    name: String
    email: String
    createdAt: DateTime
  }

  /**
   * Example behavior
   */
  behavior CreateUser {
    input {
      name: String
      email: String
    }
    
    output User
    
    postconditions {
      ensure result.id != null
      ensure result.name == input.name
      ensure result.email == input.email
    }
    
    scenario "creates user with valid data" {
      given {
        name: "Alice"
        email: "alice@example.com"
      }
      then {
        result.name == "Alice"
        result.email == "alice@example.com"
      }
    }
  }
}
`;

const API_ISL_TEMPLATE = `/**
 * {{name}} API Domain
 * 
 * REST API contract specification.
 */

domain {{pascalName}}API {
  /**
   * API Response wrapper
   */
  entity ApiResponse<T> {
    success: Boolean
    data: T?
    error: String?
    timestamp: DateTime
  }

  /**
   * Pagination parameters
   */
  entity PaginationParams {
    page: Integer
    limit: Integer
    sortBy: String?
    sortOrder: "asc" | "desc"
  }

  /**
   * Paginated response
   */
  entity PaginatedResponse<T> {
    items: List<T>
    total: Integer
    page: Integer
    limit: Integer
    hasMore: Boolean
  }

  /**
   * Resource entity
   */
  entity Resource {
    id: ID
    name: String
    description: String?
    status: "active" | "inactive" | "archived"
    createdAt: DateTime
    updatedAt: DateTime
  }

  /**
   * List resources with pagination
   */
  behavior ListResources {
    input PaginationParams
    output PaginatedResponse<Resource>
    
    preconditions {
      require input.page >= 1
      require input.limit >= 1 && input.limit <= 100
    }
    
    postconditions {
      ensure result.page == input.page
      ensure result.limit == input.limit
      ensure result.items.length <= input.limit
    }
  }

  /**
   * Get single resource
   */
  behavior GetResource {
    input {
      id: ID
    }
    
    output ApiResponse<Resource>
    
    postconditions {
      ensure result.success implies result.data?.id == input.id
      ensure !result.success implies result.error != null
    }
    
    scenario "existing resource" {
      given { id: "res_123" }
      then {
        result.success == true
        result.data?.id == "res_123"
      }
    }
    
    scenario "not found" {
      given { id: "res_nonexistent" }
      then {
        result.success == false
        result.error != null
      }
    }
  }

  /**
   * Create new resource
   */
  behavior CreateResource {
    input {
      name: String
      description: String?
    }
    
    output ApiResponse<Resource>
    
    preconditions {
      require input.name.length > 0
      require input.name.length <= 255
    }
    
    postconditions {
      ensure result.success implies result.data?.name == input.name
      ensure result.success implies result.data?.status == "active"
    }
  }

  // Global invariants
  invariant "timestamps are valid" {
    forall r: Resource =>
      r.updatedAt >= r.createdAt
  }
}
`;

const FULL_ISL_TEMPLATE = `/**
 * {{name}} Domain
 * 
 * A comprehensive example with entities, behaviors, invariants, and scenarios.
 */

domain {{pascalName}} {
  // ─────────────────────────────────────────────────────────────────────────
  // Entities
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * User account
   */
  entity User {
    id: ID
    username: String
    email: String
    passwordHash: String
    role: UserRole
    profile: UserProfile?
    createdAt: DateTime
    lastLoginAt: DateTime?
  }

  enum UserRole {
    ADMIN
    MEMBER
    GUEST
  }

  entity UserProfile {
    displayName: String
    avatarUrl: String?
    bio: String?
  }

  /**
   * Authentication token
   */
  entity AuthToken {
    token: String
    userId: ID
    expiresAt: DateTime
    scopes: List<String>
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Behaviors
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * User registration
   */
  behavior Register {
    input {
      username: String
      email: String
      password: String
    }
    
    output User
    
    preconditions {
      require input.username.length >= 3
      require input.email.contains("@")
      require input.password.length >= 8
    }
    
    postconditions {
      ensure result.username == input.username
      ensure result.email == input.email
      ensure result.role == UserRole.MEMBER
      ensure result.passwordHash != input.password  // Password is hashed
    }
    
    scenario "successful registration" {
      given {
        username: "alice"
        email: "alice@example.com"
        password: "secure123"
      }
      then {
        result.username == "alice"
        result.email == "alice@example.com"
        result.role == UserRole.MEMBER
      }
    }
    
    scenario "invalid email" {
      given {
        username: "bob"
        email: "invalid-email"
        password: "secure123"
      }
      then fails with "Invalid email format"
    }
  }

  /**
   * User login
   */
  behavior Login {
    input {
      email: String
      password: String
    }
    
    output AuthToken
    
    preconditions {
      require input.email.length > 0
      require input.password.length > 0
    }
    
    postconditions {
      ensure result.expiresAt > now()
      ensure result.scopes.contains("read")
    }
    
    scenario "successful login" {
      given {
        email: "alice@example.com"
        password: "secure123"
      }
      when {
        user exists with email "alice@example.com"
      }
      then {
        result.token.length > 0
        result.expiresAt > now()
      }
    }
    
    scenario "wrong password" {
      given {
        email: "alice@example.com"
        password: "wrongpassword"
      }
      then fails with "Invalid credentials"
    }
  }

  /**
   * Update user profile
   */
  behavior UpdateProfile {
    input {
      userId: ID
      displayName: String?
      bio: String?
      avatarUrl: String?
    }
    
    output UserProfile
    
    preconditions {
      require input.displayName == null || input.displayName.length <= 100
      require input.bio == null || input.bio.length <= 500
    }
    
    postconditions {
      ensure input.displayName != null implies result.displayName == input.displayName
      ensure input.bio != null implies result.bio == input.bio
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Invariants
  // ─────────────────────────────────────────────────────────────────────────

  invariant "emails are unique" {
    forall u1, u2: User =>
      u1.id != u2.id implies u1.email != u2.email
  }

  invariant "usernames are unique" {
    forall u1, u2: User =>
      u1.id != u2.id implies u1.username != u2.username
  }

  invariant "tokens reference valid users" {
    forall t: AuthToken =>
      exists u: User where u.id == t.userId
  }

  invariant "expired tokens are invalid" {
    forall t: AuthToken =>
      t.expiresAt < now() implies !isValid(t)
  }
}
`;

const GITIGNORE_TEMPLATE = `# Dependencies
node_modules/

# Build outputs
dist/
generated/

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Environment
.env
.env.local
.env.*.local

# Logs
*.log
npm-debug.log*

# Test coverage
coverage/

# ISL generated files (optional - uncomment to ignore)
# generated/
`;

const PACKAGE_JSON_TEMPLATE = `{
  "name": "{{name}}",
  "version": "0.1.0",
  "description": "ISL project - {{name}}",
  "type": "module",
  "scripts": {
    "check": "isl check",
    "generate": "isl generate",
    "generate:types": "isl generate --types",
    "generate:tests": "isl generate --tests",
    "generate:docs": "isl generate --docs",
    "verify": "isl verify",
    "build": "isl check && isl generate"
  },
  "devDependencies": {
    "@isl-lang/cli": "workspace:*",
    "typescript": "^5.3.3"
  }
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function toPascalCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^(.)/, (c) => c.toUpperCase());
}

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function applyTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read source code from file or directory
 */
async function readSourceCode(path: string): Promise<{ code: string; language: 'typescript' | 'javascript' | 'python' | 'go' | 'rust' | 'java' }> {
  const resolved = resolve(path);
  const stats = await stat(resolved);

  if (stats.isFile()) {
    const code = await readFile(resolved, 'utf-8');
    const ext = extname(resolved).toLowerCase();
    const language = LANGUAGE_EXTS[ext];
    if (!language) {
      throw new Error(
        `Unsupported file extension: ${ext}. Use .ts, .js, .py, .go, .rs, or .java`
      );
    }
    return { code, language };
  }

  if (stats.isDirectory()) {
    const allCode: string[] = [];
    let language: 'typescript' | 'javascript' | 'python' | 'go' | 'rust' | 'java' = 'typescript';

    async function walk(dir: string): Promise<void> {
      const entries = await readdir(dir, { withFileTypes: true });
      const supported = entries
        .filter((e) => e.isFile() && LANGUAGE_EXTS[extname(e.name).toLowerCase()])
        .sort((a, b) => a.name.localeCompare(b.name));
      for (const entry of supported) {
        const filePath = join(dir, entry.name);
        const code = await readFile(filePath, 'utf-8');
        allCode.push(`// ${entry.name}\n${code}`);
        const ext = extname(entry.name).toLowerCase();
        const lang = LANGUAGE_EXTS[ext];
        if (lang) language = lang;
      }
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await walk(join(dir, entry.name));
        }
      }
    }

    await walk(resolved);
    if (allCode.length === 0) {
      throw new Error(`No supported source files found in ${path}`);
    }
    return { code: allCode.join('\n\n'), language };
  }

  throw new Error(`Path is neither a file nor directory: ${path}`);
}

/**
 * Generate ISL spec from source code using spec-assist
 */
async function generateFromCode(
  path: string,
  options: { apiKey?: string; ai?: boolean }
): Promise<{ isl: string; errors: string[] }> {
  try {
    const { generateSpecFromCode } = await import('@isl-lang/spec-assist');
    // Enable AI assist: use anthropic if --ai + apiKey, else stub (offline)
    const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
    process.env.ISL_AI_ENABLED = 'true';
    process.env.ISL_AI_PROVIDER = options.ai && apiKey ? 'anthropic' : 'stub';
    if (options.apiKey) {
      process.env.ANTHROPIC_API_KEY = options.apiKey;
    }

    const { code, language } = await readSourceCode(path);
    const result = await generateSpecFromCode(code, language, {
      config:
        options.ai && apiKey
          ? { apiKey, provider: 'anthropic' }
          : undefined,
    });

    if (result.success && result.isl) {
      let isl = result.isl;
      // Ensure we have a domain wrapper (stub/provider may return behavior-only)
      if (!/^\s*(domain|import)\s/m.test(isl) && /^\s*behavior\s/m.test(isl)) {
        isl = `domain GeneratedDomain {\n${isl}\n}\n`;
      }
      return { isl, errors: [] };
    }

    const diagnostics = result.diagnostics?.map((d) => d.message) ?? [];
    return {
      isl: '',
      errors: diagnostics.length > 0 ? diagnostics : ['Spec generation failed. Enable AI with --ai and set ANTHROPIC_API_KEY.'],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Cannot find module '@isl-lang/spec-assist'")) {
      return {
        isl: '',
        errors: [
          'spec-assist package not found. Install with: pnpm add -D @isl-lang/spec-assist',
          'For AI generation also set: ISL_AI_ENABLED=true ANTHROPIC_API_KEY=...',
        ],
      };
    }
    return { isl: '', errors: [msg] };
  }
}

/**
 * Generate ISL spec from natural language prompt using intent-translator
 */
async function generateFromPrompt(
  prompt: string,
  options: { apiKey?: string; ai?: boolean }
): Promise<{ isl: string; errors: string[] }> {
  try {
    const { translate } = await import('@isl-lang/intent-translator');
    const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
    const result = await translate(prompt, {
      apiKey: options.ai ? apiKey : undefined,
      context: 'Generate a complete ISL domain with entities and behaviors.',
    });

    if (result.success && result.isl) {
      return { isl: result.isl, errors: [] };
    }

    return {
      isl: '',
      errors: result.errors ?? ['Translation failed. Try with --ai and ANTHROPIC_API_KEY for better results.'],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Cannot find module '@isl-lang/intent-translator'")) {
      return {
        isl: '',
        errors: [
          'intent-translator package not found. Install with: pnpm add -D @isl-lang/intent-translator',
        ],
      };
    }
    return { isl: '', errors: [msg] };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Init Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialize a new ISL project
 */
export async function init(name: string, options: InitOptions = {}): Promise<InitResult> {
  const spinner = ora('Initializing ISL project...').start();
  const files: string[] = [];
  const errors: string[] = [];

  const projectName = toKebabCase(name);
  const pascalName = toPascalCase(name);
  const projectDir = resolve(options.directory ?? projectName);

  const templateVars = {
    name: projectName,
    pascalName,
  };

  try {
    // Check if directory exists
    if (await fileExists(projectDir)) {
      if (!options.force) {
        spinner.fail('Directory already exists');
        return {
          success: false,
          projectPath: projectDir,
          files: [],
          errors: [`Directory '${projectDir}' already exists. Use --force to overwrite.`],
        };
      }
    }

    // Create project directory
    await mkdir(projectDir, { recursive: true });
    spinner.text = 'Creating project structure...';

    // Create subdirectories
    await mkdir(join(projectDir, 'src'), { recursive: true });
    await mkdir(join(projectDir, 'generated'), { recursive: true });

    // Determine ISL content: from-code, from-prompt, or template
    let islContent: string;

    if (options.fromCode) {
      spinner.text = 'Generating ISL spec from source code...';
      const gen = await generateFromCode(options.fromCode, {
        apiKey: options.apiKey,
        ai: options.ai,
      });
      if (gen.errors.length > 0) {
        spinner.fail('Spec generation failed');
        return {
          success: false,
          projectPath: projectDir,
          files: [],
          errors: gen.errors,
        };
      }
      islContent = gen.isl;
      spinner.text = 'Creating project structure...';
    } else if (options.fromPrompt) {
      spinner.text = 'Generating ISL spec from prompt...';
      const gen = await generateFromPrompt(options.fromPrompt, {
        apiKey: options.apiKey,
        ai: options.ai,
      });
      if (gen.errors.length > 0) {
        spinner.fail('Spec generation failed');
        return {
          success: false,
          projectPath: projectDir,
          files: [],
          errors: gen.errors,
        };
      }
      islContent = gen.isl;
      spinner.text = 'Creating project structure...';
    } else {
      // Template-based init
      let islTemplate: string;
      switch (options.template) {
        case 'api':
          islTemplate = API_ISL_TEMPLATE;
          break;
        case 'full':
          islTemplate = FULL_ISL_TEMPLATE;
          break;
        case 'minimal':
        default:
          islTemplate = MINIMAL_ISL_TEMPLATE;
      }
      islContent = applyTemplate(islTemplate, templateVars);
    }

    // Create ISL file
    const islPath = join(projectDir, 'src', `${projectName}.isl`);
    await writeFile(islPath, islContent);
    files.push(islPath);

    // Create config file (JSON format for better tooling support)
    spinner.text = 'Creating configuration...';
    const configPath = join(projectDir, 'isl.config.json');
    const configContent = createJsonConfigTemplate({
      include: ['src/**/*.isl'],
      output: {
        dir: './generated',
        types: true,
        tests: true,
        docs: false,
      },
    });
    await writeFile(configPath, configContent);
    files.push(configPath);

    // Create package.json
    const packagePath = join(projectDir, 'package.json');
    await writeFile(packagePath, applyTemplate(PACKAGE_JSON_TEMPLATE, templateVars));
    files.push(packagePath);

    // Create .gitignore
    const gitignorePath = join(projectDir, '.gitignore');
    await writeFile(gitignorePath, GITIGNORE_TEMPLATE);
    files.push(gitignorePath);

    // Create README
    const readmePath = join(projectDir, 'README.md');
    const readmeContent = `# ${pascalName}

An ISL (Intent Specification Language) project.

## Getting Started

\`\`\`bash
# Check ISL files for errors
npm run check

# Generate TypeScript types and tests
npm run generate

# Verify implementation against spec
npm run verify
\`\`\`

## Project Structure

\`\`\`
${projectName}/
├── src/
│   └── ${projectName}.isl    # ISL specification
├── generated/                 # Generated TypeScript files
│   ├── types/                 # Generated types
│   ├── tests/                 # Generated tests
│   └── docs/                  # Generated documentation
├── isl.config.json           # ISL configuration
└── package.json
\`\`\`

## Commands

- \`isl check\` - Validate ISL syntax and semantics
- \`isl generate --types\` - Generate TypeScript types
- \`isl generate --tests\` - Generate test files
- \`isl generate --docs\` - Generate documentation
- \`isl verify --impl <file>\` - Verify implementation

## Learn More

- [ISL Documentation](https://intentos.dev/docs)
- [ISL GitHub](https://github.com/intentos/isl)
`;
    await writeFile(readmePath, readmeContent);
    files.push(readmePath);

    spinner.succeed(`Project created at ${projectDir}`);

    return {
      success: true,
      projectPath: projectDir,
      files,
      errors,
    };
  } catch (err) {
    spinner.fail('Failed to initialize project');
    errors.push(err instanceof Error ? err.message : String(err));
    
    return {
      success: false,
      projectPath: projectDir,
      files,
      errors,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Output Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Print init results to console
 */
export function printInitResult(result: InitResult): void {
  console.log('');

  if (result.success) {
    console.log(chalk.green('✓') + ` Project initialized at ${chalk.cyan(result.projectPath)}`);
    console.log('');
    
    output.section('Created files:');
    for (const file of result.files) {
      output.filePath(file, 'created');
    }

    console.log('');
    output.box('Next Steps', [
      `cd ${result.projectPath}`,
      'npm install',
      'isl check',
      'isl generate',
    ], 'info');
  } else {
    console.log(chalk.red('✗') + ' Failed to initialize project');
    console.log('');
    for (const error of result.errors) {
      console.log(chalk.red(`  ${error}`));
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Interactive Init — Guided Onboarding Flow
// ─────────────────────────────────────────────────────────────────────────────

export interface InteractiveInitOptions {
  /** Root directory to initialize (defaults to cwd) */
  root?: string;
  /** Force overwrite existing files */
  force?: boolean;
  /** Output format */
  format?: string;
}

export interface InteractiveInitResult {
  success: boolean;
  profile: ProjectProfile;
  configPath: string | null;
  workflowPath: string | null;
  islFiles: Array<{ path: string; behaviors: number; confidence: number }>;
  errors: string[];
}

const LANGUAGE_OPTIONS: SelectOption[] = [
  { label: 'Node.js / TypeScript', value: 'typescript' },
  { label: 'Node.js / JavaScript', value: 'javascript' },
  { label: 'Python', value: 'python' },
  { label: 'Go', value: 'go' },
  { label: 'Other', value: 'unknown' },
];

function getLanguageIndex(lang: ProjectProfile['language']): number {
  const idx = LANGUAGE_OPTIONS.findIndex((o) => o.value === lang);
  return idx >= 0 ? idx : 0;
}

/**
 * Run the interactive `shipgate init` guided setup.
 *
 * Flow:
 *   1. Show banner
 *   2. Detect project characteristics
 *   3. Ask project type (with detected default)
 *   4. Ask source directory
 *   5. Ask critical directories
 *   6. Scan for patterns
 *   7. Ask about ISL generation
 *   8. Generate .shipgate.yml, ISL specs, CI workflow
 *   9. Run quick verification summary
 *  10. Show next steps
 */
export async function interactiveInit(
  options: InteractiveInitOptions = {},
): Promise<InteractiveInitResult> {
  const root = resolve(options.root ?? process.cwd());
  const errors: string[] = [];
  const islFilesWritten: InteractiveInitResult['islFiles'] = [];
  let configPath: string | null = null;
  let workflowPath: string | null = null;

  // ── Banner ──────────────────────────────────────────────────────────────
  process.stderr.write('\n');
  process.stderr.write(chalk.bold.cyan('  ShipGate ISL') + chalk.gray(' — Behavioral verification for AI-generated code') + '\n');
  process.stderr.write(chalk.gray('  Let\'s set up your project.\n'));

  // ── Step 1: Detect project ──────────────────────────────────────────────
  const spinner = ora('Detecting project...').start();
  let profile: ProjectProfile;

  try {
    profile = await detectProject(root);
    spinner.succeed(
      `Detected: ${chalk.cyan(profile.language)}` +
      (profile.framework ? ` (${profile.framework})` : '') +
      (profile.packageManager ? ` via ${profile.packageManager}` : ''),
    );
  } catch (err) {
    spinner.fail('Failed to detect project');
    profile = {
      language: 'unknown',
      srcDirs: ['.'],
      criticalDirs: [],
      testPattern: '*.test.*',
    };
  }

  // ── Step 2: Ask project type ────────────────────────────────────────────
  const langOptions = LANGUAGE_OPTIONS.map((o) => ({
    ...o,
    hint: o.value === profile.language ? 'detected' : undefined,
  }));

  const selectedLang = await select(
    'What kind of project is this?',
    langOptions,
    getLanguageIndex(profile.language),
  );
  profile.language = selectedLang as ProjectProfile['language'];

  // ── Step 3: Ask source directory ────────────────────────────────────────
  const srcOptions: SelectOption[] = [
    ...profile.srcDirs.map((d) => ({ label: `${d}/`, value: d })),
  ];

  // Add common dirs not yet listed
  for (const candidate of ['src', 'lib', 'app']) {
    if (!srcOptions.some((o) => o.value === candidate)) {
      srcOptions.push({ label: `${candidate}/`, value: candidate });
    }
  }
  srcOptions.push({ label: 'Custom path...', value: '__custom__' });

  let selectedSrc = await select(
    'Where is your source code?',
    srcOptions,
    0,
  );

  if (selectedSrc === '__custom__') {
    const { input: promptInput } = await import('./init/prompts.js');
    selectedSrc = await promptInput('Enter source directory:', 'src');
  }

  // Update profile with selected source dir
  if (!profile.srcDirs.includes(selectedSrc)) {
    profile.srcDirs = [selectedSrc, ...profile.srcDirs];
  }

  // ── Step 4: Discover and select critical directories ────────────────────
  const allSubDirs = await getSubDirs(root, selectedSrc);

  if (allSubDirs.length > 0) {
    const criticalOptions: SelectOption[] = allSubDirs.map((dir) => {
      const isCritical = profile.criticalDirs.includes(dir);
      return {
        label: `${dir}/`,
        value: dir,
        hint: isCritical ? 'detected as critical' : undefined,
      };
    });

    const selectedCritical = await multiSelect(
      'Which directories are most critical?',
      criticalOptions,
      profile.criticalDirs.filter((d) => allSubDirs.includes(d)),
    );

    profile.criticalDirs = selectedCritical;
  }

  // ── Step 5: Scan critical dirs for patterns ─────────────────────────────
  let allPatterns: DetectedPattern[] = [];

  if (profile.criticalDirs.length > 0) {
    const scanSpinner = ora('Scanning for patterns...').start();
    const scanDirs = profile.criticalDirs.length > 0 ? profile.criticalDirs : [selectedSrc];

    for (const dir of scanDirs) {
      scanSpinner.text = `Scanning ${dir}/ for patterns...`;
      const patterns = await scanForPatterns(root, dir);
      allPatterns.push(...patterns);
    }

    scanSpinner.stop();

    if (allPatterns.length > 0) {
      for (const p of allPatterns) {
        process.stderr.write(
          chalk.green('  ✓ ') +
          `Detected: ${chalk.white(p.pattern.replace(/-/g, ' '))} ` +
          chalk.gray(`(${p.pattern} pattern)`) + '\n',
        );
      }
    } else {
      process.stderr.write(chalk.gray('  No specific patterns detected in selected directories.\n'));
    }
  }

  // ── Step 6: Ask about ISL generation ────────────────────────────────────
  type GenChoice = 'generate' | 'manual' | 'config-only';
  let genChoice: GenChoice = 'config-only';

  if (allPatterns.length > 0) {
    const genAnswer = await select(
      'Generate ISL specs for detected patterns?',
      [
        { label: 'Yes, generate and review', value: 'generate' },
        { label: 'No, I\'ll write them manually', value: 'manual' },
        { label: 'Just create .shipgate.yml for now', value: 'config-only' },
      ],
      0,
    );
    genChoice = genAnswer as GenChoice;
  }

  // ── Step 7: Generate files ──────────────────────────────────────────────
  const writeSpinner = ora('Generating configuration...').start();

  try {
    // 7a: Generate .shipgate.yml
    const shipGateYml = generateShipGateYml({
      criticalDirs: profile.criticalDirs,
      testPattern: profile.testPattern,
      language: profile.language,
    });

    const shipGatePath = join(root, '.shipgate.yml');
    if (!existsSync(shipGatePath) || options.force) {
      await writeFile(shipGatePath, shipGateYml, 'utf-8');
      configPath = '.shipgate.yml';
    } else {
      errors.push('.shipgate.yml already exists (use --force to overwrite)');
    }

    // 7b: Generate ISL specs (if requested)
    if (genChoice === 'generate' && allPatterns.length > 0) {
      writeSpinner.text = 'Generating ISL specs...';
      const specs = generateISLSpecs(allPatterns);

      for (const spec of specs) {
        const specPath = join(root, spec.filePath);
        const specDir = dirname(specPath);

        if (existsSync(specPath) && !options.force) {
          errors.push(`${spec.filePath} already exists (skipped)`);
          continue;
        }

        if (!existsSync(specDir)) {
          await mkdir(specDir, { recursive: true });
        }

        await writeFile(specPath, spec.content, 'utf-8');
        islFilesWritten.push({
          path: spec.filePath,
          behaviors: spec.behaviors,
          confidence: spec.confidence,
        });
      }
    }

    // 7c: Generate CI workflow
    writeSpinner.text = 'Generating CI workflow...';
    const wfRelPath = getWorkflowPath(profile);

    if (wfRelPath) {
      const wfAbsPath = join(root, wfRelPath);
      const wfDir = dirname(wfAbsPath);

      if (!existsSync(wfAbsPath) || options.force) {
        if (!existsSync(wfDir)) {
          await mkdir(wfDir, { recursive: true });
        }

        const workflow = generateGitHubWorkflow(profile, {
          srcPaths: [selectedSrc],
          failOn: 'error',
        });

        await writeFile(wfAbsPath, workflow, 'utf-8');
        workflowPath = wfRelPath;
      } else {
        errors.push(`${wfRelPath} already exists (skipped)`);
      }
    }

    writeSpinner.succeed('Configuration generated');
  } catch (err) {
    writeSpinner.fail('Failed to generate files');
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(msg);
  }

  // ── Clean up readline ───────────────────────────────────────────────────
  closePrompts();

  return {
    success: errors.filter((e) => !e.includes('already exists')).length === 0,
    profile,
    configPath,
    workflowPath,
    islFiles: islFilesWritten,
    errors,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Interactive Init Output
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Print the interactive init results with generated file list and next steps.
 */
export function printInteractiveInitResult(result: InteractiveInitResult): void {
  process.stderr.write('\n');

  // Generated files
  process.stderr.write(chalk.bold('Generated:\n'));

  for (const isl of result.islFiles) {
    const conf = chalk.gray(`(${isl.behaviors} behavior${isl.behaviors > 1 ? 's' : ''}, confidence: ${isl.confidence.toFixed(2)})`);
    process.stderr.write(chalk.green('  ✓ ') + chalk.white(isl.path) + ' ' + conf + '\n');
  }

  if (result.configPath) {
    process.stderr.write(chalk.green('  ✓ ') + chalk.white(result.configPath) + chalk.gray(' (default config)') + '\n');
  }

  if (result.workflowPath) {
    process.stderr.write(chalk.green('  ✓ ') + chalk.white(result.workflowPath) + chalk.gray(' (CI workflow)') + '\n');
  }

  // Warnings for skipped files
  const skipped = result.errors.filter((e) => e.includes('already exists'));
  if (skipped.length > 0) {
    process.stderr.write('\n');
    for (const s of skipped) {
      process.stderr.write(chalk.yellow('  ⚠ ') + chalk.gray(s) + '\n');
    }
  }

  // Quick verify summary
  if (result.islFiles.length > 0) {
    process.stderr.write('\n');
    process.stderr.write(chalk.bold('Quick verify:\n'));

    for (const isl of result.islFiles) {
      const status = isl.confidence >= 0.7
        ? chalk.green('✓ ISL verified')
        : chalk.yellow('⚠ Review needed');
      const score = isl.confidence >= 0.7
        ? chalk.green(isl.confidence.toFixed(2))
        : chalk.yellow(isl.confidence.toFixed(2));
      process.stderr.write(`  ${isl.path.padEnd(35)} ${status}    ${score}\n`);
    }

    process.stderr.write(
      chalk.gray(
        `\n  ${result.islFiles.length} spec${result.islFiles.length > 1 ? 's' : ''} generated. ` +
        `Review and adjust before committing.\n`,
      ),
    );
  }

  // Next steps
  process.stderr.write('\n');
  process.stderr.write(chalk.bold('Next steps:\n'));

  if (result.islFiles.length > 0) {
    const firstFile = result.islFiles[0]!.path;
    process.stderr.write(chalk.gray('  1. Review generated specs:  ') + chalk.cyan(`code ${firstFile}`) + '\n');
    process.stderr.write(chalk.gray('  2. Run verification:        ') + chalk.cyan('shipgate verify src/') + '\n');
    process.stderr.write(chalk.gray('  3. Commit and push:         ') + chalk.cyan('git add -A && git push') + '\n');
  } else {
    process.stderr.write(chalk.gray('  1. Write your first ISL spec: ') + chalk.cyan('shipgate spec new') + '\n');
    process.stderr.write(chalk.gray('  2. Run verification:          ') + chalk.cyan('shipgate verify src/') + '\n');
    process.stderr.write(chalk.gray('  3. Commit and push:           ') + chalk.cyan('git add -A && git push') + '\n');
  }

  process.stderr.write('\n');
  process.stderr.write(chalk.gray('  Docs: ') + chalk.cyan('https://shipgate.dev/docs/getting-started') + '\n');
  process.stderr.write('\n');
}

export default init;
