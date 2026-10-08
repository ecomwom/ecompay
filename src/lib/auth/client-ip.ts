import { hmacSha256 } from "@/lib/crypto";

/** Best-effort client IP: first x-forwarded-for entry (set by Vercel), then x-real-ip. */
export function clientIp(headers: Pick<Headers, "get">): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

/** Keyed hash so raw client IPs are never stored. */
export function hashClientIp(ip: string, secret: string): string {
  return hmacSha256(secret, `admin-login:${ip}`);
}
