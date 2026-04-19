"use client";
import { useState } from "react";
import { FilterBar } from "@/components/FilterBar";
import { LogTable } from "@/components/LogTable";
import type { LogFilters } from "@/lib/api";

export default function WatcherPage() {
  const [filters, setFilters] = useState<LogFilters>({});
  const [live, setLive] = useState(true);
  return (
    <div className="space-y-3">
      <FilterBar value={filters} onChange={setFilters} live={live} onLiveToggle={setLive} />
      <LogTable filters={filters} live={live} />
    </div>
  );
}
