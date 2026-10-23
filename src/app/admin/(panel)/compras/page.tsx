import { BuyersPanel } from "@/components/admin/buyers-panel";
import { requireAdmin } from "@/lib/auth/admin";
import { listBuyers, parseBuyersScope } from "@/modules/orders/application/list-buyers";
import { getContainer } from "@/server/container";

export default async function BuyersPage({ searchParams }: PageProps<"/admin/compras">) {
  await requireAdmin();
  const scope = parseBuyersScope((await searchParams).estado);
  const report = await listBuyers({ scope }, getContainer());

  return (
    <>
      <h1 className="text-2xl font-semibold">Compradores</h1>
      <BuyersPanel report={report} scope={scope} basePath="/admin/compras" showProduct />
    </>
  );
}
