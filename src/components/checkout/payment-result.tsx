import type { BuyerOutcome } from "@/modules/orders/domain/order";

type PaymentResultProps = { outcome: BuyerOutcome | "unknown"; productName: string };

const content: Record<PaymentResultProps["outcome"], { icon: string; title: string; body: string; tone: string }> = {
  success: {
    icon: "✓",
    title: "¡Pago confirmado!",
    body: "Recibimos tu pago. El vendedor se comunicará contigo con los detalles de tu compra.",
    tone: "bg-emerald-100 text-emerald-700",
  },
  pending: {
    icon: "…",
    title: "Tu pago está en proceso",
    body: "Estamos esperando la confirmación de Confío. En cuanto se confirme, el vendedor se comunicará contigo.",
    tone: "bg-amber-100 text-amber-700",
  },
  failed: {
    icon: "!",
    title: "El pago no se completó",
    body: "Tu pago fue rechazado, cancelado o expiró. Puedes intentarlo de nuevo.",
    tone: "bg-red-100 text-red-700",
  },
  unknown: {
    icon: "?",
    title: "No encontramos tu pago",
    body: "Si ya pagaste, no te preocupes: el vendedor confirmará tu compra y se comunicará contigo.",
    tone: "bg-slate-200 text-slate-700",
  },
};

export function PaymentResult({ outcome, productName }: PaymentResultProps) {
  const view = content[outcome];
  return (
    <section className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <div className={`flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold ${view.tone}`} aria-hidden>
        {view.icon}
      </div>
      <h1 className="text-xl font-semibold text-slate-900">{view.title}</h1>
      <p className="text-sm text-slate-500">{productName}</p>
      <p className="text-slate-600">{view.body}</p>
    </section>
  );
}
