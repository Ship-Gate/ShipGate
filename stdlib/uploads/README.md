# ISL Standard Library: Uploads

File upload and storage modules for ISL.

## Modules

### UploadImage
Image upload with processing and thumbnail generation.

```isl
import { InitiateImageUpload, CompleteImageUpload } from "@isl/stdlib/uploads/upload-image"

behavior UploadAvatar {
  step 1: InitiateImageUpload(user_id, filename: "avatar.jpg", content_type: "image/jpeg")
  # Client uploads to presigned URL
  step 2: CompleteImageUpload(session_id, generate_thumbnails: true)
}
```

**Behaviors:**
- `InitiateImageUpload` - Create signed upload URL
- `CompleteImageUpload` - Process uploaded image
- `UploadImageDirect` - Direct upload for small images
- `ResizeImage` - Resize existing image
- `DeleteImage` - Delete image and thumbnails
- `GetImage` - Retrieve image metadata
- `ListUserImages` - List user's images

### ValidateMime
MIME type validation and file safety checks.

```isl
import { ValidateMimeType, CheckFileSafety } from "@isl/stdlib/uploads/validate-mime"

behavior SecureUpload {
  step 1: ValidateMimeType(data: file_header, claimed_mime: content_type)
  step 2: CheckFileSafety(data: file_header, filename, block_executables: true)
}
```

**Behaviors:**
- `ValidateMimeType` - Validate by magic bytes
- `CheckFileSafety` - Check file safety
- `ValidateImageMime` - Validate image files
- `ValidateDocumentMime` - Validate documents
- `GetMimeTypeInfo` - Get MIME type details
- `DetectMimeFromExtension` - Detect from extension
- `ValidateMimeConsistency` - Check consistency

### StoreBlob
Generic blob storage with multipart upload support.

```isl
import { StoreBlob, GeneratePresignedUrl } from "@isl/stdlib/uploads/store-blob"

behavior UploadDocument {
  step 1: StoreBlob(
    owner_id: user.id,
    bucket: "documents",
    key: "user/" + user.id + "/file.pdf",
    data: file_data,
    content_type: "application/pdf"
  )
}
```

**Behaviors:**
- `StoreBlob` - Store blob directly
- `InitiateMultipartUpload` - Start multipart upload
- `UploadPart` - Upload part of multipart
- `CompleteMultipartUpload` - Complete multipart
- `AbortMultipartUpload` - Abort multipart
- `GetBlob` - Get blob metadata
- `GetBlobContent` - Download blob content
- `GeneratePresignedUrl` - Create presigned URL
- `DeleteBlob` - Delete blob
- `CopyBlob` - Copy blob to new location
- `ListBlobs` - List blobs in bucket

## Supported Storage Providers

- AWS S3
- Google Cloud Storage
- Azure Blob Storage
- MinIO
- Local filesystem

## Security Features

All upload modules include:
- Magic bytes validation
- MIME type verification
- Malware scanning hooks
- EXIF stripping for images
- Rate limiting
- Quota enforcement
- Presigned URL expiration

## Usage

```isl
domain FileService {
  import { InitiateImageUpload, CompleteImageUpload } from "@isl/stdlib/uploads/upload-image"
  import { ValidateMimeType, CheckFileSafety } from "@isl/stdlib/uploads/validate-mime"
  import { StoreBlob } from "@isl/stdlib/uploads/store-blob"
  
  behavior UploadProfilePicture {
    input {
      user_id: UUID
      filename: String
      content_type: String
    }
    
    pre {
      content_type in ["image/jpeg", "image/png", "image/webp"]
    }
    
    step 1: InitiateImageUpload(
      user_id: input.user_id,
      filename: input.filename,
      content_type: input.content_type,
      max_size_bytes: 5242880  # 5MB
    )
  }
}
```

## Best Practices

1. **Always validate MIME types** - Don't trust Content-Type headers
2. **Use presigned URLs** - For large files to offload bandwidth
3. **Generate thumbnails** - Create multiple sizes on upload
4. **Set expiration** - Use expires_at for temporary files
5. **Enforce quotas** - Track and limit user storage
