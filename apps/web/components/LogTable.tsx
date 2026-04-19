"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import clsx from "clsx";
import { fetchLogs, type LogFilters, type LogRow } from "@/lib/api";

const PAGE = 200;

export function LogTable({
  filters, live,
}: { filters: LogFilters; live: boolean }) {
  const [liveBuf, setLiveBuf] = useState<LogRow[]>([]);

  const q = useInfiniteQuery({
    queryKey: ["logs", filters],
    initialPageParam: 0,
    queryFn: ({ pageParam = 0 }) => fetchLogs({ ...filters, limit: PAGE, offset: pageParam as number }),
    getNextPageParam: (last, all) => (last.rows.length === PAGE ? all.length * PAGE : undefined),
  });

  // SSE live tail
  useEffect(() => {
    if (!live) { setLiveBuf([]); return; }
    const u = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && u.set(k, String(v)));
    const es = new EventSource(`/api/stream?${u.toString()}`);
    es.addEventListener("logs", (ev: MessageEvent) => {
      const rows = JSON.parse(ev.data) as LogRow[];
      setLiveBuf((prev) => [...rows.reverse(), ...prev].slice(0, 5000));
    });
    es.onerror = () => es.close();
    return () => es.close();
  }, [live, JSON.stringify(filters)]);

  const rows = useMemo<LogRow[]>(() => {
    const paged = q.data?.pages.flatMap((p) => p.rows) ?? [];
    return live ? [...liveBuf, ...paged] : paged;
  }, [q.data, liveBuf, live]);

  const parentRef = useRef<HTMLDivElement>(null);
  const v = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 30,
    overscan: 25,
  });

  return (
    <div className="overflow-hidden rounded-md border border-zinc-800 bg-zinc-950">
      <div className="grid grid-cols-[170px_70px_1fr_100px_180px_140px_120px] border-b border-zinc-800 bg-zinc-900/60 px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-500">
        <span>time</span><span>type</span><span>identifier</span>
        <span className="text-right pr-3">amount</span>
        <span>name</span><span>resource</span><span>server</span>
      </div>

      <div
        ref={parentRef}
        className="h-[70vh] overflow-auto"
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.scrollTop + el.clientHeight > el.scrollHeight - 200 && q.hasNextPage && !q.isFetchingNextPage) {
            q.fetchNextPage();
          }
        }}
      >
        <div style={{ height: v.getTotalSize(), position: "relative" }}>
          {v.getVirtualItems().map((item) => {
            const r = rows[item.index];
            if (!r) return null;
            return (
              <div
                key={item.key}
                style={{ position: "absolute", top: item.start, height: item.size, width: "100%" }}
                className={clsx(
                  "grid grid-cols-[170px_70px_1fr_100px_180px_140px_120px] items-center px-3 text-[12px]",
                  r.type === "remove" ? "text-rose-300" : "text-emerald-300",
                  item.index % 2 ? "bg-zinc-950" : "bg-zinc-900/30",
                )}
              >
                <span className="text-zinc-400">{new Date(r.ts).toISOString().replace("T", " ").slice(0, 23)}</span>
                <span className="font-bold uppercase">{r.type}</span>
                <span className="truncate">{r.identifier}</span>
                <span className="text-right pr-3 tabular-nums">{r.amount}</span>
                <span className="truncate">{r.name}</span>
                <span className="truncate text-zinc-400">{r.resource}</span>
                <span className="truncate text-zinc-500">{r.server_id}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-zinc-800 px-3 py-1.5 text-[11px] text-zinc-500">
        {rows.length} rows {q.isFetching && " · loading…"} {q.hasNextPage ? "" : " · end"}
      </div>
    </div>
  );
}
