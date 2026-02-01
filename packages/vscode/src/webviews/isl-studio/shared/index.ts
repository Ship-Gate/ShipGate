/**
 * ISL Studio Shared Utilities
 * 
 * Common utilities for ISL Studio webview modules.
 * 
 * @module shared
 */

// Paths
export {
  VIBECHECK_DIR,
  STUDIO_DIR,
  STATE_FILE,
  getVibecheckDir,
  getStudioDir,
  getStatePath,
  getTempPath,
  getBackupPath,
  createStudioPaths,
  normalizePath,
  isWithinWorkspace,
  type StudioPaths,
} from './paths';

// JSON Store
export {
  readJson,
  readJsonSync,
  writeJson,
  writeJsonSync,
  updateJson,
  ensureDir,
  ensureDirSync,
  fileExists,
  fileExistsSync,
  deleteFile,
  type JsonStoreOptions,
} from './jsonStore';
