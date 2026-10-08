import type { OrderStatus } from "@/modules/orders/domain/order";

const labels: Record<OrderStatus, string> = {
  PENDING: "Pendiente",
  PAID: "Pagado",
  UNDER_REVIEW: "En revisión",
  DISPUTED: "En disputa",
  REFUNDED: "Reembolsado",
  EXPIRED: "Expirado",
  CANCELED: "Cancelado",
  FAILED: "Fallido",
};

const tones: Record<OrderStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  PAID: "bg-emerald-100 text-emerald-800",
  UNDER_REVIEW: "bg-sky-100 text-sky-800",
  DISPUTED: "bg-orange-100 text-orange-800",
  REFUNDED: "bg-slate-200 text-slate-700",
  EXPIRED: "bg-slate-200 text-slate-700",
  CANCELED: "bg-slate-200 text-slate-700",
  FAILED: "bg-red-100 text-red-800",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tones[status]}`}>
      {labels[status]}
    </span>
  );
}
