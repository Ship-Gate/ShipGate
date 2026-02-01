/**
 * Init Command
 * 
 * Initialize a new ISL project.
 * Usage: isl init <name>
 */

import { writeFile, mkdir, access } from 'fs/promises';
import { join, resolve } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { output } from '../output.js';
import { createConfigTemplate } from '../config.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

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
    "@intentos/cli": "workspace:*",
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

    // Select ISL template
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

    // Create ISL file
    const islPath = join(projectDir, 'src', `${projectName}.isl`);
    await writeFile(islPath, applyTemplate(islTemplate, templateVars));
    files.push(islPath);

    // Create config file
    spinner.text = 'Creating configuration...';
    const configPath = join(projectDir, 'isl.config.yaml');
    const configContent = createConfigTemplate({
      name: projectName,
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
├── isl.config.yaml           # ISL configuration
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

export default init;
