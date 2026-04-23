export const QTY_MAX = 9999999;

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
}

export interface AppUser {
  username: string;
  password: string;
  name: string;
  role: string;
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