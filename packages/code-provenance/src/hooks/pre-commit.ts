/**
 * Pre-commit Hook
 *
 * Detects the active AI tool and installs a prepare-commit-msg hook
 * that injects AI-Tool trailers into commit messages.
 *
 * Install: `shipgate provenance init`
 *
 * @module @isl-lang/code-provenance
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import type { ProvenanceSession } from '../types.js';

const HOOK_MARKER = '# shipgate-provenance-hook';

const PREPARE_COMMIT_MSG_HOOK = `#!/bin/sh
${HOOK_MARKER}
# Injected by shipgate provenance init
# Automatically adds AI-Tool trailers to commit messages

COMMIT_MSG_FILE="$1"
COMMIT_SOURCE="$2"

# Only add trailers for user-initiated commits (not merges, amends, etc.)
if [ "$COMMIT_SOURCE" = "merge" ] || [ "$COMMIT_SOURCE" = "squash" ]; then
  exit 0
fi

# Detect AI tool from environment
AI_TOOL=""
AI_MODEL=""

# Check ShipGate env vars first (highest priority)
if [ -n "$SHIPGATE_AI_TOOL" ]; then
  AI_TOOL="$SHIPGATE_AI_TOOL"
  AI_MODEL="$SHIPGATE_AI_MODEL"
# Check for Cursor
elif [ -n "$CURSOR_VERSION" ] || echo "$TERM_PROGRAM" | grep -qi cursor; then
  AI_TOOL="cursor"
# Check for Windsurf
elif [ -n "$WINDSURF_VERSION" ] || echo "$TERM_PROGRAM" | grep -qi windsurf; then
  AI_TOOL="windsurf"
# Check for VS Code (likely Copilot)
elif [ -n "$VSCODE_PID" ] || [ "$TERM_PROGRAM" = "vscode" ]; then
  AI_TOOL="copilot"
# Check for Aider
elif [ -n "$AIDER_VERSION" ]; then
  AI_TOOL="aider"
fi

# Also check .shipgate/provenance.json for session info
if [ -z "$AI_TOOL" ] && [ -f ".shipgate/provenance.json" ]; then
  # Extract generator field using basic tools
  PROV_TOOL=$(grep -o '"generator"[[:space:]]*:[[:space:]]*"[^"]*"' .shipgate/provenance.json 2>/dev/null | head -1 | sed 's/.*"generator"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/')
  PROV_MODEL=$(grep -o '"model"[[:space:]]*:[[:space:]]*"[^"]*"' .shipgate/provenance.json 2>/dev/null | head -1 | sed 's/.*"model"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/')
  if [ -n "$PROV_TOOL" ]; then
    AI_TOOL="$PROV_TOOL"
    AI_MODEL="$PROV_MODEL"
  fi
fi

# If we detected an AI tool, add the trailer
if [ -n "$AI_TOOL" ]; then
  # Build trailer value
  if [ -n "$AI_MODEL" ]; then
    TRAILER_VALUE="$AI_TOOL/$AI_MODEL"
  else
    TRAILER_VALUE="$AI_TOOL"
  fi

  # Check if trailer already exists
  if ! grep -q "^AI-Tool:" "$COMMIT_MSG_FILE" 2>/dev/null; then
    # Add blank line separator if needed, then trailers
    echo "" >> "$COMMIT_MSG_FILE"
    echo "AI-Tool: $TRAILER_VALUE" >> "$COMMIT_MSG_FILE"
    echo "AI-Session: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$COMMIT_MSG_FILE"

    # Add operator if available
    GIT_EMAIL=$(git config user.email 2>/dev/null)
    if [ -n "$GIT_EMAIL" ]; then
      echo "AI-Operator: $GIT_EMAIL" >> "$COMMIT_MSG_FILE"
    fi
  fi
fi

exit 0
`;

/**
 * Install the prepare-commit-msg hook that injects AI-Tool trailers.
 */
export function installHook(cwd: string): { installed: boolean; hookPath: string; message: string } {
  const gitDir = getGitDir(cwd);
  if (!gitDir) {
    return { installed: false, hookPath: '', message: 'Not a git repository' };
  }

  const hooksDir = path.join(gitDir, 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });

  const hookPath = path.join(hooksDir, 'prepare-commit-msg');

  if (fs.existsSync(hookPath)) {
    const existing = fs.readFileSync(hookPath, 'utf8');
    if (existing.includes(HOOK_MARKER)) {
      return { installed: true, hookPath, message: 'Hook already installed' };
    }
    const backup = hookPath + '.backup';
    fs.copyFileSync(hookPath, backup);
    const merged = existing + '\n\n' + PREPARE_COMMIT_MSG_HOOK;
    fs.writeFileSync(hookPath, merged, { mode: 0o755 });
    return { installed: true, hookPath, message: `Hook installed (existing hook backed up to ${backup})` };
  }

  fs.writeFileSync(hookPath, PREPARE_COMMIT_MSG_HOOK, { mode: 0o755 });
  return { installed: true, hookPath, message: 'Hook installed successfully' };
}

/**
 * Remove the shipgate prepare-commit-msg hook.
 */
export function uninstallHook(cwd: string): { removed: boolean; message: string } {
  const gitDir = getGitDir(cwd);
  if (!gitDir) {
    return { removed: false, message: 'Not a git repository' };
  }

  const hookPath = path.join(gitDir, 'hooks', 'prepare-commit-msg');

  if (!fs.existsSync(hookPath)) {
    return { removed: false, message: 'No hook found' };
  }

  const content = fs.readFileSync(hookPath, 'utf8');
  if (!content.includes(HOOK_MARKER)) {
    return { removed: false, message: 'Hook was not installed by shipgate' };
  }

  fs.unlinkSync(hookPath);

  const backup = hookPath + '.backup';
  if (fs.existsSync(backup)) {
    fs.renameSync(backup, hookPath);
    return { removed: true, message: 'Hook removed, original hook restored from backup' };
  }

  return { removed: true, message: 'Hook removed' };
}

/**
 * Initialize or update .shipgate/provenance.json with session info.
 */
export function initProvenanceSession(
  cwd: string,
  generator?: string,
  model?: string,
): { path: string; session: ProvenanceSession } {
  const shipgateDir = path.join(cwd, '.shipgate');
  fs.mkdirSync(shipgateDir, { recursive: true });

  const sessionPath = path.join(shipgateDir, 'provenance.json');
  let existing: Partial<ProvenanceSession> = {};

  try {
    existing = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
  } catch {
    // File doesn't exist
  }

  const operator = getGitEmail(cwd);

  const session: ProvenanceSession = {
    generator: generator ?? existing.generator ?? 'unknown',
    model: model ?? existing.model,
    operator: operator ?? existing.operator,
    sessionStarted: existing.sessionStarted ?? new Date().toISOString(),
    autoDetected: !generator,
  };

  fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2) + '\n');
  return { path: sessionPath, session };
}

function getGitDir(cwd: string): string | null {
  try {
    const result = execSync('git rev-parse --git-dir', {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return path.isAbsolute(result) ? result : path.join(cwd, result);
  } catch {
    return null;
  }
}

function getGitEmail(cwd: string): string | null {
  try {
    return execSync('git config user.email', {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim() || null;
  } catch {
    return null;
  }
}
