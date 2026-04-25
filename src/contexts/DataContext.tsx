import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";
import {
  AppUser,
  AuditAction,
  AuditLogEntry,
  Contract,
  Currency,
  ExchangeRates,
  PriceRecord,
} from "@/lib/types";
import { parseWorkbookFromUrl } from "@/lib/xlsx-io";
import { api, apiEnabled, setApiActor } from "@/lib/api";
import { toast } from "sonner";

interface DataContextValue {
  prices: PriceRecord[];
  users: AppUser[];
  contracts: Contract[];
  rates: ExchangeRates;
  auditLog: AuditLogEntry[];
  loading: boolean;

  /** Distinct, sorted lookup lists derived from current data. */
  partNumbers: string[];
  suppliers: string[];
  contractNumbers: string[];

  setActor: (username: string | null) => void;

  setAll: (prices: PriceRecord[], users?: AppUser[]) => void;
  setUsers: (users: AppUser[]) => void;
  reloadUsers: () => Promise<void>;
  addPrices: (rows: PriceRecord[], source?: "manual" | "import") => void;
  updatePrice: (id: string, patch: Partial<PriceRecord>) => void;
  deletePrices: (ids: string[]) => void;
  bulkUpdatePrices: (
    matcher: (r: PriceRecord) => boolean,
    transform: (r: PriceRecord) => PriceRecord,
    summary: string,
  ) => number;
  revertPrice: (id: string) => boolean;

  addContract: (c: Omit<Contract, "id" | "createdAt">) => void;
  updateContract: (id: string, patch: Partial<Contract>) => void;
  deleteContract: (id: string) => void;

  setRates: (rates: ExchangeRates) => void;

