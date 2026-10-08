/**
 * Confío expects `buyer.phoneNumber` in E.164 (e.g. "+573215786325") and notifies the
 * buyer over WhatsApp, so we only accept Colombian mobile numbers (10 digits, starting with 3).
 * Accepts "321 578 6325", "321-578-6325", "573215786325" or "+57 321 578 6325".
 */
export function normalizeColombianMobile(raw: string): string | null {
  let digits = raw.replace(/[\s\-().]/g, "");
  if (digits.startsWith("+")) {
    if (!digits.startsWith("+57")) return null;
    digits = digits.slice(3);
  } else if (digits.length === 12 && digits.startsWith("57")) {
    digits = digits.slice(2);
  }
  return /^3\d{9}$/.test(digits) ? `+57${digits}` : null;
}
