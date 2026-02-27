# VS Code Extension Release Checklist

This document provides the steps to publish the ISL VS Code extension to the marketplace.

---

## Pre-Release Checklist

### Code Quality
- [ ] MVP gate passes (`pnpm run mvp:green`)
- [ ] Extension builds without errors
- [ ] Extension package.json version is bumped
- [ ] CHANGELOG.md is updated with new version notes

### Testing
- [ ] Extension loads in VS Code without errors
- [ ] ISL syntax highlighting works
- [ ] Language server starts and provides diagnostics
- [ ] heal command appears in command palette
- [ ] proof command appears in command palette
- [ ] Check command works on .isl files

### Metadata
- [ ] README.md is current and accurate
- [ ] Icon is present and displays correctly
- [ ] Gallery banner colors are set
- [ ] Keywords are appropriate
- [ ] Categories are correct

---

## Build Steps

### 1. Ensure dependencies are installed
```bash
cd packages/vscode
pnpm install
```

### 2. Build the extension
```bash
pnpm run build
```

### 3. Package as VSIX
```bash
pnpm run package
# or directly:
vsce package --no-dependencies
```

### 4. Verify VSIX contents
```bash
# List contents
unzip -l isl-lang-*.vsix

# Install locally to test
code --install-extension isl-lang-*.vsix
```

---

## Smoke Tests (Local)

After installing the VSIX locally:

1. **Open a .isl file**
   - Syntax highlighting should apply
   - No errors in Output > ISL Language Server

2. **Test diagnostics**
   - Create an invalid .isl file
   - Errors should appear in Problems panel

3. **Test commands**
   - Open Command Palette (Ctrl+Shift+P)
   - Search for "ISL"
   - Verify: Parse, Check, Generate commands exist

4. **Test completion**
   - Type in a .isl file
   - Completion suggestions should appear

5. **Test hover**
   - Hover over keywords/identifiers
   - Documentation should appear

---

## Publish Steps

### Prerequisites
- VS Code Marketplace account
- Personal Access Token (PAT) with Marketplace scope
- Publisher name configured

### 1. Login to vsce
```bash
vsce login <publisher-name>
# Enter PAT when prompted
```

### 2. Publish
```bash
vsce publish
# or for specific version:
vsce publish minor  # 0.1.0 -> 0.2.0
vsce publish patch  # 0.1.0 -> 0.1.1
```

### 3. Verify
- Visit marketplace page
- Check version number
- Test install from marketplace

---

## Post-Publish

- [ ] Announce release (GitHub, Discord, etc.)
- [ ] Update main README if needed
- [ ] Tag release in git
- [ ] Close related issues

---

## Rollback Procedure

If issues are found after publish:

1. **Unpublish (if critical)**
   ```bash
   vsce unpublish <publisher>.<extension>
   ```

2. **Quick fix and republish**
   - Fix the issue
   - Bump patch version
   - Republish

3. **Document incident**
   - Add note to CHANGELOG
   - Create tracking issue if needed

---

## Version History

| Version | Date | Notes |
|---------|------|-------|
| 0.1.0 | TBD | Initial MVP release |

---

## Marketplace URLs

- **Extension page**: https://marketplace.visualstudio.com/items?itemName=isl-lang.isl-lang
- **Publisher page**: https://marketplace.visualstudio.com/publishers/isl-lang

---

## Required Secrets/Accounts

| Item | Purpose | Owner |
|------|---------|-------|
| VS Code PAT | Publish to marketplace | Release engineer |
| Publisher account | Marketplace identity | Team admin |

---

## Files to Check Before Release

```
packages/vscode/
├── package.json         # version, metadata
├── README.md            # marketplace readme
├── CHANGELOG.md         # version notes
├── icons/               # extension icon
├── syntaxes/            # grammar files
└── src/                 # extension code
```
