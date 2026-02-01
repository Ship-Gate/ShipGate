// ============================================================================
// Git Hooks
// Install and manage Git hooks for versioning
// ============================================================================

import { writeFile, readFile, chmod, mkdir, access, constants } from 'fs/promises';
import { join, dirname } from 'path';

// ============================================================================
// TYPES
// ============================================================================

export interface HookOptions {
  projectRoot?: string;
  hooksDir?: string;
  force?: boolean;
}

// ============================================================================
// HOOK INSTALLATION
// ============================================================================

/**
 * Install all versioning-related Git hooks
 */
export async function installHooks(options: HookOptions = {}): Promise<void> {
  const hooksDir = options.hooksDir ?? join(options.projectRoot ?? process.cwd(), '.git', 'hooks');

  // Ensure hooks directory exists
  try {
    await mkdir(hooksDir, { recursive: true });
  } catch {
    // Directory may already exist
  }

  // Install pre-commit hook
  await installHook(hooksDir, 'pre-commit', createPreCommitHook(), options.force);

  // Install commit-msg hook
  await installHook(hooksDir, 'commit-msg', createCommitMsgHook(), options.force);

  // Install post-commit hook
  await installHook(hooksDir, 'post-commit', createPostCommitHook(), options.force);
}

async function installHook(
  hooksDir: string,
  name: string,
  content: string,
  force: boolean = false
): Promise<void> {
  const hookPath = join(hooksDir, name);

  // Check if hook already exists
  if (!force) {
    try {
      await access(hookPath, constants.F_OK);
      // Hook exists, check if it's ours
      const existing = await readFile(hookPath, 'utf-8');
      if (!existing.includes('isl-versioner')) {
        throw new Error(
          `Hook "${name}" already exists and was not created by isl-versioner. ` +
          `Use --force to overwrite.`
        );
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
  }

  // Write hook
  await writeFile(hookPath, content, 'utf-8');

  // Make executable
  await chmod(hookPath, 0o755);
}

// ============================================================================
// PRE-COMMIT HOOK
// ============================================================================

/**
 * Create pre-commit hook content
 */
export function createPreCommitHook(): string {
  return `#!/bin/sh
# isl-versioner pre-commit hook
# This hook validates ISL spec changes before commit

set -e

# Check if there are ISL files being committed
ISL_FILES=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '\\.isl$' || true)

if [ -z "$ISL_FILES" ]; then
  # No ISL files changed
  exit 0
fi

echo "🔍 Checking ISL spec changes..."

# Run ISL validation
for file in $ISL_FILES; do
  if [ -f "$file" ]; then
    echo "  Validating $file..."
    # Run parser/typechecker if available
    if command -v isl >/dev/null 2>&1; then
      isl check "$file" || {
        echo "❌ Validation failed for $file"
        exit 1
      }
    fi
  fi
done

# Analyze version impact
if command -v isl-version >/dev/null 2>&1; then
  echo ""
  echo "📊 Analyzing version impact..."
  
  for file in $ISL_FILES; do
    if [ -f "$file" ]; then
      # Get staged content
      STAGED=$(git show ":$file" 2>/dev/null || true)
      
      # Get previous content
      PREVIOUS=$(git show "HEAD:$file" 2>/dev/null || true)
      
      if [ -n "$PREVIOUS" ] && [ -n "$STAGED" ]; then
        echo "  Changes in $file may require version bump"
      fi
    fi
  done
fi

echo "✅ Pre-commit checks passed"
exit 0
`;
}

// ============================================================================
// COMMIT-MSG HOOK
// ============================================================================

/**
 * Create commit-msg hook content
 */
export function createCommitMsgHook(): string {
  return `#!/bin/sh
# isl-versioner commit-msg hook
# This hook validates commit messages for conventional commits format

COMMIT_MSG_FILE=$1
COMMIT_MSG=$(cat "$COMMIT_MSG_FILE")

# Skip if commit message is empty or is a merge commit
if [ -z "$COMMIT_MSG" ] || echo "$COMMIT_MSG" | grep -q "^Merge"; then
  exit 0
fi

# Check for ISL files in this commit
ISL_FILES=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '\\.isl$' || true)

if [ -z "$ISL_FILES" ]; then
  # No ISL files, skip validation
  exit 0
fi

# Validate conventional commit format for ISL changes
# Format: type(scope): description
# Breaking changes should have "BREAKING CHANGE:" in body or "!" after type

CONVENTIONAL_REGEX="^(feat|fix|docs|style|refactor|perf|test|chore|ci|build|revert)(\\([a-zA-Z0-9_-]+\\))?(!)?: .+"

if ! echo "$COMMIT_MSG" | head -1 | grep -qE "$CONVENTIONAL_REGEX"; then
  echo "❌ Commit message does not follow conventional commits format"
  echo ""
  echo "Expected format: type(scope): description"
  echo ""
  echo "Types: feat, fix, docs, style, refactor, perf, test, chore, ci, build, revert"
  echo ""
  echo "Examples:"
  echo "  feat(auth): add login behavior"
  echo "  fix(user): correct email validation"
  echo "  feat(api)!: change response format (BREAKING)"
  echo ""
  echo "Your commit message:"
  echo "$COMMIT_MSG"
  exit 1
fi

# Check for breaking changes indicator when breaking changes are detected
# This is a simplified check - full analysis would require parsing ISL
if echo "$COMMIT_MSG" | grep -qE "\\!:" || echo "$COMMIT_MSG" | grep -qi "BREAKING CHANGE"; then
  echo "⚠️  Breaking change detected - will trigger MAJOR version bump"
fi

exit 0
`;
}

// ============================================================================
// POST-COMMIT HOOK
// ============================================================================

function createPostCommitHook(): string {
  return `#!/bin/sh
# isl-versioner post-commit hook
# This hook suggests version updates after ISL changes

# Check if there were ISL files in the last commit
ISL_FILES=$(git diff-tree --no-commit-id --name-only -r HEAD | grep -E '\\.isl$' || true)

if [ -z "$ISL_FILES" ]; then
  exit 0
fi

# Suggest version update
echo ""
echo "📦 ISL spec files were modified in this commit:"
for file in $ISL_FILES; do
  echo "   - $file"
done
echo ""
echo "💡 Consider running 'isl-version bump' to update the version"
echo ""

exit 0
`;
}

// ============================================================================
// HOOK UTILITIES
// ============================================================================

/**
 * Remove installed hooks
 */
export async function removeHooks(options: HookOptions = {}): Promise<void> {
  const hooksDir = options.hooksDir ?? join(options.projectRoot ?? process.cwd(), '.git', 'hooks');
  const hooks = ['pre-commit', 'commit-msg', 'post-commit'];

  for (const hook of hooks) {
    const hookPath = join(hooksDir, hook);
    
    try {
      const content = await readFile(hookPath, 'utf-8');
      if (content.includes('isl-versioner')) {
        const { unlink } = await import('fs/promises');
        await unlink(hookPath);
      }
    } catch {
      // Hook doesn't exist or can't be read
    }
  }
}

/**
 * Check if hooks are installed
 */
export async function checkHooksInstalled(options: HookOptions = {}): Promise<{
  installed: boolean;
  hooks: Record<string, boolean>;
}> {
  const hooksDir = options.hooksDir ?? join(options.projectRoot ?? process.cwd(), '.git', 'hooks');
  const hookNames = ['pre-commit', 'commit-msg', 'post-commit'];
  const result: Record<string, boolean> = {};

  for (const hook of hookNames) {
    const hookPath = join(hooksDir, hook);
    
    try {
      const content = await readFile(hookPath, 'utf-8');
      result[hook] = content.includes('isl-versioner');
    } catch {
      result[hook] = false;
    }
  }

  return {
    installed: Object.values(result).every(v => v),
    hooks: result,
  };
}

/**
 * Get husky-compatible hook content
 */
export function getHuskyHook(hookName: string): string {
  switch (hookName) {
    case 'pre-commit':
      return `#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# ISL version check
npx isl-version check --staged
`;
    case 'commit-msg':
      return `#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Validate commit message for ISL changes
npx isl-version validate-commit "$1"
`;
    default:
      return '';
  }
}
