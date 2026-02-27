/**
 * File Uploads Test Generation Strategy
 * 
 * Generates upload-specific test cases for file management flows.
 * Covers:
 * - File size validation
 * - MIME type validation
 * - Multipart upload handling
 * - Virus scanning
 * - Storage quota enforcement
 */

import type {
  TestGenerationStrategy,
  StrategyContext,
  GeneratedTestCase,
  MockSetup,
  ImportSpec,
} from '../testGenTypes.js';

export const uploadsStrategy: TestGenerationStrategy = {
  id: 'uploads',
  name: 'File Uploads Strategy',
  appliesTo: ['FileUploads', 'Files', 'Storage', 'Media', 'Assets'],

  generateTests(context: StrategyContext): GeneratedTestCase[] {
    const tests: GeneratedTestCase[] = [];
    const { behaviorName } = context;

    // Upload initiation tests
    if (behaviorName.includes('Initiate') || behaviorName.includes('Start')) {
      tests.push(...generateInitiateUploadTests(context));
    }

    // Direct upload tests
    if (behaviorName.includes('DirectUpload') || behaviorName.includes('Upload')) {
      tests.push(...generateDirectUploadTests(context));
    }

    // Chunk upload tests
    if (behaviorName.includes('Chunk')) {
      tests.push(...generateChunkUploadTests(context));
    }

    // Complete upload tests
    if (behaviorName.includes('Complete')) {
      tests.push(...generateCompleteUploadTests(context));
    }

    // Download tests
    if (behaviorName.includes('Download') || behaviorName.includes('GetUrl')) {
      tests.push(...generateDownloadTests(context));
    }

    // Delete tests
    if (behaviorName.includes('Delete')) {
      tests.push(...generateDeleteTests(context));
    }

    return tests;
  },

  generateMocks(context: StrategyContext): MockSetup[] {
    const mocks: MockSetup[] = [];

    // File mock
    mocks.push({
      entity: 'File',
      method: 'exists',
      returns: { type: 'literal', value: true },
    });

    mocks.push({
      entity: 'File',
      method: 'lookup',
      returns: {
        type: 'literal',
        value: {
          id: 'mock-file-id',
          owner_id: 'mock-user-id',
          original_filename: 'test.jpg',
          mime_type: 'image/jpeg',
          size: 1024000,
          upload_status: 'COMPLETED',
        },
      },
    });

    // Upload session mock
    mocks.push({
      entity: 'UploadSession',
      method: 'exists',
      returns: { type: 'literal', value: true },
    });

    // Config mock
    mocks.push({
      entity: 'config',
      method: 'get',
      args: { key: { type: 'literal', value: 'max_file_size' } },
      returns: { type: 'literal', value: 104857600 }, // 100MB
    });

    mocks.push({
      entity: 'config',
      method: 'get',
      args: { key: { type: 'literal', value: 'allowed_mime_types' } },
      returns: {
        type: 'literal',
        value: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
      },
    });

    return mocks;
  },

  getImports(): ImportSpec[] {
    return [
      {
        module: '@/test-utils/uploads',
        imports: ['createMockFile', 'createMockUploadSession', 'createTestBuffer'],
      },
      {
        module: '@/test-utils/storage',
        imports: ['mockS3Client', 'mockStorageProvider'],
      },
    ];
  },
};

