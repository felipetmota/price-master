import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { AppUser, PriceRecord } from "@/lib/types";
import { parseWorkbookFromUrl } from "@/lib/xlsx-io";

interface DataContextValue {
  prices: PriceRecord[];
  users: AppUser[];
  loading: boolean;
  setAll: (prices: PriceRecord[], users?: AppUser[]) => void;
  addPrices: (rows: PriceRecord[]) => void;
  updatePrice: (id: string, patch: Partial<PriceRecord>) => void;
  deletePrices: (ids: string[]) => void;
  bulkUpdatePrices: (matcher: (r: PriceRecord) => boolean, transform: (r: PriceRecord) => PriceRecord) => number;
  reload: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

let nid = 0;
export const newId = () => `r_${Date.now().toString(36)}_${(nid++).toString(36)}`;

export function DataProvider({ children }: { children: ReactNode }) {
  const [prices, setPrices] = useState<PriceRecord[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await parseWorkbookFromUrl("/templates/prices_template.xlsx");
      setPrices(data.prices);
      setUsers(data.users);
    } catch (e) {
      console.error("Falha ao carregar template:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const value = useMemo<DataContextValue>(() => ({
    prices,
    users,
    loading,
    setAll: (p, u) => {
      setPrices(p);
      if (u) setUsers(u);
    },
    addPrices: (rows) => setPrices((cur) => [...cur, ...rows]),
    updatePrice: (id, patch) =>
      setPrices((cur) => cur.map((r) => (r.id === id ? { ...r, ...patch } : r))),
    deletePrices: (ids) => {
      const set = new Set(ids);
      setPrices((cur) => cur.filter((r) => !set.has(r.id)));
    },
    bulkUpdatePrices: (matcher, transform) => {
      let n = 0;
      setPrices((cur) =>
        cur.map((r) => {
          if (!matcher(r)) return r;
          n++;
          return transform(r);
        }),
      );
      return n;
    },
    reload: load,
  }), [prices, users, loading, load]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}