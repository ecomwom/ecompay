import { StatusBadge } from "@/components/ui/status-badge";
import type { Order } from "@/modules/orders/domain/order";
import { formatCop } from "@/modules/products/domain/money";

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

export function OrdersTable({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Aún no hay pedidos.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {orders.map((order) => (
        <li key={order.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-col">
              <span className="font-medium">{order.buyerFirstName}</span>
              <a href={`https://wa.me/${order.buyerPhone.replace("+", "")}`} className="text-sm text-emerald-700 underline" target="_blank" rel="noreferrer">
                {order.buyerPhone}
              </a>
            </div>
            <div className="flex flex-col items-end gap-1">
              <StatusBadge status={order.status} />
              <span className="text-sm font-semibold">{formatCop(order.amountCents)}</span>
            </div>
          </div>

          {order.answers.length > 0 ? (
            <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[minmax(0,220px)_1fr]">
              {order.answers.map((answer) => (
                <div key={answer.questionId} className="contents">
                  <dt className="text-slate-500">{answer.label}</dt>
                  <dd className="whitespace-pre-line break-words">{answer.value === null ? "—" : String(answer.value)}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <span>{dateFormatter.format(new Date(order.createdAt))}</span>
            <span>Pedido: {order.id}</span>
            {order.confioPaymentId ? <span>Confío: {order.confioPaymentId}</span> : null}
            {order.confioStatus ? <span>Estado Confío: {order.confioStatus}</span> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
