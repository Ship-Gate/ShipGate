/**
 * Protocol codec implementation
 * @packageDocumentation
 */

import type {
  ProtocolPacket,
  ProtocolHeader,
  ProtocolPayload,
  ProtocolCodec,
  ProtocolError,
  ProtocolVersion,
  MessageFlags,
  CodecStats,
  ProtocolErrorCodes,
} from './types.js';
import { ProtocolError as ProtocolErrorImpl } from '../errors.js';
import { createHash, createHmac, randomBytes } from 'crypto';

// ============================================================================
// Default Protocol Codec
// ============================================================================

export class DefaultProtocolCodec implements ProtocolCodec {
  private compressionType: 'none' | 'gzip' | 'deflate' | 'br' = 'none';
  private encryptionType: 'none' | 'aes128' | 'aes256' = 'none';
  private encryptionKey?: Uint8Array;
  private checksumEnabled = true;

  private stats: CodecStats = {
    messagesEncoded: 0,
    messagesDecoded: 0,
    bytesEncoded: 0,
    bytesDecoded: 0,
    errors: 0,
    averageEncodeTime: 0,
    averageDecodeTime: 0,
  };

  private totalEncodeTime = 0;
  private totalDecodeTime = 0;

  // ============================================================================
  // Encoding/Decoding
  // ============================================================================

  async encode(packet: ProtocolPacket): Promise<Uint8Array> {
    const startTime = Date.now();

    try {
      // Validate packet
      const isValid = await this.validate(packet);
      if (!isValid) {
        throw new ProtocolErrorImpl('INVALID_MESSAGE', 'Packet validation failed');
      }

      // Serialize header
      const headerBytes = this.encodeHeader(packet.header);

      // Serialize payload
      let payloadBytes = this.encodePayload(packet.payload);

      // Apply compression
      if (this.compressionType !== 'none') {
        payloadBytes = await this.compress(payloadBytes);
        packet.header.compression = this.compressionType;
      }

      // Apply encryption
      if (this.encryptionType !== 'none') {
        payloadBytes = await this.encrypt(payloadBytes);
        packet.header.encryption = this.encryptionType;
      }

      // Calculate checksum
      if (this.checksumEnabled) {
        packet.header.checksum = this.calculateChecksum(headerBytes, payloadBytes);
        packet.header.flags = (packet.header.flags || 0) | MessageFlags.CHECKSUM;
      }

      // Combine header and payload
      const totalLength = 4 + headerBytes.length + 4 + payloadBytes.length; // Length prefixes
      const result = new Uint8Array(totalLength);
      
      let offset = 0;
      
      // Write header length
      result.set(this.writeUint32(headerBytes.length), offset);
      offset += 4;
      
      // Write header
      result.set(headerBytes, offset);
      offset += headerBytes.length;
      
      // Write payload length
      result.set(this.writeUint32(payloadBytes.length), offset);
      offset += 4;
      
      // Write payload
      result.set(payloadBytes, offset);

      // Update stats
      const encodeTime = Date.now() - startTime;
      this.updateEncodeStats(encodeTime, result.length);

      return result;

    } catch (error) {
      this.stats.errors++;
      throw error;
    }
  }

  async decode(data: Uint8Array): Promise<ProtocolPacket> {
    const startTime = Date.now();

    try {
      // Validate format
      const isValidFormat = await this.validateFormat(data);
      if (!isValidFormat) {
        throw new ProtocolErrorImpl('INVALID_FORMAT', 'Invalid data format');
      }

      let offset = 0;

      // Read header length
      const headerLength = this.readUint32(data, offset);
      offset += 4;

      // Read header
      const headerBytes = data.slice(offset, offset + headerLength);
      offset += headerLength;
      const header = this.decodeHeader(headerBytes);

      // Read payload length
      const payloadLength = this.readUint32(data, offset);
      offset += 4;

      // Read payload
      let payloadBytes = data.slice(offset, offset + payloadLength);

      // Verify checksum
      if ((header.flags || 0) & MessageFlags.CHECKSUM) {
        const expectedChecksum = this.calculateChecksum(headerBytes, payloadBytes);
        if (header.checksum !== expectedChecksum) {
          throw new ProtocolErrorImpl('CHECKSUM_MISMATCH', 'Checksum verification failed');
        }
      }

      // Decrypt if needed
      if (header.encryption && header.encryption !== 'none') {
        payloadBytes = await this.decrypt(payloadBytes, header.encryption);
      }

      // Decompress if needed
      if (header.compression && header.compression !== 'none') {
        payloadBytes = await this.decompress(payloadBytes, header.compression);
      }

      // Decode payload
      const payload = this.decodePayload(payloadBytes);

      // Update stats
      const decodeTime = Date.now() - startTime;
      this.updateDecodeStats(decodeTime, data.length);

      return { header, payload };

    } catch (error) {
      this.stats.errors++;
      throw error;
    }
  }

