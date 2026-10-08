import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** Constant-time string comparison (hashing first so lengths always match). */
export function safeEqual(a: string, b: string): boolean {
  const left = createHash("sha256").update(a, "utf8").digest();
  const right = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(left, right);
}

export function hmacSha256(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value, "utf8").digest("base64url");
}

export function sha256HexUpper(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex").toUpperCase();
}
