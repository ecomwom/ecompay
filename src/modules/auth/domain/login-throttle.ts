/** Admin login lockout: at most 5 failed attempts per client within 15 minutes. */
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
/** Attempts older than this are no longer needed and can be purged. */
export const LOGIN_ATTEMPT_RETENTION_MS = 24 * 60 * 60 * 1000;

export function loginWindowStart(now: Date): Date {
  return new Date(now.getTime() - LOGIN_WINDOW_MS);
}

export function loginRetentionCutoff(now: Date): Date {
  return new Date(now.getTime() - LOGIN_ATTEMPT_RETENTION_MS);
}

/**
 * `failuresInWindow` INCLUDES the attempt being evaluated (it is recorded provisionally
 * as failed before counting). The client is locked once it already had the maximum
 * failures before this attempt, i.e. this would be attempt number LOGIN_MAX_FAILURES + 1.
 */
export function isLoginLocked(failuresInWindow: number): boolean {
  return failuresInWindow > LOGIN_MAX_FAILURES;
}
