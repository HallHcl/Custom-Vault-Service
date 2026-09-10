import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // Standard recommended IV length for GCM (96 bits)
const PREFIX = "enc:v1:";

/**
 * Derives a 32-byte key buffer from CREDENTIAL_ENCRYPTION_KEY or a deterministic
 * fallback key for development / test environments when the env var is omitted.
 */
function getEncryptionKey(): Buffer {
  const rawKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!rawKey) {
    // Fallback key: SHA-256 hash of a deterministic dev seed so local dev/tests won't crash
    return crypto.createHash("sha256").update("dev-fallback-secret-key-32bytes").digest();
  }

  // If 64 hex characters, parse directly as 32 bytes
  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    return Buffer.from(rawKey, "hex");
  }

  // Otherwise SHA-256 hash the string to guarantee exact 32-byte key length
  return crypto.createHash("sha256").update(rawKey).digest();
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Output format: enc:v1:<iv_hex>:<tag_hex>:<ciphertext_hex>
 */
export function encryptCredential(plaintext: string | null | undefined): string | null {
  if (!plaintext) {
    return null;
  }

  // If it's already encrypted, avoid double-encrypting
  if (plaintext.startsWith(PREFIX)) {
    return plaintext;
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts a stored credential string.
 * If the string starts with `enc:v1:`, it is decrypted with AES-256-GCM.
 * Otherwise, it is returned as-is for backward compatibility with existing plaintext records.
 */
export function decryptCredential(stored: string | null | undefined): string | null {
  if (!stored) {
    return null;
  }

  if (!stored.startsWith(PREFIX)) {
    return stored; // Backward compatibility with legacy plaintext
  }

  try {
    const payload = stored.slice(PREFIX.length);
    const [ivHex, tagHex, ciphertextHex] = payload.split(":");

    if (!ivHex || !tagHex || !ciphertextHex) {
      return stored;
    }

    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const ciphertext = Buffer.from(ciphertextHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch {
    // If decryption fails (e.g. invalid key or corrupted data), return original or null
    return stored;
  }
}

/**
 * Generates a clean hash / token-like string to safely display on the web UI
 * (e.g. `enc_7a9f4c82b1...`) so the real password is never exposed to screen-peeking.
 */
export function getDisplayHash(stored: string | null | undefined, decrypted: string | null | undefined): string | null {
  if (!stored && !decrypted) {
    return null;
  }

  const source = stored && stored.startsWith(PREFIX) ? stored : (decrypted ?? "");
  const hash = crypto.createHash("sha256").update(source).digest("hex").slice(0, 16);
  return `enc_${hash}`;
}
