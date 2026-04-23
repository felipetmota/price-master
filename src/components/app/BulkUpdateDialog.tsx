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
  const [updateUnit, setUpdateUnit] = useState(true);
  const [updateLot, setUpdateLot] = useState(true);
  const [mode, setMode] = useState<Mode>("percent");
  const [value, setValue] = useState<string>("");

  const options = useMemo(() => {
    const set = new Set<string>();
    prices.forEach((p) => set.add(selector === "part" ? p.partNumber : p.supplier));
    return Array.from(set).filter(Boolean).sort();
  }, [prices, selector]);

  const apply = () => {
    if (!target) return toast.error("Selecione um alvo.");
    if (!updateUnit && !updateLot) return toast.error("Selecione ao menos um tipo de preço.");
    const num = Number(value);
    if (!value || isNaN(num)) return toast.error("Informe um valor numérico.");

    const matcher = (r: { partNumber: string; supplier: string }) =>
      selector === "part" ? r.partNumber === target : r.supplier === target;

    const transform = (r: typeof prices[number]) => {
      const next = { ...r };
      if (updateUnit && r.unitPrice !== null) {
        next.unitPrice = mode === "fixed" ? num : +(r.unitPrice * (1 + num / 100)).toFixed(4);
      }
      if (updateLot && r.lotPrice !== null) {
        next.lotPrice = mode === "fixed" ? num : +(r.lotPrice * (1 + num / 100)).toFixed(4);
      }
      return next;
    };

    const n = bulkUpdatePrices(matcher, transform);
    toast.success(`${n} registro(s) atualizado(s).`);
    onOpenChange(false);
    setTarget("");
    setValue("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Atualização em massa</DialogTitle>
          <DialogDescription>
            Aplique reajuste por valor fixo ou percentual em todas as faixas de um item ou supplier.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Selecionar por</Label>
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
            <Label className="text-xs text-muted-foreground">Alvo</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger><SelectValue placeholder={selector === "part" ? "Selecione um Part Number" : "Selecione um Supplier"} /></SelectTrigger>
              <SelectContent className="max-h-72">
                {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Aplicar em</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={updateUnit} onCheckedChange={(v) => setUpdateUnit(!!v)} /> Unit Price
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={updateLot} onCheckedChange={(v) => setUpdateLot(!!v)} /> Lot Price
              </label>
            </div>
            <p className="text-xs text-muted-foreground">Registros com o campo nulo são ignorados.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Modo</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percentual (%)</SelectItem>
                  <SelectItem value="fixed">Valor fixo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">{mode === "percent" ? "Variação %" : "Novo valor"}</Label>
              <Input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder={mode === "percent" ? "ex: 5 ou -3.5" : "ex: 9.90"} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={apply}>Aplicar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}