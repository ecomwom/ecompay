import Link from "next/link";
import { notFound } from "next/navigation";

import { OrdersTable } from "@/components/admin/orders-table";
import { requireAdmin } from "@/lib/auth/admin";
import { getContainer } from "@/server/container";
import { isUuid } from "@/lib/uuid";

export default async function ProductOrdersPage({ params }: PageProps<"/admin/products/[id]/orders">) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const { products, orders } = getContainer();
  const [product, productOrders] = await Promise.all([products.findById(id), orders.listByProduct(id)]);
  if (!product) notFound();

  return (
    <>
      <Link href={`/admin/products/${product.id}`} className="text-sm text-slate-500 hover:underline">
        ← {product.name}
      </Link>
      <h1 className="text-2xl font-semibold">Pedidos · {product.name}</h1>
      <OrdersTable orders={productOrders} />
    </>
  );
}
