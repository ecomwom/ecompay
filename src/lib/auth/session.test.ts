import { describe, expect, it } from "vitest";

import { createSessionToken, SESSION_TTL_SECONDS, verifySessionToken } from "./session";

const SECRET = "x".repeat(32);

describe("admin session token", () => {
  it("verifies a freshly created token", () => {
    expect(verifySessionToken(createSessionToken(SECRET), SECRET)).toBe(true);
  });

  it("rejects tampered, foreign or expired tokens", () => {
    const now = Date.now();
    const token = createSessionToken(SECRET, now);
    const [version, expires, signature] = token.split(".");

    expect(verifySessionToken(`${version}.${Number(expires) + 1000}.${signature}`, SECRET)).toBe(false);
    expect(verifySessionToken(token, "y".repeat(32))).toBe(false);
    expect(verifySessionToken(token, SECRET, now + (SESSION_TTL_SECONDS + 1) * 1000)).toBe(false);
    expect(verifySessionToken("garbage", SECRET)).toBe(false);
    expect(verifySessionToken(undefined, SECRET)).toBe(false);
    expect(verifySessionToken(token, undefined)).toBe(false);
  });
});
