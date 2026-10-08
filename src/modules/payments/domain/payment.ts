import type { OrderStatus } from "@/modules/orders/domain/order";
import type { PaymentType } from "@/modules/products/domain/product";

export const CONFIO_PAYMENT_STATUSES = [
  "STATUS_UNSPECIFIED",
  "AWAITING_PAYMENT",
  "PAYMENT_IN_PROGRESS",
  "FUNDED",
  "DELIVERING",
  "UNDER_REVIEW",
  "APPROVED",
  "DISPUTED",
  "REFUNDED",
  "EXPIRED",
  "CANCELED",
  "FAILED",
] as const;

export type ConfioPaymentStatus = (typeof CONFIO_PAYMENT_STATUSES)[number];

/** Payment as returned by the gateway (subset of Confío's `Payment` schema). */
export type GatewayPayment = {
  /** Resource name, e.g. "stores/{store}/payments/{payment}". */
  name: string;
  /** Payment id (last segment of `name`). */
  id: string;
  /** Raw Confío status (kept as string so unknown future values do not crash us). */
  status: string;
  url: string;
  amountCents: number;
  currencyCode: string;
  correlationId: string | null;
};

export type CreatePaymentRequest = {
  idempotencyKey: string;
  correlationId: string;
  amountCents: number;
  currencyCode: "COP";
  title: string;
  description: string;
  buyer: { firstName: string; phoneNumber: string };
  mediaAssets?: string[];
  paymentType: PaymentType;
  redirectUri: string;
};

/** Port: anything able to create and look up payments (Confío in production, fakes in tests). */
export interface PaymentGateway {
  createPayment(request: CreatePaymentRequest): Promise<GatewayPayment>;
  getPayment(paymentId: string): Promise<GatewayPayment>;
}

/**
 * Maps a Confío payment status to our order status.
 * Returns null for STATUS_UNSPECIFIED / unknown values so callers keep the current status.
 */
export function mapConfioStatus(status: string): OrderStatus | null {
  switch (status) {
    case "AWAITING_PAYMENT":
    case "PAYMENT_IN_PROGRESS":
      return "PENDING";
    case "FUNDED":
    case "APPROVED":
    case "DELIVERING":
      return "PAID";
    case "UNDER_REVIEW":
      return "UNDER_REVIEW";
    case "DISPUTED":
      return "DISPUTED";
    case "REFUNDED":
      return "REFUNDED";
    case "EXPIRED":
      return "EXPIRED";
    case "CANCELED":
      return "CANCELED";
    case "FAILED":
      return "FAILED";
    default:
      return null;
  }
}

const PAYMENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * Extracts the payment id from a resource name ("stores/x/payments/{id}[/attempts/y]")
 * or validates a bare id. Returns null if the value does not look like a payment id.
 */
export function extractPaymentId(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return null;
  const match = /(?:^|\/)payments\/([^/]+)/.exec(value);
  const candidate = match ? match[1] : value;
  return PAYMENT_ID_PATTERN.test(candidate) ? candidate : null;
}
