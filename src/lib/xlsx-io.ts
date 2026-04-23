import * as XLSX from "xlsx";
import { AppUser, Contract, Currency, CURRENCIES, ExchangeRates, PriceRecord, QTY_MAX } from "./types";

const PRICE_HEADERS = [
  "Contract Number",
  "Part Number",
  "Supplier",
  "Date From",
  "Date To",
  "Quantity From",
  "Quantity To",
  "Unit Price",
  "Lot Price",
  "Currency",
];

let counter = 0;
const newId = () => `r_${Date.now().toString(36)}_${(counter++).toString(36)}`;

function toIsoDate(v: unknown): string {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    // excel serial
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return "";
    const mm = String(d.m).padStart(2, "0");
    const dd = String(d.d).padStart(2, "0");
    return `${d.y}-${mm}-${dd}`;
  }
  const s = String(v).trim();
  // try dd/mm/yyyy
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return s.slice(0, 10);
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return s;
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return isNaN(n) ? null : n;
}

export interface ParsedWorkbook {
  prices: PriceRecord[];
  users: AppUser[];
  contracts: Contract[];
  rates?: ExchangeRates;
}

export async function parseWorkbookFromUrl(url: string): Promise<ParsedWorkbook> {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  return parseWorkbookFromBuffer(buf);
}

export function parseWorkbookFromBuffer(buf: ArrayBuffer): ParsedWorkbook {
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const prices: PriceRecord[] = [];
  const users: AppUser[] = [];
  const contracts: Contract[] = [];
  let rates: ExchangeRates | undefined;

  const pricesSheet = wb.Sheets["prices"] || wb.Sheets[wb.SheetNames[0]];
  if (pricesSheet) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(pricesSheet, { defval: null });
    for (const r of rows) {
      const qTo = toNumber(r["Quantity To"]) ?? QTY_MAX;
      const cur = String(r["Currency"] ?? "USD").trim().toUpperCase() as Currency;
      prices.push({
        id: newId(),
        contractNumber: String(r["Contract Number"] ?? "").trim(),
        partNumber: String(r["Part Number"] ?? "").trim(),
        supplier: String(r["Supplier"] ?? "").trim(),
        dateFrom: toIsoDate(r["Date From"]),
        dateTo: toIsoDate(r["Date To"]),
        quantityFrom: toNumber(r["Quantity From"]) ?? 1,
        quantityTo: qTo,
        unitPrice: toNumber(r["Unit Price"]),
        lotPrice: toNumber(r["Lot Price"]),
        currency: CURRENCIES.includes(cur) ? cur : "USD",
      });
    }
  }

  const usersSheet = wb.Sheets["users"];
  if (usersSheet) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(usersSheet, { defval: null });
    for (const r of rows) {
      users.push({
        username: String(r["username"] ?? "").trim(),
        password: String(r["password"] ?? "").trim(),
        name: String(r["name"] ?? "").trim(),
        role: String(r["role"] ?? "user").trim(),
      });
    }
  }

  const contractsSheet = wb.Sheets["contracts"];
  if (contractsSheet) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(contractsSheet, { defval: null });
    for (const r of rows) {
      const cur = String(r["Currency"] ?? "USD").trim().toUpperCase() as Currency;
      contracts.push({
        id: newId(),
        contractNumber: String(r["Contract Number"] ?? "").trim(),
        description: String(r["Description"] ?? "").trim(),
        currency: CURRENCIES.includes(cur) ? cur : "USD",
        createdAt: new Date().toISOString(),
      });
    }
  }

  const ratesSheet = wb.Sheets["rates"];
  if (ratesSheet) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ratesSheet, { defval: null });
    const r: Record<Currency, number> = { USD: 1, EUR: 0, GBP: 0, BRL: 0 };
    let base: Currency = "USD";
    for (const row of rows) {
      const code = String(row["Currency"] ?? "").trim().toUpperCase() as Currency;
      const rate = toNumber(row["Rate"]) ?? 0;
      if (CURRENCIES.includes(code)) r[code] = rate;
      const isBase = String(row["Base"] ?? "").trim().toLowerCase();
      if (isBase === "yes" || isBase === "true" || isBase === "1") base = code;
    }
    rates = { base, rates: r, updatedAt: new Date().toISOString() };
  }

  return { prices, users, contracts, rates };
}

export function exportPricesToXlsx(
  prices: PriceRecord[],
  users: AppUser[],
  contracts: Contract[] = [],
  rates?: ExchangeRates,
  filename = "prices_export.xlsx",
) {
  const priceRows = prices.map((p) => ({
    "Contract Number": p.contractNumber,
    "Part Number": p.partNumber,
    "Supplier": p.supplier,
    "Date From": p.dateFrom,
    "Date To": p.dateTo,
    "Quantity From": p.quantityFrom,
    "Quantity To": p.quantityTo,
    "Unit Price": p.unitPrice,
    "Lot Price": p.lotPrice,
    "Currency": p.currency ?? "USD",
  }));
  const ws = XLSX.utils.json_to_sheet(priceRows, { header: PRICE_HEADERS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "prices");

  if (users.length) {
    const us = XLSX.utils.json_to_sheet(users);
    XLSX.utils.book_append_sheet(wb, us, "users");
  }

  if (contracts.length) {
    const cs = XLSX.utils.json_to_sheet(
      contracts.map((c) => ({
        "Contract Number": c.contractNumber,
        "Description": c.description,
        "Currency": c.currency,
      })),
    );
    XLSX.utils.book_append_sheet(wb, cs, "contracts");
  }

  if (rates) {
    const rs = XLSX.utils.json_to_sheet(
      (Object.keys(rates.rates) as Currency[]).map((c) => ({
        Currency: c,
        Rate: rates.rates[c],
        Base: c === rates.base ? "yes" : "",
      })),
    );
    XLSX.utils.book_append_sheet(wb, rs, "rates");
  }

  XLSX.writeFile(wb, filename);
}