/**
 * File Upload Handlers
 * Implements the behavioral contracts from spec/uploads.isl
 */

import { v4 as uuid } from 'uuid';
import {
  type FileRecord,
  type UploadSession,
  type ApiResponse,
  FileStatus,
  FileCategory,
  ScanResult,
} from '../types.js';
import { files, uploadSessions, logAuditEvent } from '../store.js';

// ============================================
// Constants
// ============================================

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const PRESIGNED_URL_EXPIRY = 15 * 60; // 15 minutes

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
  'application/json',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/wav',
  'application/zip',
  'application/gzip',
]);

const BLOCKED_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.sh',
  '.ps1',
  '.dll',
  '.so',
  '.dylib',
]);

// ============================================
// Helpers
// ============================================

function getCategoryFromMimeType(mimeType: string): FileCategory {
  if (mimeType.startsWith('image/')) return FileCategory.IMAGE;
  if (mimeType.startsWith('video/')) return FileCategory.VIDEO;
  if (mimeType.startsWith('audio/')) return FileCategory.AUDIO;
  if (
    mimeType.startsWith('application/pdf') ||
    mimeType.includes('word') ||
    mimeType.startsWith('text/')
  ) {
    return FileCategory.DOCUMENT;
  }
  if (mimeType.includes('zip') || mimeType.includes('gzip') || mimeType.includes('tar')) {
    return FileCategory.ARCHIVE;
  }
  return FileCategory.OTHER;
}

function generatePresignedUrl(fileId: string): string {
  // Mock presigned URL - in production this would be S3, GCS, etc.
  const token = uuid().replace(/-/g, '');
  return `https://storage.example.com/upload/${fileId}?token=${token}&expires=${Date.now() + PRESIGNED_URL_EXPIRY * 1000}`;
}

function generatePublicUrl(fileId: string, filename: string): string {
  return `https://cdn.example.com/files/${fileId}/${encodeURIComponent(filename)}`;
}

function hasBlockedExtension(filename: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  return BLOCKED_EXTENSIONS.has(ext);
}

// Mock user storage quota (in production, fetch from database)
const userQuotas = new Map<string, { used: number; limit: number }>();

function getUserStorageQuota(userId: string): { used: number; limit: number } {
  if (!userQuotas.has(userId)) {
    userQuotas.set(userId, { used: 0, limit: 1024 * 1024 * 1024 }); // 1GB default
  }
  return userQuotas.get(userId)!;
}

// ============================================
// InitiateUpload Handler
// ============================================

export interface InitiateUploadInput {
  filename: string;
  mime_type: string;
  size: number;
  category?: FileCategory;
  metadata?: Record<string, string>;
}

export interface InitiateUploadSuccess {
  file_id: string;
  upload_url: string;
  expires_in: number;
  max_size: number;
}

export async function initiateUpload(
  input: InitiateUploadInput,
  user_id: string
): Promise<ApiResponse<InitiateUploadSuccess>> {
  // Preconditions
  if (!input.filename || input.filename.length === 0) {
    return {
      success: false,
      error: {
        code: 'INVALID_FILENAME',
        message: 'Filename is required',
        retriable: true,
      },
    };
  }

  if (input.filename.length > 255) {
    return {
      success: false,
      error: {
        code: 'INVALID_FILENAME',
        message: 'Filename must be 255 characters or less',
        retriable: true,
      },
    };
  }

  if (hasBlockedExtension(input.filename)) {
    return {
      success: false,
      error: {
        code: 'INVALID_MIME_TYPE',
        message: 'File type is not allowed',
        retriable: false,
      },
    };
  }

  if (input.size <= 0) {
    return {
      success: false,
      error: {
        code: 'FILE_TOO_LARGE',
        message: 'File size must be greater than 0',
        retriable: false,
      },
    };
  }

  if (input.size > MAX_FILE_SIZE) {
    return {
      success: false,
      error: {
        code: 'FILE_TOO_LARGE',
        message: `File size exceeds maximum allowed (${MAX_FILE_SIZE / 1024 / 1024}MB)`,
        retriable: false,
      },
    };
  }

  if (!ALLOWED_MIME_TYPES.has(input.mime_type)) {
    return {
      success: false,
      error: {
        code: 'INVALID_MIME_TYPE',
        message: 'MIME type is not allowed',
        retriable: false,
      },
    };
  }

  // Check quota
  const quota = getUserStorageQuota(user_id);
  if (quota.used + input.size > quota.limit) {
    return {
      success: false,
      error: {
        code: 'QUOTA_EXCEEDED',
        message: 'User storage quota exceeded',
        retriable: false,
      },
    };
  }

  const now = new Date();
  const file_id = uuid();

  // Create file record
  const file = files.create({
    id: file_id,
    user_id,
    filename: `${file_id}_${input.filename}`,
    original_filename: input.filename,
    mime_type: input.mime_type,
    size: input.size,
    category: input.category || getCategoryFromMimeType(input.mime_type),
    status: FileStatus.PENDING_UPLOAD,
    storage_path: `/uploads/${user_id}/${file_id}`,
    checksum_sha256: '',
    metadata: input.metadata,
    created_at: now,
    updated_at: now,
  });

  // Create upload session
  const presigned_url = generatePresignedUrl(file_id);
  const upload_session = uploadSessions.create({
    id: uuid(),
    file_id,
    user_id,
    presigned_url,
    expires_at: new Date(now.getTime() + PRESIGNED_URL_EXPIRY * 1000),
    created_at: now,
    completed: false,
  });

  logAuditEvent({
    type: 'upload.initiated',
    actor_id: user_id,
    resource_type: 'file',
    resource_id: file_id,
    action: 'INITIATE',
    metadata: { filename: input.filename, size: input.size },
  });

  return {
    success: true,
    data: {
      file_id,
      upload_url: presigned_url,
      expires_in: PRESIGNED_URL_EXPIRY,
      max_size: MAX_FILE_SIZE,
    },
  };
}

