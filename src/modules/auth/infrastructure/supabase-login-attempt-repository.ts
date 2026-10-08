import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { LoginAttemptRepository } from "@/modules/auth/domain/ports";

export class SupabaseLoginAttemptRepository implements LoginAttemptRepository {
  constructor(private readonly db: SupabaseClient) {}

  async record(ipHash: string, succeeded: boolean): Promise<number> {
    const { data, error } = await this.db
      .from("admin_login_attempts")
      .insert({ ip_hash: ipHash, succeeded })
      .select("id")
      .single();
    if (error) throw error;
    return Number((data as { id: number | string }).id);
  }

  async countFailuresSince(ipHash: string, since: Date): Promise<number> {
    const { count, error } = await this.db
      .from("admin_login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .eq("succeeded", false)
      .gte("attempted_at", since.toISOString());
    if (error) throw error;
    return count ?? 0;
  }

  async remove(id: number): Promise<void> {
    const { error } = await this.db.from("admin_login_attempts").delete().eq("id", id);
    if (error) throw error;
  }

  async purgeOlderThan(cutoff: Date): Promise<void> {
    const { error } = await this.db.from("admin_login_attempts").delete().lt("attempted_at", cutoff.toISOString());
    if (error) throw error;
  }
}