  // ============================================================================
  // Validation
  // ============================================================================

  async validate(packet: ProtocolPacket): Promise<boolean> {
    try {
      // Validate header
      if (!packet.header || !packet.header.id || !packet.header.type) {
        return false;
      }

      // Validate version
      if (!this.isVersionSupported(packet.header.version)) {
        return false;
      }

      // Validate payload based on type
      switch (packet.header.type) {
        case 'EVENT':
          if (!packet.payload.data || !packet.payload.data.event) {
            return false;
          }
          break;

        case 'PING':
        case 'PONG':
          // Ping/Pong can have empty payload
          break;

        case 'JSON':
          // Control messages must have action
          if (!packet.payload.data || !packet.payload.data.action) {
            return false;
          }
          break;

        default:
          // Unknown message type
          return false;
      }

      return true;

    } catch (error) {
      return false;
    }
  }

  async validateFormat(data: Uint8Array): Promise<boolean> {
    try {
      // Check minimum length (header length + payload length)
      if (data.length < 8) {
        return false;
      }

      let offset = 0;

      // Read header length
      const headerLength = this.readUint32(data, offset);
      offset += 4;

      // Validate header length
      if (headerLength < 0 || headerLength > data.length - 4) {
        return false;
      }

      // Read payload length
      const payloadLength = this.readUint32(data, offset);
      offset += 4;

      // Validate total length
      if (4 + headerLength + 4 + payloadLength !== data.length) {
        return false;
      }

      return true;

    } catch (error) {
      return false;
    }
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  setCompression(type: 'none' | 'gzip' | 'deflate' | 'br'): void {
    this.compressionType = type;
  }

  setEncryption(type: 'none' | 'aes128' | 'aes256', key?: Uint8Array): void {
    this.encryptionType = type;
    this.encryptionKey = key;
  }

  setChecksum(enabled: boolean): void {
    this.checksumEnabled = enabled;
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  getStats(): CodecStats {
    return { ...this.stats };
  }

  // ============================================================================
  // Private Methods - Encoding
  // ============================================================================

  private encodeHeader(header: ProtocolHeader): Uint8Array {
    const parts: string[] = [];

    // Required fields
    parts.push(`id:${header.id}`);
    parts.push(`type:${header.type}`);
    parts.push(`ts:${header.timestamp}`);
    parts.push(`ver:${this.versionToString(header.version)}`);

    // Optional fields
    if (header.priority) parts.push(`pri:${header.priority}`);
    if (header.ttl) parts.push(`ttl:${header.ttl}`);
    if (header.source) parts.push(`src:${header.source}`);
    if (header.destination) parts.push(`dst:${header.destination}`);
    if (header.correlationId) parts.push(`cid:${header.correlationId}`);
    if (header.flags) parts.push(`flags:${header.flags}`);
    if (header.checksum) parts.push(`cs:${header.checksum}`);
    if (header.compression) parts.push(`comp:${header.compression}`);
    if (header.encryption) parts.push(`enc:${header.encryption}`);

    const headerString = parts.join(';');
    return new TextEncoder().encode(headerString);
  }

  private encodePayload(payload: ProtocolPayload): Uint8Array {
    const payloadString = JSON.stringify(payload);
    return new TextEncoder().encode(payloadString);
  }

  // ============================================================================
  // Private Methods - Decoding
  // ============================================================================

  private decodeHeader(data: Uint8Array): ProtocolHeader {
    const headerString = new TextDecoder().decode(data);
    const parts = headerString.split(';');
    
    const header: any = {};

    for (const part of parts) {
      const [key, value] = part.split(':');
      if (!key || !value) continue;

      switch (key) {
        case 'id':
          header.id = value;
          break;
        case 'type':
          header.type = value;
          break;
        case 'ts':
          header.timestamp = parseInt(value, 10);
          break;
        case 'ver':
          header.version = this.parseVersion(value);
          break;
        case 'pri':
          header.priority = value;
          break;
        case 'ttl':
          header.ttl = parseInt(value, 10);
          break;
        case 'src':
          header.source = value;
          break;
        case 'dst':
          header.destination = value;
          break;
        case 'cid':
          header.correlationId = value;
          break;
        case 'flags':
          header.flags = parseInt(value, 10);
          break;
        case 'cs':
          header.checksum = value;
          break;
        case 'comp':
          header.compression = value;
          break;
        case 'enc':
          header.encryption = value;
          break;
      }
    }

    return header as ProtocolHeader;
  }

  private decodePayload(data: Uint8Array): ProtocolPayload {
    const payloadString = new TextDecoder().decode(data);
    return JSON.parse(payloadString);
  }

  // ============================================================================
  // Private Methods - Compression
  // ============================================================================

  private async compress(data: Uint8Array): Promise<Uint8Array> {
    // In a real implementation, use actual compression libraries
    // For now, return as-is
    return data;
  }

  private async decompress(data: Uint8Array, type: string): Promise<Uint8Array> {
    // In a real implementation, use actual decompression libraries
    // For now, return as-is
    return data;
  }

  // ============================================================================
  // Private Methods - Encryption
  // ============================================================================

  private async encrypt(data: Uint8Array): Promise<Uint8Array> {
    if (this.encryptionType === 'none' || !this.encryptionKey) {
      return data;
    }

    // In a real implementation, use actual encryption libraries
    // For now, return as-is
    return data;
  }

  private async decrypt(data: Uint8Array, type: string): Promise<Uint8Array> {
    if (type === 'none' || !this.encryptionKey) {
      return data;
    }

    // In a real implementation, use actual decryption libraries
    // For now, return as-is
    return data;
  }

  // ============================================================================
  // Private Methods - Checksum
  // ============================================================================

  private calculateChecksum(header: Uint8Array, payload: Uint8Array): string {
    const combined = new Uint8Array(header.length + payload.length);
    combined.set(header);
    combined.set(payload, header.length);

    const hash = createHash('sha256');
    hash.update(combined);
    return hash.digest('hex').substring(0, 16);
  }

  // ============================================================================
  // Private Methods - Utilities
  // ============================================================================

  private versionToString(version: ProtocolVersion | string): string {
    if (typeof version === 'string') {
      return version;
    }
    let result = `${version.major}.${version.minor}.${version.patch}`;
    if (version.pre) {
      result += `-${version.pre}`;
    }
    return result;
  }

  private parseVersion(version: string): ProtocolVersion {
    const parts = version.split('-');
    const numbers = parts[0].split('.').map(n => parseInt(n, 10));
    
    return {
      major: numbers[0] || 0,
      minor: numbers[1] || 0,
      patch: numbers[2] || 0,
      pre: parts[1],
    };
  }

  private isVersionSupported(version: ProtocolVersion | string): boolean {
    const v = typeof version === 'string' ? this.parseVersion(version) : version;
    
    // Check if version is in supported range
    return v.major === 1 && v.minor === 0; // Only support 1.0.x for now
  }

  private writeUint32(value: number): Uint8Array {
    const result = new Uint8Array(4);
    result[0] = (value >>> 24) & 0xff;
    result[1] = (value >>> 16) & 0xff;
    result[2] = (value >>> 8) & 0xff;
    result[3] = value & 0xff;
    return result;
  }

  private readUint32(data: Uint8Array, offset: number): number {
    return (data[offset] << 24) |
           (data[offset + 1] << 16) |
           (data[offset + 2] << 8) |
           data[offset + 3];
  }

  private updateEncodeStats(time: number, bytes: number): void {
    this.stats.messagesEncoded++;
    this.stats.bytesEncoded += bytes;
    this.totalEncodeTime += time;
    this.stats.averageEncodeTime = this.totalEncodeTime / this.stats.messagesEncoded;
  }

  private updateDecodeStats(time: number, bytes: number): void {
    this.stats.messagesDecoded++;
    this.stats.bytesDecoded += bytes;
    this.totalDecodeTime += time;
    this.stats.averageDecodeTime = this.totalDecodeTime / this.stats.messagesDecoded;
  }
}

// ============================================================================
// Codec Factory
// ============================================================================

export class CodecFactory {
  static createDefault(): ProtocolCodec {
    return new DefaultProtocolCodec();
  }

  static createWithCompression(compression: 'none' | 'gzip' | 'deflate' | 'br'): ProtocolCodec {
    const codec = new DefaultProtocolCodec();
    codec.setCompression(compression);
    return codec;
  }

  static createWithEncryption(
    encryption: 'none' | 'aes128' | 'aes256',
    key?: Uint8Array
  ): ProtocolCodec {
    const codec = new DefaultProtocolCodec();
    codec.setEncryption(encryption, key);
    return codec;
  }

  static createSecure(
    compression: 'none' | 'gzip' | 'deflate' | 'br' = 'gzip',
    encryption: 'none' | 'aes128' | 'aes256' = 'aes256',
    key?: Uint8Array
  ): ProtocolCodec {
    const codec = new DefaultProtocolCodec();
    codec.setCompression(compression);
    codec.setEncryption(encryption, key);
    codec.setChecksum(true);
    return codec;
  }
}

// ============================================================================
// Re-export MessageFlags
// ============================================================================

export { MessageFlags };
