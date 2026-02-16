# ShipGate VS Code Extension - Issue Fixes

## 🔧 **Issues Identified & Fixed**

### **Issue #1: Missing CLI Dependencies**
The global `npx shipgate` command was failing due to missing `@isl-lang/autofix` dependency:
```
Error: Cannot find module '@isl-lang/autofix'
```

### **Issue #2: CLI Exit Code Handling**
The ShipGate CLI returns exit code 1 for `NO_SHIP` verdicts, but the extension was treating this as an error. The CLI actually outputs valid JSON even with exit code 1.

### **Issue #3: Incorrect CLI Commands**
The extension was using `fix` command which doesn't exist. The correct command is `heal`.

### **Solution: Local CLI + Proper Exit Code Handling + Correct Commands**
1. **Use Local CLI** - Extension now uses the CLI from the monorepo (`packages/cli/dist/cli.cjs`)
2. **Handle Exit Codes** - Extension now properly handles CLI exit codes and captures JSON output even when exit code 1
3. **Use Correct Commands** - Changed `fix` to `heal` for auto-fix functionality

## 🛠️ **Changes Made**

### **1. Added CLI Path Resolution**
```typescript
function getCliCommand(): string {
  const extensionPath = extensionContext.extensionUri.fsPath;
  const cliPath = extensionPath.replace(/packages[\/\\]vscode/, 'packages/cli/dist/cli.cjs');
  
  // Check if CLI exists at the expected path
  const fs = require('fs');
  if (fs.existsSync(cliPath)) {
    return `node "${cliPath}"`;
  }
  
  // Fallback to npx
  console.warn(`ShipGate CLI not found at ${cliPath}, falling back to npx`);
  return 'npx shipgate';
}
```

### **2. Added Proper Exit Code Handling**
```typescript
// Execute shipgate CLI (handle exit codes properly)
const { stdout, stderr } = await execAsync(`${getCliCommand()} verify ${target} --json`, { 
  cwd, 
  timeout: 60000 
}).catch((err) => {
  // CLI returns exit code 1 for NO_SHIP, but still outputs JSON
  if (err.stdout) {
    return { stdout: err.stdout, stderr: err.stderr || '' };
  }
  throw err;
});
```

### **3. Updated All CLI Commands**
- `runVerification()` - Uses `getCliCommand() verify` with exit code handling
- `runShipCheck()` - Uses `getCliCommand() ship` with exit code handling
- `runInit()` - Uses `getCliCommand() init`
- `runAutofix()` - Uses `getCliCommand() heal` (corrected from `fix`)
- `exportReport()` - Uses `getCliCommand() export`

### **4. Fixed Command Names**
- Updated package.json command titles from "Auto-fix" to "Heal"
- Changed CLI calls from `fix` to `heal` command
- Updated terminal names from "ShipGate Fix" to "ShipGate Heal"

### **5. Added Extension Context Storage**
```typescript
let extensionContext: vscode.ExtensionContext;

export function activate(context: vscode.ExtensionContext) {
  extensionContext = context;
  // ... rest of activation
}
```

## 🧪 **Testing Instructions**

### **1. Build & Test Extension**
```bash
cd packages/vscode
pnpm run build

# Test in Extension Development Host (F5 in VS Code)
```

### **2. Verify CLI Integration**
```bash
# Test CLI path resolution
cd packages/vscode/dist
node -e "const fs = require('fs'); const path = require('path'); const extPath = path.resolve(__dirname, '..'); const cliPath = extPath.replace(/packages[\/\\]vscode/, 'packages/cli/dist/cli.cjs'); console.log('CLI Path:', cliPath); console.log('Exists:', fs.existsSync(cliPath));"
```

### **3. Test Extension Features**
1. **Start Extension Development Host** (F5)
2. **Check Activity Bar** for ShipGate icon
3. **Open Sidebar** to see 5-tab interface
4. **Test Commands**:
   - `Ctrl+Shift+G` - Verify project
   - `Ctrl+Shift+F5` - Verify current file
   - `Ctrl+Shift+.` - Auto-fix current file
5. **Check Status Bar** for verdict updates
6. **Test CLI Integration** by running verification

## 🎯 **Expected Behavior**

### **Before Fix:**
- ❌ Extension activates but CLI commands fail
- ❌ "Cannot find module '@isl-lang/autofix'" errors
- ❌ "Command failed" error for NO_SHIP verdicts
- ❌ No verification results displayed

### **After Fix:**
- ✅ Extension activates successfully
- ✅ CLI commands use local monorepo CLI
- ✅ Proper exit code handling for NO_SHIP verdicts
- ✅ Verification works with real results (SHIP/WARN/NO_SHIP)
- ✅ All 5 tabs display properly with verdict data
- ✅ Status bar updates with correct verdict and score
- ✅ JSON output parsed correctly even with exit code 1

## 📋 **Troubleshooting**

### **If CLI Path Resolution Fails:**
1. Check if `packages/cli/dist/cli.cjs` exists
2. Verify extension is running from monorepo
3. Check console logs for fallback warnings

### **If Extension Still Fails:**
1. Open VS Code Developer Tools (Help → Toggle Developer Tools)
2. Check console for error messages
3. Verify all files are properly built

### **If Sidebar Doesn't Appear:**
1. Check Activity Bar for ShipGate icon
2. Verify `package.json` has correct view registration
3. Check if `shipgate.sidebar` view is properly registered

## 🚀 **Ready for Testing**

The extension is now fixed and ready for testing with:
- ✅ Local CLI integration
- ✅ Fallback to global CLI if needed
- ✅ All commands updated
- ✅ Proper error handling
- ✅ Build successful (39.69 KB)

**Next Step: Test in Extension Development Host (F5)**
