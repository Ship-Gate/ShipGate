/**
 * ISL Proof Bundle - ZIP Writer
 * 
 * Creates deterministic ZIP archives from proof bundles with:
 * - Fixed timestamps (1970-01-01) for reproducibility
 * - Sorted file entries for deterministic ordering
 * - Complete manifest.json with all hashes
 * - Optional ed25519 signing
 * 
 * @module @isl-lang/proof
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import type { ProofBundleManifest } from './manifest.js';
import { calculateBundleId, calculateSpecHash } from './manifest.js';

// ============================================================================
// Types
// ============================================================================

export interface ZipBundleOptions {
  /** Source bundle directory */
  bundleDir: string;
  /** Output ZIP file path */
  outputPath: string;
  /** Optional ed25519 private key for signing (base64 or hex) */
  signKey?: string;
  /** Key ID for signature */
  signKeyId?: string;
  /** Use deterministic timestamps (default: true) */
  deterministic?: boolean;
}

export interface ZipBundleResult {
  /** Path to created ZIP file */
  zipPath: string;
  /** Bundle ID from manifest */
  bundleId: string;
  /** SHA-256 hash of the ZIP file */
  zipHash: string;
  /** Whether bundle is signed */
  signed: boolean;
  /** Public key (if signed with ed25519) */
  publicKey?: string;
}

// ============================================================================
// ZIP Creation (using Node.js built-in zlib + manual ZIP format)
// ============================================================================

/**
 * Create a deterministic ZIP archive from a proof bundle directory
 */
export async function createZipBundle(
  options: ZipBundleOptions
): Promise<ZipBundleResult> {
  const {
    bundleDir,
    outputPath,
    signKey,
    signKeyId,
    deterministic = true,
  } = options;

  // Load manifest
  const manifestPath = path.join(bundleDir, 'manifest.json');
  const manifestContent = await fs.readFile(manifestPath, 'utf-8');
  const manifest: ProofBundleManifest = JSON.parse(manifestContent);

  // Collect all files in deterministic order
  const files = await collectFiles(bundleDir, manifest.files || []);
  
  // Sort files for deterministic ordering
  files.sort((a, b) => a.path.localeCompare(b.path));

  // Create ZIP using yazl-like approach (we'll use a simple implementation)
  // For production, consider using 'yazl' package
  const zipBuffer = await createZipArchive(files, deterministic);

  // Calculate ZIP hash
  const zipHash = crypto.createHash('sha256').update(zipBuffer).digest('hex');

  // Sign if key provided
  let signed = false;
  let publicKey: string | undefined;
  
  if (signKey) {
    const signature = await signZipWithEd25519(zipBuffer, signKey);
    signed = true;
    publicKey = signature.publicKey;
    
    // Write signature file
    const sigPath = outputPath + '.sig';
    await fs.writeFile(sigPath, JSON.stringify({
      algorithm: 'ed25519',
      signature: signature.signature,
      publicKey: signature.publicKey,
      keyId: signKeyId,
      zipHash,
    }, null, 2));
  }

  // Write ZIP file
  await fs.writeFile(outputPath, zipBuffer);

  return {
    zipPath: outputPath,
    bundleId: manifest.bundleId,
    zipHash,
    signed,
    publicKey,
  };
}

/**
 * Collect files from bundle directory
 */
async function collectFiles(
  bundleDir: string,
  manifestFiles: string[]
): Promise<Array<{ path: string; content: Buffer }>> {
  const files: Array<{ path: string; content: Buffer }> = [];

  // Use manifest file list if available, otherwise scan directory
  const filesToInclude = manifestFiles.length > 0 
    ? manifestFiles 
    : await scanDirectory(bundleDir);

  for (const filePath of filesToInclude) {
    const fullPath = path.join(bundleDir, filePath);
    try {
      const content = await fs.readFile(fullPath);
      files.push({ path: filePath, content });
    } catch (err) {
      // Skip missing files (they might be optional)
      continue;
    }
  }

  return files;
}

/**
 * Scan directory recursively for files
 */
async function scanDirectory(dir: string, baseDir: string = dir): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      const subFiles = await scanDirectory(fullPath, baseDir);
      files.push(...subFiles);
    } else {
      files.push(relativePath);
    }
  }

  return files;
}

/**
 * Create ZIP archive buffer
 * 
 * This is a simplified ZIP writer. For production, use 'yazl' package.
 */
