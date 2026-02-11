/**
 * @packageDocumentation
 * @isl-lang/stdlib-files/transform/encode
 */

import type { FileResult } from '../types';
import { FileError, FileErrorFactory, FileErrorCode } from '../errors';

// ============================================================================
// ENCODING TYPES
// ============================================================================

export type EncodingFormat = 
  | 'base64'
  | 'hex'
  | 'utf8'
  | 'ascii'
  | 'binary'
  | 'latin1'
  | 'ucs2'
  | 'utf16le';

export interface EncodingOptions {
  /** Line ending for text files */
  lineEnding?: '\n' | '\r\n' | '\r';
  
  /** Whether to include BOM for UTF-8 */
  includeBOM?: boolean;
  
  /** Chunk size for streaming operations */
  chunkSize?: number;
}

export interface EncodingResult {
  /** Original encoding */
  originalEncoding: string;
  
  /** New encoding */
  newEncoding: string;
  
  /** Original size */
  originalSize: number;
  
  /** New size */
  newSize: number;
  
  /** Size change ratio */
  sizeRatio: number;
  
  /** Time taken */
  duration: number;
}

// ============================================================================
// ENCODING HANDLER
// ============================================================================

export class EncodingHandler {
  /**
   * Convert file encoding
   */
  async convertFileEncoding(
    inputPath: string,
    outputPath: string,
    fromEncoding: EncodingFormat,
    toEncoding: EncodingFormat,
    options?: EncodingOptions
  ): Promise<FileResult<EncodingResult>> {
    const startTime = Date.now();
    
    try {
      const fs = await import('fs/promises');
      
      // Read file with original encoding
      const content = await fs.readFile(inputPath, fromEncoding);
      const originalSize = content.length;
      
      // Convert to new encoding
      let converted: Buffer;
      
      if (toEncoding === 'base64') {
        converted = Buffer.from(content.toString('latin1'), 'base64');
      } else if (fromEncoding === 'base64') {
        converted = Buffer.from(content.toString('latin1'), 'base64');
      } else if (toEncoding === 'hex') {
        converted = Buffer.from(content.toString('latin1'), 'hex');
      } else if (fromEncoding === 'hex') {
        converted = Buffer.from(content.toString('latin1'), 'hex');
      } else {
        // Text encoding conversion
        let textContent = content.toString(fromEncoding as BufferEncoding);
        
        // Add BOM if requested
        if (options?.includeBOM && toEncoding === 'utf8') {
          textContent = '\uFEFF' + textContent;
        }
        
        // Convert line endings
        if (options?.lineEnding) {
          textContent = this.convertLineEndings(textContent, options.lineEnding);
        }
        
        converted = Buffer.from(textContent, toEncoding as BufferEncoding);
      }
      
      // Write converted file
      await fs.writeFile(outputPath, converted);
      
      const newSize = converted.length;
      const duration = Date.now() - startTime;
      const sizeRatio = originalSize > 0 ? newSize / originalSize : 0;
      
      return {
        ok: true,
        value: {
          originalEncoding: fromEncoding,
          newEncoding: toEncoding,
          originalSize,
          newSize,
          sizeRatio,
          duration
        }
      };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  /**
   * Convert buffer encoding
   */
  async convertBufferEncoding(
    buffer: Buffer,
    fromEncoding: EncodingFormat,
    toEncoding: EncodingFormat,
    options?: EncodingOptions
  ): Promise<FileResult<{ converted: Buffer; result: EncodingResult }>> {
    const startTime = Date.now();
    const originalSize = buffer.length;
    
    try {
      let converted: Buffer;
      
      if (fromEncoding === toEncoding) {
        // No conversion needed
        converted = buffer;
      } else if (toEncoding === 'base64') {
        converted = Buffer.from(buffer.toString('latin1'), 'base64');
      } else if (fromEncoding === 'base64') {
        converted = Buffer.from(buffer.toString('latin1'), 'base64');
      } else if (toEncoding === 'hex') {
        converted = Buffer.from(buffer.toString('latin1'), 'hex');
      } else if (fromEncoding === 'hex') {
        converted = Buffer.from(buffer.toString('latin1'), 'hex');
      } else {
        // Text encoding conversion
        let textContent = buffer.toString(fromEncoding as BufferEncoding);
        
        // Add BOM if requested
        if (options?.includeBOM && toEncoding === 'utf8') {
          textContent = '\uFEFF' + textContent;
        }
        
        // Convert line endings
        if (options?.lineEnding) {
          textContent = this.convertLineEndings(textContent, options.lineEnding);
        }
        
        converted = Buffer.from(textContent, toEncoding as BufferEncoding);
      }
      
      const newSize = converted.length;
      const duration = Date.now() - startTime;
      const sizeRatio = originalSize > 0 ? newSize / originalSize : 0;
      
      return {
        ok: true,
        value: {
          converted,
          result: {
            originalEncoding: fromEncoding,
            newEncoding: toEncoding,
            originalSize,
            newSize,
            sizeRatio,
            duration
          }
        }
      };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  /**
   * Encode buffer to base64
   */
  encodeToBase64(buffer: Buffer): string {
    return buffer.toString('base64');
  }

  /**
   * Decode base64 to buffer
   */
  decodeFromBase64(base64: string): Buffer {
    return Buffer.from(base64, 'base64');
  }

  /**
   * Encode buffer to hex
   */
  encodeToHex(buffer: Buffer): string {
    return buffer.toString('hex');
  }

  /**
   * Decode hex to buffer
   */
  decodeFromHex(hex: string): Buffer {
    return Buffer.from(hex, 'hex');
  }

  /**
   * Encode URL component
   */
  encodeURIComponent(str: string): string {
    return encodeURIComponent(str);
  }

  /**
   * Decode URL component
   */
  decodeURIComponent(encoded: string): string {
    return decodeURIComponent(encoded);
  }

  /**
   * Encode URL (different from encodeURIComponent)
   */
  encodeURL(str: string): string {
    return encodeURI(str);
  }

  /**
   * Decode URL
   */
  decodeURL(encoded: string): string {
    return decodeURI(encoded);
  }

  /**
   * Convert to data URL
   */
  toDataURL(
    buffer: Buffer,
    mimeType: string,
    encoding: 'base64' | 'hex' = 'base64'
  ): string {
    const encoded = encoding === 'base64' ? 
      this.encodeToBase64(buffer) : 
      this.encodeToHex(buffer);
    
    return `data:${mimeType};${encoding},${encoded}`;
  }

  /**
   * Parse data URL
   */
  parseDataURL(dataURL: string): FileResult<{
    mimeType: string;
    encoding: 'base64' | 'hex' | 'utf8';
    data: Buffer;
  }> {
    try {
      const match = dataURL.match(/^data:([^;]+);([^,]+),(.+)$/);
      if (!match) {
        return { 
          ok: false, 
          error: new FileError(
            FileErrorCode.INVALID_INPUT,
            'Invalid data URL format'
          )
        };
      }

      const [, mimeType, encoding, data] = match;
      let buffer: Buffer;

      switch (encoding) {
        case 'base64':
          buffer = this.decodeFromBase64(data);
          break;
        case 'hex':
          buffer = this.decodeFromHex(data);
          break;
        case 'utf8':
          buffer = Buffer.from(data, 'utf8');
          break;
        default:
          return { 
            ok: false, 
            error: new FileError(
              FileErrorCode.INVALID_INPUT,
              `Unsupported data URL encoding: ${encoding}`
            )
          };
      }

      return {
        ok: true,
        value: { mimeType, encoding: encoding as any, data: buffer }
      };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  /**
   * Detect file encoding
   */
  async detectEncoding(buffer: Buffer): Promise<FileResult<{
    encoding: EncodingFormat;
    confidence: number;
    bom?: Buffer;
  }>> {
    try {
      // Check for BOM
      let bom: Buffer | undefined;
      let encoding: EncodingFormat = 'utf8';
      let confidence = 0.5;

      if (buffer.length >= 3) {
        // UTF-8 BOM
        if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
          bom = buffer.subarray(0, 3);
          encoding = 'utf8';
          confidence = 1.0;
        }
        // UTF-16 LE BOM
        else if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
          bom = buffer.subarray(0, 2);
          encoding = 'utf16le';
          confidence = 1.0;
        }
        // UTF-16 BE BOM
        else if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
          bom = buffer.subarray(0, 2);
          encoding = 'utf16le'; // Node.js doesn't support utf16be directly
          confidence = 1.0;
        }
      }

      // If no BOM, try to detect based on content
      if (!bom) {
        // Check if valid UTF-8
        if (this.isValidUTF8(buffer)) {
          encoding = 'utf8';
          confidence = 0.8;
        }
        // Check if valid ASCII
        else if (this.isValidASCII(buffer)) {
          encoding = 'ascii';
          confidence = 0.9;
        }
        // Check if might be base64
        else if (this.looksLikeBase64(buffer)) {
          encoding = 'base64';
          confidence = 0.6;
        }
        // Check if might be hex
        else if (this.looksLikeHex(buffer)) {
          encoding = 'hex';
          confidence = 0.6;
        }
      }

      return {
        ok: true,
        value: { encoding, confidence, bom }
      };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  /**
   * Convert line endings
   */
  private convertLineEndings(text: string, lineEnding: '\n' | '\r\n' | '\r'): string {
    // Normalize to \n first
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Convert to target
    return text.replace(/\n/g, lineEnding);
  }

  /**
   * Check if buffer is valid UTF-8
   */
  private isValidUTF8(buffer: Buffer): boolean {
    try {
      Buffer.from(buffer.toString('utf8'), 'utf8');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if buffer is valid ASCII
   */
  private isValidASCII(buffer: Buffer): boolean {
    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i] > 127) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if buffer looks like base64
   */
  private looksLikeBase64(buffer: Buffer): boolean {
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    const str = buffer.toString('ascii');
    
    // Check length is multiple of 4
    if (str.length % 4 !== 0) {
      return false;
    }
    
    // Check characters
    return base64Regex.test(str);
  }

  /**
   * Check if buffer looks like hex
   */
  private looksLikeHex(buffer: Buffer): boolean {
    const hexRegex = /^[0-9a-fA-F]*$/;
    const str = buffer.toString('ascii');
    
    // Check length is even
    if (str.length % 2 !== 0) {
      return false;
    }
    
    // Check characters
    return hexRegex.test(str);
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

export const encodingHandler = new EncodingHandler();

export async function convertFileEncoding(
  inputPath: string,
  outputPath: string,
  fromEncoding: EncodingFormat,
  toEncoding: EncodingFormat,
  options?: EncodingOptions
): Promise<FileResult<EncodingResult>> {
  return encodingHandler.convertFileEncoding(inputPath, outputPath, fromEncoding, toEncoding, options);
}

export async function convertBufferEncoding(
  buffer: Buffer,
  fromEncoding: EncodingFormat,
  toEncoding: EncodingFormat,
  options?: EncodingOptions
): Promise<FileResult<{ converted: Buffer; result: EncodingResult }>> {
  return encodingHandler.convertBufferEncoding(buffer, fromEncoding, toEncoding, options);
}

export function encodeToBase64(buffer: Buffer): string {
  return encodingHandler.encodeToBase64(buffer);
}

export function decodeFromBase64(base64: string): Buffer {
  return encodingHandler.decodeFromBase64(base64);
}

export function encodeToHex(buffer: Buffer): string {
  return encodingHandler.encodeToHex(buffer);
}

export function decodeFromHex(hex: string): Buffer {
  return encodingHandler.decodeFromHex(hex);
}

export function toDataURL(buffer: Buffer, mimeType: string, encoding?: 'base64' | 'hex'): string {
  return encodingHandler.toDataURL(buffer, mimeType, encoding);
}

export function parseDataURL(dataURL: string): FileResult<{
  mimeType: string;
  encoding: 'base64' | 'hex' | 'utf8';
  data: Buffer;
}> {
  return encodingHandler.parseDataURL(dataURL);
}
