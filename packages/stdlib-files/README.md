# @intentos/stdlib-files

File storage standard library for IntentOS. Provides upload, download, and file management operations with full ISL specification.

## Features

- **Upload files** with presigned URLs for direct client upload
- **Download files** with presigned URLs for secure access
- **Delete files** with soft delete and permanent delete options
- **Folder management** with hierarchical organization
- **Access control** with private, shared, and public access levels
- **Storage quota** management and enforcement
- **S3 adapter** for AWS S3 and compatible storage (MinIO, R2, etc.)

## Installation

```bash
pnpm add @intentos/stdlib-files
```

## Quick Start

```typescript
import { createFileService, InMemoryStorageProvider } from '@intentos/stdlib-files';

// Create file service with S3 storage
const fileService = createFileService({
  s3: {
    provider: 'S3',
    bucket: 'my-bucket',
    region: 'us-east-1',
  },
  fileRepository: myFileRepo,
  folderRepository: myFolderRepo,
  quotaService: myQuotaService,
});

// Upload a file
const uploadResult = await fileService.upload({
  name: 'document.pdf',
  mimeType: 'application/pdf',
  size: 1024000,
  checksum: 'sha256-hash-here',
}, userId);

// Client uploads directly to uploadResult.uploadUrl

// Complete the upload
const file = await fileService.completeUpload({
  fileId: uploadResult.file.id,
}, userId);

// Download a file
const downloadResult = await fileService.download({
  fileId: file.id,
  expiresIn: 3600, // 1 hour
}, userId);

// Use downloadResult.downloadUrl

// Delete a file
await fileService.delete({ fileId: file.id }, userId);
```

## ISL Specification

The complete ISL specification is in the `intents/` directory:

```
intents/
├── domain.isl           # Main domain definition
├── file.isl             # File entity
├── folder.isl           # Folder entity and behaviors
└── behaviors/
    ├── upload.isl       # Upload, CompleteUpload behaviors
    ├── download.isl     # Download, GetDownloadUrl behaviors
    ├── delete.isl       # Delete, BulkDelete, Restore behaviors
    └── presign.isl      # Presigned URL behaviors
```

### Key Behaviors

#### Upload

```isl
behavior Upload {
  input {
    name: String { max_length: 255 }
    folder_id: FolderId?
    mime_type: MimeType
    size: FileSize
    checksum: String  // SHA-256
  }
  
  output {
    success: UploadResult
    errors { FOLDER_NOT_FOUND, QUOTA_EXCEEDED, FILE_TOO_LARGE, INVALID_MIME_TYPE }
  }
  
  temporal {
    response within 200.ms (p99)
  }
}
```

#### Download

```isl
behavior Download {
  input {
    file_id: FileId
    expires_in: Duration { min: 1.minute, max: 7.days }
  }
  
  output {
    success: DownloadResult
    errors { FILE_NOT_FOUND, ACCESS_DENIED, FILE_NOT_READY }
  }
  
  temporal {
    response within 100.ms (p99)
  }
}
```

#### Delete

```isl
behavior Delete {
  input {
    file_id: FileId
    permanent: Boolean = false
  }
  
  temporal {
    eventually within 24.hours: storage_data_purged
  }
  
  compliance {
    gdpr { must_support_deletion_request }
  }
}
```

## Storage Providers

### S3 Provider

Works with AWS S3 and compatible services:

```typescript
import { S3StorageProvider, createS3ProviderFromEnv } from '@intentos/stdlib-files/s3';

// From configuration
const s3 = new S3StorageProvider({
  provider: 'S3',
  bucket: 'my-bucket',
  region: 'us-east-1',
  endpoint: 'https://s3.amazonaws.com', // Optional for custom endpoints
});

// From environment variables
const s3 = createS3ProviderFromEnv();
// Uses: S3_BUCKET, S3_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
```

### In-Memory Provider (Testing)

```typescript
import { InMemoryStorageProvider } from '@intentos/stdlib-files';

const storage = new InMemoryStorageProvider('test-bucket');
```

## Access Control

Files support three access levels:

- **PRIVATE**: Only the owner can access
- **SHARED**: Owner + explicitly shared users can access
- **PUBLIC**: Anyone with the URL can access

```typescript
// Upload with access level
const result = await fileService.upload({
  name: 'photo.jpg',
  mimeType: 'image/jpeg',
  size: 50000,
  checksum: 'sha256...',
  accessLevel: AccessLevel.PUBLIC,
}, userId);
```

## Folder Organization

Files can be organized into folders:

```isl
entity Folder {
  id: FolderId [immutable, unique]
  name: String { max_length: 255 }
  path: FilePath [unique]
  parent_id: FolderId?
  depth: Int { min: 0, max: 50 }
  
  invariants {
    parent_id != null implies depth == Folder.lookup(parent_id).depth + 1
    not is_ancestor_of(self)  // No circular references
  }
}
```

## Error Handling

All operations return typed errors:

```typescript
import {
  FileNotFoundError,
  FolderNotFoundError,
  AccessDeniedError,
  QuotaExceededError,
  FileTooLargeError,
  InvalidMimeTypeError,
  ChecksumMismatchError,
} from '@intentos/stdlib-files';

try {
  await fileService.download({ fileId: 'invalid' }, userId);
} catch (error) {
  if (error instanceof FileNotFoundError) {
    // Handle not found
  } else if (error instanceof AccessDeniedError) {
    // Handle access denied
  }
}
```

## Configuration Options

```typescript
interface FileServiceConfig {
  maxFileSize: number;              // Max file size in bytes (default: 5GB)
  allowedMimeTypes?: string[];      // Allowlist of MIME types (default: all)
  uploadExpirySeconds: number;      // Upload URL expiry (default: 3600)
  defaultDownloadExpirySeconds: number; // Download URL expiry (default: 3600)
  restoreWindowDays: number;        // Days to restore deleted files (default: 30)
}
```

## Compliance

The specification includes GDPR compliance annotations:

- Files must be permanently deleted within 24 hours of deletion request
- Soft delete allows for accidental deletion recovery
- Permanent delete satisfies right-to-erasure requests

## License

MIT