async function createZipArchive(
  files: Array<{ path: string; content: Buffer }>,
  deterministic: boolean
): Promise<Buffer> {
  // Use a simple ZIP implementation
  // For now, we'll use a minimal ZIP writer
  // In production, install and use 'yazl': npm install yazl @types/yazl
  
  // Fixed timestamp for deterministic ZIPs: January 1, 1980 00:00:00 (ZIP epoch)
  const zipEpoch = deterministic ? new Date('1980-01-01T00:00:00Z') : new Date();
  
  // Convert to DOS date/time format
  const dosDate = dateToDosDate(zipEpoch);
  const dosTime = dateToDosTime(zipEpoch);

  const chunks: Buffer[] = [];
  const centralDir: Array<{ offset: number; entry: ZipEntry }> = [];
  let offset = 0;

  // Write local file entries
  for (const file of files) {
    const entry: ZipEntry = {
      fileName: file.path,
      fileData: file.content,
      dosDate,
      dosTime,
      crc32: calculateCrc32(file.content),
    };

    const localHeader = createLocalFileHeader(entry);
    chunks.push(localHeader);
    chunks.push(file.content);
    offset += localHeader.length + file.content.length;

    centralDir.push({ offset: offset - file.content.length - localHeader.length, entry });
  }

  // Write central directory
  const centralDirStart = offset;
  for (const { offset: localOffset, entry } of centralDir) {
    const centralHeader = createCentralDirectoryHeader(entry, localOffset);
    chunks.push(centralHeader);
    offset += centralHeader.length;
  }

  // Write end of central directory record
  const eocd = createEndOfCentralDirectory(
    centralDir.length,
    centralDirStart,
    offset - centralDirStart
  );
  chunks.push(eocd);

  return Buffer.concat(chunks);
}

interface ZipEntry {
  fileName: string;
  fileData: Buffer;
  dosDate: number;
  dosTime: number;
  crc32: number;
}

/**
 * Create local file header
 */
function createLocalFileHeader(entry: ZipEntry): Buffer {
  const fileNameBytes = Buffer.from(entry.fileName, 'utf-8');
  const header = Buffer.alloc(30 + fileNameBytes.length);
  
  // Local file header signature: 0x04034b50
  header.writeUInt32LE(0x04034b50, 0);
  // Version needed to extract: 20 (2.0)
  header.writeUInt16LE(20, 4);
  // General purpose bit flag: 0 (no encryption)
  header.writeUInt16LE(0, 6);
  // Compression method: 0 (stored, no compression)
  header.writeUInt16LE(0, 8);
  // DOS time
  header.writeUInt16LE(entry.dosTime, 10);
  // DOS date
  header.writeUInt16LE(entry.dosDate, 12);
  // CRC-32
  header.writeUInt32LE(entry.crc32, 14);
  // Compressed size
  header.writeUInt32LE(entry.fileData.length, 18);
  // Uncompressed size
  header.writeUInt32LE(entry.fileData.length, 22);
  // File name length
  header.writeUInt16LE(fileNameBytes.length, 26);
  // Extra field length: 0
  header.writeUInt16LE(0, 28);
  // File name
  fileNameBytes.copy(header, 30);
  
  return header;
}

/**
 * Create central directory header
 */
function createCentralDirectoryHeader(entry: ZipEntry, localHeaderOffset: number): Buffer {
  const fileNameBytes = Buffer.from(entry.fileName, 'utf-8');
  const header = Buffer.alloc(46 + fileNameBytes.length);
  
  // Central file header signature: 0x02014b50
  header.writeUInt32LE(0x02014b50, 0);
  // Version made by: 20 (2.0)
  header.writeUInt16LE(20, 4);
  // Version needed to extract: 20 (2.0)
  header.writeUInt16LE(20, 6);
  // General purpose bit flag: 0
  header.writeUInt16LE(0, 8);
  // Compression method: 0 (stored)
  header.writeUInt16LE(0, 10);
  // DOS time
  header.writeUInt16LE(entry.dosTime, 12);
  // DOS date
  header.writeUInt16LE(entry.dosDate, 14);
  // CRC-32
  header.writeUInt32LE(entry.crc32, 16);
  // Compressed size
  header.writeUInt32LE(entry.fileData.length, 20);
  // Uncompressed size
  header.writeUInt32LE(entry.fileData.length, 24);
  // File name length
  header.writeUInt16LE(fileNameBytes.length, 28);
  // Extra field length: 0
  header.writeUInt16LE(0, 30);
  // File comment length: 0
  header.writeUInt16LE(0, 32);
  // Disk number start: 0
  header.writeUInt16LE(0, 34);
  // Internal file attributes: 0
  header.writeUInt16LE(0, 36);
  // External file attributes: 0
  header.writeUInt32LE(0, 38);
  // Relative offset of local header
  header.writeUInt32LE(localHeaderOffset, 42);
  // File name
  fileNameBytes.copy(header, 46);
  
  return header;
}