function generateInitiateUploadTests(context: StrategyContext): GeneratedTestCase[] {
  const { behaviorName } = context;
  const tests: GeneratedTestCase[] = [];

  // Test: Successful initiation
  tests.push({
    id: `${behaviorName}_uploads_initiate_success`,
    name: 'should initiate upload session',
    description: 'Tests successful upload session creation',
    behaviorName,
    testType: 'postcondition_success',
    sourceClause: {
      clauseType: 'postcondition',
      index: 0,
      expression: 'UploadSession.exists(result.session.id)',
    },
    input: {
      params: {
        filename: { type: 'literal', value: 'photo.jpg' },
        mime_type: { type: 'literal', value: 'image/jpeg' },
        size: { type: 'literal', value: 5242880 }, // 5MB
      },
    },
    expected: {
      outcome: 'success',
      assertions: [
        { path: 'result.session', operator: 'is_not_null', expected: { type: 'literal', value: null } },
        { path: 'result.upload_url', operator: 'is_not_null', expected: { type: 'literal', value: null } },
      ],
    },
    tags: ['uploads', 'initiate', 'positive'],
    priority: 'critical',
  });

  // Test: File too large
  tests.push({
    id: `${behaviorName}_uploads_too_large`,
    name: 'should reject file exceeding size limit',
    description: 'Tests that files exceeding max size are rejected',
    behaviorName,
    testType: 'precondition_violation',
    sourceClause: {
      clauseType: 'precondition',
      index: 1,
      expression: 'input.size <= config.max_file_size',
    },
    input: {
      params: {
        filename: { type: 'literal', value: 'huge-video.mp4' },
        mime_type: { type: 'literal', value: 'video/mp4' },
        size: { type: 'literal', value: 5368709120 }, // 5GB - too large
      },
      context: {
        config: { max_file_size: 104857600 }, // 100MB limit
      },
    },
    expected: {
      outcome: 'error',
      errorCode: 'FILE_TOO_LARGE',
    },
    tags: ['uploads', 'validation', 'negative', 'size'],
    priority: 'high',
  });

  // Test: Invalid MIME type
  tests.push({
    id: `${behaviorName}_uploads_invalid_mime`,
    name: 'should reject disallowed file type',
    description: 'Tests that files with disallowed MIME types are rejected',
    behaviorName,
    testType: 'precondition_violation',
    sourceClause: {
      clauseType: 'precondition',
      index: 2,
      expression: 'input.mime_type in config.allowed_mime_types',
    },
    input: {
      params: {
        filename: { type: 'literal', value: 'malware.exe' },
        mime_type: { type: 'literal', value: 'application/x-executable' },
        size: { type: 'literal', value: 1024000 },
      },
    },
    expected: {
      outcome: 'error',
      errorCode: 'INVALID_MIME_TYPE',
    },
    tags: ['uploads', 'validation', 'negative', 'security'],
    priority: 'critical',
  });

  // Test: Quota exceeded
  tests.push({
    id: `${behaviorName}_uploads_quota_exceeded`,
    name: 'should reject upload when quota exceeded',
    description: 'Tests that uploads are rejected when user storage quota is exceeded',
    behaviorName,
    testType: 'negative',
    sourceClause: {
      clauseType: 'precondition',
      index: 0,
      expression: 'User.storage_used + input.size <= User.storage_quota',
    },
    input: {
      params: {
        filename: { type: 'literal', value: 'large-file.zip' },
        mime_type: { type: 'literal', value: 'application/zip' },
        size: { type: 'literal', value: 52428800 }, // 50MB
      },
      context: {
        actor: {
          type: 'User',
          authenticated: true,
          id: 'user-at-quota',
        },
      },
      mocks: [
        {
          entity: 'User',
          method: 'lookup',
          returns: {
            type: 'literal',
            value: {
              storage_used: 100000000, // 100MB used
              storage_quota: 104857600, // 100MB quota - only 4.8MB left
            },
          },
        },
      ],
    },
    expected: {
      outcome: 'error',
      errorCode: 'QUOTA_EXCEEDED',
    },
    tags: ['uploads', 'validation', 'negative', 'quota'],
    priority: 'high',
  });

  return tests;
}

