import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Currency, PriceRecord, QTY_MAX } from "@/lib/types";
import { useData, newId } from "@/contexts/DataContext";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import ComboInput from "@/components/app/ComboInput";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: PriceRecord | null;
}

type DraftBreak = { quantityFrom: string; quantityTo: string; unitPrice: string };
type LotDraft = { lotPrice: string };
type CommonDraft = {
  contractNumber: string;
  partNumber: string;
  supplier: string;
  dateFrom: string;
  dateTo: string;
};

const emptyCommon: CommonDraft = { contractNumber: "", partNumber: "", supplier: "", dateFrom: "", dateTo: "" };

export default function PriceEditorDialog({ open, onOpenChange, editing }: Props) {
  const { addPrices, updatePrice, contracts, partNumbers, suppliers } = useData();
  const contractOptions = useMemo(() => contracts.map((c) => c.contractNumber).sort(), [contracts]);
  const [mode, setMode] = useState<"unit" | "lot">("unit");
  const [common, setCommon] = useState<CommonDraft>(emptyCommon);
  const [breaks, setBreaks] = useState<DraftBreak[]>([{ quantityFrom: "1", quantityTo: String(QTY_MAX), unitPrice: "" }]);
  const [lot, setLot] = useState<LotDraft>({ lotPrice: "" });

  const selectedContract = useMemo(
    () => contracts.find((c) => c.contractNumber === common.contractNumber),
    [contracts, common.contractNumber],
  );
  const currency: Currency = selectedContract?.currency ?? "USD";

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setCommon({
        contractNumber: editing.contractNumber,
        partNumber: editing.partNumber,
        supplier: editing.supplier,
        dateFrom: editing.dateFrom,
        dateTo: editing.dateTo,
      });
      if (editing.lotPrice !== null) {
        setMode("lot");
        setLot({ lotPrice: String(editing.lotPrice) });
      } else {
        setMode("unit");
        setBreaks([{
          quantityFrom: String(editing.quantityFrom),
          quantityTo: String(editing.quantityTo),
          unitPrice: editing.unitPrice !== null ? String(editing.unitPrice) : "",
        }]);
      }
    } else {
      setMode("unit");
      setCommon(emptyCommon);
      setBreaks([{ quantityFrom: "1", quantityTo: String(QTY_MAX), unitPrice: "" }]);
      setLot({ lotPrice: "" });
    }
  }, [open, editing]);

  const submit = () => {
    if (!common.partNumber || !common.contractNumber || !common.supplier || !common.dateFrom || !common.dateTo) {
      toast.error("Fill in contract, part number, supplier and dates.");
      return;
    }
    if (!selectedContract) {
      toast.error("Selected contract not found. Register it in Admin → Contracts first.");
      return;
    }
    if (mode === "unit") {
      for (const b of breaks) {
        if (!b.unitPrice || !b.quantityFrom || !b.quantityTo) {
          toast.error("Fill in all tiers with quantity and unit price.");
          return;
        }
      }
      if (editing) {
        const b = breaks[0];
        updatePrice(editing.id, {
          ...common,
          quantityFrom: Number(b.quantityFrom),
          quantityTo: Number(b.quantityTo),
          unitPrice: Number(b.unitPrice),
          lotPrice: null,
          currency,
        });
        toast.success("Record updated.");
      } else {
        const rows: PriceRecord[] = breaks.map((b) => ({
          id: newId(),
          ...common,
          quantityFrom: Number(b.quantityFrom),
          quantityTo: Number(b.quantityTo),
          unitPrice: Number(b.unitPrice),
          lotPrice: null,
          currency,
        }));
        addPrices(rows);
        toast.success(`${rows.length} tier(s) created.`);
      }
    } else {
      if (!lot.lotPrice) {
        toast.error("Provide the Lot Price.");
        return;
      }
      const payload = {
        ...common,
        quantityFrom: 1,
        quantityTo: QTY_MAX,
        unitPrice: null,
        lotPrice: Number(lot.lotPrice),
        currency,
      };
      if (editing) {
        updatePrice(editing.id, payload);
        toast.success("Record updated.");
      } else {
        addPrices([{ id: newId(), ...payload }]);
        toast.success("Record created.");
      }
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit record" : "New record"}</DialogTitle>
          <DialogDescription>
            {editing ? "Change fields and save." : "Register an item using price breaks (Unit Price) or by lot (Lot Price)."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-2">
              Contract Number
              {selectedContract && <Badge variant="secondary" className="font-mono text-[10px]">{currency}</Badge>}
            </Label>
            <ComboInput
              value={common.contractNumber}
              onChange={(v) => setCommon({ ...common, contractNumber: v })}
              options={contractOptions}
              allowFreeText={false}
              placeholder={contracts.length === 0 ? "No contracts — create in Admin → Contracts" : "Search a contract"}
              disabled={contracts.length === 0}
            />
          </div>
          <Field label="Part Number">
            <ComboInput
              value={common.partNumber}
              onChange={(v) => setCommon({ ...common, partNumber: v })}
              options={partNumbers}
              placeholder="Type or pick existing"
            />
          </Field>
          <Field label="Supplier">
            <ComboInput
              value={common.supplier}
              onChange={(v) => setCommon({ ...common, supplier: v })}
              options={suppliers}
              placeholder="Type or pick existing"
            />
          </Field>
          <Field label="Date From"><Input type="date" value={common.dateFrom} onChange={(e) => setCommon({ ...common, dateFrom: e.target.value })} /></Field>
          <Field label="Date To"><Input type="date" value={common.dateTo} onChange={(e) => setCommon({ ...common, dateTo: e.target.value })} /></Field>
        </div>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "unit" | "lot")} className="mt-2">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="unit">Unit Price (price breaks)</TabsTrigger>
            <TabsTrigger value="lot">Lot Price (lot)</TabsTrigger>
          </TabsList>

          <TabsContent value="unit" className="space-y-2 mt-3">
            <div className="space-y-2">
              {breaks.map((b, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-3"><Label className="text-xs text-muted-foreground">Qty From</Label>
                    <Input value={b.quantityFrom} inputMode="numeric" onChange={(e) => { const n = [...breaks]; n[i] = { ...b, quantityFrom: e.target.value }; setBreaks(n); }} />
                  </div>
                  <div className="col-span-3"><Label className="text-xs text-muted-foreground">Qty To <span className="text-[10px]">(∞ = {QTY_MAX})</span></Label>
                    <Input value={b.quantityTo} inputMode="numeric" onChange={(e) => { const n = [...breaks]; n[i] = { ...b, quantityTo: e.target.value }; setBreaks(n); }} />
                  </div>
                  <div className="col-span-5"><Label className="text-xs text-muted-foreground">Unit Price ({currency})</Label>
                    <Input value={b.unitPrice} inputMode="decimal" onChange={(e) => { const n = [...breaks]; n[i] = { ...b, unitPrice: e.target.value }; setBreaks(n); }} />
                  </div>
                  <div className="col-span-1">
                    <Button type="button" variant="ghost" size="icon" disabled={breaks.length === 1 || !!editing} onClick={() => setBreaks(breaks.filter((_, j) => j !== i))}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {!editing && (
              <Button type="button" variant="outline" size="sm" onClick={() => setBreaks([...breaks, { quantityFrom: "", quantityTo: "", unitPrice: "" }])}>
                <Plus className="size-4" /> Add tier
              </Button>
            )}
          </TabsContent>

          <TabsContent value="lot" className="mt-3">
            <Field label={`Lot Price (${currency})`}>
              <Input value={lot.lotPrice} inputMode="decimal" onChange={(e) => setLot({ lotPrice: e.target.value })} />
            </Field>
            <p className="mt-2 text-xs text-muted-foreground">
              The tier will be recorded from 1 to {QTY_MAX.toLocaleString()} (∞).
            </p>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>{editing ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
