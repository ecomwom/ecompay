import "server-only";

import ExcelJS from "exceljs";

import type { BuyersReport } from "@/modules/orders/application/list-buyers";
import { ORDER_STATUS_LABELS } from "@/modules/orders/domain/buyers-report";
import { centsToCop } from "@/modules/products/domain/money";

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

/** Builds an .xlsx workbook with one row per buyer (order). */
export async function buildBuyersWorkbook({ rows, questionLabels }: BuyersReport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Compradores");

  sheet.columns = [
    { header: "Fecha", key: "date", width: 18 },
    { header: "Producto", key: "product", width: 32 },
    { header: "Nombre", key: "name", width: 22 },
    { header: "Celular", key: "phone", width: 16 },
    { header: "Correo", key: "email", width: 30 },
    ...questionLabels.map((label, i) => ({ header: label, key: `q${i}`, width: 30 })),
    { header: "Estado", key: "status", width: 12 },
    { header: "Valor (COP)", key: "amount", width: 14, style: { numFmt: "#,##0" } },
    { header: "Pedido", key: "orderId", width: 38 },
    { header: "Pago Confío", key: "confioId", width: 38 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  for (const row of rows) {
    sheet.addRow({
      date: dateFormatter.format(new Date(row.createdAt)),
      product: row.productName,
      name: row.name,
      phone: row.phone,
      email: row.email ?? "",
      ...Object.fromEntries(questionLabels.map((label, i) => [`q${i}`, row.answers[label] ?? ""])),
      status: ORDER_STATUS_LABELS[row.status],
      amount: centsToCop(row.amountCents),
      orderId: row.orderId,
      confioId: row.confioPaymentId ?? "",
    });
  }
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
