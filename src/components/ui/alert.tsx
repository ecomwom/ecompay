import type { ReactNode } from "react";

type AlertProps = { tone?: "error" | "success" | "info"; children: ReactNode };

const tones = {
  error: "border-red-200 bg-red-50 text-red-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  info: "border-slate-200 bg-slate-50 text-slate-700",
};

export function Alert({ tone = "info", children }: AlertProps) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-3 py-2 text-sm ${tones[tone]}`}>
      {children}
    </div>
  );
}
