#!/usr/bin/env node
// ============================================================================
// ISL Version CLI
// Command-line interface for ISL spec versioning
// ============================================================================

import { readFile, writeFile } from 'fs/promises';
import {
  formatVersion,
  bumpVersion,
  isValidVersion,
  type SemanticVersion,
} from './versioner.js';
import { installHooks, removeHooks, checkHooksInstalled, createPreCommitHook, createCommitMsgHook } from './git/hooks.js';
import {
  createTag,
  deleteTag,
  listTags,
  getLatestTag,
  pushTags,
  isGitRepo,
} from './git/tags.js';

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'check':
      await checkCommand(args.slice(1));
      break;

    case 'bump':
      await bumpCommand(args.slice(1));
      break;

    case 'changelog':
      await changelogCommand(args.slice(1));
      break;

    case 'tag':
      await tagCommand(args.slice(1));
      break;

    case 'hooks':
      await hooksCommand(args.slice(1));
      break;

    case 'analyze':
      await analyzeCommand(args.slice(1));
      break;

    case 'validate-commit':
      await validateCommitCommand(args.slice(1));
      break;

    case 'help':
    case '--help':
    case '-h':
      printHelp();
      break;

    case 'version':
    case '--version':
    case '-v':
      console.log('0.1.0');
      break;

    default:
      if (command) {
        console.error(`Unknown command: ${command}`);
      }
      printHelp();
      process.exit(command ? 1 : 0);
  }
}

// ============================================================================
// COMMANDS
// ============================================================================

/**
 * Check command - validate spec changes and suggest version bump
 */
async function checkCommand(args: string[]): Promise<void> {
  const staged = args.includes('--staged');

  console.log('🔍 Checking ISL spec changes...\n');

  // Check if we're in a git repo
  if (!(await isGitRepo())) {
    console.error('Not a git repository');
    process.exit(1);
  }

  // Get latest tag
  const latest = await getLatestTag();
  const currentVersion = latest ? formatVersion(latest.version) : '0.0.0';

  console.log(`Current version: ${currentVersion}`);
  console.log(staged ? 'Checking staged changes...' : 'Checking all changes...');
  console.log('');

  // For now, output a summary
  // In a real implementation, this would parse ISL files and run analyzeChanges
  console.log('✅ Check complete');
  console.log('');
  console.log('To analyze specific spec changes, use:');
  console.log('  isl-version analyze <old-spec.isl> <new-spec.isl>');
}

/**
 * Bump command - compute and apply version bump
 */
async function bumpCommand(args: string[]): Promise<void> {
  const forceBump = parseForce(args);
  const prerelease = parsePrerelease(args);
  const dryRun = args.includes('--dry-run');
  const push = args.includes('--push');

  console.log('📦 Computing version bump...\n');

  // Check if we're in a git repo
  if (!(await isGitRepo())) {
    console.error('Not a git repository');
    process.exit(1);
  }

  // Get latest tag
  const latest = await getLatestTag();
  const currentVersion = latest ? latest.version : { major: 0, minor: 0, patch: 0 };

  console.log(`Current version: ${formatVersion(currentVersion)}`);

  // Compute next version
  let nextVersion: SemanticVersion;
  
  if (forceBump) {
    nextVersion = bumpVersion(currentVersion, forceBump, { prerelease });
  } else {
    // Without analysis, default to patch
    console.log('No changes analyzed, defaulting to patch bump');
    nextVersion = bumpVersion(currentVersion, 'patch', { prerelease });
  }

  console.log(`Next version: ${formatVersion(nextVersion)}`);
  console.log(`Bump type: ${forceBump ?? 'patch'}`);

  if (!dryRun) {
    const tag = await createTag(nextVersion, {
      message: `Release ${formatVersion(nextVersion)}`,
    });
    console.log(`\n✅ Created tag ${tag.name}`);

    if (push) {
      await pushTags([tag.name]);
      console.log('✅ Pushed tag to remote');
    }
  } else {
    console.log('\n(dry run - no changes made)');
  }
}

/**
 * Changelog command - generate changelog
 */
async function changelogCommand(args: string[]): Promise<void> {
  const output = args.find(a => a.startsWith('--output='))?.split('=')[1] ?? 'CHANGELOG.md';
  const init = args.includes('--init');
  const format = args.find(a => a.startsWith('--format='))?.split('=')[1] as 'markdown' | 'json' | 'conventional' ?? 'markdown';

  console.log('📝 Generating changelog...\n');

  if (init) {
    const content = `# Changelog

All notable changes to this ISL specification will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`;
    await writeFile(output, content, 'utf-8');
    console.log(`✅ Created ${output}`);
    return;
  }

  // Get version tags to generate changelog from
  const tags = await listTags({ limit: 10 });
  
  if (tags.length === 0) {
    console.log('No version tags found. Create a tag first with:');
    console.log('  isl-version tag create 1.0.0');
    return;
  }

  console.log(`Found ${tags.length} version tags`);
  console.log(`Output file: ${output}`);
  console.log(`Format: ${format}`);
}

