import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const CURRENT_VERSION = "v1";

/**
 * Derives a 32-byte key from the environment configuration.
 * GPG_TOKEN_ENCRYPTION_KEY should be set in production.
 */
function getEncryptionKey(): Buffer {
  const rawKey =
    process.env.GPG_TOKEN_ENCRYPTION_KEY ||
    "groveveil-dev-gpg-encryption-key-must-be-rotated-32-bytes";

  // Deterministically hash to ensure 32-byte key for AES-256
  return crypto.createHash("sha256").update(rawKey).digest();
}

/**
 * Encrypts a sensitive string (such as an OAuth refresh token) using AES-256-GCM.
 * Output format: v1:<iv_hex>:<auth_tag_hex>:<ciphertext_hex>
 */
export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // Standard 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return `${CURRENT_VERSION}:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts an encrypted token envelope.
 * Validates version header and verifies the GCM authentication tag.
 */
export function decryptToken(envelope: string): string {
  const parts = envelope.split(":");
  if (parts.length !== 4) {
    throw new Error("Invalid encrypted token envelope format");
  }

  const [version, ivHex, tagHex, ciphertextHex] = parts;
  if (version !== CURRENT_VERSION) {
    throw new Error(`Unsupported token encryption version: ${version}`);
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertextHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
