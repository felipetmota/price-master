import { Currency, ExchangeRates, QTY_MAX } from "./types";

export const fmtMoney = (v: number | null | undefined, currency: Currency = "USD") =>
  v === null || v === undefined
    ? "—"
    : new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(v);

export const fmtQty = (v: number) =>
  v >= QTY_MAX ? "∞" : new Intl.NumberFormat("en-US").format(v);

export const fmtDate = (iso: string) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${m}/${d}/${y}`;
};

export const fmtDateTime = (iso: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" });
};

/**
 * Convert an amount between currencies using the provided rates table.
 * rates.rates[X] = how many X equal 1 unit of rates.base.
 * amount_in_to = amount_in_from * (rates[to] / rates[from])
 */
export const convertCurrency = (
  amount: number,
  from: Currency,
  to: Currency,
  rates: ExchangeRates,
): number => {
  if (from === to) return amount;
  const r = rates.rates;
  const fromRate = r[from];
  const toRate = r[to];
  if (!fromRate || !toRate) return amount;
  return +(amount * (toRate / fromRate)).toFixed(4);
};