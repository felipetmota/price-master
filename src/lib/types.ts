export const QTY_MAX = 9999999;

export type Currency = "USD" | "EUR" | "GBP" | "BRL";
export const CURRENCIES: Currency[] = ["USD", "EUR", "GBP", "BRL"];

export interface PriceRecord {
  id: string;
  contractNumber: string;
  partNumber: string;
  supplier: string;
  dateFrom: string; // ISO yyyy-mm-dd
  dateTo: string;
  quantityFrom: number;
  quantityTo: number; // QTY_MAX = infinito
  unitPrice: number | null;
  lotPrice: number | null;
  currency?: Currency; // derived from contract; persisted on the record for export
  previousUnitPrice?: number | null;
  previousLotPrice?: number | null;
  previousDateFrom?: string;
  previousDateTo?: string;
  lastChangedAt?: string; // ISO timestamp
  lastChangedBy?: string;
}

export interface Contract {
  id: string;
  contractNumber: string;
  description: string;
  currency: Currency;
  createdAt: string;
}

/**
 * Exchange rates relative to a base currency.
 * Example: base = "USD", rates = { USD: 1, EUR: 0.92, GBP: 0.79, BRL: 5.10 }
 * Conversion: amount_in_target = amount_in_source * (rates[target] / rates[source])
 */
export interface ExchangeRates {
  base: Currency;
  rates: Record<Currency, number>;
  updatedAt: string;
}

export type AuditAction =
  | "price.create"
  | "price.update"
  | "price.delete"
  | "price.bulk_update"
  | "price.import"
  | "price.revert"
  | "contract.create"
  | "contract.update"
  | "contract.delete"
  | "rates.update";

export interface AuditLogEntry {
  id: string;
  at: string;
  user: string;
  action: AuditAction;
  summary: string;
  affectedIds?: string[];
  details?: Record<string, unknown>;
}

export interface AppUser {
  username: string;
  password: string;
  name: string;
  role: string;
  /** Optional contact email. Persisted server-side; never returned in login response. */
  email?: string;
  /**
   * Keys of systems (from src/lib/systems.ts) the user is allowed to open.
   * Admins implicitly have access to all systems regardless of this list.
   */
  systems?: string[];
}

export interface PriceFilters {
  contractNumber: string;
  partNumber: string;
  supplier: string;
  dateFrom: string;
  dateTo: string;
  qtyFrom: string;
  qtyTo: string;
  unitPriceMin: string;
  unitPriceMax: string;
  lotPriceMin: string;
  lotPriceMax: string;
}

export const emptyFilters: PriceFilters = {
  contractNumber: "",
  partNumber: "",
  supplier: "",
  dateFrom: "",
  dateTo: "",
  qtyFrom: "",
  qtyTo: "",
  unitPriceMin: "",
  unitPriceMax: "",
  lotPriceMin: "",
  lotPriceMax: "",
};

/**
 * Radiographic Examination Report (X-ray Records) — single record.
 * All free-text fields are kept as strings (the source spreadsheet mixes
 * numbers and text in the same cells, e.g. "10 x 9x12").
 */
export interface XrayReport {
  id: string;
  reportNumber: string;
  partNo: string;
  description: string;
  quantity: string;
  date: string; // ISO yyyy-mm-dd
  operationNo: string;
  planningCardNo: string;
  customer: string;
  xrayTechniqueNo: string;
  issue: string;
  kv: string;
  ma: string;
  timeSeconds: string;
  sfdMm: string;
  filmTypeQty: string;
  xraySerialNo: string;
  acceptedQty: number | null;
  reworkQty: number | null;
  rejectQty: number | null;
  interpreter: string;
  radiographer: string;
  secondScrutineer: string;
  radiographicProcedure: string;
  acceptanceCriteria: string;
  createdAt?: string;
  lastChangedAt?: string;
  lastChangedBy?: string;
}

export interface XrayFilters {
  q: string; // free-text on report number / part / description / customer
  customer: string;
  dateFrom: string;
  dateTo: string;
}

export const emptyXrayFilters: XrayFilters = {
  q: "",
  customer: "",
  dateFrom: "",
  dateTo: "",
};