import {
  AppUser,
  AuditLogEntry,
  Contract,
  ExchangeRates,
  PriceRecord,
  XrayReport,
} from "./types";

/**
 * Base URL for the on-premise REST API. Set `VITE_API_URL` at build time
 * (e.g. `VITE_API_URL=http://server.local:3001`) to enable API mode. When
 * unset or unreachable, the app falls back to its in-memory / .xlsx loader.
 */
export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "";
export const apiEnabled = () => !!API_URL;

let actor = "system";
export function setApiActor(username: string | null) {
  actor = username || "system";
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Actor": actor,
    ...((init.headers as Record<string, string>) || {}),
  };
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  health: () => request<{ status: string }>("/api/health"),

  // Prices
  listPrices: () => request<PriceRecord[]>("/api/prices"),
  createPrices: (rows: PriceRecord[], source: "manual" | "import" = "manual") =>
    request<PriceRecord[]>(`/api/prices?source=${source}`, {
      method: "POST",
      body: JSON.stringify(rows),
    }),
  updatePrice: (id: string, patch: Partial<PriceRecord>) =>
    request<PriceRecord>(`/api/prices/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  deletePrices: (ids: string[]) =>
    request<{ deleted: number }>("/api/prices", {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    }),
  revertPrice: (id: string) =>
    request<PriceRecord>(`/api/prices/${id}/revert`, { method: "POST" }),
  bulkUpdate: (body: {
    match: { contractNumber?: string; partNumber?: string; supplier?: string };
    patch: Partial<Pick<PriceRecord, "unitPrice" | "lotPrice" | "dateFrom" | "dateTo">>;
    summary: string;
  }) =>
    request<{ updated: number; ids: string[] }>("/api/prices/bulk-update", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // Contracts
  listContracts: () => request<Contract[]>("/api/contracts"),
  createContract: (c: Omit<Contract, "id" | "createdAt">) =>
    request<Contract>("/api/contracts", { method: "POST", body: JSON.stringify(c) }),
  updateContract: (id: string, patch: Partial<Contract>) =>
    request<Contract>(`/api/contracts/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  deleteContract: (id: string) =>
    request<{ ok: boolean }>(`/api/contracts/${id}`, { method: "DELETE" }),

  // Rates
  getRates: () => request<ExchangeRates>("/api/rates"),
  putRates: (r: ExchangeRates) =>
    request<{ ok: boolean }>("/api/rates", { method: "PUT", body: JSON.stringify(r) }),

  // Audit
  listAudit: (limit = 500) => request<AuditLogEntry[]>(`/api/audit?limit=${limit}`),

  // Auth
  login: (username: string, password: string) =>
    request<AppUser>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  // Users + per-user system grants
  listUsers: () => request<AppUser[]>("/api/users"),
  setUserSystems: (username: string, systems: string[]) =>
    request<{ ok: boolean }>(`/api/users/${encodeURIComponent(username)}/systems`, {
      method: "PUT",
      body: JSON.stringify({ systems }),
    }),
  createUser: (body: {
    username: string;
    password: string;
    name: string;
    email: string;
    role: string;
    systems?: string[];
  }) =>
    request<AppUser>("/api/users", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateUser: (
    username: string,
    patch: { name?: string; email?: string; role?: string },
  ) =>
    request<{ ok: boolean }>(`/api/users/${encodeURIComponent(username)}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  resetUserPassword: (username: string, password: string) =>
    request<{ ok: boolean }>(
      `/api/users/${encodeURIComponent(username)}/reset-password`,
      { method: "POST", body: JSON.stringify({ password }) },
    ),
  deleteUser: (username: string) =>
    request<{ ok: boolean }>(`/api/users/${encodeURIComponent(username)}`, {
      method: "DELETE",
    }),

  // X-ray Reports
  listXrayReports: () => request<XrayReport[]>("/api/xray-reports"),
  createXrayReports: (rows: Partial<XrayReport>[], source: "manual" | "import" = "manual") =>
    request<XrayReport[]>(`/api/xray-reports?source=${source}`, {
      method: "POST",
      body: JSON.stringify(rows),
    }),
  updateXrayReport: (id: string, patch: Partial<XrayReport>) =>
    request<XrayReport>(`/api/xray-reports/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  deleteXrayReports: (ids: string[]) =>
    request<{ deleted: number }>("/api/xray-reports", {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    }),
};