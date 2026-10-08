import { safeEqual, sha256HexUpper } from "@/lib/crypto";

type SignedPayload = {
  data?: Record<string, unknown>;
  timestamp?: unknown;
  signature?: { properties?: unknown; checksum?: unknown };
};

function stringify(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Confío documented checksum (cookbooks/webhooks):
 *   SHA256(data[p1] + data[p2] + ... + timestamp + WEBHOOK_KEY), uppercase hex, plain SHA-256 (not HMAC),
 *   properties taken in the order of `signature.properties`.
 *
 * TODO(confio): confirm with Confío how non-scalar properties (e.g. `buyer`) and numbers are
 * serialized, then make a mismatch reject the request. Today the result is only logged:
 * the webhook is authenticated by the shared Bearer key and the body is never trusted
 * (the payment is always re-fetched from the API).
 */
export function verifyConfioChecksum(
  payload: SignedPayload,
  headerChecksum: string | null,
  key: string,
): "valid" | "invalid" | "missing" {
  const checksum =
    headerChecksum ??
    (typeof payload.signature?.checksum === "string" ? payload.signature.checksum : null);
  const properties = payload.signature?.properties;
  if (!checksum || !Array.isArray(properties) || payload.timestamp === undefined) {
    return "missing";
  }

  const data = payload.data ?? {};
  const material =
    properties.map((property) => stringify(data[String(property)])).join("") +
    stringify(payload.timestamp) +
    key;

  return safeEqual(sha256HexUpper(material), checksum.trim().toUpperCase()) ? "valid" : "invalid";
}
