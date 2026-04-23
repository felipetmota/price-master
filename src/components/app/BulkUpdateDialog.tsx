import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useData } from "@/contexts/DataContext";
import { toast } from "sonner";

interface Props { open: boolean; onOpenChange: (v: boolean) => void; }

type Selector = "part" | "supplier";
type Mode = "fixed" | "percent";

export default function BulkUpdateDialog({ open, onOpenChange }: Props) {
  const { prices, bulkUpdatePrices } = useData();
  const [selector, setSelector] = useState<Selector>("part");
  const [target, setTarget] = useState<string>("");
  // Price update
  const [updatePrices, setUpdatePrices] = useState(true);
  const [updateUnit, setUpdateUnit] = useState(true);
  const [updateLot, setUpdateLot] = useState(true);
  const [mode, setMode] = useState<Mode>("percent");
  const [value, setValue] = useState<string>("");
  // Validity update
  const [updateDates, setUpdateDates] = useState(false);
  const [newDateFrom, setNewDateFrom] = useState<string>("");
  const [newDateTo, setNewDateTo] = useState<string>("");

  const options = useMemo(() => {
    const set = new Set<string>();
    prices.forEach((p) => set.add(selector === "part" ? p.partNumber : p.supplier));
    return Array.from(set).filter(Boolean).sort();
  }, [prices, selector]);

  const apply = () => {
    if (!target) return toast.error("Select a target.");
    if (!updatePrices && !updateDates) return toast.error("Select at least one update type (prices or validity).");

    let num = 0;
    if (updatePrices) {
      if (!updateUnit && !updateLot) return toast.error("Select at least one price type.");
      num = Number(value);
      if (!value || isNaN(num)) return toast.error("Provide a numeric value.");
    }

    if (updateDates) {
      if (!newDateFrom && !newDateTo) return toast.error("Provide at least one new date.");
      if (newDateFrom && newDateTo && newDateFrom > newDateTo) {
        return toast.error("Date From must be earlier than Date To.");
      }
    }

    const matcher = (r: { partNumber: string; supplier: string }) =>
      selector === "part" ? r.partNumber === target : r.supplier === target;

    const transform = (r: typeof prices[number]) => {
      const next = { ...r };
      if (updatePrices) {
        if (updateUnit && r.unitPrice !== null) {
          next.unitPrice = mode === "fixed" ? num : +(r.unitPrice * (1 + num / 100)).toFixed(4);
        }
        if (updateLot && r.lotPrice !== null) {
          next.lotPrice = mode === "fixed" ? num : +(r.lotPrice * (1 + num / 100)).toFixed(4);
        }
      }
      if (updateDates) {
        if (newDateFrom) next.dateFrom = newDateFrom;
        if (newDateTo) next.dateTo = newDateTo;
      }
      return next;
    };

    const n = bulkUpdatePrices(matcher, transform);
    toast.success(`${n} record(s) updated.`);
    onOpenChange(false);
    setTarget("");
    setValue("");
    setNewDateFrom("");
    setNewDateTo("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk update</DialogTitle>
          <DialogDescription>
            Apply price adjustments and/or new validity dates to every tier of an item or supplier.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Select by</Label>
            <RadioGroup value={selector} onValueChange={(v) => { setSelector(v as Selector); setTarget(""); }} className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer hover:bg-secondary">
                <RadioGroupItem value="part" /> Part Number
              </label>
              <label className="flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer hover:bg-secondary">
                <RadioGroupItem value="supplier" /> Supplier
              </label>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Target</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger><SelectValue placeholder={selector === "part" ? "Select a Part Number" : "Select a Supplier"} /></SelectTrigger>
              <SelectContent className="max-h-72">
                {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Prices section */}
          <div className="rounded-lg border p-4 space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <Checkbox checked={updatePrices} onCheckedChange={(v) => setUpdatePrices(!!v)} />
              Update prices
            </label>
            {updatePrices && (
              <div className="space-y-3 pl-6">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Apply to</Label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={updateUnit} onCheckedChange={(v) => setUpdateUnit(!!v)} /> Unit Price
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={updateLot} onCheckedChange={(v) => setUpdateLot(!!v)} /> Lot Price
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground">Records with null value for the selected field are skipped.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Mode</Label>
                    <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">Percentage (%)</SelectItem>
                        <SelectItem value="fixed">Fixed value</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">{mode === "percent" ? "Variation %" : "New value"}</Label>
                    <Input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder={mode === "percent" ? "e.g. 5 or -3.5" : "e.g. 9.90"} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Validity section */}
          <div className="rounded-lg border p-4 space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <Checkbox checked={updateDates} onCheckedChange={(v) => setUpdateDates(!!v)} />
              Update validity dates
            </label>
            {updateDates && (
              <div className="space-y-3 pl-6">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">New Date From</Label>
                    <Input type="date" value={newDateFrom} onChange={(e) => setNewDateFrom(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">New Date To</Label>
                    <Input type="date" value={newDateTo} onChange={(e) => setNewDateTo(e.target.value)} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Leave a field empty to keep the current value.</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={apply}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}