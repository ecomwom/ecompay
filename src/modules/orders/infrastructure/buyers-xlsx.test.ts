import ExcelJS from "exceljs";
import { expect, it } from "vitest";

import { buildBuyersWorkbook } from "./buyers-xlsx";

it("writes one row per buyer with email and custom answers as columns", async () => {
  const file = await buildBuyersWorkbook({
    summary: { paidCount: 1, paidAmountCents: 5_000_000, pendingCount: 0, paidEmailCount: 1 },
    questionLabels: ["Etapa"],
    rows: [
      {
        createdAt: "2026-10-20T15:00:00Z",
        productName: "Evento",
        name: "Ana",
        phone: "+573215786325",
        email: "ana@mail.com",
        answers: { Etapa: "=HYPERLINK(\"x\")" },
        status: "PAID",
        amountCents: 5_000_000,
        orderId: "o1",
        confioPaymentId: "pay_1",
      },
    ],
  });

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer);
  const sheet = workbook.getWorksheet("Compradores")!;
  const header = sheet.getRow(1).values as unknown[];
  expect(header.slice(1)).toEqual([
    "Fecha", "Producto", "Nombre", "Celular", "Correo", "Etapa", "Estado", "Valor (COP)", "Pedido", "Pago Confío",
  ]);
  const row = sheet.getRow(2);
  expect(row.getCell(5).value).toBe("ana@mail.com");
  // Buyer input is stored as plain text, never as a formula.
  expect(row.getCell(6).value).toBe("=HYPERLINK(\"x\")");
  expect(row.getCell(7).value).toBe("Pagado");
  expect(row.getCell(8).value).toBe(50_000);
});
