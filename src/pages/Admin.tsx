import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import AppLayout from "@/components/app/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Contract, Currency, CURRENCIES, ExchangeRates, PriceRecord } from "@/lib/types";
import { fmtDateTime, fmtMoney, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { ArrowLeftRight, FileText, History, Image as ImageIcon, KeyRound, Pencil, Plus, RefreshCw, Trash2, Undo2, Upload, Users as UsersIcon, Lock } from "lucide-react";
import { useBrandLogo, fileToDataUrl } from "@/hooks/useBrandLogo";
import { Checkbox } from "@/components/ui/checkbox";
import { SYSTEMS } from "@/lib/systems";
import { api, apiEnabled } from "@/lib/api";
import { AppUser } from "@/lib/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Admin() {
  const { isAdmin, user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Administration</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage contracts, exchange rates and review price update history.
          </p>
        </header>

        <Tabs defaultValue="contracts" className="space-y-4">
          <TabsList>
            <TabsTrigger value="contracts">
              <FileText className="size-4" /> Contracts
            </TabsTrigger>
            <TabsTrigger value="rates">
              <ArrowLeftRight className="size-4" /> Exchange Rates
            </TabsTrigger>
            <TabsTrigger value="users">
              <UsersIcon className="size-4" /> Users
            </TabsTrigger>
            <TabsTrigger value="access">
              <KeyRound className="size-4" /> Access
            </TabsTrigger>
            <TabsTrigger value="branding">
              <ImageIcon className="size-4" /> Branding
            </TabsTrigger>
            <TabsTrigger value="log">
              <History className="size-4" /> Activity Log
            </TabsTrigger>
            <TabsTrigger value="price-history">
              <Undo2 className="size-4" /> Price History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contracts">
            <ContractsTab />
          </TabsContent>
          <TabsContent value="rates">
            <RatesTab />
          </TabsContent>
          <TabsContent value="users">
            <UsersTab />
          </TabsContent>
          <TabsContent value="access">
            <AccessTab />
          </TabsContent>
          <TabsContent value="branding">
            <BrandingTab />
          </TabsContent>
          <TabsContent value="log">
            <ActivityLogTab />
          </TabsContent>
          <TabsContent value="price-history">
            <PriceHistoryTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

/* ---------------- Contracts ---------------- */
function ContractsTab() {
  const { contracts, addContract, updateContract, deleteContract, prices } = useData();
  const [editing, setEditing] = useState<Contract | null>(null);
  const [open, setOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState<Contract | null>(null);

  const usage = useMemo(() => {
    const m = new Map<string, number>();
    prices.forEach((p) => m.set(p.contractNumber, (m.get(p.contractNumber) ?? 0) + 1));
    return m;
  }, [prices]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground num">{contracts.length} contract(s)</p>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="size-4" /> New contract
        </Button>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium">Contract Number</th>
              <th className="px-3 py-2.5 text-left font-medium">Description</th>
              <th className="px-3 py-2.5 text-left font-medium">Currency</th>
              <th className="px-3 py-2.5 text-right font-medium">Records</th>
              <th className="px-3 py-2.5 w-24" />
            </tr>
          </thead>
          <tbody>
            {contracts.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">No contracts.</td></tr>
            )}
            {contracts.map((c) => (
              <tr key={c.id} className="border-t hover:bg-secondary/40">
                <td className="px-3 py-2.5 font-mono text-xs">{c.contractNumber}</td>
                <td className="px-3 py-2.5">{c.description || <span className="text-muted-foreground">—</span>}</td>
                <td className="px-3 py-2.5"><Badge variant="secondary" className="font-mono">{c.currency}</Badge></td>
                <td className="px-3 py-2.5 text-right num">{usage.get(c.contractNumber) ?? 0}</td>
                <td className="px-3 py-2.5 text-right">
                  <div className="flex justify-end gap-0.5">
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => { setEditing(c); setOpen(true); }}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" onClick={() => setConfirmDel(c)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ContractDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSubmit={(data) => {
          if (editing) {
            updateContract(editing.id, data);
            toast.success("Contract updated.");
          } else {
            if (contracts.some((c) => c.contractNumber.toLowerCase() === data.contractNumber.toLowerCase())) {
              toast.error("Contract number already exists.");
              return false;
            }
            addContract(data);
            toast.success("Contract created.");
          }
          return true;
        }}
      />

      <AlertDialog open={!!confirmDel} onOpenChange={(v) => !v && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete contract?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDel && usage.get(confirmDel.contractNumber)
                ? `This contract is used by ${usage.get(confirmDel.contractNumber)} price record(s). Those records will keep the contract number text but lose the link.`
                : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmDel) {
                  deleteContract(confirmDel.id);
                  toast.success("Contract deleted.");
                }
                setConfirmDel(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function ContractDialog({
  open,
  onOpenChange,
  editing,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Contract | null;
  onSubmit: (data: { contractNumber: string; description: string; currency: Currency }) => boolean;
}) {
  const [contractNumber, setContractNumber] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState<Currency>("USD");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setContractNumber(editing.contractNumber);
      setDescription(editing.description);
      setCurrency(editing.currency);
    } else {
      setContractNumber("");
      setDescription("");
      setCurrency("USD");
    }
  }, [open, editing]);

  const submit = () => {
    if (!contractNumber.trim()) return toast.error("Contract Number is required.");
    const ok = onSubmit({ contractNumber: contractNumber.trim(), description: description.trim(), currency });
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit contract" : "New contract"}</DialogTitle>
          <DialogDescription>
            Contracts hold the currency that price records inherit when registered.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Contract Number</Label>
            <Input value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} placeholder="CT-2026-001" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Currency</Label>
            <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>{editing ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Rates ---------------- */
function RatesTab() {
  const { rates, setRates } = useData();
  const [draft, setDraft] = useState<ExchangeRates>(rates);

  useEffect(() => { setDraft(rates); }, [rates]);

  const save = () => {
    for (const c of CURRENCIES) {
      if (!draft.rates[c] || draft.rates[c] <= 0) {
        return toast.error(`Rate for ${c} must be positive.`);
      }
    }
    if (draft.rates[draft.base] !== 1) {
      return toast.error(`Base currency (${draft.base}) must have rate = 1.`);
    }
    setRates(draft);
    toast.success("Exchange rates updated.");
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-6 space-y-4 shadow-sm">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-1.5 max-w-xs flex-1">
            <Label className="text-xs text-muted-foreground">Base currency</Label>
            <Select
              value={draft.base}
              onValueChange={(v) => {
                const newBase = v as Currency;
                // rebase: divide all rates by current rate of newBase
                const factor = draft.rates[newBase];
                const next: Record<Currency, number> = { ...draft.rates };
                if (factor && factor !== 1) {
                  for (const c of CURRENCIES) next[c] = +(draft.rates[c] / factor).toFixed(6);
                }
                next[newBase] = 1;
                setDraft({ ...draft, base: newBase, rates: next });
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Last update: <span className="num">{fmtDateTime(draft.updatedAt)}</span>
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {CURRENCIES.map((c) => (
            <div key={c} className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                1 {draft.base} = ? {c} {c === draft.base && <span className="text-[10px]">(base)</span>}
              </Label>
              <Input
                type="number"
                step="0.0001"
                value={draft.rates[c]}
                disabled={c === draft.base}
                onChange={(e) => setDraft({ ...draft, rates: { ...draft.rates, [c]: Number(e.target.value) } })}
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setDraft(rates)}>
            <RefreshCw className="size-4" /> Reset
          </Button>
          <Button size="sm" onClick={save}>Save rates</Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground mb-1">How conversions work</p>
        <p>
          Each rate represents how many units of that currency equal <span className="font-mono">1 {draft.base}</span>.
          To convert between two non-base currencies the system uses cross-rate:
          <span className="font-mono"> amount × (rate[to] / rate[from])</span>.
        </p>
      </div>
    </div>
  );
}

/* ---------------- Activity Log ---------------- */
function ActivityLogTab() {
  const { auditLog } = useData();
  const [filter, setFilter] = useState("");

  const filtered = useMemo(
    () =>
      auditLog.filter((e) =>
        !filter
          ? true
          : `${e.user} ${e.action} ${e.summary}`.toLowerCase().includes(filter.toLowerCase()),
      ),
    [auditLog, filter],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Input
          placeholder="Filter by user, action or text…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
        />
        <p className="text-sm text-muted-foreground num">{filtered.length} entry(ies)</p>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium">When</th>
              <th className="px-3 py-2.5 text-left font-medium">User</th>
              <th className="px-3 py-2.5 text-left font-medium">Action</th>
              <th className="px-3 py-2.5 text-left font-medium">Summary</th>
              <th className="px-3 py-2.5 text-right font-medium">Records</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">No activity.</td></tr>
            )}
            {filtered.map((e) => (
              <tr key={e.id} className="border-t hover:bg-secondary/40">
                <td className="px-3 py-2.5 num text-xs text-muted-foreground whitespace-nowrap">{fmtDateTime(e.at)}</td>
                <td className="px-3 py-2.5 font-mono text-xs">{e.user}</td>
                <td className="px-3 py-2.5"><Badge variant="secondary" className="font-mono text-[10px]">{e.action}</Badge></td>
                <td className="px-3 py-2.5">{e.summary}</td>
                <td className="px-3 py-2.5 text-right num text-xs text-muted-foreground">{e.affectedIds?.length ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Price History ---------------- */
function PriceHistoryTab() {
  const { prices, revertPrice } = useData();

  const changed = useMemo(
    () =>
      prices
        .filter((p) => p.lastChangedAt)
        .sort((a, b) => (b.lastChangedAt ?? "").localeCompare(a.lastChangedAt ?? "")),
    [prices],
  );

  const onRevert = (p: PriceRecord) => {
    const ok = revertPrice(p.id);
    if (ok) toast.success("Reverted to previous values.");
    else toast.error("No previous values to revert.");
  };

  const hasPrev = (p: PriceRecord) =>
    p.previousUnitPrice !== undefined ||
    p.previousLotPrice !== undefined ||
    p.previousDateFrom !== undefined ||
    p.previousDateTo !== undefined;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Records that have been modified. Each row shows current vs. previous values; click revert to roll back the last change.
      </p>

      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium">Changed at</th>
              <th className="px-3 py-2.5 text-left font-medium">By</th>
              <th className="px-3 py-2.5 text-left font-medium">Contract / Part</th>
              <th className="px-3 py-2.5 text-left font-medium">Field</th>
              <th className="px-3 py-2.5 text-right font-medium">Previous</th>
              <th className="px-3 py-2.5 text-right font-medium">Current</th>
              <th className="px-3 py-2.5 w-24" />
            </tr>
          </thead>
          <tbody>
            {changed.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No changes recorded yet.</td></tr>
            )}
            {changed.flatMap((p) => {
              const rows: { field: string; prev: string; curr: string }[] = [];
              const cur = p.currency ?? "USD";
              if (p.previousUnitPrice !== undefined && p.previousUnitPrice !== p.unitPrice) {
                rows.push({ field: "Unit Price", prev: fmtMoney(p.previousUnitPrice, cur), curr: fmtMoney(p.unitPrice, cur) });
              }
              if (p.previousLotPrice !== undefined && p.previousLotPrice !== p.lotPrice) {
                rows.push({ field: "Lot Price", prev: fmtMoney(p.previousLotPrice, cur), curr: fmtMoney(p.lotPrice, cur) });
              }
              if (p.previousDateFrom && p.previousDateFrom !== p.dateFrom) {
                rows.push({ field: "Date From", prev: fmtDate(p.previousDateFrom), curr: fmtDate(p.dateFrom) });
              }
              if (p.previousDateTo && p.previousDateTo !== p.dateTo) {
                rows.push({ field: "Date To", prev: fmtDate(p.previousDateTo), curr: fmtDate(p.dateTo) });
              }
              if (rows.length === 0) return [];
              return rows.map((r, i) => (
                <tr key={`${p.id}-${i}`} className="border-t hover:bg-secondary/40">
                  {i === 0 ? (
                    <>
                      <td rowSpan={rows.length} className="px-3 py-2.5 num text-xs text-muted-foreground whitespace-nowrap align-top">{fmtDateTime(p.lastChangedAt!)}</td>
                      <td rowSpan={rows.length} className="px-3 py-2.5 font-mono text-xs align-top">{p.lastChangedBy ?? "—"}</td>
                      <td rowSpan={rows.length} className="px-3 py-2.5 align-top">
                        <div className="font-mono text-xs">{p.contractNumber}</div>
                        <div className="font-medium">{p.partNumber}</div>
                      </td>
                    </>
                  ) : null}
                  <td className="px-3 py-2.5 text-xs">{r.field}</td>
                  <td className="px-3 py-2.5 text-right num text-muted-foreground line-through">{r.prev}</td>
                  <td className="px-3 py-2.5 text-right num font-medium">{r.curr}</td>
                  {i === 0 ? (
                    <td rowSpan={rows.length} className="px-3 py-2.5 text-right align-top">
                      <Button variant="ghost" size="sm" disabled={!hasPrev(p)} onClick={() => onRevert(p)}>
                        <Undo2 className="size-3.5" /> Revert
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Access (per-user system grants) ---------------- */
function AccessTab() {
  const { users } = useData();
  const { setUserSystems } = useAuth();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Toggle which systems each user can open from the portal. Admins always
        have access to every system regardless of these checkboxes.
      </p>

      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium">User</th>
              <th className="px-3 py-2.5 text-left font-medium">Role</th>
              {SYSTEMS.map((s) => (
                <th key={s.key} className="px-3 py-2.5 text-center font-medium">
                  <div className="flex flex-col items-center gap-0.5">
                    <span>{s.name}</span>
                    {s.status === "coming-soon" && (
                      <span className="text-[9px] font-normal normal-case text-muted-foreground">
                        coming soon
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={2 + SYSTEMS.length} className="px-3 py-8 text-center text-muted-foreground">
                  No users.
                </td>
              </tr>
            )}
            {users.map((u) => {
              const isAdminUser = (u.role ?? "").toLowerCase() === "admin";
              const granted = new Set(u.systems ?? []);
              return (
                <tr key={u.username} className="border-t hover:bg-secondary/40">
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{u.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{u.username}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant={isAdminUser ? "default" : "secondary"} className="font-mono text-[10px]">
                      {u.role}
                    </Badge>
                  </td>
                  {SYSTEMS.map((s) => {
                    const checked = isAdminUser || granted.has(s.key);
                    return (
                      <td key={s.key} className="px-3 py-2.5 text-center">
                        <Checkbox
                          checked={checked}
                          disabled={isAdminUser}
                          onCheckedChange={async (v) => {
                            const next = new Set(u.systems ?? []);
                            if (v) next.add(s.key);
                            else next.delete(s.key);
                            await setUserSystems(u.username, Array.from(next));
                            toast.success(
                              `${v ? "Granted" : "Revoked"} ${s.name} for ${u.username}.`,
                            );
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Users (CRUD + reset password) ---------------- */
function UsersTab() {
  const { users, reloadUsers, setUsers } = useData();
  const { user: currentUser } = useAuth();
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [resetting, setResetting] = useState<AppUser | null>(null);
  const [confirmDel, setConfirmDel] = useState<AppUser | null>(null);

  const apiOn = apiEnabled();

  return (
    <div className="space-y-4">
      {!apiOn && (
        <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Backend API not configured (<span className="font-mono">VITE_API_URL</span>). Changes here will only update the
          in-memory list and won't persist.
        </div>
      )}
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground num">{users.length} user(s)</p>
        <Button size="sm" onClick={() => { setEditing(null); setOpenForm(true); }}>
          <Plus className="size-4" /> New user
        </Button>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium">Name</th>
              <th className="px-3 py-2.5 text-left font-medium">Username</th>
              <th className="px-3 py-2.5 text-left font-medium">Email</th>
              <th className="px-3 py-2.5 text-left font-medium">Role</th>
              <th className="px-3 py-2.5 text-left font-medium">Systems</th>
              <th className="px-3 py-2.5 w-32" />
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No users.</td></tr>
            )}
            {users.map((u) => {
              const isAdminUser = (u.role ?? "").toLowerCase() === "admin";
              return (
                <tr key={u.username} className="border-t hover:bg-secondary/40">
                  <td className="px-3 py-2.5 font-medium">{u.name || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-2.5 font-mono text-xs">{u.username}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{u.email || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant={isAdminUser ? "default" : "secondary"} className="font-mono text-[10px]">
                      {u.role}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    {isAdminUser ? (
                      <span className="text-xs text-muted-foreground italic">all (admin)</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {(u.systems ?? []).length === 0 ? (
                          <span className="text-xs text-muted-foreground">none</span>
                        ) : (
                          (u.systems ?? []).map((k) => (
                            <Badge key={k} variant="outline" className="font-mono text-[10px]">{k}</Badge>
                          ))
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex justify-end gap-0.5">
                      <Button variant="ghost" size="icon" className="size-8" title="Edit"
                        onClick={() => { setEditing(u); setOpenForm(true); }}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8" title="Reset password"
                        onClick={() => setResetting(u)}>
                        <Lock className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive"
                        title="Delete"
                        disabled={currentUser?.username.toLowerCase() === u.username.toLowerCase()}
                        onClick={() => setConfirmDel(u)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <UserFormDialog
        open={openForm}
        onOpenChange={setOpenForm}
        editing={editing}
        existingUsernames={users.map((u) => u.username.toLowerCase())}
        onSubmit={async (data) => {
          try {
            if (editing) {
              if (apiOn) {
                await api.updateUser(editing.username, {
                  name: data.name,
                  email: data.email,
                  role: data.role,
                });
                await reloadUsers();
              } else {
                setUsers(users.map((u) =>
                  u.username === editing.username
                    ? { ...u, name: data.name, email: data.email, role: data.role }
                    : u,
                ));
              }
              toast.success("User updated.");
            } else {
              if (apiOn) {
                await api.createUser({
                  username: data.username,
                  password: data.password,
                  name: data.name,
                  email: data.email,
                  role: data.role,
                  systems: data.systems,
                });
                await reloadUsers();
              } else {
                setUsers([...users, {
                  username: data.username,
                  password: data.password,
                  name: data.name,
                  email: data.email,
                  role: data.role,
                  systems: data.systems,
                }]);
              }
              toast.success("User created.");
            }
            return true;
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to save user.");
            return false;
          }
        }}
      />

      <ResetPasswordDialog
        user={resetting}
        onClose={() => setResetting(null)}
        onSubmit={async (password) => {
          if (!resetting) return false;
          try {
            if (apiOn) {
              await api.resetUserPassword(resetting.username, password);
            } else {
              setUsers(users.map((u) =>
                u.username === resetting.username ? { ...u, password } : u,
              ));
            }
            toast.success(`Password reset for ${resetting.username}.`);
            return true;
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to reset password.");
            return false;
          }
        }}
      />

      <AlertDialog open={!!confirmDel} onOpenChange={(v) => !v && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDel && `User "${confirmDel.username}" will be removed along with their system grants. This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!confirmDel) return;
                try {
                  if (apiOn) {
                    await api.deleteUser(confirmDel.username);
                    await reloadUsers();
                  } else {
                    setUsers(users.filter((u) => u.username !== confirmDel.username));
                  }
                  toast.success("User deleted.");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed to delete user.");
                }
                setConfirmDel(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UserFormDialog({
  open,
  onOpenChange,
  editing,
  existingUsernames,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: AppUser | null;
  existingUsernames: string[];
  onSubmit: (data: {
    username: string;
    password: string;
    name: string;
    email: string;
    role: string;
    systems: string[];
  }) => Promise<boolean>;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("user");
  const [systems, setSystems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setUsername(editing.username);
      setPassword("");
      setName(editing.name);
      setEmail(editing.email ?? "");
      setRole(editing.role || "user");
      setSystems(editing.systems ?? []);
    } else {
      setUsername("");
      setPassword("");
      setName("");
      setEmail("");
      setRole("user");
      setSystems([]);
    }
  }, [open, editing]);

  const submit = async () => {
    if (!editing) {
      if (!username.trim()) return toast.error("Username is required.");
      if (existingUsernames.includes(username.trim().toLowerCase())) {
        return toast.error("Username already exists.");
      }
      if (!password || password.length < 4) {
        return toast.error("Password must be at least 4 characters.");
      }
    }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      return toast.error("Invalid email format.");
    }
    setBusy(true);
    const ok = await onSubmit({
      username: username.trim(),
      password,
      name: name.trim(),
      email: email.trim(),
      role: role.trim().toLowerCase(),
      systems,
    });
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  const isAdminRole = role.toLowerCase() === "admin";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? `Edit user · ${editing.username}` : "New user"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update profile fields. Use the lock icon on the list to reset the password."
              : "Create a new account. The password can be changed later from the list."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Username</Label>
              <Input
                value={username}
                disabled={!!editing}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="jdoe"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">user</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Full name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
            />
          </div>
          {!editing && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Initial password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 4 characters"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">System access</Label>
            {isAdminRole ? (
              <p className="text-xs text-muted-foreground italic">
                Admins automatically have access to every system.
              </p>
            ) : (
              <div className="rounded-md border bg-background p-2 space-y-1.5 max-h-44 overflow-auto">
                {SYSTEMS.map((s) => {
                  const checked = systems.includes(s.key);
                  return (
                    <label key={s.key} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-secondary/40 rounded px-1.5 py-1">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          if (v) setSystems([...systems, s.key]);
                          else setSystems(systems.filter((k) => k !== s.key));
                        }}
                      />
                      <span className="flex-1">{s.name}</span>
                      {s.status === "coming-soon" && (
                        <span className="text-[10px] text-muted-foreground">coming soon</span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{editing ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  user,
  onClose,
  onSubmit,
}: {
  user: AppUser | null;
  onClose: () => void;
  onSubmit: (password: string) => Promise<boolean>;
}) {
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) { setPwd(""); setConfirm(""); }
  }, [user]);

  const submit = async () => {
    if (!pwd || pwd.length < 4) return toast.error("Password must be at least 4 characters.");
    if (pwd !== confirm) return toast.error("Passwords do not match.");
    setBusy(true);
    const ok = await onSubmit(pwd);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Dialog open={!!user} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            Set a new password for <span className="font-mono">{user?.username}</span>. The user will need it on the next login.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">New password</Label>
            <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Confirm password</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>Reset password</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
