"use client";
import { useQuery } from "@tanstack/react-query";
import { fetchOverview } from "@/lib/api";
import {
  Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
  Line, LineChart,
} from "recharts";

export function StatCards({ range = "1h" }: { range?: string }) {
  const q = useQuery({
    queryKey: ["overview", range],
    queryFn: () => fetchOverview(range),
    refetchInterval: 15_000,
  });

  if (!q.data) return <div className="text-zinc-500">loading stats…</div>;

  const adds = q.data.ratio.find((r) => r.type === "add")?.c ?? 0;
  const rems = q.data.ratio.find((r) => r.type === "remove")?.c ?? 0;
  const total = adds + rems || 1;

  // pivot series for chart
  const seriesMap = new Map<string, { bucket: string; add: number; remove: number }>();
  for (const p of q.data.series) {
    const k = p.bucket;
    const cur = seriesMap.get(k) ?? { bucket: k, add: 0, remove: 0 };
    cur[p.type] = Number(p.c);
    seriesMap.set(k, cur);
  }
  const series = [...seriesMap.values()];

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      <Card title={`Add vs Remove (${range})`}>
        <div className="flex items-baseline gap-3">
          <span className="text-3xl text-emerald-400">{adds.toLocaleString()}</span>
          <span className="text-zinc-500">/</span>
          <span className="text-3xl text-rose-400">{rems.toLocaleString()}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded bg-zinc-800">
          <div className="h-full bg-emerald-500" style={{ width: `${(adds / total) * 100}%` }} />
        </div>
        <div className="mt-3 h-20">
          <ResponsiveContainer>
            <LineChart data={series}>
              <XAxis dataKey="bucket" hide />
              <YAxis hide />
              <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a" }} />
              <Line type="monotone" dataKey="add" stroke="#34d399" dot={false} strokeWidth={1.5} />
              <Line type="monotone" dataKey="remove" stroke="#fb7185" dot={false} strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Top items">
        <BarPanel data={q.data.topItems.slice(0, 8).map((i) => ({ name: `${i.name} (${i.type})`, v: Number(i.n) }))} />
      </Card>

      <Card title="Top resources">
        <BarPanel data={q.data.topResources.slice(0, 8).map((i) => ({ name: i.resource, v: Number(i.c) }))} />
      </Card>

      <Card title="Top players (volume)">
        <BarPanel data={q.data.topPlayers.slice(0, 8).map((i) => ({ name: i.identifier, v: Number(i.v) }))} />
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
      <div className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500">{title}</div>
      {children}
    </div>
  );
}

function BarPanel({ data }: { data: { name: string; v: number }[] }) {
  return (
    <div className="h-44">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 8 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={140} tick={{ fill: "#a1a1aa", fontSize: 10 }} />
          <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a" }} />
          <Bar dataKey="v" fill="#3f3f46" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