function generateDirectUploadTests(context: StrategyContext): GeneratedTestCase[] {
  const { behaviorName } = context;
  const tests: GeneratedTestCase[] = [];

  // Test: Successful direct upload
  tests.push({
    id: `${behaviorName}_uploads_direct_success`,
    name: 'should complete direct upload',
    description: 'Tests successful direct file upload',
    behaviorName,
    testType: 'postcondition_success',
    sourceClause: {
      clauseType: 'postcondition',
      index: 0,
      expression: 'File.exists(result.id) and File.lookup(result.id).upload_status == COMPLETED',
    },
    input: {
      params: {
        filename: { type: 'literal', value: 'profile.png' },
        mime_type: { type: 'literal', value: 'image/png' },
        data: { type: 'literal', value: '<binary_data>' },
        is_public: { type: 'literal', value: false },
      },
    },
    expected: {
      outcome: 'success',
      assertions: [
        { path: 'result.id', operator: 'is_not_null', expected: { type: 'literal', value: null } },
        { path: 'result.upload_status', operator: 'equals', expected: { type: 'literal', value: 'COMPLETED' } },
      ],
    },
    tags: ['uploads', 'direct', 'positive'],
    priority: 'critical',
  });

  // Test: Virus detected
  tests.push({
    id: `${behaviorName}_uploads_virus_detected`,
    name: 'should reject file with detected malware',
    description: 'Tests that files with detected malware are rejected',
    behaviorName,
    testType: 'invariant_hold',
    sourceClause: {
      clauseType: 'invariant',
      index: 0,
      expression: 'file content scanned for malware',
    },
    input: {
      params: {
        filename: { type: 'literal', value: 'suspicious.pdf' },
        mime_type: { type: 'literal', value: 'application/pdf' },
        data: { type: 'literal', value: '<eicar_test_signature>' },
      },
      mocks: [
        {
          entity: 'AntivirusScanner',
          method: 'scan',
          returns: {
            type: 'literal',
            value: { infected: true, threat: 'EICAR-Test-File' },
          },
        },
      ],
    },
    expected: {
      outcome: 'error',
      errorCode: 'MALWARE_DETECTED',
    },
    tags: ['uploads', 'security', 'negative', 'virus'],
    priority: 'critical',
  });

  return tests;
}

function generateChunkUploadTests(context: StrategyContext): GeneratedTestCase[] {
  const { behaviorName } = context;
  const tests: GeneratedTestCase[] = [];

  // Test: Successful chunk upload
  tests.push({
    id: `${behaviorName}_uploads_chunk_success`,
    name: 'should upload chunk successfully',
    description: 'Tests successful chunk upload in multipart flow',
    behaviorName,
    testType: 'postcondition_success',
    sourceClause: {
      clauseType: 'postcondition',
      index: 0,
      expression: 'input.chunk_number in UploadSession.lookup(input.session_id).uploaded_chunks',
    },
    input: {
      params: {
        session_id: { type: 'generated', generator: { kind: 'uuid' } },
        chunk_number: { type: 'literal', value: 1 },
        data: { type: 'literal', value: '<chunk_data>' },
      },
      mocks: [
        {
          entity: 'UploadSession',
          method: 'lookup',
          returns: {
            type: 'literal',
            value: {
              id: 'session-1',
              uploaded_chunks: [0],
              total_chunks: 5,
              expires_at: new Date(Date.now() + 3600000).toISOString(),
            },
          },
        },
      ],
    },
    expected: {
      outcome: 'success',
      assertions: [
        { path: 'result.uploaded_chunks', operator: 'greater_than', expected: { type: 'literal', value: 0 } },
      ],
    },
    tags: ['uploads', 'chunk', 'multipart', 'positive'],
    priority: 'high',
  });

  // Test: Session expired
  tests.push({
    id: `${behaviorName}_uploads_session_expired`,
    name: 'should reject chunk for expired session',
    description: 'Tests that chunks are rejected for expired upload sessions',
    behaviorName,
    testType: 'precondition_violation',
    sourceClause: {
      clauseType: 'precondition',
      index: 1,
      expression: 'UploadSession.lookup(input.session_id).expires_at > now()',
    },
    input: {
      params: {
        session_id: { type: 'literal', value: 'expired-session' },
        chunk_number: { type: 'literal', value: 1 },
        data: { type: 'literal', value: '<chunk_data>' },
      },
      mocks: [
        {
          entity: 'UploadSession',
          method: 'lookup',
          returns: {
            type: 'literal',
            value: {
              id: 'expired-session',
              expires_at: new Date(Date.now() - 3600000).toISOString(), // Expired 1 hour ago
            },
          },
        },
      ],
    },
    expected: {
      outcome: 'error',
      errorCode: 'SESSION_EXPIRED',
    },
    tags: ['uploads', 'chunk', 'negative', 'expiry'],
    priority: 'high',
  });

  // Test: Duplicate chunk
  tests.push({
    id: `${behaviorName}_uploads_duplicate_chunk`,
    name: 'should reject already uploaded chunk',
    description: 'Tests that chunks cannot be uploaded twice',
    behaviorName,
    testType: 'precondition_violation',
    sourceClause: {
      clauseType: 'precondition',
      index: 2,
      expression: 'input.chunk_number not in UploadSession.lookup(input.session_id).uploaded_chunks',
    },
    input: {
      params: {
        session_id: { type: 'generated', generator: { kind: 'uuid' } },
        chunk_number: { type: 'literal', value: 0 }, // Already uploaded
        data: { type: 'literal', value: '<chunk_data>' },
      },
      mocks: [
        {
          entity: 'UploadSession',
          method: 'lookup',
          returns: {
            type: 'literal',
            value: {
              uploaded_chunks: [0, 1, 2], // Chunk 0 already uploaded
              expires_at: new Date(Date.now() + 3600000).toISOString(),
            },
          },
        },
      ],
    },
    expected: {
      outcome: 'error',
      errorCode: 'INVALID_CHUNK',
    },
    tags: ['uploads', 'chunk', 'negative'],
    priority: 'medium',
  });

  return tests;
}

