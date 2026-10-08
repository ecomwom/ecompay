import { beforeEach, describe, expect, it } from "vitest";

import type { LoginAttemptRepository } from "@/modules/auth/domain/ports";

import { attemptAdminLogin, type AttemptAdminLoginDeps } from "./attempt-admin-login";

type Attempt = { id: number; ipHash: string; succeeded: boolean; at: Date };

class InMemoryLoginAttempts implements LoginAttemptRepository {
  rows: Attempt[] = [];
  now = new Date("2026-10-06T12:00:00Z");
  private nextId = 1;
  async record(ipHash: string, succeeded: boolean) {
    this.rows.push({ id: this.nextId, ipHash, succeeded, at: this.now });
    return this.nextId++;
  }
  async countFailuresSince(ipHash: string, since: Date) {
    return this.rows.filter((r) => r.ipHash === ipHash && !r.succeeded && r.at >= since).length;
  }
  async remove(id: number) {
    this.rows = this.rows.filter((r) => r.id !== id);
  }
  async purgeOlderThan(cutoff: Date) {
    this.rows = this.rows.filter((r) => r.at >= cutoff);
  }
}

describe("attemptAdminLogin", () => {
  let attempts: InMemoryLoginAttempts;
  let deps: AttemptAdminLoginDeps;
  let checked: number;
  const login = (correct: boolean, ipHash = "ip-a") =>
    attemptAdminLogin({ ipHash, verifyPassword: async () => (checked++, correct) }, deps);

  beforeEach(() => {
    attempts = new InMemoryLoginAttempts();
    deps = { attempts, now: () => attempts.now };
    checked = 0;
  });

  it("records a failed attempt for a wrong password", async () => {
    expect(await login(false)).toBe("invalid");
    expect(attempts.rows).toMatchObject([{ ipHash: "ip-a", succeeded: false }]);
  });

  it("records a success without leaving a failure behind", async () => {
    expect(await login(true)).toBe("ok");
    expect(attempts.rows).toMatchObject([{ ipHash: "ip-a", succeeded: true }]);
  });

  it("locks out after 5 failures, even with the correct password, without checking it", async () => {
    for (let i = 0; i < 5; i++) expect(await login(false)).toBe("invalid");
    checked = 0;
    expect(await login(true)).toBe("locked");
    expect(checked).toBe(0);
    expect(await login(true, "ip-b")).toBe("ok");
  });

  it("allows logging in again once the failures leave the 15 minute window", async () => {
    for (let i = 0; i < 5; i++) await login(false);
    attempts.now = new Date(attempts.now.getTime() + 16 * 60 * 1000);
    expect(await login(true)).toBe("ok");
  });

  it("does not extend the lock when retrying while locked", async () => {
    for (let i = 0; i < 5; i++) await login(false);
    const minute = 60 * 1000;
    const start = attempts.now.getTime();
    // Keep retrying every minute while locked.
    for (let m = 1; m <= 14; m++) {
      attempts.now = new Date(start + m * minute);
      expect(await login(true)).toBe("locked");
    }
    expect(attempts.rows.filter((r) => !r.succeeded)).toHaveLength(5);
    // 15 minutes after the real 5th failure the lock is gone.
    attempts.now = new Date(start + 15 * minute + 1);
    expect(await login(true)).toBe("ok");
  });

  it("fails closed without checking the password when the attempt store fails", async () => {
    const errors: unknown[][] = [];
    deps.logger = { error: (...args: unknown[]) => errors.push(args) };
    attempts.record = async () => {
      throw new Error("supabase down");
    };
    expect(await login(true)).toBe("unavailable");

    attempts = new InMemoryLoginAttempts();
    attempts.countFailuresSince = async () => {
      throw new Error("supabase down");
    };
    deps.attempts = attempts;
    expect(await login(true)).toBe("unavailable");

    expect(checked).toBe(0);
    expect(errors).toEqual([
      ["[admin-login] throttle check failed", { errorName: "Error" }],
      ["[admin-login] throttle check failed", { errorName: "Error" }],
    ]);
  });

  it("purges attempts older than one day", async () => {
    await login(false);
    attempts.now = new Date(attempts.now.getTime() + 25 * 60 * 60 * 1000);
    await login(false);
    expect(attempts.rows).toHaveLength(1);
  });
});
