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
import { convertCurrency } from "@/lib/format";

interface DataContextValue {
  prices: PriceRecord[];
  users: AppUser[];
  contracts: Contract[];
  rates: ExchangeRates;
  auditLog: AuditLogEntry[];
  loading: boolean;

  setActor: (username: string | null) => void;

  setAll: (prices: PriceRecord[], users?: AppUser[]) => void;
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
  base: "USD",
  rates: { USD: 1, EUR: 0.92, GBP: 0.79, BRL: 5.1 },
  updatedAt: new Date().toISOString(),
};

export function DataProvider({ children }: { children: ReactNode }) {
  const [prices, setPrices] = useState<PriceRecord[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [rates, setRatesState] = useState<ExchangeRates>(defaultRates);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const actor = useRef<string>("system");

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
    try {
      const data = await parseWorkbookFromUrl("/templates/prices_template.xlsx");
      // backfill currency from contracts if available
      const contractCurrency = new Map<string, Currency>();
      data.contracts.forEach((c) => contractCurrency.set(c.contractNumber, c.currency));
      const enriched = data.prices.map((p) => ({
        ...p,
        currency: p.currency ?? contractCurrency.get(p.contractNumber) ?? "USD",
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
              currency: p.currency ?? "USD",
              createdAt: new Date().toISOString(),
            });
          }
        });
        contractsFinal = Array.from(seen.values());
      }
      setPrices(enriched);
      setUsers(data.users);
      setContracts(contractsFinal);
      if (data.rates) setRatesState(data.rates);
    } catch (e) {
      console.error("Failed to load template:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const value = useMemo<DataContextValue>(
    () => ({
      prices,
      users,
      contracts,
      rates,
      auditLog,
      loading,

      setActor: (username) => {
        actor.current = username ?? "anonymous";
      },

      setAll: (p, u) => {
        setPrices(p);
        if (u) setUsers(u);
      },

      addPrices: (rows, source = "manual") => {
        setPrices((cur) => [...cur, ...rows]);
        log(
          source === "import" ? "price.import" : "price.create",
          source === "import"
            ? `Imported ${rows.length} record(s) from spreadsheet`
            : `Created ${rows.length} record(s)`,
          rows.map((r) => r.id),
        );
      },

      updatePrice: (id, patch) => {
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
        const set = new Set(ids);
        setPrices((cur) => cur.filter((r) => !set.has(r.id)));
        log("price.delete", `Deleted ${ids.length} record(s)`, ids);
      },

      bulkUpdatePrices: (matcher, transform, summary) => {
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
        const next: Contract = { ...c, id: newId(), createdAt: new Date().toISOString() };
        setContracts((cur) => [...cur, next]);
        log("contract.create", `Created contract ${c.contractNumber} (${c.currency})`);
      },

      updateContract: (id, patch) => {
        const before = contracts.find((x) => x.id === id);
        setContracts((cur) => cur.map((c) => (c.id === id ? { ...c, ...patch } : c)));

        if (!before) {
          log("contract.update", `Updated contract ${id}`, undefined, { patch });
          return;
        }

        const numberChanged = patch.contractNumber && patch.contractNumber !== before.contractNumber;
        const currencyChanged = patch.currency && patch.currency !== before.currency;

        if (numberChanged || currencyChanged) {
          let convertedCount = 0;
          const affected: string[] = [];
          setPrices((cur) =>
            cur.map((p) => {
              if (p.contractNumber !== before.contractNumber) return p;
              const newContractNumber = patch.contractNumber ?? p.contractNumber;
              if (!currencyChanged) {
                return { ...p, contractNumber: newContractNumber };
              }
              const fromCur: Currency = p.currency ?? before.currency;
              const toCur: Currency = patch.currency!;
              const newUnit =
                p.unitPrice !== null ? convertCurrency(p.unitPrice, fromCur, toCur, rates) : null;
              const newLot =
                p.lotPrice !== null ? convertCurrency(p.lotPrice, fromCur, toCur, rates) : null;
              convertedCount++;
              affected.push(p.id);
              return {
                ...p,
                contractNumber: newContractNumber,
                currency: toCur,
                unitPrice: newUnit,
                lotPrice: newLot,
                previousUnitPrice: p.unitPrice,
                previousLotPrice: p.lotPrice,
                previousDateFrom: p.dateFrom,
                previousDateTo: p.dateTo,
                lastChangedAt: new Date().toISOString(),
                lastChangedBy: actor.current,
              };
            }),
          );

          if (currencyChanged && convertedCount > 0) {
            log(
              "price.bulk_update",
              `Currency change ${before.currency} → ${patch.currency} on contract ${before.contractNumber} · converted ${convertedCount} record(s)`,
              affected,
            );
          }
        }

        log("contract.update", `Updated contract ${before.contractNumber}`, undefined, { patch });
      },

      deleteContract: (id) => {
        const c = contracts.find((x) => x.id === id);
        setContracts((cur) => cur.filter((x) => x.id !== id));
        log("contract.delete", `Deleted contract ${c?.contractNumber ?? id}`);
      },

      setRates: (r) => {
        setRatesState({ ...r, updatedAt: new Date().toISOString() });
        log("rates.update", `Updated exchange rates (base ${r.base})`, undefined, { rates: r.rates });
      },

      reload: load,
    }),
    [prices, users, contracts, rates, auditLog, loading, load, log],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
