import { describe, expect, it } from "vitest";

import { isLoginLocked, loginRetentionCutoff, loginWindowStart } from "./login-throttle";

describe("login throttle", () => {
  it("locks out the attempt that follows 5 failures (count includes the current attempt)", () => {
    expect(isLoginLocked(1)).toBe(false);
    expect(isLoginLocked(5)).toBe(false);
    expect(isLoginLocked(6)).toBe(true);
    expect(isLoginLocked(10)).toBe(true);
  });

  it("uses a 15 minute window and a 1 day retention", () => {
    const now = new Date("2026-10-06T12:00:00Z");
    expect(loginWindowStart(now).toISOString()).toBe("2026-10-06T11:45:00.000Z");
    expect(loginRetentionCutoff(now).toISOString()).toBe("2026-10-05T12:00:00.000Z");
  });
});
