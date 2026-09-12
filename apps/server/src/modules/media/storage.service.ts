import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { type AllowedMediaType } from "./media.schemas.js";

/**
 * Validates binary magic bytes to guarantee file signature matches declared image type.
 * Protects against MIME spoofing and disguised executable/script payloads.
 */
export function sniffImageMagicBytes(buffer: Buffer): AllowedMediaType | null {
  if (!buffer || buffer.length < 12) {
    return null;
  }

  // JPEG: starts with FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: starts with 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  // WebP: RIFF at 0-3 and WEBP at 8-11
  const riff = buffer.subarray(0, 4).toString("ascii");
  const webp = buffer.subarray(8, 12).toString("ascii");
  if (riff === "RIFF" && webp === "WEBP") {
    return "image/webp";
  }

  return null;
}

export class StorageService {
  private baseDir: string;

  constructor(customBaseDir?: string) {
    this.baseDir = path.resolve(
      customBaseDir || process.env.MEDIA_STORAGE_DIR || "./uploads"
    );
  }

  /**
   * Resolves and secures absolute filesystem path.
   * Strictly prevents path traversal attacks (e.g. '../').
   */
  public resolveSafePath(storageKey: string): string {
    if (!storageKey || storageKey.includes("..") || path.isAbsolute(storageKey)) {
      throw new Error("Invalid storage key: path traversal prohibited");
    }

    const resolved = path.resolve(this.baseDir, storageKey);
    if (!resolved.startsWith(this.baseDir)) {
      throw new Error("Access denied: path escapes storage root");
    }

    return resolved;
  }

  /**
   * Writes binary payload directly to storage destination.
   */
  public async saveBinary(storageKey: string, buffer: Buffer): Promise<void> {
    const targetPath = this.resolveSafePath(storageKey);
    const parentDir = path.dirname(targetPath);

    await fs.mkdir(parentDir, { recursive: true });
    await fs.writeFile(targetPath, buffer);
  }

  /**
   * Checks whether object exists on storage.
   */
  public async exists(storageKey: string): Promise<boolean> {
    try {
      const targetPath = this.resolveSafePath(storageKey);
      await fs.access(targetPath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Opens readable stream for streaming media responses.
   */
  public createReadStream(storageKey: string): fsSync.ReadStream {
    const targetPath = this.resolveSafePath(storageKey);
    return fsSync.createReadStream(targetPath);
  }

  /**
   * Deletes object from storage.
   */
  public async delete(storageKey: string): Promise<void> {
    try {
      const targetPath = this.resolveSafePath(storageKey);
      await fs.unlink(targetPath);
    } catch {
      // Ignored if non-existent
    }
  }
}

export const storageService = new StorageService();
