import { useMemo, useRef, useState } from "react";
import AppLayout from "@/components/app/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Printer, Pencil, Trash2, RefreshCw, Search, Upload } from "lucide-react";
import { useXrayReports } from "@/hooks/useXrayReports";
import { XrayReport } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import * as XLSX from "xlsx";
import XrayEditorDialog from "@/components/xray/XrayEditorDialog";
import XrayPrintDialog from "@/components/xray/XrayPrintDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { fmtXrayDate } from "@/lib/format";

export default function XrayReportsPage() {
  const { reports, loading, reload, create, update, remove, usingApi, getNextReportNumber } = useXrayReports();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<XrayReport | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [printing, setPrinting] = useState<XrayReport | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<XrayReport | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter((r) =>
      [r.reportNumber, r.partNo, r.description, r.customer, r.interpreter, r.xraySerialNo]
        .some((s) => (s ?? "").toLowerCase().includes(q)),
    );
  }, [reports, search]);

  const handleSave = async (patch: Partial<XrayReport>, id: string | null) => {
    if (id) {
      await update(id, patch);
      toast.success("Report updated.");
    } else {
      await create([patch]);
      toast.success("Report created.");
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await remove([confirmDelete.id]);
    toast.success(`Report ${confirmDelete.reportNumber} removed.`);
    setConfirmDelete(null);
  };

  const triggerImport = () => fileInputRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting same file later
    if (!f) return;
    setImporting(true);
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const sheet = wb.Sheets["xray_reports"] || wb.Sheets[wb.SheetNames[0]];
      if (!sheet) throw new Error("Workbook has no readable sheet.");
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
      const parsed: Partial<XrayReport>[] = rows.map((r) => mapRow(r));
      if (!parsed.length) throw new Error("No rows found in file.");
      const created = await create(parsed, "import");
      toast.success(`Imported ${created.length} X-ray report(s).`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Radiographic Examination Reports</h1>
            <p className="text-sm text-muted-foreground mt-1">
              <span className="num">{reports.length}</span> report(s)
              {!usingApi && <Badge variant="outline" className="ml-2 text-[10px]">Local mode</Badge>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => reload()} disabled={loading}>
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Reload
            </Button>
            {isAdmin && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFile}
                />
                <Button variant="outline" size="sm" onClick={triggerImport} disabled={importing}>
                  <Upload className={`size-4 ${importing ? "animate-pulse" : ""}`} />
                  {importing ? "Importing…" : "Import"}
                </Button>
              </>
            )}
            <Button size="sm" onClick={() => { setEditing(null); setEditorOpen(true); }}>
              <Plus className="size-4" /> New report
            </Button>
          </div>
        </header>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search report number, part, customer, serial…"
              className="pl-9"
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {filtered.length} of {reports.length}
          </span>
        </div>

        <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto max-h-[70vh]">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground sticky top-0">
                <tr>
                  <th className="px-3 py-2.5 text-left font-medium">Report #</th>
                  <th className="px-3 py-2.5 text-left font-medium">Date</th>
                  <th className="px-3 py-2.5 text-left font-medium">Part No</th>
                  <th className="px-3 py-2.5 text-left font-medium">Description</th>
                  <th className="px-3 py-2.5 text-left font-medium">Customer</th>
                  <th className="px-3 py-2.5 text-right font-medium">Acc</th>
                  <th className="px-3 py-2.5 text-right font-medium">RW</th>
                  <th className="px-3 py-2.5 text-right font-medium">Rej</th>
                  <th className="px-3 py-2.5 text-left font-medium">Interpreter</th>
                  <th className="px-3 py-2.5 w-[110px]" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-sm text-muted-foreground">
                      {loading ? "Loading…" : "No reports found."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.id} className="border-t hover:bg-secondary/40 transition-colors">
                      <td className="px-3 py-2 font-mono text-xs font-semibold">{r.reportNumber}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground num">{fmtXrayDate(r.date)}</td>
                      <td className="px-3 py-2 font-medium">{r.partNo}</td>
                      <td className="px-3 py-2 text-muted-foreground truncate max-w-[200px]" title={r.description}>{r.description}</td>
                      <td className="px-3 py-2">{r.customer}</td>
                      <td className="px-3 py-2 text-right num">{r.acceptedQty ?? ""}</td>
                      <td className="px-3 py-2 text-right num">{r.reworkQty ?? ""}</td>
                      <td className="px-3 py-2 text-right num">{r.rejectQty ?? ""}</td>
                      <td className="px-3 py-2 text-xs">{r.interpreter}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-0.5">
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => { setPrinting(r); setPrintOpen(true); }} title="Print">
                            <Printer className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => { setEditing(r); setEditorOpen(true); }} title="Edit">
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" onClick={() => setConfirmDelete(r)} title="Delete">
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <XrayEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        editing={editing}
        onSave={handleSave}
        getNextReportNumber={getNextReportNumber}
      />
      <XrayPrintDialog open={printOpen} onOpenChange={setPrintOpen} report={printing} />

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete report?</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently remove report {confirmDelete?.reportNumber}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}