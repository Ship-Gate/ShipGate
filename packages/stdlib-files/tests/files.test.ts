/**
 * Tests for stdlib-files
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  FileService,
  FileStatus,
  AccessLevel,
  InMemoryStorageProvider,
  FileNotFoundError,
  FolderNotFoundError,
  AccessDeniedError,
  QuotaExceededError,
  FileTooLargeError,
  InvalidMimeTypeError,
  ChecksumMismatchError,
  type File,
  type Folder,
  type FileRepository,
  type FolderRepository,
  type UserQuotaService,
  type FileServiceConfig,
} from '../implementations/typescript/index.js';

// ============================================================================
// MOCKS
// ============================================================================

function createMockFileRepository(): FileRepository & { files: Map<string, File> } {
  const files = new Map<string, File>();
  let idCounter = 1;

  return {
    files,
    
    async create(data) {
      const id = `file-${idCounter++}`;
      const file: File = {
        ...data,
        id,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as File;
      files.set(id, file);
      return file;
    },

    async findById(id) {
      return files.get(id) ?? null;
    },

    async findByPath(path) {
      for (const file of files.values()) {
        if (file.path === path) return file;
      }
      return null;
    },

    async update(id, updates) {
      const file = files.get(id);
      if (!file) throw new Error('File not found');
      const updated = { ...file, ...updates, updatedAt: new Date() };
      files.set(id, updated);
      return updated;
    },

    async delete(id) {
      files.delete(id);
    },

    async findByOwner(ownerId, status) {
      return Array.from(files.values()).filter(
        f => f.ownerId === ownerId && (!status || f.status === status)
      );
    },

    async findByFolder(folderId) {
      return Array.from(files.values()).filter(f => f.folderId === folderId);
    },
  };
}

function createMockFolderRepository(): FolderRepository & { folders: Map<string, Folder> } {
  const folders = new Map<string, Folder>();
  let idCounter = 1;

  return {
    folders,

    async create(data) {
      const id = `folder-${idCounter++}`;
      const folder: Folder = {
        ...data,
        id,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Folder;
      folders.set(id, folder);
      return folder;
    },

    async findById(id) {
      return folders.get(id) ?? null;
    },

    async findByPath(path) {
      for (const folder of folders.values()) {
        if (folder.path === path) return folder;
      }
      return null;
    },

    async update(id, updates) {
      const folder = folders.get(id);
      if (!folder) throw new Error('Folder not found');
      const updated = { ...folder, ...updates, updatedAt: new Date() };
      folders.set(id, updated);
      return updated;
    },

    async delete(id) {
      folders.delete(id);
    },

    async findByParent(parentId) {
      return Array.from(folders.values()).filter(f => f.parentId === parentId);
    },

    async findByOwner(ownerId) {
      return Array.from(folders.values()).filter(f => f.ownerId === ownerId);
    },
  };
}

function createMockQuotaService(quota: number = 1024 * 1024 * 1024): UserQuotaService & { usage: Map<string, number> } {
  const usage = new Map<string, number>();

  return {
    usage,

    async getUsed(userId) {
      return usage.get(userId) ?? 0;
    },

    async getQuota() {
      return quota;
    },

    async checkAvailable(userId, additionalBytes) {
      const used = usage.get(userId) ?? 0;
      return used + additionalBytes <= quota;
    },

    async updateUsed(userId, deltaBytes) {
      const current = usage.get(userId) ?? 0;
      usage.set(userId, Math.max(0, current + deltaBytes));
    },
  };
}

// ============================================================================
// TEST SETUP
// ============================================================================

describe('FileService', () => {
  let storage: InMemoryStorageProvider;
  let fileRepo: ReturnType<typeof createMockFileRepository>;
  let folderRepo: ReturnType<typeof createMockFolderRepository>;
  let quotaService: ReturnType<typeof createMockQuotaService>;
  let service: FileService;
  const userId = 'user-123';

  beforeEach(() => {
    storage = new InMemoryStorageProvider('test-bucket');
    fileRepo = createMockFileRepository();
    folderRepo = createMockFolderRepository();
    quotaService = createMockQuotaService();

    const config: FileServiceConfig = {
      storage: { provider: 'S3', bucket: 'test-bucket', region: 'us-east-1' },
      maxFileSize: 100 * 1024 * 1024, // 100MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf', 'text/plain'],
      uploadExpirySeconds: 3600,
      defaultDownloadExpirySeconds: 3600,
      restoreWindowDays: 30,
    };

    service = new FileService(
      config,
      storage,
      fileRepo,
      folderRepo,
      quotaService
    );
  });

  // ============================================================================
  // UPLOAD TESTS
  // ============================================================================

  describe('upload', () => {
    it('should create file record and return presigned URL', async () => {
      const result = await service.upload({
        name: 'test.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
        checksum: 'abc123def456789012345678901234567890123456789012345678901234',
      }, userId);

      expect(result.file).toBeDefined();
      expect(result.file.name).toBe('test.jpg');
      expect(result.file.status).toBe(FileStatus.UPLOADING);
      expect(result.file.ownerId).toBe(userId);
      expect(result.uploadUrl).toBeDefined();
      expect(result.uploadUrl).toContain('storage.example.com');
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should reject invalid MIME types', async () => {
      await expect(service.upload({
        name: 'test.exe',
        mimeType: 'application/x-executable',
        size: 1024,
        checksum: 'abc123def456789012345678901234567890123456789012345678901234',
      }, userId)).rejects.toThrow(InvalidMimeTypeError);
    });

    it('should reject files exceeding max size', async () => {
      await expect(service.upload({
        name: 'large.jpg',
        mimeType: 'image/jpeg',
        size: 200 * 1024 * 1024, // 200MB
        checksum: 'abc123def456789012345678901234567890123456789012345678901234',
      }, userId)).rejects.toThrow(FileTooLargeError);
    });

    it('should reject when quota exceeded', async () => {
      quotaService.usage.set(userId, 1024 * 1024 * 1024 - 100); // Nearly at quota

      await expect(service.upload({
        name: 'test.jpg',
        mimeType: 'image/jpeg',
        size: 1024, // Would exceed
        checksum: 'abc123def456789012345678901234567890123456789012345678901234',
      }, userId)).rejects.toThrow(QuotaExceededError);
    });

    it('should reject for non-existent folder', async () => {
      await expect(service.upload({
        name: 'test.jpg',
        folderId: 'nonexistent-folder',
        mimeType: 'image/jpeg',
        size: 1024,
        checksum: 'abc123def456789012345678901234567890123456789012345678901234',
      }, userId)).rejects.toThrow(FolderNotFoundError);
    });

    it('should upload to specified folder', async () => {
      // Create folder first
      const folder = await folderRepo.create({
        name: 'uploads',
        path: '/uploads',
        parentId: null,
        depth: 0,
        ownerId: userId,
        accessLevel: AccessLevel.PRIVATE,
        sharedWith: [],
        inheritPermissions: true,
        metadata: {},
      });

      const result = await service.upload({
        name: 'test.jpg',
        folderId: folder.id,
        mimeType: 'image/jpeg',
        size: 1024,
        checksum: 'abc123def456789012345678901234567890123456789012345678901234',
      }, userId);

      expect(result.file.folderId).toBe(folder.id);
    });
  });

  // ============================================================================
  // COMPLETE UPLOAD TESTS
  // ============================================================================

  describe('completeUpload', () => {
    it('should mark file as ready when upload complete', async () => {
      // Create an uploading file
      const uploadResult = await service.upload({
        name: 'test.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
        checksum: 'abc123def456789012345678901234567890123456789012345678901234',
      }, userId);

      // Simulate the actual upload to storage
      storage.setFile(
        uploadResult.file.storageKey,
        Buffer.alloc(1024),
        'image/jpeg'
      );

      const file = await service.completeUpload({
        fileId: uploadResult.file.id,
      }, userId);

      expect(file.status).toBe(FileStatus.READY);
    });

    it('should reject for non-existent file', async () => {
      await expect(service.completeUpload({
        fileId: 'nonexistent',
      }, userId)).rejects.toThrow(FileNotFoundError);
    });

    it('should reject if not file owner', async () => {
      const uploadResult = await service.upload({
        name: 'test.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
        checksum: 'abc123def456789012345678901234567890123456789012345678901234',
      }, userId);

      await expect(service.completeUpload({
        fileId: uploadResult.file.id,
      }, 'different-user')).rejects.toThrow(AccessDeniedError);
    });
  });

  // ============================================================================
  // DOWNLOAD TESTS
  // ============================================================================

  describe('download', () => {
    let readyFile: File;

    beforeEach(async () => {
      // Create a ready file
      const uploadResult = await service.upload({
        name: 'test.pdf',
        mimeType: 'application/pdf',
        size: 2048,
        checksum: 'abc123def456789012345678901234567890123456789012345678901234',
      }, userId);

      storage.setFile(uploadResult.file.storageKey, Buffer.alloc(2048), 'application/pdf');
      readyFile = await service.completeUpload({ fileId: uploadResult.file.id }, userId);
    });

    it('should return download URL for owner', async () => {
      const result = await service.download({
        fileId: readyFile.id,
      }, userId);

      expect(result.downloadUrl).toBeDefined();
      expect(result.downloadUrl).toContain('storage.example.com');
      expect(result.file.id).toBe(readyFile.id);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should reject for non-existent file', async () => {
      await expect(service.download({
        fileId: 'nonexistent',
      }, userId)).rejects.toThrow(FileNotFoundError);
    });

    it('should reject for unauthorized user', async () => {
      await expect(service.download({
        fileId: readyFile.id,
      }, 'other-user')).rejects.toThrow(AccessDeniedError);
    });

    it('should allow download for public files', async () => {
      // Make file public
      await fileRepo.update(readyFile.id, { accessLevel: AccessLevel.PUBLIC });

      const result = await service.download({
        fileId: readyFile.id,
      }, 'other-user');

      expect(result.downloadUrl).toBeDefined();
    });

    it('should allow download for shared files', async () => {
      const otherUser = 'shared-user';
      await fileRepo.update(readyFile.id, {
        accessLevel: AccessLevel.SHARED,
        sharedWith: [otherUser],
      });

      const result = await service.download({
        fileId: readyFile.id,
      }, otherUser);

      expect(result.downloadUrl).toBeDefined();
    });

    it('should respect custom expiration', async () => {
      const result = await service.download({
        fileId: readyFile.id,
        expiresIn: 300, // 5 minutes
      }, userId);

      const expectedExpiry = Date.now() + 300 * 1000;
      expect(result.expiresAt.getTime()).toBeLessThanOrEqual(expectedExpiry + 1000);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  // ============================================================================
  // DELETE TESTS
  // ============================================================================

  describe('delete', () => {
    let readyFile: File;

    beforeEach(async () => {
      const uploadResult = await service.upload({
        name: 'test.txt',
        mimeType: 'text/plain',
        size: 512,
        checksum: 'abc123def456789012345678901234567890123456789012345678901234',
      }, userId);

      storage.setFile(uploadResult.file.storageKey, Buffer.alloc(512), 'text/plain');
      readyFile = await service.completeUpload({ fileId: uploadResult.file.id }, userId);
    });

    it('should soft delete file', async () => {
      const result = await service.delete({
        fileId: readyFile.id,
      }, userId);

      expect(result).toBe(true);

      const file = await fileRepo.findById(readyFile.id);
      expect(file?.status).toBe(FileStatus.DELETED);
      expect(file?.deletedAt).toBeDefined();
    });

    it('should permanently delete when specified', async () => {
      const result = await service.delete({
        fileId: readyFile.id,
        permanent: true,
      }, userId);

      expect(result).toBe(true);

      const file = await fileRepo.findById(readyFile.id);
      expect(file).toBeNull();

      // Storage should be cleared
      const exists = await storage.exists(readyFile.storageKey);
      expect(exists).toBe(false);
    });

    it('should reject for non-existent file', async () => {
      await expect(service.delete({
        fileId: 'nonexistent',
      }, userId)).rejects.toThrow(FileNotFoundError);
    });

    it('should reject for non-owner', async () => {
      await expect(service.delete({
        fileId: readyFile.id,
      }, 'other-user')).rejects.toThrow(AccessDeniedError);
    });

    it('should update quota on delete', async () => {
      const usedBefore = await quotaService.getUsed(userId);
      
      await service.delete({ fileId: readyFile.id }, userId);
      
      const usedAfter = await quotaService.getUsed(userId);
      expect(usedAfter).toBe(usedBefore - readyFile.size);
    });
  });

  // ============================================================================
  // BULK DELETE TESTS
  // ============================================================================

  describe('bulkDelete', () => {
    let files: File[];

    beforeEach(async () => {
      files = [];
      for (let i = 0; i < 3; i++) {
        const uploadResult = await service.upload({
          name: `file${i}.txt`,
          mimeType: 'text/plain',
          size: 100,
          checksum: 'abc123def456789012345678901234567890123456789012345678901234',
        }, userId);

        storage.setFile(uploadResult.file.storageKey, Buffer.alloc(100), 'text/plain');
        const file = await service.completeUpload({ fileId: uploadResult.file.id }, userId);
        files.push(file);
      }
    });

    it('should delete multiple files', async () => {
      const result = await service.bulkDelete({
        fileIds: files.map(f => f.id),
      }, userId);

      expect(result.deletedCount).toBe(3);
      expect(result.failedCount).toBe(0);
      expect(result.deleted).toHaveLength(3);
    });

    it('should handle partial failures', async () => {
      const fileIds = [...files.map(f => f.id), 'nonexistent'];

      const result = await service.bulkDelete({ fileIds }, userId);

      expect(result.deletedCount).toBe(3);
      expect(result.failedCount).toBe(1);
      expect(result.failed[0]?.fileId).toBe('nonexistent');
    });
  });

  // ============================================================================
  // PRESIGNED URL TESTS
  // ============================================================================

  describe('createPresignedUrl', () => {
    let readyFile: File;

    beforeEach(async () => {
      const uploadResult = await service.upload({
        name: 'test.png',
        mimeType: 'image/png',
        size: 1024,
        checksum: 'abc123def456789012345678901234567890123456789012345678901234',
      }, userId);

      storage.setFile(uploadResult.file.storageKey, Buffer.alloc(1024), 'image/png');
      readyFile = await service.completeUpload({ fileId: uploadResult.file.id }, userId);
    });

    it('should create GET presigned URL', async () => {
      const result = await service.createPresignedUrl({
        fileId: readyFile.id,
        operation: 'GET',
        expiresIn: 3600,
      }, userId);

      expect(result.url).toContain('operation=GET');
      expect(result.method).toBe('GET');
      expect(result.fileId).toBe(readyFile.id);
    });

    it('should create PUT presigned URL with key', async () => {
      const result = await service.createPresignedUrl({
        key: 'custom/path/file.txt',
        operation: 'PUT',
        expiresIn: 3600,
        contentType: 'text/plain',
      }, userId);

      expect(result.url).toContain('operation=PUT');
      expect(result.method).toBe('PUT');
    });

    it('should reject for unauthorized file access', async () => {
      await expect(service.createPresignedUrl({
        fileId: readyFile.id,
        operation: 'GET',
        expiresIn: 3600,
      }, 'other-user')).rejects.toThrow(AccessDeniedError);
    });
  });
});

// ============================================================================
// IN-MEMORY STORAGE TESTS
// ============================================================================

describe('InMemoryStorageProvider', () => {
  let storage: InMemoryStorageProvider;

  beforeEach(() => {
    storage = new InMemoryStorageProvider('test-bucket');
  });

  describe('upload and download', () => {
    it('should upload and download files', async () => {
      const content = Buffer.from('Hello, World!');

      await storage.upload({
        key: 'test/file.txt',
        body: content,
        contentType: 'text/plain',
      });

      const { body, metadata } = await storage.download('test/file.txt');
      
      const chunks: Uint8Array[] = [];
      const reader = body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      const downloaded = Buffer.concat(chunks);
      expect(downloaded.toString()).toBe('Hello, World!');
      expect(metadata.contentType).toBe('text/plain');
      expect(metadata.size).toBe(13);
    });
  });

  describe('metadata', () => {
    it('should return metadata for existing files', async () => {
      await storage.upload({
        key: 'test.txt',
        body: Buffer.from('test'),
        contentType: 'text/plain',
      });

      const metadata = await storage.getMetadata('test.txt');
      
      expect(metadata).not.toBeNull();
      expect(metadata?.key).toBe('test.txt');
      expect(metadata?.size).toBe(4);
    });

    it('should return null for non-existent files', async () => {
      const metadata = await storage.getMetadata('nonexistent.txt');
      expect(metadata).toBeNull();
    });
  });

  describe('exists', () => {
    it('should return true for existing files', async () => {
      await storage.upload({
        key: 'exists.txt',
        body: Buffer.from('test'),
        contentType: 'text/plain',
      });

      expect(await storage.exists('exists.txt')).toBe(true);
    });

    it('should return false for non-existent files', async () => {
      expect(await storage.exists('nonexistent.txt')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete files', async () => {
      await storage.upload({
        key: 'to-delete.txt',
        body: Buffer.from('test'),
        contentType: 'text/plain',
      });

      await storage.delete('to-delete.txt');

      expect(await storage.exists('to-delete.txt')).toBe(false);
    });
  });

  describe('deleteMany', () => {
    it('should delete multiple files', async () => {
      await storage.upload({ key: 'a.txt', body: Buffer.from('a'), contentType: 'text/plain' });
      await storage.upload({ key: 'b.txt', body: Buffer.from('b'), contentType: 'text/plain' });
      await storage.upload({ key: 'c.txt', body: Buffer.from('c'), contentType: 'text/plain' });

      const result = await storage.deleteMany(['a.txt', 'b.txt', 'nonexistent.txt']);

      expect(result.deleted).toContain('a.txt');
      expect(result.deleted).toContain('b.txt');
      expect(result.errors).toHaveLength(1);
      expect(await storage.exists('c.txt')).toBe(true);
    });
  });

  describe('copy', () => {
    it('should copy files', async () => {
      await storage.upload({
        key: 'original.txt',
        body: Buffer.from('original content'),
        contentType: 'text/plain',
      });

      await storage.copy({
        sourceKey: 'original.txt',
        destinationKey: 'copy.txt',
      });

      expect(await storage.exists('copy.txt')).toBe(true);
      
      const original = storage.getFile('original.txt');
      const copy = storage.getFile('copy.txt');
      expect(copy?.toString()).toBe(original?.toString());
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      await storage.upload({ key: 'folder/a.txt', body: Buffer.from('a'), contentType: 'text/plain' });
      await storage.upload({ key: 'folder/b.txt', body: Buffer.from('b'), contentType: 'text/plain' });
      await storage.upload({ key: 'folder/sub/c.txt', body: Buffer.from('c'), contentType: 'text/plain' });
      await storage.upload({ key: 'other/d.txt', body: Buffer.from('d'), contentType: 'text/plain' });
    });

    it('should list files with prefix', async () => {
      const result = await storage.list({ prefix: 'folder/' });

      expect(result.objects.length).toBe(3);
      expect(result.objects.map(o => o.key)).toContain('folder/a.txt');
    });

    it('should list with delimiter', async () => {
      const result = await storage.list({ prefix: 'folder/', delimiter: '/' });

      expect(result.objects.length).toBe(2);
      expect(result.prefixes).toContain('folder/sub/');
    });
  });

  describe('multipart upload', () => {
    it('should handle multipart uploads', async () => {
      const upload = await storage.createMultipartUpload({
        key: 'large-file.bin',
        contentType: 'application/octet-stream',
      });

      const part1 = await storage.uploadPart({
        key: 'large-file.bin',
        uploadId: upload.uploadId,
        partNumber: 1,
        body: Buffer.from('part1'),
      });

      const part2 = await storage.uploadPart({
        key: 'large-file.bin',
        uploadId: upload.uploadId,
        partNumber: 2,
        body: Buffer.from('part2'),
      });

      const metadata = await storage.completeMultipartUpload({
        key: 'large-file.bin',
        uploadId: upload.uploadId,
        parts: [part1, part2],
      });

      expect(metadata.size).toBe(10);
      expect(await storage.exists('large-file.bin')).toBe(true);
      
      const file = storage.getFile('large-file.bin');
      expect(file?.toString()).toBe('part1part2');
    });
  });
});
