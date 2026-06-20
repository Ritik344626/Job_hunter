import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { env } from "@/lib/env";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";

function getEncryptionKey() {
  if (!env.INTEGRATION_ENCRYPTION_KEY) {
    throw new Error(
      "Integration encryption is not configured. Set INTEGRATION_ENCRYPTION_KEY before saving credentials.",
    );
  }

  const key = Buffer.from(env.INTEGRATION_ENCRYPTION_KEY, "base64");

  if (key.length !== 32) {
    throw new Error(
      "INTEGRATION_ENCRYPTION_KEY must be a base64-encoded 32-byte value.",
    );
  }

  return key;
}

export function encryptSecret(secret: string) {
  const initializationVector = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), initializationVector);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    VERSION,
    initializationVector.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

export function decryptSecret(encryptedSecret: string) {
  const [version, initializationVector, authTag, ciphertext] = encryptedSecret.split(":");

  if (
    version !== VERSION ||
    !initializationVector ||
    !authTag ||
    !ciphertext
  ) {
    throw new Error("Stored integration credential has an unsupported format.");
  }

  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      getEncryptionKey(),
      Buffer.from(initializationVector, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(authTag, "base64url"));

    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Stored integration credential could not be decrypted.");
  }
}