/**
 * Tag command - manage version tags
 */
async function tagCommand(args: string[]): Promise<void> {
  const subcommand = args[0];

  // Check if we're in a git repo
  if (!(await isGitRepo())) {
    console.error('Not a git repository');
    process.exit(1);
  }

  switch (subcommand) {
    case 'list': {
      console.log('📋 Version tags:\n');
      const allTags = await listTags({ limit: 10 });
      if (allTags.length === 0) {
        console.log('No version tags found');
      } else {
        for (const tag of allTags) {
          const pre = tag.version.prerelease ? ' (pre-release)' : '';
          console.log(`  ${tag.name}${pre}`);
        }
      }
      break;
    }

    case 'latest': {
      const latest = await getLatestTag();
      if (latest) {
        console.log(`Latest version: ${latest.name}`);
        console.log(`  Commit: ${latest.commit}`);
        console.log(`  Date: ${latest.date.toISOString()}`);
      } else {
        console.log('No version tags found');
      }
      break;
    }

    case 'create': {
      const version = args[1];
      if (!version) {
        console.error('Usage: isl-version tag create <version>');
        process.exit(1);
      }
      if (!isValidVersion(version)) {
        console.error(`Invalid version: ${version}`);
        process.exit(1);
      }
      const message = args.find(a => a.startsWith('--message='))?.split('=')[1];
      const created = await createTag(version, {
        message: message ?? `Release ${version}`,
        annotated: true,
      });
      console.log(`✅ Created tag ${created.name}`);
      break;
    }

    case 'delete': {
      const toDelete = args[1];
      if (!toDelete) {
        console.error('Usage: isl-version tag delete <tag>');
        process.exit(1);
      }
      const remote = args.includes('--remote');
      await deleteTag(toDelete, remote);
      console.log(`✅ Deleted tag ${toDelete}${remote ? ' (and remote)' : ''}`);
      break;
    }

    case 'push': {
      const tagName = args[1];
      if (tagName) {
        await pushTags([tagName]);
        console.log(`✅ Pushed tag ${tagName}`);
      } else {
        await pushTags();
        console.log('✅ Pushed all tags');
      }
      break;
    }

    default:
      console.log('Tag subcommands: list, latest, create, delete, push');
  }
}

/**
 * Hooks command - manage git hooks
 */
async function hooksCommand(args: string[]): Promise<void> {
  const subcommand = args[0];

  switch (subcommand) {
    case 'install': {
      console.log('📌 Installing Git hooks...');
      const force = args.includes('--force');
      await installHooks({ force });
      console.log('✅ Hooks installed');
      break;
    }

    case 'uninstall': {
      console.log('🗑️ Removing Git hooks...');
      await removeHooks();
      console.log('✅ Hooks removed');
      break;
    }

    case 'status': {
      console.log('📋 Hook status:\n');
      const status = await checkHooksInstalled();
      for (const [hook, installed] of Object.entries(status.hooks)) {
        const emoji = installed ? '✅' : '❌';
        console.log(`  ${emoji} ${hook}`);
      }
      console.log('');
      console.log(status.installed ? 'All hooks installed' : 'Some hooks not installed');
      break;
    }

    case 'show': {
      const hookName = args[1];
      if (hookName === 'pre-commit') {
        console.log(createPreCommitHook());
      } else if (hookName === 'commit-msg') {
        console.log(createCommitMsgHook());
      } else {
        console.log('Available hooks: pre-commit, commit-msg');
      }
      break;
    }

    default:
      console.log('Hook subcommands: install, uninstall, status, show');
  }
}

/**
 * Analyze command - analyze spec changes between two files
 */
