import { encryptCredential, decryptCredential, getDisplayHash } from "../utils/crypto";

describe("crypto utility", () => {
  it("should encrypt and decrypt a password successfully", () => {
    const rawPassword = "MySecureP@ssw0rd!123";
    const encrypted = encryptCredential(rawPassword);

    expect(encrypted).toBeDefined();
    expect(encrypted).not.toBe(rawPassword);
    expect(encrypted?.startsWith("enc:v1:")).toBe(true);

    const decrypted = decryptCredential(encrypted);
    expect(decrypted).toBe(rawPassword);
  });

  it("should produce different ciphertexts for the same plaintext due to random IV", () => {
    const password = "same_password";
    const enc1 = encryptCredential(password);
    const enc2 = encryptCredential(password);

    expect(enc1).not.toBe(enc2);
    expect(decryptCredential(enc1)).toBe(password);
    expect(decryptCredential(enc2)).toBe(password);
  });

  it("should gracefully handle null or undefined or empty strings", () => {
    expect(encryptCredential(null)).toBeNull();
    expect(encryptCredential(undefined)).toBeNull();
    expect(encryptCredential("")).toBeNull();

    expect(decryptCredential(null)).toBeNull();
    expect(decryptCredential(undefined)).toBeNull();
    expect(decryptCredential("")).toBeNull();
  });

  it("should support backward compatibility with legacy plaintext passwords", () => {
    const legacyPlaintext = "legacy_plain_secret";
    // If it doesn't have enc:v1: prefix, decryptCredential returns it as-is
    expect(decryptCredential(legacyPlaintext)).toBe(legacyPlaintext);
  });

  it("should generate a consistent display hash string starting with enc_", () => {
    const password = "test_password";
    const encrypted = encryptCredential(password);
    const displayHash = getDisplayHash(encrypted, password);

    expect(displayHash).toBeDefined();
    expect(displayHash?.startsWith("enc_")).toBe(true);
    expect(displayHash?.length).toBe(20); // 'enc_' (4) + 16 hex chars
  });
});