function generateCompleteUploadTests(context: StrategyContext): GeneratedTestCase[] {
  const { behaviorName } = context;
  const tests: GeneratedTestCase[] = [];

  // Test: Successful completion
  tests.push({
    id: `${behaviorName}_uploads_complete_success`,
    name: 'should complete multipart upload',
    description: 'Tests successful completion of multipart upload',
    behaviorName,
    testType: 'postcondition_success',
    sourceClause: {
      clauseType: 'postcondition',
      index: 0,
      expression: 'File.exists(result.id) and File.lookup(result.id).upload_status in [COMPLETED, PROCESSING]',
    },
    input: {
      params: {
        session_id: { type: 'generated', generator: { kind: 'uuid' } },
      },
      mocks: [
        {
          entity: 'UploadSession',
          method: 'lookup',
          returns: {
            type: 'literal',
            value: {
              uploaded_chunks: [0, 1, 2, 3, 4],
              total_chunks: 5, // All chunks uploaded
              filename: 'large-video.mp4',
              mime_type: 'video/mp4',
            },
          },
        },
      ],
    },
    expected: {
      outcome: 'success',
      assertions: [
        { path: 'result.upload_status', operator: 'is_truthy', expected: { type: 'literal', value: true } },
      ],
    },
    tags: ['uploads', 'complete', 'multipart', 'positive'],
    priority: 'critical',
  });

  // Test: Incomplete upload
  tests.push({
    id: `${behaviorName}_uploads_incomplete`,
    name: 'should reject completion of incomplete upload',
    description: 'Tests that uploads cannot be completed until all chunks are uploaded',
    behaviorName,
    testType: 'precondition_violation',
    sourceClause: {
      clauseType: 'precondition',
      index: 1,
      expression: 'UploadSession.lookup(input.session_id).uploaded_chunks.length == UploadSession.lookup(input.session_id).total_chunks',
    },
    input: {
      params: {
        session_id: { type: 'literal', value: 'incomplete-session' },
      },
      mocks: [
        {
          entity: 'UploadSession',
          method: 'lookup',
          returns: {
            type: 'literal',
            value: {
              uploaded_chunks: [0, 1], // Only 2 of 5 chunks uploaded
              total_chunks: 5,
            },
          },
        },
      ],
    },
    expected: {
      outcome: 'error',
      errorCode: 'INCOMPLETE_UPLOAD',
    },
    tags: ['uploads', 'complete', 'negative'],
    priority: 'high',
  });

  return tests;
}

