import { describe, expect, it } from "vitest";

import { clientIp, hashClientIp } from "./client-ip";

describe("clientIp", () => {
  it("prefers the first x-forwarded-for entry, then x-real-ip", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": " 1.2.3.4, 10.0.0.1", "x-real-ip": "5.6.7.8" }))).toBe("1.2.3.4");
    expect(clientIp(new Headers({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
    expect(clientIp(new Headers())).toBe("unknown");
  });

  it("hashes IPs with the secret instead of storing them", () => {
    const hash = hashClientIp("1.2.3.4", "s".repeat(32));
    expect(hash).not.toContain("1.2.3.4");
    expect(hash).toBe(hashClientIp("1.2.3.4", "s".repeat(32)));
    expect(hash).not.toBe(hashClientIp("1.2.3.4", "t".repeat(32)));
  });
});
