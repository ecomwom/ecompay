import { z } from "zod";

import { buildAnswersSchema, buyerSchema } from "@/modules/orders/domain/checkout-form";
import type { Order } from "@/modules/orders/domain/order";
import { CheckoutTokenConflictError, type OrderRepository } from "@/modules/orders/domain/ports";
import {
  extractPaymentId,
  mapConfioStatus,
  type GatewayPayment,
  type PaymentGateway,
} from "@/modules/payments/domain/payment";
import type { ProductRepository } from "@/modules/products/domain/ports";
import type { ProductWithQuestions } from "@/modules/products/domain/product";

export type CreateCheckoutInput = {
  slug: string;
  /** Raw form values: firstName, phoneNumber and q_<questionId> answers. */
  fields: Record<string, string | undefined>;
  /** One-time token rendered into the form; repeated submits reuse its order. */
  checkoutToken?: string;
};

export type CreateCheckoutResult =
  | { ok: true; orderId: string; checkoutUrl: string }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "invalid"; fieldErrors: Record<string, string>; staleToken?: true }
  /** `failed`: Confío definitively rejected it (order FAILED); otherwise the payment may exist. */
  | { ok: false; reason: "gateway_error"; orderId: string; failed: boolean }
  /** The token's order already left PENDING (e.g. PAID) without a checkout URL to reopen. */
  | { ok: false; reason: "already_registered"; orderId: string }
  /** Another request with the same token is still creating the payment: retry with the SAME token. */
  | { ok: false; reason: "in_progress"; orderId: string };

export type CreateCheckoutDeps = {
  products: Pick<ProductRepository, "findBySlug">;
  orders: OrderRepository;
  gateway: PaymentGateway;
  appUrl: string;
  newId: () => string;
  logger?: Pick<Console, "error">;
  /** Injectable for tests; default to the real clock and timer. */
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
};

/** A PENDING order without checkout URL younger than this may still be mid Confío call. */
export const IN_FLIGHT_ORDER_MAX_AGE_MS = 45_000;
/** How long a repeated submit waits for the in-flight request to store the checkout URL. */
const IN_FLIGHT_POLL_INTERVAL_MS = 1_000;
const IN_FLIGHT_POLL_ATTEMPTS = 15;

const checkoutTokenSchema = z.uuid();

/**
 * Token the next submit must use. A fresh one only when the submitted token is dead
 * (its order FAILED) or unusable (missing, malformed, another product's). Every other
 * result keeps it so a retry replays the same order instead of paying twice.
 */
export function nextCheckoutToken(
  result: CreateCheckoutResult,
  submitted: string | undefined,
  mint: () => string,
): string {
  const token = checkoutTokenSchema.safeParse(submitted);
  if (!token.success || result.ok) return token.success ? token.data : mint();
  const dead = result.reason === "gateway_error" ? result.failed : result.reason === "invalid" && !!result.staleToken;
  return dead ? mint() : token.data;
}

const STALE_FORM: CreateCheckoutResult = {
  ok: false,
  reason: "invalid",
  fieldErrors: { form: "Recarga la página e intenta de nuevo." },
  staleToken: true,
};

function isInFlight(order: Order, now: Date): boolean {
  return (
    order.status === "PENDING" &&
    !order.checkoutUrl &&
    now.getTime() - new Date(order.createdAt).getTime() < IN_FLIGHT_ORDER_MAX_AGE_MS
  );
}

/**
 * Result for a repeated submit: never creates a second order. When another request is
 * still creating the payment for this token, waits for its checkout URL; when an old
 * attempt ended ambiguously, re-requests the same payment (Confío dedupes by order id).
 */
async function replayExisting(
  order: Order,
  product: ProductWithQuestions,
  checkoutToken: string,
  deps: CreateCheckoutDeps,
): Promise<CreateCheckoutResult> {
  if (order.productId !== product.id) return STALE_FORM;
  const now = deps.now ?? (() => new Date());
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  let current: Order | null = order;
  for (let attempt = 0; current && !current.checkoutUrl && isInFlight(current, now()); attempt++) {
    if (attempt === IN_FLIGHT_POLL_ATTEMPTS) return { ok: false, reason: "in_progress", orderId: order.id };
    await sleep(IN_FLIGHT_POLL_INTERVAL_MS);
    try {
      current = await deps.orders.findByCheckoutToken(checkoutToken);
    } catch (error) {
      deps.logger?.error("[checkout] findByCheckoutToken failed", { orderId: order.id, ...errorInfo(error) });
      return { ok: false, reason: "in_progress", orderId: order.id };
    }
  }
  if (current?.checkoutUrl) return { ok: true, orderId: current.id, checkoutUrl: current.checkoutUrl };
  if (!current) return { ok: false, reason: "gateway_error", orderId: order.id, failed: false };
  if (current.status === "FAILED") return { ok: false, reason: "gateway_error", orderId: order.id, failed: true };
  if (current.status !== "PENDING") return { ok: false, reason: "already_registered", orderId: order.id };
  // Ambiguous attempt abandoned long ago: the payment may exist, so retry the same one.
  return requestPayment(current, product, deps);
}

function firstErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    result[key] ??= issue.message;
  }
  return result;
}

/**
 * Validates the buyer form, creates a PENDING order and a Confío payment for it.
 * The order id is used both as Confío `correlationId` and as `idempotency-key`.
 * The checkout token makes double submits of the same form idempotent.
 */
export async function createCheckout(
  input: CreateCheckoutInput,
  deps: CreateCheckoutDeps,
): Promise<CreateCheckoutResult> {
  const product = await deps.products.findBySlug(input.slug);
  if (!product || !product.isActive) return { ok: false, reason: "not_found" };

  const buyer = buyerSchema.safeParse(input.fields);
  const answers = buildAnswersSchema(product.questions).safeParse(input.fields);
  if (!buyer.success || !answers.success) {
    return {
      ok: false,
      reason: "invalid",
      fieldErrors: {
        ...(buyer.success ? {} : firstErrors(buyer.error)),
        ...(answers.success ? {} : firstErrors(answers.error)),
      },
    };
  }

  const token = checkoutTokenSchema.safeParse(input.checkoutToken);
  if (!token.success) return STALE_FORM;

  const existing = await deps.orders.findByCheckoutToken(token.data);
  if (existing) return replayExisting(existing, product, token.data, deps);

  let order: Order;
  try {
    order = await deps.orders.create({
      id: deps.newId(),
      productId: product.id,
      buyerFirstName: buyer.data.firstName,
      buyerPhone: buyer.data.phoneNumber,
      answers: answers.data,
      amountCents: product.priceCents,
      checkoutToken: token.data,
    });
  } catch (error) {
    if (!(error instanceof CheckoutTokenConflictError)) throw error;
    // Lost the insert race against a concurrent submit of the same form.
    const winner = await deps.orders.findByCheckoutToken(token.data);
    if (!winner) throw error;
    return replayExisting(winner, product, token.data, deps);
  }
  return requestPayment(order, product, deps);
}

/** Creates (or, by idempotency key, re-fetches) the Confío payment for a PENDING order. */
async function requestPayment(
  order: Order,
  product: ProductWithQuestions,
  deps: CreateCheckoutDeps,
): Promise<CreateCheckoutResult> {
  const createPayment = () =>
    deps.gateway.createPayment({
      idempotencyKey: order.id,
      correlationId: order.id,
      amountCents: order.amountCents,
      currencyCode: "COP",
      title: product.name,
      description: product.description,
      buyer: { firstName: order.buyerFirstName, phoneNumber: order.buyerPhone },
      mediaAssets: product.imageUrl ? [product.imageUrl] : undefined,
      paymentType: product.paymentType,
      redirectUri: `${deps.appUrl}/p/${encodeURIComponent(product.slug)}/return`,
    });

  // Retry ambiguous failures once with the same idempotency key (order id).
  let payment: GatewayPayment | undefined;
  for (let attempt = 0; attempt < 2 && !payment; attempt++) {
    try {
      payment = await createPayment();
    } catch (error) {
      const log = { orderId: order.id, attempt, ...errorInfo(error) };
      deps.logger?.error("[checkout] Confío createPayment failed", log);
      if (isDefinitiveRejection(error)) {
        await deps.orders.markFailed(order.id).catch((markError) =>
          deps.logger?.error("[checkout] markFailed failed", { orderId: order.id, ...errorInfo(markError) }),
        );
        return { ok: false, reason: "gateway_error", orderId: order.id, failed: true };
      }
    }
  }
  // Still ambiguous: Confío may have created the payment, so the order stays PENDING
  // and the webhook/return sync reconciles it via correlationId.
  if (!payment) return { ok: false, reason: "gateway_error", orderId: order.id, failed: false };

  try {
    const paymentId = extractPaymentId(payment.name) ?? payment.id;
    await deps.orders.applyPayment(order.id, {
      confioPaymentId: paymentId,
      confioStatus: payment.status,
      status: mapConfioStatus(payment.status) ?? "PENDING",
      checkoutUrl: payment.url,
    });
  } catch (error) {
    // The payment exists: never mark FAILED here; the webhook/return sync reconciles it.
    deps.logger?.error("[checkout] applyPayment failed", { orderId: order.id, ...errorInfo(error) });
  }
  return { ok: true, orderId: order.id, checkoutUrl: payment.url };
}

function httpStatus(error: unknown): number | undefined {
  const status = (error as { status?: unknown } | null)?.status;
  return error instanceof Error && error.name === "ConfioApiError" && typeof status === "number" ? status : undefined;
}

/** Only a Confío 4xx (except 408/409/429) proves the payment was not created. */
function isDefinitiveRejection(error: unknown): boolean {
  const status = httpStatus(error);
  return status !== undefined && status >= 400 && status < 500 && ![408, 409, 429].includes(status);
}

/** Logs without buyer PII or response bodies. */
function errorInfo(error: unknown) {
  return { errorName: error instanceof Error ? error.name : typeof error, status: httpStatus(error) };
}
