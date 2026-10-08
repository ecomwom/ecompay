import Link from "next/link";

import { requireAdmin } from "@/lib/auth/admin";
import { formatCop } from "@/modules/products/domain/money";
import { getContainer } from "@/server/container";

export default async function AdminProductsPage() {
  await requireAdmin();
  const products = await getContainer().products.list();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Productos</h1>
        <Link href="/admin/products/new" className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
          Nuevo producto
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Todavía no has creado productos.</p>
      ) : (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {products.map((product) => (
            <li key={product.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex flex-col">
                <Link href={`/admin/products/${product.id}`} className="font-medium hover:underline">
                  {product.name}
                </Link>
                <span className="text-xs text-slate-500">/p/{product.slug}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold">{formatCop(product.priceCents)}</span>
                {product.isActive ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Activo</span>
                ) : (
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">Archivado</span>
                )}
                <Link href={`/admin/products/${product.id}/orders`} className="text-sm text-emerald-700 underline">
                  Pedidos
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
