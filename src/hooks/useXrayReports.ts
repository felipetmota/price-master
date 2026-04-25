import { useCallback, useEffect, useState } from "react";
import { XrayReport } from "@/lib/types";
import { api, apiEnabled } from "@/lib/api";

const STORAGE_KEY = "xray_reports_local_v1";

function loadLocal(): XrayReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as XrayReport[]) : [];
  } catch {
    return [];
  }
}
function saveLocal(rows: XrayReport[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  } catch {
    /* ignore quota */
  }
}

let counter = 0;
const newId = () => `xr_${Date.now().toString(36)}_${(counter++).toString(36)}`;

/** Compute next sequential report number from a list of existing reports. */
function computeNextNumber(rows: XrayReport[]): string {
  let max = 0;
  for (const r of rows) {
    const n = parseInt(String(r.reportNumber).trim(), 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return String(max + 1);
}

/**
 * Single-source-of-truth hook for X-ray reports.
 * - When the on-premise API is configured, it owns the data.
 * - Otherwise we persist to localStorage so the preview is usable.
 */
export function useXrayReports() {
  const [reports, setReports] = useState<XrayReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingApi, setUsingApi] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    if (apiEnabled()) {
      try {
        const data = await api.listXrayReports();
        setReports(data);
        setUsingApi(true);
        setLoading(false);
        return;
      } catch (e) {
        console.warn("[xray] API unreachable, falling back to local storage.", e);
      }
    }
    setReports(loadLocal());
    setUsingApi(false);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const create = useCallback(
    async (rows: Partial<XrayReport>[], source: "manual" | "import" = "manual") => {
      if (usingApi) {
        const created = await api.createXrayReports(rows, source);
        setReports((cur) => [...created, ...cur]);
        return created;
      }
      // Local mode: auto-assign blank report numbers based on current local max.
      let nextNum = parseInt(computeNextNumber(reports), 10);
      const created: XrayReport[] = rows.map((r) => ({
        id: newId(),
        reportNumber: "",
        partNo: "",
        description: "",
        quantity: "",
        date: "",
        operationNo: "",
        planningCardNo: "",
        customer: "",
        xrayTechniqueNo: "",
        issue: "",
        kv: "",
        ma: "",
        timeSeconds: "",
        sfdMm: "",
        filmTypeQty: "",
        xraySerialNo: "",
        acceptedQty: null,
        reworkQty: null,
        rejectQty: null,
        interpreter: "",
        radiographer: "",
        secondScrutineer: "",
        radiographicProcedure: "",
        acceptanceCriteria: "",
        createdAt: new Date().toISOString(),
        ...r,
      } as XrayReport)).map((r) => {
        if (!r.reportNumber || !String(r.reportNumber).trim()) {
          r.reportNumber = String(nextNum++);
        }
        return r;
      });
      const next = [...created, ...reports];
      setReports(next);
      saveLocal(next);
      return created;
    },
    [reports, usingApi],
  );

  const update = useCallback(
    async (id: string, patch: Partial<XrayReport>) => {
      if (usingApi) {
        const updated = await api.updateXrayReport(id, patch);
        setReports((cur) => cur.map((r) => (r.id === id ? updated : r)));
        return updated;
      }
      const next = reports.map((r) =>
        r.id === id
          ? { ...r, ...patch, lastChangedAt: new Date().toISOString() }
          : r,
      );
      setReports(next);
      saveLocal(next);
      return next.find((r) => r.id === id)!;
    },
    [reports, usingApi],
  );

  const remove = useCallback(
    async (ids: string[]) => {
      if (usingApi) {
        await api.deleteXrayReports(ids);
      }
      const set = new Set(ids);
      const next = reports.filter((r) => !set.has(r.id));
      setReports(next);
      if (!usingApi) saveLocal(next);
    },
    [reports, usingApi],
  );

  /** Get the next report number (server-authoritative when API is enabled). */
  const getNextReportNumber = useCallback(async (): Promise<string> => {
    if (usingApi) {
      try {
        const { next } = await api.nextXrayReportNumber();
        return next;
      } catch {
        /* fall through to local computation */
      }
    }
    return computeNextNumber(reports);
  }, [reports, usingApi]);

  return { reports, loading, usingApi, reload, create, update, remove, getNextReportNumber };
}