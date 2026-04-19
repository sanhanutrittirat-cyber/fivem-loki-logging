-- Run on first ClickHouse boot. Database is created from CLICKHOUSE_DB env var.

CREATE TABLE IF NOT EXISTS tx_logs (
  ts          DateTime64(3) CODEC(Delta, ZSTD),
  identifier  LowCardinality(String),
  name        LowCardinality(String),
  amount      Int64,
  resource    LowCardinality(String),
  type        Enum8('add' = 1, 'remove' = 2),
  server_id   LowCardinality(String),
  char_id     String,
  reason      String,

  INDEX idx_identifier identifier TYPE bloom_filter(0.01) GRANULARITY 4,
  INDEX idx_name       name       TYPE bloom_filter(0.01) GRANULARITY 4,
  INDEX idx_reason_ft  reason     TYPE tokenbf_v1(8192, 3, 0) GRANULARITY 4
)
ENGINE = MergeTree
PARTITION BY toYYYYMMDD(ts)
ORDER BY (server_id, type, resource, ts)
TTL toDateTime(ts) + INTERVAL 90 DAY;

-- 5-minute rollup for fast top-K dashboards
CREATE MATERIALIZED VIEW IF NOT EXISTS tx_logs_5m
ENGINE = SummingMergeTree
PARTITION BY toYYYYMMDD(bucket)
ORDER BY (bucket, server_id, type, resource, name)
TTL toDateTime(bucket) + INTERVAL 365 DAY
AS
SELECT
  toStartOfFiveMinute(ts) AS bucket,
  server_id, type, resource, name,
  sum(amount) AS amount_sum,
  count()     AS cnt
FROM tx_logs
GROUP BY bucket, server_id, type, resource, name;

-- Per-player hourly rollup (for anomaly detection / player profile)
CREATE MATERIALIZED VIEW IF NOT EXISTS tx_logs_player_hourly
ENGINE = SummingMergeTree
PARTITION BY toYYYYMM(bucket)
ORDER BY (bucket, server_id, identifier, type)
TTL toDateTime(bucket) + INTERVAL 365 DAY
AS
SELECT
  toStartOfHour(ts) AS bucket,
  server_id, identifier, type,
  sum(abs(amount)) AS volume,
  count()          AS cnt
FROM tx_logs
GROUP BY bucket, server_id, identifier, type;