  reload: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

let nid = 0;
export const newId = () => `r_${Date.now().toString(36)}_${(nid++).toString(36)}`;

const defaultRates: ExchangeRates = {
  base: "GBP",
  rates: { USD: 1.27, EUR: 1.17, GBP: 1, BRL: 6.45 },
  updatedAt: new Date().toISOString(),
};

/**
 * Built-in demo users used only in browser-only fallback mode (no API).
 * In production the API + SQLite owns authentication; these are never used.
 */
const fallbackUsers: AppUser[] = [
  { username: "admin", password: "admin123", name: "Administrator", role: "admin", systems: ["price-management", "xray-reports"] },
  { username: "user",  password: "user123",  name: "Standard User", role: "user",  systems: ["price-management", "xray-reports"] },
];

export function DataProvider({ children }: { children: ReactNode }) {
  const [prices, setPrices] = useState<PriceRecord[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [rates, setRatesState] = useState<ExchangeRates>(defaultRates);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const actor = useRef<string>("system");
  // Whether we successfully reached the on-premise API on this session.
  // When false we run in fully local mode (xlsx fallback) — keeps Lovable
  // preview working without any backend.
  const useApi = useRef<boolean>(false);

  const log = useCallback(
    (action: AuditAction, summary: string, affectedIds?: string[], details?: Record<string, unknown>) => {
      setAuditLog((cur) => [
        {
          id: newId(),
          at: new Date().toISOString(),
          user: actor.current,
          action,
          summary,
          affectedIds,
          details,
        },
        ...cur,
      ]);
    },
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    // 1. Try the on-premise API first if VITE_API_URL is configured.
    if (apiEnabled()) {
      try {
        await api.health();
        const [pxs, ctrs, rts, aud, usrs] = await Promise.all([
          api.listPrices(),
          api.listContracts(),
          api.getRates().catch(() => defaultRates),
          api.listAudit().catch(() => [] as AuditLogEntry[]),
          api.listUsers().catch(() => [] as AppUser[]),
        ]);
        setPrices(pxs);
        setContracts(ctrs);
        setRatesState(rts);
        setAuditLog(aud);
        // The API never returns password hashes, so AppUser.password is "".
        // Authentication itself goes through api.login() in AuthContext.
        setUsers(usrs);
        useApi.current = true;
        setLoading(false);
        return;
      } catch (e) {
        console.warn(
          "[DataContext] API at VITE_API_URL is unreachable, falling back to local xlsx loader.",
          e,
        );
      }
    }
    // 2. Fallback: the original in-memory / xlsx loader.
    try {
      const data = await parseWorkbookFromUrl("/templates/prices_template.xlsx");
      // backfill currency from contracts if available
      const contractCurrency = new Map<string, Currency>();
      data.contracts.forEach((c) => contractCurrency.set(c.contractNumber, c.currency));
      const enriched = data.prices.map((p) => ({
        ...p,
        currency: p.currency ?? contractCurrency.get(p.contractNumber) ?? "GBP",
      }));
      // derive contracts from prices if sheet is empty
      let contractsFinal = data.contracts;
      if (contractsFinal.length === 0) {
        const seen = new Map<string, Contract>();
        enriched.forEach((p) => {
          if (p.contractNumber && !seen.has(p.contractNumber)) {
            seen.set(p.contractNumber, {
              id: newId(),
              contractNumber: p.contractNumber,
              description: "",
              currency: p.currency ?? "GBP",
              createdAt: new Date().toISOString(),
            });
          }
        });
        contractsFinal = Array.from(seen.values());
      }
      setPrices(enriched);
      setUsers(data.users.length ? data.users : fallbackUsers);
      setContracts(contractsFinal);
      if (data.rates) setRatesState(data.rates);
      useApi.current = false;
    } catch (e) {
      console.error("Failed to load template:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const value = useMemo<Omit<DataContextValue, "partNumbers" | "suppliers" | "contractNumbers">>(
    () => ({
      prices,
      users,
      contracts,
      rates,
      auditLog,
      loading,

      setActor: (username) => {
        actor.current = username ?? "anonymous";
        setApiActor(username);
      },

      setAll: (p, u) => {
        setPrices(p);
        if (u) setUsers(u);
      },

      setUsers: (u) => setUsers(u),

      reloadUsers: async () => {
        if (!apiEnabled()) return;
        try {
          const usrs = await api.listUsers();
          setUsers(usrs);
        } catch (e) {
          console.warn("[DataContext] reloadUsers failed", e);
        }
      },

      addPrices: (rows, source = "manual") => {
        const BATCH = 500;
        const persist = useApi.current;
        const reloadAfter = async () => {
          try {
            const [pxs, ctrs] = await Promise.all([
              api.listPrices(),
              api.listContracts().catch(() => contracts),
            ]);
            setPrices(pxs);
            setContracts(ctrs);
          } catch (e) {
            console.warn("[DataContext] reload after addPrices failed", e);
          }
        };
        // Small payloads: keep the original synchronous behavior.
        if (rows.length <= BATCH) {
          if (persist) {
            api
              .createPrices(rows, source)
              .then(reloadAfter)
              .catch((e) => {
                console.error("[DataContext] createPrices failed", e);
                toast.error("Failed to save records to the server.");
              });
          } else {
            setPrices((cur) => [...cur, ...rows]);
            log(
              source === "import" ? "price.import" : "price.create",
              source === "import"
                ? `Imported ${rows.length} record(s) from spreadsheet`
                : `Created ${rows.length} record(s)`,
              rows.map((r) => r.id),
            );
          }
          return;
        }
        // Large imports: chunk to keep the UI responsive and show progress.
        const total = rows.length;
        const toastId = toast.loading(`Importing 0 / ${total}…`);
        let i = 0;
        const pump = async () => {
          const slice = rows.slice(i, i + BATCH);
          if (persist) {
            try {
              await api.createPrices(slice, source);
            } catch (e) {
              console.error("[DataContext] createPrices batch failed", e);
              toast.error("Failed to save batch to the server.", { id: toastId });
              return;
            }
          } else {
            setPrices((cur) => [...cur, ...slice]);
          }
          i += slice.length;
          if (i < total) {
            toast.loading(`Importing ${i} / ${total}…`, { id: toastId });
            // Yield to the browser so it can paint and stay responsive.
            setTimeout(pump, 0);
          } else {
            toast.success(`Imported ${total} record(s).`, { id: toastId });
            if (persist) {
              await reloadAfter();
            } else {
              log(
                source === "import" ? "price.import" : "price.create",
                source === "import"
                  ? `Imported ${total} record(s) from spreadsheet`
                  : `Created ${total} record(s)`,
                rows.map((r) => r.id),
              );
            }
          }
        };
        pump();
      },

      updatePrice: (id, patch) => {
        if (useApi.current) {
          api
            .updatePrice(id, patch)
            .then((updated) =>
              setPrices((cur) => cur.map((r) => (r.id === id ? updated : r))),
            )
            .catch((e) => {
              console.error("[DataContext] updatePrice failed", e);
              toast.error("Failed to save changes to the server.");
            });
          return;
        }
        setPrices((cur) =>
          cur.map((r) => {
            if (r.id !== id) return r;
            const next: PriceRecord = {
              ...r,
              ...patch,
              previousUnitPrice: r.unitPrice,
              previousLotPrice: r.lotPrice,
              previousDateFrom: r.dateFrom,
              previousDateTo: r.dateTo,
              lastChangedAt: new Date().toISOString(),
              lastChangedBy: actor.current,
            };
            return next;
          }),
        );
        log("price.update", `Updated record ${id}`, [id], { patch });
      },

      deletePrices: (ids) => {
        if (useApi.current) {
          api
            .deletePrices(ids)
            .then(() => {
              const set = new Set(ids);
              setPrices((cur) => cur.filter((r) => !set.has(r.id)));
            })
            .catch((e) => {
              console.error("[DataContext] deletePrices failed", e);
              toast.error("Failed to delete records on the server.");
            });
          return;
        }
        const set = new Set(ids);
        setPrices((cur) => cur.filter((r) => !set.has(r.id)));
        log("price.delete", `Deleted ${ids.length} record(s)`, ids);
      },

      bulkUpdatePrices: (matcher, transform, summary) => {
        // API mode handles bulk update through its own endpoint in the dialog.
        // This local path remains for fallback (no API) usage.
        let n = 0;
        const affected: string[] = [];
        setPrices((cur) =>
          cur.map((r) => {
            if (!matcher(r)) return r;
            n++;
            affected.push(r.id);
            const transformed = transform(r);
            return {
              ...transformed,
              previousUnitPrice: r.unitPrice,
              previousLotPrice: r.lotPrice,
              previousDateFrom: r.dateFrom,
              previousDateTo: r.dateTo,
              lastChangedAt: new Date().toISOString(),
              lastChangedBy: actor.current,
            };
          }),
        );
        if (n > 0) log("price.bulk_update", `${summary} · ${n} record(s)`, affected);
        return n;
      },

      revertPrice: (id) => {
        if (useApi.current) {
          api
            .revertPrice(id)
            .then((updated) =>
              setPrices((cur) => cur.map((r) => (r.id === id ? updated : r))),
            )
            .catch((e) => {
              console.error("[DataContext] revertPrice failed", e);
              toast.error("Failed to revert record on the server.");
            });
          return true;
        }
        let ok = false;
        setPrices((cur) =>
          cur.map((r) => {
            if (r.id !== id) return r;
            if (
              r.previousUnitPrice === undefined &&
              r.previousLotPrice === undefined &&
              r.previousDateFrom === undefined &&
              r.previousDateTo === undefined
            ) {
              return r;
            }
            ok = true;
            return {
              ...r,
              unitPrice: r.previousUnitPrice ?? r.unitPrice,
              lotPrice: r.previousLotPrice ?? r.lotPrice,
              dateFrom: r.previousDateFrom ?? r.dateFrom,
              dateTo: r.previousDateTo ?? r.dateTo,
              previousUnitPrice: undefined,
              previousLotPrice: undefined,
              previousDateFrom: undefined,
              previousDateTo: undefined,
              lastChangedAt: new Date().toISOString(),
              lastChangedBy: actor.current,
            };
          }),
        );
        if (ok) log("price.revert", `Reverted record ${id} to previous values`, [id]);
        return ok;
      },

      addContract: (c) => {
        if (useApi.current) {
          api
            .createContract(c)
            .then((created) => setContracts((cur) => [...cur, created]))
            .catch((e) => {
              console.error("[DataContext] createContract failed", e);
              toast.error("Failed to save contract to the server.");
            });
          return;
        }
        const next: Contract = { ...c, id: newId(), createdAt: new Date().toISOString() };
        setContracts((cur) => [...cur, next]);
        log("contract.create", `Created contract ${c.contractNumber} (${c.currency})`);
      },

      updateContract: (id, patch) => {
        const before = contracts.find((x) => x.id === id);
        if (useApi.current) {
          api
            .updateContract(id, patch)
            .then((updated) => {
              setContracts((cur) => cur.map((c) => (c.id === id ? updated : c)));
              if (before && patch.contractNumber && patch.contractNumber !== before.contractNumber) {
                // Refresh prices since contract numbers may have propagated server-side.
                api.listPrices().then(setPrices).catch(() => {});
              }
            })
            .catch((e) => {
              console.error("[DataContext] updateContract failed", e);
              toast.error("Failed to update contract on the server.");
            });
          return;
        }
        setContracts((cur) => cur.map((c) => (c.id === id ? { ...c, ...patch } : c)));
        // If contract number changed, just propagate the new number to existing
        // price records that reference this contract. Currency on existing
        // records is intentionally NOT changed: it represents the original
        // storage currency. Display conversion is handled by the base currency
        // of the Exchange Rates.
        if (before && patch.contractNumber && patch.contractNumber !== before.contractNumber) {
          setPrices((cur) =>
            cur.map((p) =>
              p.contractNumber === before.contractNumber
                ? { ...p, contractNumber: patch.contractNumber! }
                : p,
            ),
          );
        }
        log(
          "contract.update",
          `Updated contract ${before?.contractNumber ?? id}`,
          undefined,
          { patch },
        );
      },

      deleteContract: (id) => {
        const c = contracts.find((x) => x.id === id);
        if (useApi.current) {
          api
            .deleteContract(id)
            .then(() => setContracts((cur) => cur.filter((x) => x.id !== id)))
            .catch((e) => {
              console.error("[DataContext] deleteContract failed", e);
              toast.error("Failed to delete contract on the server.");
            });
          return;
        }
        setContracts((cur) => cur.filter((x) => x.id !== id));
        log("contract.delete", `Deleted contract ${c?.contractNumber ?? id}`);
      },

      setRates: (r) => {
        if (useApi.current) {
          api
            .putRates(r)
            .then(() => setRatesState({ ...r, updatedAt: new Date().toISOString() }))
            .catch((e) => {
              console.error("[DataContext] putRates failed", e);
              toast.error("Failed to save exchange rates to the server.");
            });
          return;
        }
        setRatesState({ ...r, updatedAt: new Date().toISOString() });
        log("rates.update", `Updated exchange rates (base ${r.base})`, undefined, { rates: r.rates });
      },

      reload: load,
    }),
    [prices, users, contracts, rates, auditLog, loading, load, log],
  );

  const partNumbers = useMemo(() => {
    const s = new Set<string>();
    for (const p of prices) if (p.partNumber) s.add(p.partNumber);
    return Array.from(s).sort();
  }, [prices]);

  const suppliers = useMemo(() => {
    const s = new Set<string>();
    for (const p of prices) if (p.supplier) s.add(p.supplier);
    return Array.from(s).sort();
  }, [prices]);

  const contractNumbers = useMemo(() => {
    const s = new Set<string>();
    for (const c of contracts) if (c.contractNumber) s.add(c.contractNumber);
    for (const p of prices) if (p.contractNumber) s.add(p.contractNumber);
    return Array.from(s).sort();
  }, [contracts, prices]);

  const fullValue = useMemo<DataContextValue>(
    () => ({ ...value, partNumbers, suppliers, contractNumbers }),
    [value, partNumbers, suppliers, contractNumbers],
  );

  return <DataContext.Provider value={fullValue}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
