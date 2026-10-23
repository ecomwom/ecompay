import Link from "next/link";
import { notFound } from "next/navigation";

import { BuyersPanel } from "@/components/admin/buyers-panel";
import { requireAdmin } from "@/lib/auth/admin";
import { listBuyers, parseBuyersScope } from "@/modules/orders/application/list-buyers";
import { getContainer } from "@/server/container";
import { isUuid } from "@/lib/uuid";

export default async function ProductOrdersPage({ params, searchParams }: PageProps<"/admin/products/[id]/orders">) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const scope = parseBuyersScope((await searchParams).estado);

  const container = getContainer();
  const [product, report] = await Promise.all([
    container.products.findById(id),
    listBuyers({ productId: id, scope }, container),
  ]);
  if (!product) notFound();

  return (
    <>
      <Link href={`/admin/products/${product.id}`} className="text-sm text-slate-500 hover:underline">
        ← {product.name}
      </Link>
      <h1 className="text-2xl font-semibold">Pedidos · {product.name}</h1>
      <BuyersPanel report={report} scope={scope} basePath={`/admin/products/${product.id}/orders`} productId={product.id} />
    </>
  );
}
