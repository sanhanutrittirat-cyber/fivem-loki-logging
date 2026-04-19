export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { metrics } from "@/lib/server/buffer";

export async function GET() {
  const body = [
    `# HELP logwatch_ingested_total Logs accepted by /api/ingest`,
    `# TYPE logwatch_ingested_total counter`,
    `logwatch_ingested_total ${metrics.ingested}`,
    `# HELP logwatch_flushed_total Logs flushed to sinks`,
    `# TYPE logwatch_flushed_total counter`,
    `logwatch_flushed_total ${metrics.flushed}`,
    `# HELP logwatch_loki_errors_total Loki push errors`,
    `# TYPE logwatch_loki_errors_total counter`,
    `logwatch_loki_errors_total ${metrics.loki_errors}`,
    `# HELP logwatch_ch_errors_total ClickHouse insert errors`,
    `# TYPE logwatch_ch_errors_total counter`,
    `logwatch_ch_errors_total ${metrics.ch_errors}`,
    `# HELP logwatch_queued Current in-memory queue size`,
    `# TYPE logwatch_queued gauge`,
    `logwatch_queued ${metrics.queued}`,
    `# HELP logwatch_dropped_total Logs dropped due to queue overflow`,
    `# TYPE logwatch_dropped_total counter`,
    `logwatch_dropped_total ${metrics.dropped}`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "content-type": "text/plain" } });
}
