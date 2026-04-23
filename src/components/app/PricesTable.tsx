import { useMemo } from "react";
import { Currency, PriceRecord } from "@/lib/types";
import { convertCurrency, fmtDate, fmtMoney, fmtQty } from "@/lib/format";
import { useData } from "@/contexts/DataContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  rows: PriceRecord[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  onEdit: (r: PriceRecord) => void;
  onDelete: (ids: string[]) => void;
}

export default function PricesTable({ rows, selected, onToggle, onToggleAll, onEdit, onDelete }: Props) {
  const { rates } = useData();
  const display: Currency = rates.base;
  const groups = useMemo(() => {
    const map = new Map<string, PriceRecord[]>();
    rows.forEach((r) => {
      const key = `${r.partNumber}__${r.contractNumber}__${r.supplier}`;
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    });
    map.forEach((arr) => arr.sort((a, b) => a.quantityFrom - b.quantityFrom));
    return Array.from(map.entries());
  }, [rows]);

  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">
        No records found.
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 w-10">
                <Checkbox checked={allChecked} onCheckedChange={(v) => onToggleAll(!!v)} />
              </th>
              <th className="px-3 py-2.5 text-left font-medium">Contract Number</th>
              <th className="px-3 py-2.5 text-left font-medium">Part Number</th>
              <th className="px-3 py-2.5 text-left font-medium">Supplier</th>
              <th className="px-3 py-2.5 text-left font-medium">Validity</th>
              <th className="px-3 py-2.5 text-right font-medium">Qty From</th>
              <th className="px-3 py-2.5 text-right font-medium">Qty To</th>
              <th className="px-3 py-2.5 text-right font-medium">Unit Price</th>
              <th className="px-3 py-2.5 text-right font-medium">Lot Price</th>
              <th className="px-3 py-2.5 w-24" />
            </tr>
          </thead>
          <tbody>
            {groups.map(([key, items]) => (
              <GroupRows key={key} items={items} selected={selected} onToggle={onToggle} onEdit={onEdit} onDelete={(id) => onDelete([id])} display={display} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GroupRows({ items, selected, onToggle, onEdit, onDelete, display }: {
  items: PriceRecord[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onEdit: (r: PriceRecord) => void;
  onDelete: (id: string) => void;
  display: Currency;
}) {
  const { rates } = useData();
  const head = items[0];
  const isLot = items.length === 1 && head.lotPrice !== null;
  const conv = (v: number | null | undefined, from: Currency | undefined) => {
    if (v === null || v === undefined) return null;
    return convertCurrency(v, from ?? display, display, rates);
  };
  return (
    <>
      {items.map((r, i) => (
        <tr key={r.id} className={`border-t hover:bg-secondary/40 transition-colors ${selected.has(r.id) ? "bg-accent-soft/40" : ""}`}>
          <td className="px-3 py-2.5">
            <Checkbox checked={selected.has(r.id)} onCheckedChange={() => onToggle(r.id)} />
          </td>
          <td className="px-3 py-2.5">
            {i === 0 ? (
              <span className="font-mono text-xs">{r.contractNumber}</span>
            ) : null}
          </td>
          <td className="px-3 py-2.5">
            {i === 0 ? (
              <div className="font-medium flex items-center gap-2">
                {r.partNumber}
                {isLot ? <Badge variant="secondary" className="font-normal">Lot</Badge> : items.length > 1 ? <Badge variant="secondary" className="font-normal">{items.length} tiers</Badge> : null}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground pl-3">↳</span>
            )}
          </td>
          <td className="px-3 py-2.5">{i === 0 ? r.supplier : ""}</td>
          <td className="px-3 py-2.5 text-xs text-muted-foreground num">
            {i === 0 ? `${fmtDate(r.dateFrom)} → ${fmtDate(r.dateTo)}` : ""}
          </td>
          <td className="px-3 py-2.5 text-right num">{fmtQty(r.quantityFrom)}</td>
          <td className="px-3 py-2.5 text-right num">{fmtQty(r.quantityTo)}</td>
          <td className="px-3 py-2.5 text-right num font-medium">
            <div className="flex items-center justify-end gap-1.5">
              {r.lastChangedAt && (r.previousUnitPrice !== undefined && r.previousUnitPrice !== r.unitPrice) && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <History className="size-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Previous: {fmtMoney(conv(r.previousUnitPrice, r.currency), display)}
                    {r.currency && r.currency !== display && (
                      <span className="block text-[10px] opacity-70">orig {fmtMoney(r.previousUnitPrice, r.currency)}</span>
                    )}
                  </TooltipContent>
                </Tooltip>
              )}
              <span title={r.currency && r.currency !== display ? `Original: ${fmtMoney(r.unitPrice, r.currency)}` : undefined}>
                {fmtMoney(conv(r.unitPrice, r.currency), display)}
              </span>
            </div>
          </td>
          <td className="px-3 py-2.5 text-right num font-medium">
            <div className="flex items-center justify-end gap-1.5">
              {r.lastChangedAt && (r.previousLotPrice !== undefined && r.previousLotPrice !== r.lotPrice) && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <History className="size-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Previous: {fmtMoney(conv(r.previousLotPrice, r.currency), display)}
                    {r.currency && r.currency !== display && (
                      <span className="block text-[10px] opacity-70">orig {fmtMoney(r.previousLotPrice, r.currency)}</span>
                    )}
                  </TooltipContent>
                </Tooltip>
              )}
              <span title={r.currency && r.currency !== display ? `Original: ${fmtMoney(r.lotPrice, r.currency)}` : undefined}>
                {fmtMoney(conv(r.lotPrice, r.currency), display)}
              </span>
            </div>
          </td>
          <td className="px-3 py-2.5 text-right">
            <div className="flex justify-end gap-0.5">
              <Button variant="ghost" size="icon" onClick={() => onEdit(r)} className="size-8"><Pencil className="size-3.5" /></Button>
              <Button variant="ghost" size="icon" onClick={() => onDelete(r.id)} className="size-8 text-destructive hover:text-destructive"><Trash2 className="size-3.5" /></Button>
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}