// ============================================
// CompleteUpload Handler
// ============================================

export interface CompleteUploadInput {
  file_id: string;
  checksum?: string;
  etag?: string;
}

export async function completeUpload(
  input: CompleteUploadInput,
  user_id: string
): Promise<ApiResponse<FileRecord>> {
  const file = files.get(input.file_id);

  if (!file) {
    return {
      success: false,
      error: {
        code: 'FILE_NOT_FOUND',
        message: 'File record does not exist',
        retriable: false,
      },
    };
  }

  if (file.user_id !== user_id) {
    return {
      success: false,
      error: {
        code: 'FILE_NOT_FOUND',
        message: 'File not found',
        retriable: false,
      },
    };
  }

  if (file.status !== FileStatus.PENDING_UPLOAD && file.status !== FileStatus.UPLOADING) {
    return {
      success: false,
      error: {
        code: 'UPLOAD_NOT_STARTED',
        message: 'No upload was initiated for this file',
        retriable: false,
      },
    };
  }

  const session = uploadSessions.findBy((s) => s.file_id === input.file_id);

  if (!session) {
    return {
      success: false,
      error: {
        code: 'UPLOAD_NOT_STARTED',
        message: 'No upload session found',
        retriable: false,
      },
    };
  }

  if (session.expires_at < new Date()) {
    files.update(file.id, { status: FileStatus.FAILED, updated_at: new Date() });
    return {
      success: false,
      error: {
        code: 'UPLOAD_EXPIRED',
        message: 'Upload session has expired',
        retriable: false,
      },
    };
  }

  // Mock checksum validation
  if (input.checksum && input.checksum === 'invalid') {
    files.update(file.id, { status: FileStatus.FAILED, updated_at: new Date() });
    return {
      success: false,
      error: {
        code: 'CHECKSUM_MISMATCH',
        message: 'File checksum does not match expected',
        retriable: true,
      },
    };
  }

  const now = new Date();

  // Update file status to scanning
  const updated = files.update(file.id, {
    status: FileStatus.SCANNING,
    checksum_sha256: input.checksum || `sha256_${uuid().replace(/-/g, '')}`,
    updated_at: now,
  })!;

  // Mark session as completed
  uploadSessions.update(session.id, { completed: true });

  // Update user quota
  const quota = getUserStorageQuota(user_id);
  quota.used += file.size;

  logAuditEvent({
    type: 'upload.completed',
    actor_id: user_id,
    resource_type: 'file',
    resource_id: file.id,
    action: 'COMPLETE',
  });

  return { success: true, data: updated };
}

// ============================================
// ProcessFile Handler
// ============================================

export interface ProcessFileInput {
  file_id: string;
  scan_result: ScanResult;
}

export async function processFile(
  input: ProcessFileInput
): Promise<ApiResponse<FileRecord>> {
  const file = files.get(input.file_id);

  if (!file) {
    return {
      success: false,
      error: {
        code: 'FILE_NOT_FOUND',
        message: 'File does not exist',
        retriable: false,
      },
    };
  }

  if (file.status !== FileStatus.SCANNING) {
    return {
      success: false,
      error: {
        code: 'FILE_NOT_FOUND',
        message: 'File is not in scanning state',
        retriable: false,
      },
    };
  }

  const now = new Date();

  if (input.scan_result === ScanResult.INFECTED || input.scan_result === ScanResult.SUSPICIOUS) {
    const updated = files.update(file.id, {
      status: FileStatus.QUARANTINED,
      scan_result: input.scan_result,
      updated_at: now,
    })!;

    logAuditEvent({
      type: 'file.quarantined',
      resource_type: 'file',
      resource_id: file.id,
      action: 'QUARANTINE',
      metadata: { scan_result: input.scan_result },
    });

    return {
      success: false,
      error: {
        code: 'FILE_INFECTED',
        message: 'Virus scan detected malware',
        retriable: false,
      },
    };
  }

  // Generate public URL
  const public_url = generatePublicUrl(file.id, file.original_filename);

  const updated = files.update(file.id, {
    status: FileStatus.READY,
    scan_result: ScanResult.CLEAN,
    public_url,
    updated_at: now,
  })!;

  logAuditEvent({
    type: 'file.ready',
    resource_type: 'file',
    resource_id: file.id,
    action: 'PROCESS_COMPLETE',
  });

  return { success: true, data: updated };
}

