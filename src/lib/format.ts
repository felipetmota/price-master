export const fmtMoney = (v: number | null | undefined) =>
  v === null || v === undefined
    ? "—"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v);

import { QTY_MAX } from "./types";

export const fmtQty = (v: number) =>
  v >= QTY_MAX ? "∞" : new Intl.NumberFormat("en-US").format(v);

export const fmtDate = (iso: string) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${m}/${d}/${y}`;
};