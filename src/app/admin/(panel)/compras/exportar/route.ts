import { notFound } from "next/navigation";
import type { NextRequest } from "next/server";

import { requireAdmin } from "@/lib/auth/admin";
import { isUuid } from "@/lib/uuid";
import { listBuyers, parseBuyersScope } from "@/modules/orders/application/list-buyers";
import { buildBuyersWorkbook } from "@/modules/orders/infrastructure/buyers-xlsx";
import { getContainer } from "@/server/container";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  await requireAdmin();
  const params = request.nextUrl.searchParams;
  const productId = params.get("producto") ?? undefined;
  if (productId !== undefined && !isUuid(productId)) notFound();
  const scope = parseBuyersScope(params.get("estado"));

  const report = await listBuyers({ productId, scope }, getContainer());
  const file = await buildBuyersWorkbook(report);
  const date = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Bogota" });

  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="compradores-${scope}-${date}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
