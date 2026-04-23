import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PriceRecord, QTY_MAX } from "@/lib/types";
import { useData, newId } from "@/contexts/DataContext";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

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
  const { addPrices, updatePrice } = useData();
  const [mode, setMode] = useState<"unit" | "lot">("unit");
  const [common, setCommon] = useState<CommonDraft>(emptyCommon);
  const [breaks, setBreaks] = useState<DraftBreak[]>([{ quantityFrom: "1", quantityTo: String(QTY_MAX), unitPrice: "" }]);
  const [lot, setLot] = useState<LotDraft>({ lotPrice: "" });

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
      toast.error("Preencha contrato, part number, supplier e datas.");
      return;
    }
    if (mode === "unit") {
      for (const b of breaks) {
        if (!b.unitPrice || !b.quantityFrom || !b.quantityTo) {
          toast.error("Preencha todas as faixas com quantidade e preço unitário.");
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
        });
        toast.success("Registro atualizado.");
      } else {
        const rows: PriceRecord[] = breaks.map((b) => ({
          id: newId(),
          ...common,
          quantityFrom: Number(b.quantityFrom),
          quantityTo: Number(b.quantityTo),
          unitPrice: Number(b.unitPrice),
          lotPrice: null,
        }));
        addPrices(rows);
        toast.success(`${rows.length} faixa(s) cadastrada(s).`);
      }
    } else {
      if (!lot.lotPrice) {
        toast.error("Informe o Lot Price.");
        return;
      }
      const payload = {
        ...common,
        quantityFrom: 1,
        quantityTo: QTY_MAX,
        unitPrice: null,
        lotPrice: Number(lot.lotPrice),
      };
      if (editing) {
        updatePrice(editing.id, payload);
        toast.success("Registro atualizado.");
      } else {
        addPrices([{ id: newId(), ...payload }]);
        toast.success("Registro cadastrado.");
      }
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar registro" : "Novo registro"}</DialogTitle>
          <DialogDescription>
            {editing ? "Altere os campos e salve." : "Cadastre um item por price breaks (Unit Price) ou por lote (Lot Price)."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Contract Number"><Input value={common.contractNumber} onChange={(e) => setCommon({ ...common, contractNumber: e.target.value })} /></Field>
          <Field label="Part Number"><Input value={common.partNumber} onChange={(e) => setCommon({ ...common, partNumber: e.target.value })} /></Field>
          <Field label="Supplier"><Input value={common.supplier} onChange={(e) => setCommon({ ...common, supplier: e.target.value })} /></Field>
          <div />
          <Field label="Date From"><Input type="date" value={common.dateFrom} onChange={(e) => setCommon({ ...common, dateFrom: e.target.value })} /></Field>
          <Field label="Date To"><Input type="date" value={common.dateTo} onChange={(e) => setCommon({ ...common, dateTo: e.target.value })} /></Field>
        </div>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "unit" | "lot")} className="mt-2">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="unit">Unit Price (price breaks)</TabsTrigger>
            <TabsTrigger value="lot">Lot Price (lote)</TabsTrigger>
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
                  <div className="col-span-5"><Label className="text-xs text-muted-foreground">Unit Price</Label>
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
                <Plus className="size-4" /> Adicionar faixa
              </Button>
            )}
          </TabsContent>

          <TabsContent value="lot" className="mt-3">
            <Field label="Lot Price">
              <Input value={lot.lotPrice} inputMode="decimal" onChange={(e) => setLot({ lotPrice: e.target.value })} />
            </Field>
            <p className="mt-2 text-xs text-muted-foreground">
              A faixa será registrada de 1 a {QTY_MAX.toLocaleString()} (∞).
            </p>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit}>{editing ? "Salvar" : "Cadastrar"}</Button>
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