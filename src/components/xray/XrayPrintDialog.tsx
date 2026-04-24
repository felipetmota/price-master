import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { XrayReport } from "@/lib/types";
import { Printer } from "lucide-react";
import { useBrandLogo } from "@/hooks/useBrandLogo";
import { useBrandAddress } from "@/hooks/useBrandAddress";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  report: XrayReport | null;
}

/**
 * Renders an A4-style preview matching the Nasmyth Group "Radiographic
 * Examination Report" template (see screenshot reference). The user types
 * the Summary of Imperfections free-text just before printing — it is
 * NOT persisted to the database.
 */
export default function XrayPrintDialog({ open, onOpenChange, report }: Props) {
  const [summary, setSummary] = useState("");
  const printRef = useRef<HTMLDivElement>(null);
  const { logo } = useBrandLogo();
  const { address } = useBrandAddress();

  useEffect(() => {
    if (open) setSummary("");
  }, [open, report?.id]);

  const handlePrint = () => {
    if (!report) return;
    const html = printRef.current?.outerHTML ?? "";
    const win = window.open("", "_blank", "width=900,height=1100");
    if (!win) return;
    win.document.write(`<!doctype html>
<html><head><meta charset="utf-8"><title>RER ${report.reportNumber}</title>
<style>${PRINT_STYLES}</style>
</head><body>${html}<script>
(function(){
  function doPrint(){ try { window.focus(); window.print(); } finally { setTimeout(function(){ window.close(); }, 200); } }
  function ready(){
    var imgs = Array.prototype.slice.call(document.images || []);
    if (imgs.length === 0) return doPrint();
    var pending = imgs.length;
    var done = function(){ pending--; if (pending <= 0) doPrint(); };
    imgs.forEach(function(img){
      if (img.complete && img.naturalWidth > 0) return done();
      img.addEventListener('load', done);
      img.addEventListener('error', done);
    });
    setTimeout(doPrint, 3000); // hard fallback
  }
  if (document.readyState === 'complete') ready(); else window.addEventListener('load', ready);
})();
</script></body></html>`);
    win.document.close();
  };

  if (!report) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-5">
          <DialogTitle>Print report — {report.reportNumber}</DialogTitle>
          <DialogDescription>
            Review the report preview and print with the current branding settings.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 space-y-2">
          <Label htmlFor="summary" className="text-xs">
            Summary of Imperfections (typed here, not saved to the database)
          </Label>
          <Textarea
            id="summary"
            rows={4}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="e.g. 0.2mm pore on weld XU2509 - acceptable to Criteria.&#10;No further imperfections revealed."
          />
        </div>

        <div className="px-6 pb-2">
          <p className="text-xs text-muted-foreground mb-2">Preview</p>
          <div className="bg-muted/40 p-4 rounded-md flex justify-center overflow-auto">
            <style>{PRINT_STYLES}</style>
            <div ref={printRef}>
              <PrintableReport report={report} summary={summary} logo={logo} address={address} />
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 pb-5">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handlePrint}>
            <Printer className="size-4" /> Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const PRINT_STYLES = `
  @page { size: A4; margin: 12mm; }
  body { margin: 0; }
  .rer-doc {
    width: 186mm;
    background: white;
    color: #000;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10pt;
    padding: 6mm;
    box-sizing: border-box;
  }
  .rer-doc * { box-sizing: border-box; }
  .rer-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
  .rer-brand { display:flex; align-items:center; gap:8px; }
  .rer-brand .logo {
    width: 56px; height: 56px; border-radius: 50%;
    background: #1d8a3e; color: white;
    display:flex; align-items:center; justify-content:center;
    font-weight: 800; font-size: 18pt; letter-spacing: -1px;
  }
  .rer-brand .logo-img {
    max-width: 80px; max-height: 64px; object-fit: contain;
  }
  .rer-brand .brand-name { font-weight: 800; font-size: 16pt; color: #1d8a3e; line-height: 1; }
  .rer-brand .brand-name small { display:block; font-weight: 600; font-size: 8pt; letter-spacing: 4px; color: #333; }
  .rer-addr { text-align: right; font-size: 8.5pt; line-height: 1.35; }
  .rer-addr .h { font-weight: 700; color: #1d8a3e; }
  .rer-title {
    text-align: center; font-weight: 800; font-size: 18pt;
    color: #1d8a3e; text-decoration: underline;
    margin: 6px 0 8px;
  }
  .rer-section { border: 1.5px solid #000; padding: 6px 8px; margin-bottom: 6px; }
  .rer-section .section-title { text-align: center; font-weight: 700; text-decoration: underline; font-size: 10pt; margin-bottom: 6px; }
  .rer-grid { display: grid; gap: 6px; }
  .rer-grid.cols-3 { grid-template-columns: 1fr 1fr 1fr; }
  .rer-grid.cols-2 { grid-template-columns: 1fr 1fr; }
  .rer-grid.cols-4 { grid-template-columns: 1fr 1fr 1fr 1fr; }
  .rer-field { display: flex; flex-direction: column; gap: 2px; }
  .rer-field .lbl { font-weight: 700; font-size: 9pt; }
  .rer-field .box { border: 1px solid #000; padding: 3px 6px; min-height: 18px; font-size: 9.5pt; }
  .rer-summary-box { border: 1px solid #000; padding: 6px 8px; min-height: 70px; white-space: pre-wrap; font-size: 9.5pt; }
  .rer-foot { display:flex; justify-content: space-between; font-size: 8.5pt; margin-top: 8px; }
  .rer-italic { font-style: italic; color: #555; font-size: 8pt; }
`;

const PrintableReport = forwardRef<HTMLDivElement, { report: XrayReport; summary: string; logo: string | null; address: string }>(function PrintableReport(
  { report, summary, logo, address },
  ref,
) {
  const addressLines = address.split("\n");
  return (
    <div ref={ref} className="rer-doc">
      <div className="rer-header">
        <div className="rer-brand">
          {logo ? (
            <img src={logo} alt="Logo" className="logo-img" />
          ) : (
            <div className="logo">N</div>
          )}
        </div>
        <div className="rer-addr">
          {addressLines.map((line, i) => (
            <div key={i}>{line || "\u00A0"}</div>
          ))}
        </div>
      </div>

      <div className="rer-title">RADIOGRAPHIC EXAMINATION REPORT</div>

      <div className="rer-section">
        <div className="section-title">REPORT SPECIFICS</div>
        <div className="rer-grid cols-3" style={{ marginBottom: 6 }}>
          <Field label="Part no" value={report.partNo} />
          <div />
          <Field label="Report Number" value={report.reportNumber} bold />
        </div>
        <div className="rer-grid cols-3" style={{ marginBottom: 6 }}>
          <Field label="Description" value={report.description} />
          <Field label="Quantity" value={report.quantity} />
          <Field label="Date" value={report.date} />
        </div>
        <div className="rer-grid cols-3">
          <Field label="Customer" value={report.customer} />
          <Field label="Operation No." value={report.operationNo} />
          <Field label="Planning Card No." value={report.planningCardNo} />
        </div>
      </div>

      <div className="rer-section">
        <div className="section-title">EXPOSURE DETAILS</div>
        <div className="rer-grid cols-3" style={{ marginBottom: 6 }}>
          <Field label="X-Ray Technique No." value={report.xrayTechniqueNo} />
          <Field label="Issue" value={report.issue} />
          <Field label="X-Ray Serial No." value={report.xraySerialNo} />
        </div>
        <div className="rer-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr 2fr" }}>
          <Field label="kV" value={report.kv} />
          <Field label="mA" value={report.ma} />
          <Field label="Time (seconds)" value={report.timeSeconds} />
          <Field label="SFD (mm)" value={report.sfdMm} />
          <Field label="Type / Quantity of film used" value={report.filmTypeQty} />
        </div>
      </div>

      <div className="rer-section">
        <div className="rer-grid cols-3">
          <Field label="Accepted Qty" value={report.acceptedQty ?? ""} />
          <Field label="Re-work Qty" value={report.reworkQty ?? ""} />
          <Field label="Reject Qty" value={report.rejectQty ?? ""} />
        </div>
      </div>

      <div className="rer-section">
        <div className="section-title">SUMMARY OF IMPERFECTIONS</div>
        <div className="rer-summary-box">{summary || "\u00A0"}</div>
        <div className="rer-grid cols-2" style={{ marginTop: 8 }}>
          <Field label="Radiographic Procedure" value={report.radiographicProcedure} />
          <Field label="Acceptance Criteria" value={report.acceptanceCriteria} />
        </div>
      </div>

      <div className="rer-grid cols-3">
        <Field label="Signature - Radiographer" value={report.radiographer} />
        <Field label="Signature - Interpreter" value={report.interpreter} />
        <div>
          <Field label="Signature - 2nd Scrutineer" value={report.secondScrutineer} />
          <div className="rer-italic" style={{ textAlign: "center", marginTop: 2 }}>(If applicable)</div>
        </div>
      </div>

      <div className="rer-foot">
        <div>QA-RER No.1</div>
        <div>Issue no.3</div>
        <div>Date: {new Date().toLocaleDateString("en-GB")}</div>
      </div>
    </div>
  );
});

function Field({ label, value, bold }: { label: string; value: React.ReactNode; bold?: boolean }) {
  return (
    <div className="rer-field">
      <div className="lbl">{label}</div>
      <div className="box" style={bold ? { fontWeight: 700, textAlign: "center" } : undefined}>
        {value === "" || value === null || value === undefined ? "\u00A0" : String(value)}
      </div>
    </div>
  );
}