/**
 * AES-256-GCM encryption for secrets at rest — specifically the Google Drive OAuth
 * access/refresh tokens. Tokens are NEVER stored in plaintext (spec requirement).
 *
 * Ciphertext format: `iv:authTag:data`, all hex. A fresh 12-byte IV per encryption
 * and GCM's auth tag give authenticated encryption (tamper-evident).
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "../config/env.js";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY = Buffer.from(env.TOKEN_ENCRYPTION_KEY, "hex"); // validated to 32 bytes in env.ts

/** Encrypt a UTF-8 string. Returns `iv:authTag:ciphertext` (hex). */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/** Reverse {@link encryptSecret}. Throws if the payload is malformed or tampered. */
export function decryptSecret(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 3) throw new Error("Malformed encrypted payload");
  const [ivHex, tagHex, dataHex] = parts as [string, string, string];
  const decipher = createDecipheriv(ALGORITHM, KEY, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
