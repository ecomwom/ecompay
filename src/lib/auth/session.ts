import { hmacSha256, safeEqual } from "@/lib/crypto";

export const SESSION_COOKIE = "ecompay_admin";
export const SESSION_TTL_SECONDS = 60 * 60 * 12;

/** Token format: "<version>.<expiresAtEpochSeconds>.<hmac>" signed with SESSION_SECRET. */
export function createSessionToken(secret: string, nowMs = Date.now()): string {
  const expiresAt = Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS;
  const payload = `v1.${expiresAt}`;
  return `${payload}.${hmacSha256(secret, payload)}`;
}

export function verifySessionToken(
  token: string | undefined | null,
  secret: string | undefined,
  nowMs = Date.now(),
): boolean {
  if (!token || !secret) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;

  const [version, expiresAt, signature] = parts;
  const payload = `${version}.${expiresAt}`;
  if (!safeEqual(signature, hmacSha256(secret, payload))) return false;

  const expires = Number(expiresAt);
  return Number.isInteger(expires) && expires > Math.floor(nowMs / 1000);
}
