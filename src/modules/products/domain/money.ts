/** Confío minimum: amountCents >= 1,000,000 (10,000 COP). */
export const MIN_PRICE_COP = 10_000;
export const MIN_PRICE_CENTS = MIN_PRICE_COP * 100;

/** Converts whole Colombian pesos (as entered by the admin) to cents. */
export function copToCents(pesos: number): number {
  if (!Number.isInteger(pesos) || pesos < 0) {
    throw new RangeError("COP amount must be a non-negative whole number of pesos");
  }
  const cents = pesos * 100;
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError("COP amount is too large");
  }
  return cents;
}

export function centsToCop(cents: number): number {
  return Math.round(cents / 100);
}

const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function formatCop(cents: number): string {
  return copFormatter.format(centsToCop(cents));
}

/**
 * Parses an admin-typed whole peso amount: plain digits ("150000") or correctly grouped
 * thousands with "." or "," ("150.000", "1.500.000", "150,000"), with an optional
 * leading "$". Anything else (decimals such as "1500.50", mixed separators) is rejected.
 */
export function parseCopInput(raw: string): number | null {
  const normalized = raw.trim().replace(/^\$\s*/, "");
  if (!/^(\d+|\d{1,3}(\.\d{3})+|\d{1,3}(,\d{3})+)$/.test(normalized)) return null;
  const value = Number(normalized.replace(/[.,]/g, ""));
  return Number.isSafeInteger(value) ? value : null;
}
