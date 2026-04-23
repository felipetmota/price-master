import { useMemo, useRef, useState } from "react";
import AppLayout from "@/components/app/AppLayout";
import FiltersBar from "@/components/app/FiltersBar";
import PricesTable from "@/components/app/PricesTable";
import PriceEditorDialog from "@/components/app/PriceEditorDialog";
import BulkUpdateDialog from "@/components/app/BulkUpdateDialog";
import { Button } from "@/components/ui/button";
import { useData } from "@/contexts/DataContext";
import { PriceFilters, PriceRecord, emptyFilters } from "@/lib/types";
import { Download, FileSpreadsheet, Plus, RefreshCw, Trash2, Upload, Wand2 } from "lucide-react";
import { exportPricesToXlsx, parseWorkbookFromBuffer } from "@/lib/xlsx-io";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function Dashboard() {
  const { prices, users, deletePrices, addPrices, setAll, reload, loading } = useData();
  const [filters, setFilters] = useState<PriceFilters>(emptyFilters);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<PriceRecord | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    return prices.filter((r) => {
      if (filters.contractNumber && !r.contractNumber.toLowerCase().includes(filters.contractNumber.toLowerCase())) return false;
      if (filters.partNumber && !r.partNumber.toLowerCase().includes(filters.partNumber.toLowerCase())) return false;
      if (filters.supplier && !r.supplier.toLowerCase().includes(filters.supplier.toLowerCase())) return false;
      if (filters.dateFrom && r.dateTo && r.dateTo < filters.dateFrom) return false;
      if (filters.dateTo && r.dateFrom && r.dateFrom > filters.dateTo) return false;
      const qF = filters.qtyFrom ? Number(filters.qtyFrom) : null;
      const qT = filters.qtyTo ? Number(filters.qtyTo) : null;
      if (qF !== null && r.quantityTo < qF) return false;
      if (qT !== null && r.quantityFrom > qT) return false;
      const upMin = filters.unitPriceMin ? Number(filters.unitPriceMin) : null;
      const upMax = filters.unitPriceMax ? Number(filters.unitPriceMax) : null;
      if (upMin !== null && (r.unitPrice === null || r.unitPrice < upMin)) return false;
      if (upMax !== null && (r.unitPrice === null || r.unitPrice > upMax)) return false;
      const lpMin = filters.lotPriceMin ? Number(filters.lotPriceMin) : null;
      const lpMax = filters.lotPriceMax ? Number(filters.lotPriceMax) : null;
      if (lpMin !== null && (r.lotPrice === null || r.lotPrice < lpMin)) return false;
      if (lpMax !== null && (r.lotPrice === null || r.lotPrice > lpMax)) return false;
      return true;
    });
  }, [prices, filters]);

  const onImport = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const data = parseWorkbookFromBuffer(buf);
      if (!data.prices.length) {
        toast.error("No records found in the 'prices' sheet.");
        return;
      }
      addPrices(data.prices);
      toast.success(`${data.prices.length} record(s) imported.`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to import spreadsheet.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const handleDelete = () => {
    if (!confirmDelete) return;
    deletePrices(confirmDelete);
    setSelected(new Set());
    toast.success(`${confirmDelete.length} record(s) removed.`);
    setConfirmDelete(null);
  };

  const stats = useMemo(() => {
    const partSet = new Set(prices.map((p) => p.partNumber));
    const supSet = new Set(prices.map((p) => p.supplier));
    return { items: partSet.size, suppliers: supSet.size, rows: prices.length };
  }, [prices]);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Contract prices</h1>
            <p className="text-sm text-muted-foreground mt-1">
              <span className="num">{stats.items}</span> items · <span className="num">{stats.suppliers}</span> suppliers · <span className="num">{stats.rows}</span> records
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={fileInput} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
            <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
              <Upload className="size-4" /> Import .xlsx
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportPricesToXlsx(prices, users)}>
              <Download className="size-4" /> Export
            </Button>
            <Button variant="outline" size="sm" onClick={() => reload()} disabled={loading}>
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Reload
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setBulkOpen(true)}>
              <Wand2 className="size-4" /> Bulk update
            </Button>
            <Button size="sm" onClick={() => { setEditing(null); setEditorOpen(true); }}>
              <Plus className="size-4" /> New record
            </Button>
          </div>
        </header>

        <a href="/templates/prices_template.xlsx" download className="inline-flex items-center gap-2 text-xs text-accent hover:underline">
          <FileSpreadsheet className="size-3.5" /> Download template spreadsheet
        </a>

        <FiltersBar value={filters} onChange={setFilters} resultCount={filtered.length} totalCount={prices.length} />

        {selected.size > 0 && (
          <div className="flex items-center justify-between rounded-lg border bg-accent-soft px-4 py-2.5 text-sm">
            <span><span className="font-medium num">{selected.size}</span> record(s) selected</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
              <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(Array.from(selected))}>
                <Trash2 className="size-4" /> Delete selected
              </Button>
            </div>
          </div>
        )}

        <PricesTable
          rows={filtered}
          selected={selected}
          onToggle={(id) => {
            const n = new Set(selected);
            n.has(id) ? n.delete(id) : n.add(id);
            setSelected(n);
          }}
          onToggleAll={(checked) => {
            if (checked) setSelected(new Set(filtered.map((r) => r.id)));
            else setSelected(new Set());
          }}
          onEdit={(r) => { setEditing(r); setEditorOpen(true); }}
          onDelete={(ids) => setConfirmDelete(ids)}
        />
      </div>

      <PriceEditorDialog open={editorOpen} onOpenChange={setEditorOpen} editing={editing} />
      <BulkUpdateDialog open={bulkOpen} onOpenChange={setBulkOpen} />

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete record(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {confirmDelete?.length ?? 0} record(s) from memory. To persist, export the spreadsheet after confirming.
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