import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { XrayReport } from "@/lib/types";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: XrayReport | null;
  onSave: (patch: Partial<XrayReport>, id: string | null) => Promise<void> | void;
  /** Resolves to the next sequential report number (used when creating). */
  getNextReportNumber?: () => Promise<string>;
}

function blank(): Partial<XrayReport> {
  return {
    reportNumber: "", partNo: "", description: "", quantity: "", date: "",
    operationNo: "", planningCardNo: "", customer: "", xrayTechniqueNo: "",
    issue: "", kv: "", ma: "", timeSeconds: "", sfdMm: "", filmTypeQty: "",
    xraySerialNo: "", acceptedQty: null, reworkQty: null, rejectQty: null,
    interpreter: "", radiographer: "", secondScrutineer: "",
    radiographicProcedure: "", acceptanceCriteria: "",
  };
}

export default function XrayEditorDialog({ open, onOpenChange, editing, onSave, getNextReportNumber }: Props) {
  const [v, setV] = useState<Partial<XrayReport>>(blank());
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setV({ ...editing });
      return;
    }
    // New report: prefill with the next sequential number.
    const base = blank();
    setV(base);
    if (getNextReportNumber) {
      getNextReportNumber()
        .then((n) => setV((cur) => ({ ...cur, reportNumber: cur.reportNumber || n })))
        .catch(() => {/* leave blank — server will assign on insert */});
    }
  }, [editing, open, getNextReportNumber]);

  const set = <K extends keyof XrayReport>(k: K, val: XrayReport[K]) => setV((s) => ({ ...s, [k]: val }));
  const num = (s: string) => (s === "" ? null : Number(s));

  const submit = async () => {
    try {
      await onSave(v, editing?.id ?? null);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save report.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit report ${editing.reportNumber}` : "New X-ray report"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <Field label="Report Number" required>
            <Input
              value={v.reportNumber ?? ""}
              onChange={(e) => set("reportNumber", e.target.value)}
              placeholder={editing ? "" : "Auto"}
            />
          </Field>
          <Field label="Date">
            <Input type="date" value={v.date ?? ""} onChange={(e) => set("date", e.target.value)} />
          </Field>
          <Field label="Customer">
            <Input value={v.customer ?? ""} onChange={(e) => set("customer", e.target.value)} />
          </Field>

          <Field label="Part No">
            <Input value={v.partNo ?? ""} onChange={(e) => set("partNo", e.target.value)} />
          </Field>
          <Field label="Description">
            <Input value={v.description ?? ""} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <Field label="Quantity">
            <Input value={v.quantity ?? ""} onChange={(e) => set("quantity", e.target.value)} />
          </Field>

          <Field label="Operation No.">
            <Input value={v.operationNo ?? ""} onChange={(e) => set("operationNo", e.target.value)} />
          </Field>
          <Field label="Planning Card No.">
            <Input value={v.planningCardNo ?? ""} onChange={(e) => set("planningCardNo", e.target.value)} />
          </Field>
          <Field label="X-Ray Technique No.">
            <Input value={v.xrayTechniqueNo ?? ""} onChange={(e) => set("xrayTechniqueNo", e.target.value)} />
          </Field>

          <Field label="Issue">
            <Input value={v.issue ?? ""} onChange={(e) => set("issue", e.target.value)} />
          </Field>
          <Field label="X-Ray Serial No.">
            <Input value={v.xraySerialNo ?? ""} onChange={(e) => set("xraySerialNo", e.target.value)} />
          </Field>
          <Field label="Type / Quantity of film used">
            <Input value={v.filmTypeQty ?? ""} onChange={(e) => set("filmTypeQty", e.target.value)} />
          </Field>

          <Field label="kV">
            <Input value={v.kv ?? ""} onChange={(e) => set("kv", e.target.value)} />
          </Field>
          <Field label="mA">
            <Input value={v.ma ?? ""} onChange={(e) => set("ma", e.target.value)} />
          </Field>
          <Field label="Time (seconds)">
            <Input value={v.timeSeconds ?? ""} onChange={(e) => set("timeSeconds", e.target.value)} />
          </Field>

          <Field label="SFD (mm)">
            <Input value={v.sfdMm ?? ""} onChange={(e) => set("sfdMm", e.target.value)} />
          </Field>
          <Field label="Accepted Qty">
            <Input type="number" value={v.acceptedQty ?? ""} onChange={(e) => set("acceptedQty", num(e.target.value))} />
          </Field>
          <Field label="Re-work Qty">
            <Input type="number" value={v.reworkQty ?? ""} onChange={(e) => set("reworkQty", num(e.target.value))} />
          </Field>
          <Field label="Reject Qty">
            <Input type="number" value={v.rejectQty ?? ""} onChange={(e) => set("rejectQty", num(e.target.value))} />
          </Field>

          <Field label="Radiographer (Signature)">
            <Input value={v.radiographer ?? ""} onChange={(e) => set("radiographer", e.target.value)} />
          </Field>
          <Field label="Interpreter (Signature)">
            <Input value={v.interpreter ?? ""} onChange={(e) => set("interpreter", e.target.value)} />
          </Field>
          <Field label="2nd Scrutineer (Signature)">
            <Input value={v.secondScrutineer ?? ""} onChange={(e) => set("secondScrutineer", e.target.value)} />
          </Field>

          <Field label="Radiographic Procedure" className="col-span-2 md:col-span-3">
            <Input value={v.radiographicProcedure ?? ""} onChange={(e) => set("radiographicProcedure", e.target.value)} />
          </Field>
          <Field label="Acceptance Criteria" className="col-span-2 md:col-span-3">
            <Input value={v.acceptanceCriteria ?? ""} onChange={(e) => set("acceptanceCriteria", e.target.value)} />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>{editing ? "Save changes" : "Create report"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, required, children, className = "" }: { label: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1 ${className}`}>
      <Label className="text-xs">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}