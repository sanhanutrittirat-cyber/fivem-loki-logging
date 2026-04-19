"use client";
import { useState } from "react";
import type { LogFilters } from "@/lib/api";

export function FilterBar({
  value,
  onChange,
  live,
  onLiveToggle,
}: {
  value: LogFilters;
  onChange: (f: LogFilters) => void;
  live: boolean;
  onLiveToggle: (v: boolean) => void;
}) {
  const [draft, setDraft] = useState<LogFilters>(value);
  const apply = () => onChange(draft);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950 p-2 text-xs">
      <Input ph="identifier (steam:…)" v={draft.identifier} on={(v) => setDraft({ ...draft, identifier: v })} />
      <Input ph="name (bread, money…)"  v={draft.name}       on={(v) => setDraft({ ...draft, name: v })} />
      <Input ph="resource"              v={draft.resource}   on={(v) => setDraft({ ...draft, resource: v })} />

      <select
        className="rounded bg-zinc-900 px-2 py-1 text-zinc-200 outline-none"
        value={draft.type ?? ""}
        onChange={(e) => setDraft({ ...draft, type: (e.target.value || undefined) as LogFilters["type"] })}
      >
        <option value="">type: any</option>
        <option value="add">add</option>
        <option value="remove">remove</option>
      </select>

      <Input ph="amount >" v={draft.amount_gt} on={(v) => setDraft({ ...draft, amount_gt: v })} w="w-24" />
      <Input ph="amount <" v={draft.amount_lt} on={(v) => setDraft({ ...draft, amount_lt: v })} w="w-24" />
      <Input ph="amount =" v={draft.amount_eq} on={(v) => setDraft({ ...draft, amount_eq: v })} w="w-24" />

      <Input ph="from (ISO)" v={draft.from} on={(v) => setDraft({ ...draft, from: v })} w="w-44" />
      <Input ph="to (ISO)"   v={draft.to}   on={(v) => setDraft({ ...draft, to:   v })} w="w-44" />

      <Input ph="full-text search" v={draft.search} on={(v) => setDraft({ ...draft, search: v })} w="w-56" />

      <button
        onClick={apply}
        className="rounded bg-emerald-600 px-3 py-1 text-zinc-50 hover:bg-emerald-500"
      >Apply</button>
      <button
        onClick={() => { setDraft({}); onChange({}); }}
        className="rounded bg-zinc-800 px-3 py-1 text-zinc-200 hover:bg-zinc-700"
      >Clear</button>

      <label className="ml-auto flex items-center gap-2">
        <span className={live ? "text-emerald-400" : "text-zinc-500"}>● LIVE</span>
        <input type="checkbox" checked={live} onChange={(e) => onLiveToggle(e.target.checked)} />
      </label>
    </div>
  );
}

function Input({
  ph, v, on, w = "w-40",
}: { ph: string; v?: string; on: (v: string) => void; w?: string }) {
  return (
    <input
      placeholder={ph}
      value={v ?? ""}
      onChange={(e) => on(e.target.value)}
      className={`rounded bg-zinc-900 px-2 py-1 text-zinc-200 outline-none placeholder:text-zinc-600 ${w}`}
    />
  );
}
