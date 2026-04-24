import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PriceFilters, emptyFilters } from "@/lib/types";
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ComboInput from "@/components/app/ComboInput";
import { useData } from "@/contexts/DataContext";

interface Props {
  value: PriceFilters;
  onChange: (f: PriceFilters) => void;
  resultCount: number;
  totalCount: number;
}

export default function FiltersBar({ value, onChange, resultCount, totalCount }: Props) {
  const { partNumbers, suppliers, contractNumbers } = useData();
  // Local mirror so typing stays instant; debounce text/numeric fields
  // before propagating to the parent (which re-filters thousands of rows).
  const [local, setLocal] = useState<PriceFilters>(value);
  const timer = useRef<number | null>(null);

  // Sync when the parent resets/clears filters externally.
  useEffect(() => {
    setLocal(value);
  }, [value]);

  const set = <K extends keyof PriceFilters>(k: K, v: PriceFilters[K]) => {
    const next = { ...local, [k]: v };
    setLocal(next);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => onChange(next), 250);
  };

  // Combobox commits filter values immediately (no debounce) — selection
  // events are user-driven and infrequent.
  const setNow = <K extends keyof PriceFilters>(k: K, v: PriceFilters[K]) => {
    const next = { ...local, [k]: v };
    setLocal(next);
    if (timer.current) window.clearTimeout(timer.current);
    onChange(next);
  };

  const hasActive = JSON.stringify(local) !== JSON.stringify(emptyFilters);

  const clearAll = () => {
    if (timer.current) window.clearTimeout(timer.current);
    setLocal(emptyFilters);
    onChange(emptyFilters);
  };

  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Search className="size-4 text-muted-foreground" />
          Filters
          <span className="text-muted-foreground font-normal num">
            · {resultCount} of {totalCount}
          </span>
        </div>
        {hasActive && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            <X className="size-4" /> Clear
          </Button>
        )}
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Field label="Contract Number">
          <ComboInput
            value={local.contractNumber}
            onChange={(v) => setNow("contractNumber", v)}
            options={contractNumbers}
            placeholder="CT-..."
          />
        </Field>
        <Field label="Part Number">
          <ComboInput
            value={local.partNumber}
            onChange={(v) => setNow("partNumber", v)}
            options={partNumbers}
            placeholder="AB123"
          />
        </Field>
        <Field label="Supplier">
          <ComboInput
            value={local.supplier}
            onChange={(v) => setNow("supplier", v)}
            options={suppliers}
            placeholder="Acme..."
          />
        </Field>
        <Field label="Date From">
          <Input type="date" value={local.dateFrom} onChange={(e) => set("dateFrom", e.target.value)} />
        </Field>
        <Field label="Date To">
          <Input type="date" value={local.dateTo} onChange={(e) => set("dateTo", e.target.value)} />
        </Field>
        <Field label="Quantity range">
          <div className="flex gap-1">
            <Input value={local.qtyFrom} onChange={(e) => set("qtyFrom", e.target.value)} placeholder="min" inputMode="numeric" />
            <Input value={local.qtyTo} onChange={(e) => set("qtyTo", e.target.value)} placeholder="max" inputMode="numeric" />
          </div>
        </Field>
        <Field label="Unit Price range">
          <div className="flex gap-1">
            <Input value={local.unitPriceMin} onChange={(e) => set("unitPriceMin", e.target.value)} placeholder="min" inputMode="decimal" />
            <Input value={local.unitPriceMax} onChange={(e) => set("unitPriceMax", e.target.value)} placeholder="max" inputMode="decimal" />
          </div>
        </Field>
        <Field label="Lot Price range">
          <div className="flex gap-1">
            <Input value={local.lotPriceMin} onChange={(e) => set("lotPriceMin", e.target.value)} placeholder="min" inputMode="decimal" />
            <Input value={local.lotPriceMax} onChange={(e) => set("lotPriceMax", e.target.value)} placeholder="max" inputMode="decimal" />
          </div>
        </Field>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground font-normal">{label}</Label>
      {children}
    </div>
  );
}