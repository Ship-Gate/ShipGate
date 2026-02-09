import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { detectWorkspace, isWorkspacePackage } from '../src/workspace.js';

describe('Workspace Detection', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');

  it('should detect pnpm workspace', async () => {
    const projectRoot = path.join(fixturesDir, 'workspace-project');
    const workspaceInfo = await detectWorkspace(projectRoot);

    expect(workspaceInfo.isPnpmWorkspace).toBe(true);
    expect(workspaceInfo.workspacePackages.length).toBeGreaterThan(0);
    expect(workspaceInfo.workspacePackages).toContain('@isl-lang/isl-core');
  });

  it('should detect non-workspace project', async () => {
    const projectRoot = path.join(fixturesDir, 'valid-project');
    const workspaceInfo = await detectWorkspace(projectRoot);

    expect(workspaceInfo.isPnpmWorkspace).toBe(false);
  });

  it('should check if package is workspace package', async () => {
    const projectRoot = path.join(fixturesDir, 'workspace-project');
    const workspaceInfo = await detectWorkspace(projectRoot);

    expect(isWorkspacePackage('@isl-lang/isl-core', workspaceInfo)).toBe(true);
    expect(isWorkspacePackage('lodash', workspaceInfo)).toBe(false);
  });
});
