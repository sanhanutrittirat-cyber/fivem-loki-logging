"use client";
import { useState } from "react";
import { StatCards } from "@/components/StatCards";

const RANGES = ["15m", "1h", "6h", "24h", "7d"] as const;

export default function OverviewPage() {
  const [range, setRange] = useState<(typeof RANGES)[number]>("1h");
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-zinc-500">range:</span>
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`rounded px-2 py-1 ${r === range ? "bg-emerald-600 text-white" : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"}`}
          >{r}</button>
        ))}
      </div>
      <StatCards range={range} />
    </div>
  );
}