function generateDownloadTests(context: StrategyContext): GeneratedTestCase[] {
  const { behaviorName } = context;
  const tests: GeneratedTestCase[] = [];

  // Test: Successful download URL
  tests.push({
    id: `${behaviorName}_uploads_download_url`,
    name: 'should generate signed download URL',
    description: 'Tests generation of signed download URL',
    behaviorName,
    testType: 'postcondition_success',
    sourceClause: {
      clauseType: 'postcondition',
      index: 0,
      expression: 'result.url != null',
    },
    input: {
      params: {
        file_id: { type: 'generated', generator: { kind: 'uuid' } },
        expires_in: { type: 'literal', value: 3600 },
      },
      mocks: [
        {
          entity: 'File',
          method: 'lookup',
          returns: {
            type: 'literal',
            value: {
              id: 'file-1',
              upload_status: 'COMPLETED',
              storage_path: '/files/file-1.jpg',
            },
          },
        },
      ],
    },
    expected: {
      outcome: 'success',
      assertions: [
        { path: 'result.url', operator: 'is_not_null', expected: { type: 'literal', value: null } },
        { path: 'result.expires_at', operator: 'is_not_null', expected: { type: 'literal', value: null } },
      ],
    },
    tags: ['uploads', 'download', 'positive'],
    priority: 'high',
  });

  // Test: Access denied
  tests.push({
    id: `${behaviorName}_uploads_access_denied`,
    name: 'should deny access to unauthorized file',
    description: 'Tests that users cannot download files they do not own',
    behaviorName,
    testType: 'negative',
    sourceClause: {
      clauseType: 'precondition',
      index: 0,
      expression: 'File.lookup(input.file_id).owner_id == actor.id or File.lookup(input.file_id).is_public',
    },
    input: {
      params: {
        file_id: { type: 'literal', value: 'private-file' },
      },
      context: {
        actor: {
          type: 'User',
          id: 'different-user',
          authenticated: true,
        },
      },
      mocks: [
        {
          entity: 'File',
          method: 'lookup',
          returns: {
            type: 'literal',
            value: {
              id: 'private-file',
              owner_id: 'original-owner',
              is_public: false,
              upload_status: 'COMPLETED',
            },
          },
        },
      ],
    },
    expected: {
      outcome: 'error',
      errorCode: 'ACCESS_DENIED',
    },
    tags: ['uploads', 'download', 'negative', 'security'],
    priority: 'critical',
  });

  return tests;
}

function generateDeleteTests(context: StrategyContext): GeneratedTestCase[] {
  const { behaviorName } = context;
  const tests: GeneratedTestCase[] = [];

  // Test: Soft delete
  tests.push({
    id: `${behaviorName}_uploads_soft_delete`,
    name: 'should soft delete file',
    description: 'Tests soft delete marks file as deleted without removing',
    behaviorName,
    testType: 'postcondition_success',
    sourceClause: {
      clauseType: 'postcondition',
      index: 0,
      expression: 'File.lookup(input.file_id).upload_status == DELETED',
    },
    input: {
      params: {
        file_id: { type: 'generated', generator: { kind: 'uuid' } },
        permanent: { type: 'literal', value: false },
      },
    },
    expected: {
      outcome: 'success',
      stateChanges: [
        {
          entity: 'File',
          lookup: { id: { type: 'reference', path: 'input.file_id' } },
          property: 'upload_status',
          expected: { type: 'literal', value: 'DELETED' },
        },
      ],
    },
    tags: ['uploads', 'delete', 'positive'],
    priority: 'high',
  });

  // Test: Permanent delete
  tests.push({
    id: `${behaviorName}_uploads_permanent_delete`,
    name: 'should permanently delete file',
    description: 'Tests permanent delete removes file completely',
    behaviorName,
    testType: 'postcondition_success',
    sourceClause: {
      clauseType: 'postcondition',
      index: 1,
      expression: 'input.permanent implies not File.exists(input.file_id)',
    },
    input: {
      params: {
        file_id: { type: 'generated', generator: { kind: 'uuid' } },
        permanent: { type: 'literal', value: true },
      },
    },
    expected: {
      outcome: 'success',
    },
    tags: ['uploads', 'delete', 'permanent', 'positive'],
    priority: 'high',
  });

  return tests;
}

export default uploadsStrategy;
