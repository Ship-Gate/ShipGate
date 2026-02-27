# ISL Repository - Realistic Cleanup Plan

## Executive Summary
This is a conservative cleanup plan that preserves valuable work while removing only actual junk. The goal is merge-readiness without destroying useful features.

## What I Got Wrong Before
- **Codegen packages are CORE features** - Used by CLI, have real users, generate Python/Go/TypeScript/etc.
- **Stdlib packages are ESSENTIAL** - Standard library with auth, HTTP, observability - not experimental
- **Multi-language SDKs are STRATEGIC** - Go, Rust, Python SDKs are part of the ecosystem vision
- **Most packages have PURPOSE** - This is a full-featured language platform, not a minimal spine

## What Actually Needs Cleaning

### 1. Debug/Temporary Files (DELETE)
These are clearly junk with no value:

**Root Level Files to Delete:**
- `build.log` - Build debug output
- `typecheck.log` - TypeScript debug output  
- `__test_final.txt` - Test debug output
- `__test_output.txt` - Test debug output
- `tsc-errors*.txt` - TypeScript error logs (5 files)
- `build_output.txt` - Build debug output
- `typecheck-output.txt` - TypeScript debug output
- `eslint-errors.txt` - ESLint debug output
- `stamp-*.txt` - Stamp debug files
- `test-baseline.txt` - Test baseline debug

**Root Level Demo Scripts to Delete:**
- `add-*.ts` - Demo scripts
- `demo*.ts` - Demo scripts  
- `design.ps1` - Design script
- `experimental.json` - Experimental config
- `shipgate-demo.ts` - Demo script
- `test-pipeline.ts` - Test script

**Temporary Folders to Delete:**
- `.demo-output*` - Demo output folders
- `.test-demo*` - Test demo folders
- `.test-temp` - Test temp folder
- `.tmp-npx-test` - NPX test temp
- `tmp-cli-qa-init` - CLI QA temp

### 2. True Empty/Placeholder Packages (DELETE)

**Packages with No Real Content:**
- `packages/coverage` - Has package.json but src/ is mostly empty folders
- `packages/isl-runtime-rs` - Check if actually empty
- Any packages with only package.json and no real implementation

### 3. Duplicate Documentation (CONSOLIDATE)

**Marketing Docs to Archive:**
- `LANDING_PAGE_COPY.md` - Marketing copy
- `README_NEW.md` - Duplicate README  
- `HACKER_NEWS_POST.md` - Marketing post

**Keep Only:**
- `README.md` - Main README
- Core technical docs in `docs/`

### 4. Unused Demo/Example Folders (ARCHIVE)

**Demo Folders to Archive:**
- Keep only 1-2 best demos
- Archive the rest to `/archive/demos/`

**Example Folders to Archive:**  
- `examples/` - If not actively used
- `samples/` (except `samples/isl` if used)

### 5. Development Tooling Folders (EVALUATE)

**Potentially Unused Tooling:**
- `.capability-manifests/` - Capability manifests
- `.claude/` - Claude config
- `.cursor/` - Cursor config  
- `.guardrail/` - Guardrail config
- `.islstudio/` - ISL Studio config
- `.shipgate/` - Shipgate config
- `.vibecheck/` - Vibecheck config

**Keep:**
- `.github/` - CI/CD (essential)
- `scripts/` - Build scripts (essential)
- `.turbo/` - Turbo cache (useful)

## What to KEEP (Most Packages)

### Core Language (KEEP ALL)
- `packages/parser` - Essential
- `packages/typechecker` - Essential  
- `packages/evaluator` - Essential
- `packages/core` - Essential
- `packages/isl-core` - Essential

### Code Generation (KEEP ALL)
- `packages/codegen` - Main umbrella
- `packages/codegen-*` - All language targets
- These are actively used features

### Standard Library (KEEP ALL)  
- `packages/stdlib-*` - Standard library
- Essential building blocks for users

### SDKs (KEEP ALL)
- `packages/sdk` - Main SDK
- `packages/sdk-*` - Language-specific SDKs
- Strategic multi-language support

### Verification & Testing (KEEP ALL)
- `packages/isl-verify` - Core verification
- `packages/isl-verify-pipeline` - Pipeline
- `packages/isl-gate` - Gate engine
- `packages/test-generator` - Test generation
- `packages/pbt` - Property-based testing

### Developer Tools (KEEP ALL)
- `packages/cli` - Main CLI
- `packages/vscode` - VS Code extension
- `packages/language-server` - LSP server

### AI & Inference (KEEP ALL)
- `packages/ai-copilot` - AI assistance
- `packages/inference` - AI inference

### Observability (KEEP ALL)
- `packages/observability` - Core observability
- `packages/opentelemetry` - OpenTelemetry
- `packages/health-check` - Health checks

### Specialized Tools (KEEP MOST)
- `packages/autofix` - Auto-fixing
- `packages/compliance` - Compliance tools
- `packages/security-*` - Security tools
- `packages/formal-verification` - Formal verification

These may be specialized but represent real investment and capability.

## Implementation Steps

### Phase 1: Safe Cleanup (No Risk)
1. Delete debug files (*.log, *.txt debug outputs)
2. Delete temporary folders (.tmp-*, demo-output*)
3. Delete demo scripts (add-*.ts, demo*.ts)
4. Archive duplicate marketing docs

### Phase 2: Empty Package Cleanup  
1. Identify truly empty packages
2. Delete packages with only package.json
3. Update workspace config

### Phase 3: Demo Consolidation
1. Evaluate demo folders
2. Keep 1-2 best demos
3. Archive rest to `/archive/demos/`

### Phase 4: Verification
1. Run `pnpm install`
2. Run `pnpm build`  
3. Run `pnpm test`
4. Fix any broken references

## Expected Results

**Before:** ~200 packages, lots of debug files
**After:** ~190 packages, clean root, preserved features

**Space Savings:** Mostly from debug files, not code
**Risk:** Minimal - only deleting obvious junk
**Value:** Preserved all real features and investments

## Why This Approach Works

1. **Conservative** - Only deletes what's clearly junk
2. **Preserves Investment** - Keeps all valuable features
3. **Low Risk** - Won't break builds or dependencies  
4. **Real Impact** - Removes actual clutter without destroying value
5. **Merge Ready** - Clean repository structure maintained

## Verification Checklist

- [ ] Debug files deleted
- [ ] Empty packages identified and removed
- [ ] Demo folders consolidated
- [ ] pnpm install succeeds
- [ ] pnpm build succeeds
- [ ] pnpm test succeeds
- [ ] No broken imports
- [ ] Documentation updated

This plan respects the work that went into the codebase while cleaning up only what's truly junk.
