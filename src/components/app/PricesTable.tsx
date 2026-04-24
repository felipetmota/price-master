import { useMemo, useRef } from "react";
import { Currency, PriceRecord } from "@/lib/types";
import { convertCurrency, fmtDate, fmtMoney, fmtQty } from "@/lib/format";
import { useData } from "@/contexts/DataContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useVirtualizer } from "@tanstack/react-virtual";

interface Props {
  rows: PriceRecord[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  onEdit: (r: PriceRecord) => void;
  onDelete: (ids: string[]) => void;
}

// Column template kept in one place so the header and every row stay aligned.
const GRID_COLS =
  "40px minmax(140px,1fr) minmax(140px,1.2fr) minmax(160px,1.4fr) minmax(180px,1.2fr) 90px 90px 130px 130px 80px";

type FlatRow = {
  record: PriceRecord;
  indexInGroup: number;
  groupSize: number;
  isLot: boolean;
};

export default function PricesTable({ rows, selected, onToggle, onToggleAll, onEdit, onDelete }: Props) {
  const { rates } = useData();
  const display: Currency = rates.base;

  // Build a flat list of rows (grouped, in display order) so we can virtualize.
  const flat = useMemo<FlatRow[]>(() => {
    const map = new Map<string, PriceRecord[]>();
    rows.forEach((r) => {
      const key = `${r.partNumber}__${r.contractNumber}__${r.supplier}__${r.dateFrom}__${r.dateTo}`;
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    });
    map.forEach((arr) => arr.sort((a, b) => a.quantityFrom - b.quantityFrom));
    const out: FlatRow[] = [];
    map.forEach((items) => {
      const isLot = items.length === 1 && items[0].lotPrice !== null;
      items.forEach((record, indexInGroup) =>
        out.push({ record, indexInGroup, groupSize: items.length, isLot }),
      );
    });
    return out;
  }, [rows]);

  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: flat.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 12,
  });

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">
        No records found.
      </div>
    );
  }

  const conv = (v: number | null | undefined, from: Currency | undefined) => {
    if (v === null || v === undefined) return null;
    return convertCurrency(v, from ?? display, display, rates);
  };

  const items = virtualizer.getVirtualItems();

  return (
    <div className="rounded-xl border bg-card overflow-hidden shadow-sm text-sm">
      <div className="overflow-x-auto">
        {/* Min width keeps columns from collapsing on narrow screens. */}
        <div style={{ minWidth: 1180 }}>
          {/* Header */}
          <div
            className="grid bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground border-b"
            style={{ gridTemplateColumns: GRID_COLS }}
          >
            <div className="px-3 py-2.5 flex items-center">
              <Checkbox checked={allChecked} onCheckedChange={(v) => onToggleAll(!!v)} />
            </div>
            <div className="px-3 py-2.5 font-medium">Contract Number</div>
            <div className="px-3 py-2.5 font-medium">Part Number</div>
            <div className="px-3 py-2.5 font-medium">Supplier</div>
            <div className="px-3 py-2.5 font-medium">Validity</div>
            <div className="px-3 py-2.5 font-medium text-right">Qty From</div>
            <div className="px-3 py-2.5 font-medium text-right">Qty To</div>
            <div className="px-3 py-2.5 font-medium text-right">Unit Price</div>
            <div className="px-3 py-2.5 font-medium text-right">Lot Price</div>
            <div className="px-3 py-2.5" />
          </div>

          {/* Virtualized body — caps height so the browser only paints what's visible. */}
          <div
            ref={parentRef}
            className="overflow-y-auto"
            style={{ height: Math.min(640, Math.max(240, flat.length * 44 + 8)) }}
          >
            <div
              style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}
            >
              {items.map((vi) => {
                const row = flat[vi.index];
                return (
                  <div
                    key={row.record.id}
                    ref={virtualizer.measureElement}
                    data-index={vi.index}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${vi.start}px)`,
                    }}
                  >
                    <Row
                      flat={row}
                      selected={selected.has(row.record.id)}
                      display={display}
                      conv={conv}
                      onToggle={onToggle}
                      onEdit={onEdit}
                      onDelete={(id) => onDelete([id])}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Single virtualized row. Uses native `title` attributes instead of Radix
 * tooltips so we don't mount a portal per cell across thousands of rows.
 */
function Row({
  flat,
  selected,
  display,
  conv,
  onToggle,
  onEdit,
  onDelete,
}: {
  flat: FlatRow;
  selected: boolean;
  display: Currency;
  conv: (v: number | null | undefined, from: Currency | undefined) => number | null;
  onToggle: (id: string) => void;
  onEdit: (r: PriceRecord) => void;
  onDelete: (id: string) => void;
}) {
  const r = flat.record;
  const i = flat.indexInGroup;
  const isLot = flat.isLot;
  const groupSize = flat.groupSize;

  const unitPrev =
    r.lastChangedAt && r.previousUnitPrice !== undefined && r.previousUnitPrice !== r.unitPrice
      ? `Previous: ${fmtMoney(conv(r.previousUnitPrice, r.currency), display)}` +
        (r.currency && r.currency !== display
          ? ` (orig ${fmtMoney(r.previousUnitPrice, r.currency)})`
          : "")
      : null;
  const lotPrev =
    r.lastChangedAt && r.previousLotPrice !== undefined && r.previousLotPrice !== r.lotPrice
      ? `Previous: ${fmtMoney(conv(r.previousLotPrice, r.currency), display)}` +
        (r.currency && r.currency !== display
          ? ` (orig ${fmtMoney(r.previousLotPrice, r.currency)})`
          : "")
      : null;

  return (
    <div
      className={`grid border-t hover:bg-secondary/40 transition-colors ${
        selected ? "bg-accent-soft/40" : ""
      }`}
      style={{ gridTemplateColumns: GRID_COLS }}
    >
      <div className="px-3 py-2.5 flex items-center">
        <Checkbox checked={selected} onCheckedChange={() => onToggle(r.id)} />
      </div>
      <div className="px-3 py-2.5">
        {i === 0 ? <span className="font-mono text-xs">{r.contractNumber}</span> : null}
      </div>
      <div className="px-3 py-2.5">
        {i === 0 ? (
          <div className="font-medium flex items-center gap-2">
            {r.partNumber}
            {isLot ? (
              <Badge variant="secondary" className="font-normal">Lot</Badge>
            ) : groupSize > 1 ? (
              <Badge variant="secondary" className="font-normal">{groupSize} tiers</Badge>
            ) : null}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground pl-3">↳</span>
        )}
      </div>
      <div className="px-3 py-2.5 truncate">{i === 0 ? r.supplier : ""}</div>
      <div className="px-3 py-2.5 text-xs text-muted-foreground num">
        {i === 0 ? `${fmtDate(r.dateFrom)} → ${fmtDate(r.dateTo)}` : ""}
      </div>
      <div className="px-3 py-2.5 text-right num">{fmtQty(r.quantityFrom)}</div>
      <div className="px-3 py-2.5 text-right num">{fmtQty(r.quantityTo)}</div>
      <div className="px-3 py-2.5 text-right num font-medium">
        <div className="flex items-center justify-end gap-1.5">
          {unitPrev && <History className="size-3 text-muted-foreground" aria-label={unitPrev} />}
          <span
            title={
              [
                unitPrev,
                r.currency && r.currency !== display
                  ? `Original: ${fmtMoney(r.unitPrice, r.currency)}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ") || undefined
            }
          >
            {fmtMoney(conv(r.unitPrice, r.currency), display)}
          </span>
        </div>
      </div>
      <div className="px-3 py-2.5 text-right num font-medium">
        <div className="flex items-center justify-end gap-1.5">
          {lotPrev && <History className="size-3 text-muted-foreground" aria-label={lotPrev} />}
          <span
            title={
              [
                lotPrev,
                r.currency && r.currency !== display
                  ? `Original: ${fmtMoney(r.lotPrice, r.currency)}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ") || undefined
            }
          >
            {fmtMoney(conv(r.lotPrice, r.currency), display)}
          </span>
        </div>
      </div>
      <div className="px-3 py-2.5 text-right">
        <div className="flex justify-end gap-0.5">
          <Button variant="ghost" size="icon" onClick={() => onEdit(r)} className="size-8">
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(r.id)}
            className="size-8 text-destructive hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}