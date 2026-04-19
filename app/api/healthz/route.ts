export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { metrics } from "@/lib/server/buffer";

export async function GET() {
  return new Response(
    JSON.stringify({
      ok: true,
      ingested: metrics.ingested,
      flushed: metrics.flushed,
      queued: metrics.queued,
      dropped: metrics.dropped,
      loki_errors: metrics.loki_errors,
      ch_errors: metrics.ch_errors,
    }),
    { headers: { "content-type": "application/json" } },
  );
}
