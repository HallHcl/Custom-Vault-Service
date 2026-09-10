import { formatServer } from "../services/servers.service";
import { encryptCredential } from "../utils/crypto";
import { Server } from "../types";

describe("formatServer encryption and display hash", () => {
  const baseServer: Server = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    environment_id: "123e4567-e89b-12d3-a456-426614174001",
    hostname: "db-node-01",
    ip_address: "10.0.0.1",
    tech_stack: [],
    monitoring_url: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    display_name: "DB Node 01",
    service_type: "database",
    access_method: "ssh",
    access_host: "root@10.0.0.1",
    access_port: 22,
    access_path: null,
    username: "root",
    password: null,
  };

  it("should return decrypted plaintext in password and hash in encrypted_password when password is encrypted", () => {
    const rawSecret = "superSecretPassword123!";
    const encrypted = encryptCredential(rawSecret);

    const server: Server = {
      ...baseServer,
      password: encrypted,
    };

    const formatted = formatServer(server);

    // Password must be the decrypted plaintext so CopyButton copies the real password
    expect(formatted.password).toBe(rawSecret);
    // encrypted_password must be defined and start with enc_ for UI display
    expect(formatted.encrypted_password).toBeDefined();
    expect(formatted.encrypted_password?.startsWith("enc_")).toBe(true);
    expect(formatted.encrypted_password).not.toBe(rawSecret);
  });

  it("should handle legacy plaintext password gracefully", () => {
    const legacyPlain = "old_plain_text_password";
    const server: Server = {
      ...baseServer,
      password: legacyPlain,
    };

    const formatted = formatServer(server);

    expect(formatted.password).toBe(legacyPlain);
    expect(formatted.encrypted_password?.startsWith("enc_")).toBe(true);
  });

  it("should return null for password and encrypted_password when server has no password", () => {
    const server: Server = {
      ...baseServer,
      password: null,
    };

    const formatted = formatServer(server);

    expect(formatted.password).toBeNull();
    expect(formatted.encrypted_password).toBeNull();
  });
});
