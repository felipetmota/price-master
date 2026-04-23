import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PriceFilters, emptyFilters } from "@/lib/types";
import { Search, X } from "lucide-react";

interface Props {
  value: PriceFilters;
  onChange: (f: PriceFilters) => void;
  resultCount: number;
  totalCount: number;
}

export default function FiltersBar({ value, onChange, resultCount, totalCount }: Props) {
  const set = <K extends keyof PriceFilters>(k: K, v: PriceFilters[K]) =>
    onChange({ ...value, [k]: v });

  const hasActive = JSON.stringify(value) !== JSON.stringify(emptyFilters);

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
          <Button variant="ghost" size="sm" onClick={() => onChange(emptyFilters)}>
            <X className="size-4" /> Clear
          </Button>
        )}
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Field label="Contract Number">
          <Input value={value.contractNumber} onChange={(e) => set("contractNumber", e.target.value)} placeholder="CT-..." />
        </Field>
        <Field label="Part Number">
          <Input value={value.partNumber} onChange={(e) => set("partNumber", e.target.value)} placeholder="AB123" />
        </Field>
        <Field label="Supplier">
          <Input value={value.supplier} onChange={(e) => set("supplier", e.target.value)} placeholder="Acme..." />
        </Field>
        <Field label="Date From">
          <Input type="date" value={value.dateFrom} onChange={(e) => set("dateFrom", e.target.value)} />
        </Field>
        <Field label="Date To">
          <Input type="date" value={value.dateTo} onChange={(e) => set("dateTo", e.target.value)} />
        </Field>
        <Field label="Quantity range">
          <div className="flex gap-1">
            <Input value={value.qtyFrom} onChange={(e) => set("qtyFrom", e.target.value)} placeholder="min" inputMode="numeric" />
            <Input value={value.qtyTo} onChange={(e) => set("qtyTo", e.target.value)} placeholder="max" inputMode="numeric" />
          </div>
        </Field>
        <Field label="Unit Price range">
          <div className="flex gap-1">
            <Input value={value.unitPriceMin} onChange={(e) => set("unitPriceMin", e.target.value)} placeholder="min" inputMode="decimal" />
            <Input value={value.unitPriceMax} onChange={(e) => set("unitPriceMax", e.target.value)} placeholder="max" inputMode="decimal" />
          </div>
        </Field>
        <Field label="Lot Price range">
          <div className="flex gap-1">
            <Input value={value.lotPriceMin} onChange={(e) => set("lotPriceMin", e.target.value)} placeholder="min" inputMode="decimal" />
            <Input value={value.lotPriceMax} onChange={(e) => set("lotPriceMax", e.target.value)} placeholder="max" inputMode="decimal" />
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