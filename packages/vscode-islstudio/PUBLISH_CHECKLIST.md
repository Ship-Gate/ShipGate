# VS Code Extension Publishing Checklist

## Pre-Publishing

### 1. Build & Test
- [ ] Run `npm run build` successfully
- [ ] Test extension locally using F5 (Debug Extension)
- [ ] Verify all commands work
- [ ] Test sidebar tree view
- [ ] Test heal UI webview
- [ ] Test diagnostics provider
- [ ] Test on Windows, macOS, and Linux (if possible)

### 2. Package Preparation
- [ ] Update version in `package.json`
- [ ] Update CHANGELOG.md with new features
- [ ] Ensure README.md is up to date
- [ ] Verify all icons/assets are included
- [ ] Check that `main` points to correct entry file (`./dist/extension.js`)

### 3. Marketplace Assets
- [ ] Create/update icon (128x128 PNG) at `icon.png`
- [ ] Create/update README.md with screenshots
- [ ] Prepare screenshots/gifs for marketplace listing
- [ ] Write clear description and keywords

## Publishing to VS Code Marketplace

### 1. Install vsce (VS Code Extension Manager)
```bash
npm install -g @vscode/vsce
```

### 2. Get Personal Access Token
1. Go to https://dev.azure.com
2. User Settings → Personal Access Tokens
3. Create new token with "Marketplace (Manage)" scope
4. Save token securely

### 3. Create Publisher (if needed)
```bash
vsce create-publisher <publisher-name>
```

### 4. Package Extension
```bash
cd packages/vscode-islstudio
npm run build
vsce package
```

This creates `vscode-islstudio-<version>.vsix`

### 5. Publish to Marketplace
```bash
vsce publish -p <personal-access-token>
```

Or publish the .vsix file:
```bash
vsce publish -p <token> <path-to-vsix>
```

### 6. Verify Publication
- [ ] Check extension page on marketplace
- [ ] Verify all assets display correctly
- [ ] Test installation from marketplace

## Publishing to OpenVSX

### 1. Install ovsx CLI
```bash
npm install -g @openvsx/cli
```

### 2. Get OpenVSX Token
1. Go to https://open-vsx.org
2. Sign in with GitHub
3. Go to User Settings → Access Tokens
4. Create new token

### 3. Publish to OpenVSX
```bash
ovsx publish <path-to-vsix> -p <openvsx-token>
```

### 4. Verify Publication
- [ ] Check extension page on open-vsx.org
- [ ] Verify all assets display correctly
- [ ] Test installation from OpenVSX

## Post-Publishing

### 1. Documentation
- [ ] Update main README with installation instructions
- [ ] Add badges for marketplace/OpenVSX
- [ ] Document any breaking changes

### 2. Announcement
- [ ] Post release notes
- [ ] Share on social media/community channels
- [ ] Update project website if applicable

### 3. Monitor
- [ ] Watch for issues/feedback
- [ ] Monitor download/install stats
- [ ] Respond to reviews/questions

## Version Management

Follow semantic versioning:
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes

Update version in `package.json`:
```json
{
  "version": "0.3.0"
}
```

## Common Issues

### Issue: "Extension not found"
- Ensure `publisher` field in package.json matches your publisher name
- Check that extension ID is correct

### Issue: "Invalid icon"
- Icon must be 128x128 PNG
- Path must be relative to package.json

### Issue: "Missing dependencies"
- Run `npm install` before packaging
- Check that all dependencies are listed in package.json

### Issue: "Build errors"
- Ensure TypeScript compiles without errors
- Check that all imports resolve correctly
- Verify tsup config is correct

## CI/CD (Future)

Consider setting up automated publishing:
1. GitHub Actions workflow
2. Auto-publish on version tag
3. Automated testing before publish

Example workflow:
```yaml
name: Publish Extension
on:
  release:
    types: [created]
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run build
      - run: npm install -g @vscode/vsce
      - run: vsce publish -p ${{ secrets.VSCE_TOKEN }}
```

## Resources

- [VS Code Extension Publishing Guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [OpenVSX Publishing Guide](https://github.com/eclipse/openvsx/wiki/Publishing-Extensions)
- [vsce Documentation](https://github.com/microsoft/vscode-vsce)
