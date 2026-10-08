export interface LoginAttemptRepository {
  /** Stores an attempt for the hashed client IP and returns its id. */
  record(ipHash: string, succeeded: boolean): Promise<number>;
  countFailuresSince(ipHash: string, since: Date): Promise<number>;
  remove(id: number): Promise<void>;
  purgeOlderThan(cutoff: Date): Promise<void>;
}
