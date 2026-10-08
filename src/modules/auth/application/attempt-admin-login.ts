import {
  isLoginLocked,
  loginRetentionCutoff,
  loginWindowStart,
} from "@/modules/auth/domain/login-throttle";
import type { LoginAttemptRepository } from "@/modules/auth/domain/ports";

/** `unavailable`: the attempt store failed, so the lockout cannot be enforced (fail closed). */
export type AdminLoginOutcome = "ok" | "invalid" | "locked" | "unavailable";

export type AttemptAdminLoginDeps = {
  attempts: LoginAttemptRepository;
  now: () => Date;
  logger?: Pick<Console, "error">;
};

/**
 * Rate-limited admin login. The attempt is recorded as failed BEFORE counting, so
 * concurrent requests from one client see each other and cannot bypass the limit;
 * the password is only checked when the client is not locked out.
 */
export async function attemptAdminLogin(
  input: { ipHash: string; verifyPassword: () => Promise<boolean> },
  deps: AttemptAdminLoginDeps,
): Promise<AdminLoginOutcome> {
  const now = deps.now();
  let attemptId: number;
  let failures: number;
  try {
    attemptId = await deps.attempts.record(input.ipHash, false);
    // Includes the provisional failure just recorded.
    failures = await deps.attempts.countFailuresSince(input.ipHash, loginWindowStart(now));
  } catch (error) {
    logError(deps, "throttle check", error);
    return "unavailable";
  }

  if (isLoginLocked(failures)) {
    // Retries while locked must not extend the lock: drop the provisional failure so the
    // lock expires one window after the real failures.
    await deps.attempts.remove(attemptId).catch((error) => logError(deps, "remove locked attempt", error));
    return "locked";
  }

  await deps.attempts.purgeOlderThan(loginRetentionCutoff(now)).catch((error) => logError(deps, "purge", error));

  if (!(await input.verifyPassword())) return "invalid";

  // The provisional failure is replaced by a success record (best effort: the session is already set).
  await Promise.all([deps.attempts.remove(attemptId), deps.attempts.record(input.ipHash, true)]).catch((error) =>
    logError(deps, "record success", error),
  );
  return "ok";
}

function logError(deps: AttemptAdminLoginDeps, step: string, error: unknown) {
  deps.logger?.error(`[admin-login] ${step} failed`, { errorName: error instanceof Error ? error.name : typeof error });
}
