"use client";
import { useQuery } from "@tanstack/react-query";
import { fetchLogs, type LogRow } from "@/lib/api";

export default function PlayerPage({ params }: { params: { identifier: string } }) {
  const id = decodeURIComponent(params.identifier);
  const q = useQuery({
    queryKey: ["player", id],
    queryFn: () => fetchLogs({ identifier: id, limit: 500 }),
  });

  return (
    <div className="space-y-3">
      <h1 className="text-lg">Player <span className="text-emerald-400">{id}</span></h1>
      <div className="rounded-md border border-zinc-800 bg-zinc-950 p-2 text-xs">
        {q.data?.rows.map((r: LogRow, i: number) => (
          <div key={i} className={r.type === "remove" ? "text-rose-300" : "text-emerald-300"}>
            {new Date(r.ts).toISOString()} · {r.type.toUpperCase()} · {r.amount} × {r.name} ({r.resource})
          </div>
        ))}
      </div>
    </div>
  );
}
