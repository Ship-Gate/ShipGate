/**
 * @packageDocumentation
 * @isl-lang/stdlib-files
 */

// ============================================================================
// CORE EXPORTS
// ============================================================================

export * from './types.js';
export * from './errors.js';

// ============================================================================
// STORAGE ADAPTERS
// ============================================================================

export * from './storage/index.js';

// ============================================================================
// FILE OPERATIONS
// ============================================================================

export * from './operations/index.js';

// ============================================================================
// UPLOAD HANDLERS
// ============================================================================

export * from './upload/index.js';

// ============================================================================
// DOWNLOAD HANDLERS
// ============================================================================

export * from './download/index.js';

// ============================================================================
// TRANSFORMS
// ============================================================================

export * from './transform/index.js';

// ============================================================================
// CONVENIENCE FACTORIES
// ============================================================================

import { LocalStorageAdapter } from './storage/local.js';
import { MemoryStorageAdapter } from './storage/memory.js';
import { 
  createReadOperations,
  createWriteOperations,
  createCopyOperations,
  createDeleteOperations,
  createListOperations,
  createMetadataOperations
} from './operations/index.js';
import { 
  createUploadHandler 
} from './upload/index.js';
import { 
  createDownloadHandler 
} from './download/index.js';

// Create a unified file system interface
export function createFileSystem(
  adapter: 'local' | 'memory',
  config?: any
) {
  const storage = adapter === 'local' ? 
    new LocalStorageAdapter() : 
    new MemoryStorageAdapter();

  if (config && adapter === 'local') {
    // Initialize with config if needed
  }

  return {
    storage,
    read: createReadOperations(storage),
    write: createWriteOperations(storage),
    copy: createCopyOperations(storage),
    delete: createDeleteOperations(storage),
    list: createListOperations(storage),
    metadata: createMetadataOperations(storage),
    upload: createUploadHandler(storage),
    download: createDownloadHandler(storage)
  };
}
