import { useMemo, useRef, useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  /** Allow values that don't exist in `options`. Default: true. */
  allowFreeText?: boolean;
  /** Max items rendered in the dropdown to keep things responsive. */
  maxResults?: number;
  className?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * Searchable, type-ahead text input backed by an option list.
 * - Typing filters the dropdown (case-insensitive substring match).
 * - When `allowFreeText` is true, the typed value is committed even if it
 *   doesn't appear in the options. When false, only existing options can be
 *   selected (the free-typed text won't propagate as a value).
 * - Renders at most `maxResults` items (default 100) for large datasets.
 */
export default function ComboInput({
  value,
  onChange,
  options,
  placeholder,
  allowFreeText = true,
  maxResults = 100,
  className,
  disabled,
  id,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep query in sync when the parent resets the value externally.
  useEffect(() => {
    setQuery(value);
  }, [value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, maxResults);
    const out: string[] = [];
    for (let i = 0; i < options.length && out.length < maxResults; i++) {
      if (options[i].toLowerCase().includes(q)) out.push(options[i]);
    }
    return out;
  }, [options, query, maxResults]);

  const totalMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.length;
    let n = 0;
    for (const o of options) if (o.toLowerCase().includes(q)) n++;
    return n;
  }, [options, query]);

  const commit = (v: string) => {
    if (!allowFreeText) {
      const exists = options.some((o) => o.toLowerCase() === v.toLowerCase());
      if (!exists) {
        // Revert input to last valid value.
        setQuery(value);
        return;
      }
      // Use canonical casing from options.
      const canonical = options.find((o) => o.toLowerCase() === v.toLowerCase()) ?? v;
      onChange(canonical);
      setQuery(canonical);
      return;
    }
    onChange(v);
    setQuery(v);
  };

  const select = (v: string) => {
    onChange(v);
    setQuery(v);
    setOpen(false);
    // Return focus to input for fast keyboard flow.
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <div className={cn("relative", className)}>
        <PopoverTrigger asChild>
          <Input
            id={id}
            ref={inputRef}
            value={query}
            disabled={disabled}
            placeholder={placeholder}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!open) setOpen(true);
              if (allowFreeText) onChange(e.target.value);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              if (!allowFreeText) commit(query);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (filtered[0]) select(filtered[0]);
                else commit(query);
              } else if (e.key === "Escape") {
                setOpen(false);
              } else if (e.key === "ArrowDown") {
                setOpen(true);
              }
            }}
            className="pr-16"
            autoComplete="off"
          />
        </PopoverTrigger>
        {query && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-7 top-1/2 -translate-y-1/2 size-6"
            onClick={() => {
              setQuery("");
              onChange("");
              setOpen(true);
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
            tabIndex={-1}
          >
            <X className="size-3.5" />
          </Button>
        )}
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
      </div>
      <PopoverContent
        align="start"
        className="p-0 w-[--radix-popover-trigger-width] max-h-72 overflow-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="max-h-72 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              {options.length === 0 ? "No options yet" : "No matches"}
              {allowFreeText && query && (
                <div className="mt-1 text-foreground">Press Enter to use “{query}”.</div>
              )}
            </div>
          ) : (
            <>
              {filtered.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-1.5 text-sm text-left hover:bg-accent",
                    opt === value && "bg-accent/60",
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => select(opt)}
                >
                  <span className="truncate">{opt}</span>
                  {opt === value && <Check className="size-3.5 text-muted-foreground shrink-0" />}
                </button>
              ))}
              {totalMatches > filtered.length && (
                <div className="px-3 py-1.5 text-[11px] text-muted-foreground border-t">
                  Showing {filtered.length} of {totalMatches} matches — keep typing to narrow.
                </div>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}