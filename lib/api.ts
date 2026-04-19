export type LogRow = {
  ts: string;
  identifier: string;
  name: string;
  amount: number;
  resource: string;
  type: "add" | "remove";
  server_id: string;
  char_id?: string;
  reason?: string;
};

export type LogFilters = Partial<{
  identifier: string;
  name: string;
  resource: string;
  type: "add" | "remove";
  amount_gt: string;
  amount_lt: string;
  amount_eq: string;
  from: string;
  to: string;
  search: string;
  server_id: string;
}>;

function buildQuery(params: Record<string, string | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) u.set(k, v);
  const s = u.toString();
  return s ? `?${s}` : "";
}

export async function fetchLogs(filters: LogFilters & { limit?: number; offset?: number }) {
  const r = await fetch(
    `/api/logs${buildQuery({ ...filters, limit: String(filters.limit ?? 200), offset: String(filters.offset ?? 0) })}`,
  );
  if (!r.ok) throw new Error(`logs ${r.status}`);
  return (await r.json()) as { rows: LogRow[]; limit: number; offset: number };
}

export async function fetchOverview(range = "1h", server_id?: string) {
  const r = await fetch(`/api/stats/overview${buildQuery({ range, server_id })}`);
  if (!r.ok) throw new Error(`stats ${r.status}`);
  return r.json() as Promise<{
    range: string;
    ratio: { type: "add" | "remove"; c: number; s: number }[];
    topItems: { name: string; type: "add" | "remove"; s: number; n: number }[];
    topResources: { resource: string; c: number }[];
    topPlayers: { identifier: string; v: number; n: number }[];
    series: { bucket: string; type: "add" | "remove"; c: number }[];
  }>;
}
