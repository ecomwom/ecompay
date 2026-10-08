import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PaymentResult } from "@/components/checkout/payment-result";
import { resolveReturn } from "@/modules/orders/application/resolve-return";
import { getProductForReturn } from "@/modules/products/application/manage-products";
import { getContainer } from "@/server/container";

export const metadata: Metadata = { title: "Estado de tu pago", robots: { index: false } };

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ReturnPage({ params, searchParams }: PageProps<"/p/[slug]/return">) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const container = getContainer();
  const product = await getProductForReturn(slug, container.products);
  if (!product) notFound();

  // Query params (status, payment_id, correlation_id) are NOT trusted: resolveReturn
  // re-fetches the payment from Confío server-side before showing anything.
  const { outcome } = await resolveReturn(
    {
      productId: product.id,
      paymentId: single(query.payment_id),
      correlationId: single(query.correlation_id),
    },
    { orders: container.orders, gateway: container.gateway, logger: console },
  );

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-6 p-6">
      <PaymentResult outcome={outcome} productName={product.name} />
      <Link href={`/p/${product.slug}`} className="text-center text-sm font-medium text-emerald-700 underline">
        Volver al producto
      </Link>
    </main>
  );
}
