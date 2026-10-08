import { canTransitionOrderStatus, type NewOrder, type Order } from "@/modules/orders/domain/order";
import { CheckoutTokenConflictError, type OrderRepository, type PaymentSnapshot } from "@/modules/orders/domain/ports";
import type {
  CreatePaymentRequest,
  GatewayPayment,
  PaymentGateway,
} from "@/modules/payments/domain/payment";
import type { ProductWithQuestions } from "@/modules/products/domain/product";

export function makeProduct(overrides: Partial<ProductWithQuestions> = {}): ProductWithQuestions {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    slug: "camiseta-negra",
    name: "Camiseta negra",
    description: "Camiseta de algodón 100% color negro, talla única.",
    priceCents: 5_000_000,
    currency: "COP",
    imageUrl: "https://cdn.example.com/camiseta.jpg",
    paymentType: "PRODUCT",
    isActive: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    questions: [],
    ...overrides,
  };
}

export class InMemoryOrderRepository implements OrderRepository {
  readonly orders = new Map<string, Order>();
  /** checkout token -> order id (mirrors the unique constraint). */
  readonly tokens = new Map<string, string>();
  failApply = false;

  async create({ checkoutToken, ...order }: NewOrder): Promise<Order> {
    if (checkoutToken && this.tokens.has(checkoutToken)) throw new CheckoutTokenConflictError("duplicate token");
    if (checkoutToken) this.tokens.set(checkoutToken, order.id);
    const created: Order = {
      ...order,
      currency: "COP",
      confioPaymentId: null,
      confioStatus: null,
      checkoutUrl: null,
      status: "PENDING",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };
    this.orders.set(order.id, created);
    return created;
  }

  async findById(id: string) {
    return this.orders.get(id) ?? null;
  }

  async findByCheckoutToken(checkoutToken: string) {
    const id = this.tokens.get(checkoutToken);
    return id ? (this.orders.get(id) ?? null) : null;
  }

  async findByPaymentId(paymentId: string) {
    return [...this.orders.values()].find((o) => o.confioPaymentId === paymentId) ?? null;
  }

  async listByProduct(productId: string) {
    return [...this.orders.values()].filter((o) => o.productId === productId);
  }

  async applyPayment(orderId: string, snapshot: PaymentSnapshot): Promise<Order> {
    const current = this.orders.get(orderId);
    if (!current || this.failApply) throw new Error("order not found");
    if (!canTransitionOrderStatus(current.status, snapshot.status)) return current;
    const updated: Order = {
      ...current,
      confioPaymentId: snapshot.confioPaymentId,
      confioStatus: snapshot.confioStatus,
      status: snapshot.status,
      checkoutUrl: snapshot.checkoutUrl ?? current.checkoutUrl,
    };
    this.orders.set(orderId, updated);
    return updated;
  }

  async markFailed(orderId: string) {
    const current = this.orders.get(orderId);
    if (current && !current.confioPaymentId) this.orders.set(orderId, { ...current, status: "FAILED" });
  }
}

export class FakePaymentGateway implements PaymentGateway {
  readonly created: CreatePaymentRequest[] = [];
  readonly fetched: string[] = [];
  readonly payments = new Map<string, GatewayPayment>();
  /** Errors thrown by successive createPayment calls (shifted per call). */
  createErrors: Error[] = [];

  async createPayment(request: CreatePaymentRequest): Promise<GatewayPayment> {
    this.created.push(request);
    const error = this.createErrors.shift();
    if (error) throw error;
    const id = `PAY${this.created.length}`;
    const payment: GatewayPayment = {
      name: `stores/STORE1/payments/${id}`,
      id,
      url: `https://checkout.dev.confiopagos.com/p/${id}`,
      status: "AWAITING_PAYMENT",
      amountCents: request.amountCents,
      currencyCode: request.currencyCode,
      correlationId: request.correlationId,
    };
    this.payments.set(id, payment);
    return payment;
  }

  async getPayment(paymentId: string): Promise<GatewayPayment> {
    this.fetched.push(paymentId);
    const payment = this.payments.get(paymentId);
    if (!payment) throw new Error(`payment ${paymentId} not found`);
    return payment;
  }

  setStatus(paymentId: string, status: string) {
    const payment = this.payments.get(paymentId);
    if (payment) this.payments.set(paymentId, { ...payment, status });
  }
}