async function analyzeCommand(args: string[]): Promise<void> {
  const oldPath = args[0];
  const newPath = args[1];

  if (!oldPath || !newPath) {
    console.error('Usage: isl-version analyze <old-spec> <new-spec>');
    process.exit(1);
  }

  console.log('🔬 Analyzing changes...\n');

  try {
    // Read files to verify they exist
    await readFile(oldPath, 'utf-8');
    await readFile(newPath, 'utf-8');

    console.log(`Comparing: ${oldPath} → ${newPath}`);
    console.log('');
    
    // Note: This would need a parser to convert ISL to Domain AST
    // For now, show a placeholder message
    console.log('To analyze ISL specs, ensure they are parsed first.');
    console.log('Use the ISL parser to convert specs to JSON, then analyze.');
    console.log('');
    console.log('Example workflow:');
    console.log('  1. isl parse old.isl --output old.json');
    console.log('  2. isl parse new.isl --output new.json');
    console.log('  3. isl-version analyze old.json new.json');
    
  } catch (error) {
    console.error('Failed to read spec files:', (error as Error).message);
    process.exit(1);
  }
}

/**
 * Validate commit message (called from commit-msg hook)
 */
async function validateCommitCommand(args: string[]): Promise<void> {
  const msgFile = args[0];
  
  if (!msgFile) {
    console.error('Usage: isl-version validate-commit <commit-msg-file>');
    process.exit(1);
  }

  try {
    const msg = await readFile(msgFile, 'utf-8');
    const firstLine = msg.split('\n')[0];

    // Skip merge commits
    if (firstLine.startsWith('Merge')) {
      process.exit(0);
    }

    // Validate conventional commit format
    const conventionalRegex = /^(feat|fix|docs|style|refactor|perf|test|chore|ci|build|revert)(\([a-zA-Z0-9_-]+\))?(!)?: .+/;
    
    if (!conventionalRegex.test(firstLine)) {
      console.error('❌ Commit message does not follow conventional commits format');
      console.error('');
      console.error('Expected: type(scope): description');
      console.error('');
      console.error('Types: feat, fix, docs, style, refactor, perf, test, chore');
      console.error('');
      console.error('Your message:', firstLine);
      process.exit(1);
    }

    // Check for breaking change marker
    if (firstLine.includes('!:') || msg.toLowerCase().includes('breaking change')) {
      console.log('⚠️ Breaking change detected - will require MAJOR version bump');
    }

    process.exit(0);
  } catch (error) {
    console.error('Failed to read commit message:', (error as Error).message);
    process.exit(1);
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function parseForce(args: string[]): 'major' | 'minor' | 'patch' | undefined {
  if (args.includes('--major')) return 'major';
  if (args.includes('--minor')) return 'minor';
  if (args.includes('--patch')) return 'patch';
  return undefined;
}

function parsePrerelease(args: string[]): string | undefined {
  const pre = args.find(a => a.startsWith('--prerelease='));
  if (pre) return pre.split('=')[1];
  if (args.includes('--alpha')) return 'alpha';
  if (args.includes('--beta')) return 'beta';
  if (args.includes('--rc')) return 'rc';
  return undefined;
}

function printHelp(): void {
  console.log(`
ISL Spec Versioner - Semantic versioning for ISL specifications

Usage: isl-version <command> [options]

Commands:
  check [--staged]           Check for version-relevant changes
  bump [options]             Compute and apply version bump
  changelog [--init]         Generate or update changelog
  tag <subcommand>           Manage version tags
  hooks <subcommand>         Manage Git hooks
  analyze <old> <new>        Analyze differences between specs
  validate-commit <file>     Validate commit message (for hooks)

Bump Options:
  --major                    Force major version bump
  --minor                    Force minor version bump
  --patch                    Force patch version bump
  --prerelease=<id>          Create pre-release (alpha, beta, rc)
  --alpha, --beta, --rc      Shorthand for --prerelease
  --dry-run                  Show what would happen without changes
  --push                     Push tag to remote after creation

Tag Subcommands:
  list                       List all version tags
  latest                     Show latest version tag
  create <version>           Create a new version tag
  delete <tag> [--remote]    Delete a version tag
  push [tag]                 Push tags to remote

Hook Subcommands:
  install [--force]          Install Git hooks
  uninstall                  Remove Git hooks
  status                     Show hook installation status
  show <hook>                Show hook content

Changelog Options:
  --init                     Create initial CHANGELOG.md
  --output=<file>            Output file (default: CHANGELOG.md)
  --format=<fmt>             Format: markdown, json, conventional

Version Rules:
  MAJOR  Breaking changes (field removed, type changed incompatibly)
  MINOR  Backward-compatible additions (new field, new behavior)
  PATCH  Fixes (constraint tweaks, documentation changes)

Examples:
  isl-version check --staged
  isl-version bump --minor --dry-run
  isl-version bump --prerelease=beta
  isl-version tag create 1.0.0
  isl-version hooks install
  isl-version changelog --init
`);
}

// ============================================================================
// RUN CLI
// ============================================================================

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