/**
 * Create end of central directory record
 */
function createEndOfCentralDirectory(
  totalEntries: number,
  centralDirOffset: number,
  centralDirSize: number
): Buffer {
  const header = Buffer.alloc(22);
  
  // End of central directory signature: 0x06054b50
  header.writeUInt32LE(0x06054b50, 0);
  // Number of this disk: 0
  header.writeUInt16LE(0, 4);
  // Disk with start of central directory: 0
  header.writeUInt16LE(0, 6);
  // Number of entries in central directory on this disk
  header.writeUInt16LE(totalEntries, 8);
  // Total number of entries in central directory
  header.writeUInt16LE(totalEntries, 10);
  // Size of central directory
  header.writeUInt32LE(centralDirSize, 12);
  // Offset of start of central directory
  header.writeUInt32LE(centralDirOffset, 16);
  // ZIP file comment length: 0
  header.writeUInt16LE(0, 20);
  
  return header;
}

/**
 * Convert Date to DOS date format
 */
function dateToDosDate(date: Date): number {
  const year = date.getFullYear() - 1980;
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return (year << 9) | (month << 5) | day;
}

/**
 * Convert Date to DOS time format
 */
function dateToDosTime(date: Date): number {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2); // DOS time has 2-second resolution
  return (hours << 11) | (minutes << 5) | seconds;
}

/**
 * Calculate CRC-32 checksum
 */
function calculateCrc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  const table = crc32Table();
  
  for (let i = 0; i < buffer.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buffer[i]) & 0xff];
  }
  
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Generate CRC-32 lookup table
 */
function crc32Table(): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 1) ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
    table[i] = crc;
  }
  return table;
}

// ============================================================================
// Ed25519 Signing
// ============================================================================

interface Ed25519Signature {
  signature: string;
  publicKey: string;
}

/**
 * Sign ZIP buffer with ed25519
 */
async function signZipWithEd25519(
  zipBuffer: Buffer,
  privateKey: string
): Promise<Ed25519Signature> {
  // Parse private key (base64, hex, or PEM format)
  let keyBuffer: Buffer;
  if (privateKey.startsWith('-----BEGIN')) {
    // PEM format - extract base64 part
    const base64Key = privateKey
      .replace(/-----BEGIN.*?-----/g, '')
      .replace(/-----END.*?-----/g, '')
      .replace(/\s/g, '');
    keyBuffer = Buffer.from(base64Key, 'base64');
  } else if (privateKey.length === 128) {
    // Hex format (64 bytes = 128 hex chars for ed25519 private key)
    keyBuffer = Buffer.from(privateKey, 'hex');
  } else {
    // Assume base64
    keyBuffer = Buffer.from(privateKey, 'base64');
  }

  // For ed25519 in Node.js, we use crypto.sign() with the key object
  // Create a key object from the private key
  let keyObject: crypto.KeyObject;
  try {
    // Try to create key object directly
    if (keyBuffer.length === 64) {
      // Raw ed25519 private key (64 bytes: 32-byte seed + 32-byte public key)
      // Node.js expects just the seed (first 32 bytes) or full 64 bytes
      keyObject = crypto.createPrivateKey({
        key: keyBuffer,
        format: 'raw',
        type: 'ed25519',
      });
    } else {
      // Try as PEM or other format
      keyObject = crypto.createPrivateKey({
        key: keyBuffer,
        format: keyBuffer.toString('utf-8').includes('BEGIN') ? 'pem' : 'der',
      });
    }
  } catch {
    // Fallback: try creating from raw buffer
    keyObject = crypto.createPrivateKey({
      key: keyBuffer.slice(0, 32), // Use first 32 bytes as seed
      format: 'raw',
      type: 'ed25519',
    });
  }

  // Sign the ZIP buffer
  const signature = crypto.sign(null, zipBuffer, keyObject);

  // Extract public key
  const publicKeyObj = crypto.createPublicKey(keyObject);
  const publicKeyBuffer = publicKeyObj.export({ format: 'raw', type: 'spki' });

  return {
    signature: signature.toString('base64'),
    publicKey: publicKeyBuffer.toString('base64'),
  };
}

// ============================================================================
// Exports
// ============================================================================

export {
  createZipBundle,
  collectFiles,
  scanDirectory,
};
