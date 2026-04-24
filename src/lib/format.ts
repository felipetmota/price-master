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
  return `${d}/${m}/${y}`;
};

/**
 * Format X-ray report dates to dd/mm/yyyy. Accepts:
 * - ISO `yyyy-mm-dd` or full ISO timestamps
 * - already-formatted `dd/mm/yyyy`
 * - Excel serial numbers (e.g. 45123)
 */
export const fmtXrayDate = (raw: string | number | null | undefined) => {
  if (raw === null || raw === undefined || raw === "") return "—";

  const pad = (n: number) => String(n).padStart(2, "0");
  const fromDate = (d: Date) =>
    `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

  if (typeof raw === "number" && Number.isFinite(raw)) {
    const ms = Math.round((raw - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return fromDate(d);
  }

  const s = String(raw).trim();
  if (!s) return "—";

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;

  const d = new Date(s);
  if (!isNaN(d.getTime())) return fromDate(d);

  return s;
};

export const fmtDateTime = (iso: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" });
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