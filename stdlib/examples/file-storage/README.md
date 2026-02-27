# File Storage Service Example

A file storage service demonstrating ISL upload modules.

## Features

- Secure file upload with MIME validation
- Image processing with thumbnails
- Presigned download URLs
- Folder organization
- Storage quota tracking

## Modules Used

```isl
import { ValidateMimeType, CheckFileSafety, ValidateImageMime } from "@isl/stdlib/uploads/validate-mime"
import { StoreBlob, GeneratePresignedUrl, DeleteBlob } from "@isl/stdlib/uploads/store-blob"
import { InitiateImageUpload, CompleteImageUpload } from "@isl/stdlib/uploads/upload-image"
```

## Key Behaviors

- `UploadFile` - Upload any file with validation
- `UploadImage` - Upload images with thumbnail generation
- `DownloadFile` - Get presigned download URL
- `ShareFile` - Create shareable link
- `ListFiles` - Browse files
- `DeleteFile` - Remove file
- `GetStorageUsage` - Check quota

## Security

All uploads are validated:
1. Magic bytes check (real file type)
2. MIME type consistency
3. Executable blocking
4. Size limits
5. Quota enforcement