// ============================================
// GetFile Handler
// ============================================

export interface GetFileInput {
  file_id: string;
  variant?: string;
}

export interface GetFileSuccess {
  file: FileRecord;
  download_url: string;
  expires_in: number;
}

export async function getFile(
  input: GetFileInput,
  user_id?: string
): Promise<ApiResponse<GetFileSuccess>> {
  const file = files.get(input.file_id);

  if (!file) {
    return {
      success: false,
      error: {
        code: 'FILE_NOT_FOUND',
        message: 'File does not exist',
        retriable: false,
      },
    };
  }

  // Check access (simplified - in production check permissions)
  if (user_id && file.user_id !== user_id) {
    return {
      success: false,
      error: {
        code: 'ACCESS_DENIED',
        message: 'User does not have permission to access file',
        retriable: false,
      },
    };
  }

  if (file.status !== FileStatus.READY) {
    return {
      success: false,
      error: {
        code: 'FILE_NOT_READY',
        message: 'File is still processing',
        retriable: true,
        retry_after: 5,
      },
    };
  }

  // Generate signed download URL
  const token = uuid().replace(/-/g, '');
  const expires_in = 3600; // 1 hour
  const download_url = `${file.public_url}?token=${token}&expires=${Date.now() + expires_in * 1000}`;

  logAuditEvent({
    type: 'file.accessed',
    actor_id: user_id,
    resource_type: 'file',
    resource_id: file.id,
    action: 'DOWNLOAD',
  });

  return {
    success: true,
    data: {
      file,
      download_url,
      expires_in,
    },
  };
}

// ============================================
// DeleteFile Handler
// ============================================

export interface DeleteFileInput {
  file_id: string;
  permanent?: boolean;
}

export interface DeleteFileSuccess {
  deleted: boolean;
  variants_deleted: number;
}

export async function deleteFile(
  input: DeleteFileInput,
  user_id: string
): Promise<ApiResponse<DeleteFileSuccess>> {
  const file = files.get(input.file_id);

  if (!file) {
    return {
      success: false,
      error: {
        code: 'FILE_NOT_FOUND',
        message: 'File does not exist',
        retriable: false,
      },
    };
  }

  if (file.user_id !== user_id) {
    return {
      success: false,
      error: {
        code: 'ACCESS_DENIED',
        message: 'User does not have permission to delete file',
        retriable: false,
      },
    };
  }

  // Update file status
  files.update(file.id, {
    status: FileStatus.DELETED,
    updated_at: new Date(),
  });

  // Update user quota
  const quota = getUserStorageQuota(user_id);
  quota.used = Math.max(0, quota.used - file.size);

  logAuditEvent({
    type: 'file.deleted',
    actor_id: user_id,
    resource_type: 'file',
    resource_id: file.id,
    action: 'DELETE',
    metadata: { permanent: input.permanent },
  });

  return {
    success: true,
    data: {
      deleted: true,
      variants_deleted: 0, // Mock - no variants in this demo
    },
  };
}

// ============================================
// ListFiles Handler
// ============================================

export interface ListFilesInput {
  user_id?: string;
  category?: FileCategory;
  status?: FileStatus;
  limit?: number;
  cursor?: string;
}

export interface ListFilesSuccess {
  files: FileRecord[];
  next_cursor?: string;
  total_count: number;
}

export async function listFiles(
  input: ListFilesInput,
  requesting_user_id: string
): Promise<ApiResponse<ListFilesSuccess>> {
  const user_id = input.user_id || requesting_user_id;
  const limit = Math.min(input.limit ?? 20, 100);

  let userFiles = files.findAll((f) => f.user_id === user_id && f.status !== FileStatus.DELETED);

  if (input.category) {
    userFiles = userFiles.filter((f) => f.category === input.category);
  }

  if (input.status) {
    userFiles = userFiles.filter((f) => f.status === input.status);
  }

  // Sort by created_at descending
  userFiles.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

  const total_count = userFiles.length;

  // Handle cursor pagination
  if (input.cursor) {
    const cursorIndex = userFiles.findIndex((f) => f.id === input.cursor);
    if (cursorIndex >= 0) {
      userFiles = userFiles.slice(cursorIndex + 1);
    }
  }

  const has_more = userFiles.length > limit;
  const result = userFiles.slice(0, limit);
  const next_cursor = has_more ? result[result.length - 1]?.id : undefined;

  return {
    success: true,
    data: {
      files: result,
      next_cursor,
      total_count,
    },
  };
}
