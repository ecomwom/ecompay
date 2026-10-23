import Link from "next/link";

import { CopyButton } from "@/components/admin/copy-button";
import { StatusBadge } from "@/components/ui/status-badge";
import type { BuyersReport, BuyersScope } from "@/modules/orders/application/list-buyers";
import { formatCop } from "@/modules/products/domain/money";

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

type BuyersPanelProps = {
  report: BuyersReport;
  scope: BuyersScope;
  /** Page the scope tabs link to. */
  basePath: string;
  productId?: string;
  showProduct?: boolean;
};

function scopeHref(basePath: string, scope: BuyersScope): string {
  return scope === "pagados" ? basePath : `${basePath}?estado=todos`;
}

export function BuyersPanel({ report, scope, basePath, productId, showProduct = false }: BuyersPanelProps) {
  const { summary, rows, questionLabels } = report;
  const exportParams = new URLSearchParams({ estado: scope, ...(productId ? { producto: productId } : {}) });
  const emails = [...new Set(rows.map((r) => r.email).filter((e): e is string => e !== null))];

  return (
    <>
      <BuyersSummaryCards summary={summary} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm">
          {(["pagados", "todos"] as const).map((value) => (
            <Link
              key={value}
              href={scopeHref(basePath, value)}
              aria-current={scope === value ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 font-medium ${scope === value ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {value === "pagados" ? "Pagados" : "Todos los pedidos"}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          {emails.length > 0 ? <CopyButton value={emails.join(", ")} label={`Copiar ${emails.length} correos`} /> : null}
          <a
            href={`/admin/compras/exportar?${exportParams}`}
            download
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Exportar Excel
          </a>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
          {scope === "pagados" ? "Aún no hay compras pagadas." : "Aún no hay pedidos."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Fecha</th>
                {showProduct ? <th className="px-3 py-2 font-medium">Producto</th> : null}
                <th className="px-3 py-2 font-medium">Nombre</th>
                <th className="px-3 py-2 font-medium">Celular</th>
                <th className="px-3 py-2 font-medium">Correo</th>
                {questionLabels.map((label) => (
                  <th key={label} className="min-w-48 px-3 py-2 font-medium normal-case tracking-normal">
                    {label}
                  </th>
                ))}
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 text-right font-medium">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.orderId} className="align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-slate-500">{dateFormatter.format(new Date(row.createdAt))}</td>
                  {showProduct ? <td className="px-3 py-2">{row.productName}</td> : null}
                  <td className="px-3 py-2 font-medium">{row.name}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <a href={`https://wa.me/${row.phone.replace("+", "")}`} className="text-emerald-700 underline" target="_blank" rel="noreferrer">
                      {row.phone}
                    </a>
                  </td>
                  <td className="px-3 py-2">
                    {row.email ? (
                      <a href={`mailto:${row.email}`} className="break-all text-emerald-700 underline">
                        {row.email}
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  {questionLabels.map((label) => (
                    <td key={label} className="whitespace-pre-line break-words px-3 py-2">
                      {row.answers[label] ?? <span className="text-slate-400">—</span>}
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">{formatCop(row.amountCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export function BuyersSummaryCards({ summary }: { summary: BuyersReport["summary"] }) {
  const cards = [
    { label: "Compras pagadas", value: String(summary.paidCount) },
    { label: "Total recaudado", value: formatCop(summary.paidAmountCents) },
    { label: "Correos registrados", value: String(summary.paidEmailCount) },
    { label: "Pedidos pendientes", value: String(summary.pendingCount) },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <dt className="text-xs font-medium text-slate-500">{card.label}</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">{card.value}</dd>
        </div>
      ))}
    </dl>
  );
}
