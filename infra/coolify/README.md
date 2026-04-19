# Coolify deploy guide (new services only)

Loki & Grafana are already deployed and untouched. You're adding 4 new services
on Coolify, all on the **same internal Docker network** as Loki so the API can
reach `http://loki:3100` privately.

## Order

1. **clickhouse** (`clickhouse.compose.yml`)
   - Set secret: `CLICKHOUSE_PASSWORD`
   - Mount `infra/clickhouse/init.sql` into the container's
     `/docker-entrypoint-initdb.d/init.sql` (Coolify → Volumes / File mounts).
   - No public domain. Internal hostname: `clickhouse`.

2. **redis** (`redis.compose.yml`)
   - No public domain. Internal hostname: `redis`.
   - (Skip if you already run Redis on Coolify; reuse its URL.)

3. **api** (`api.compose.yml`)
   - Build from this repo: `apps/api/Dockerfile` (or push image to GHCR/Docker Hub).
   - Public domain: e.g. `logs.example.com` (Coolify auto Let's Encrypt).
   - Required env vars:
     ```
     INGEST_API_TOKEN=<32+ random chars>
     INGEST_RPS=300
     SERVER_SECRETS_JSON={"srv-eu-1":"...","srv-na-1":"..."}
     LOKI_URL=http://loki:3100
     LOKI_TENANT_ID=fivem            # only if multi-tenant
     LOKI_USERNAME=                   # only if Loki has basic auth
     LOKI_PASSWORD=
     CLICKHOUSE_URL=http://clickhouse:8123
     CLICKHOUSE_USER=logwatch
     CLICKHOUSE_PASSWORD=...
     REDIS_URL=redis://redis:6379
     ```
   - Health check: `/healthz` (already in Dockerfile).
   - Restart policy: `unless-stopped`.

4. **web** (`web.compose.yml`)
   - Build from `apps/web/Dockerfile`.
   - Public domain: e.g. `watcher.example.com`.
   - Env:
     ```
     NEXT_PUBLIC_API_BASE=https://logs.example.com   # for the browser
     API_INTERNAL_URL=http://api:8080                # for Next.js server-side rewrites
     ```

## Networking

All four containers (clickhouse, redis, api, web) **and** the existing
loki/grafana containers must share the same Docker network in Coolify so
short-name DNS works (`loki`, `clickhouse`, `redis`, `api`).
In Coolify: Application → Network → attach to the existing Loki/Grafana network.

## Smoke test

```
TOKEN=...
SECRET=...
BODY='{"logs":[{"identifier":"steam:11000010xxxxxxx","name":"bread","amount":5,"resource":"esx_jobs","type":"add"}]}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -hex | awk '{print $2}')
curl -i https://logs.example.com/ingest \
  -H "X-Ingest-Token: $TOKEN" \
  -H "X-Server-Id: srv-eu-1" \
  -H "X-Signature: $SIG" \
  -H 'Content-Type: application/json' \
  -d "$BODY"
# expect: 202 {"accepted":1}
```

Confirm in ClickHouse:
```
docker exec -it <clickhouse> clickhouse-client -u logwatch --password
SELECT * FROM logwatch.tx_logs ORDER BY ts DESC LIMIT 5;
```

Confirm in Grafana Explore (Loki datasource):
```
{job="fivem_logs"} | json
```

## Backups & retention

- ClickHouse hot data: 90d via `TTL` on `tx_logs`.
- ClickHouse rollups: 365d.
- Schedule nightly backup:
  ```
  BACKUP DATABASE logwatch TO Disk('backups', 'nightly_{{date}}');
  ```
  Push backup volume to S3 (Coolify scheduled task or external job).
- Redis: ephemeral, no backup.
- Loki: keep retention as already configured in your existing Loki.

## Monitoring

The API exposes Prometheus metrics at `/metrics`:
- `logwatch_ingested_total`
- `logwatch_flushed_total`
- `logwatch_loki_errors_total`
- `logwatch_ch_errors_total`
- `logwatch_queued`
- `logwatch_dropped_total`

Add a Prometheus scrape job (or use Grafana Agent) and build a dashboard.

## Environments

| env     | api domain         | web domain            | Loki tenant |
|---------|--------------------|-----------------------|-------------|
| dev     | localhost:8080     | localhost:3000        | dev         |
| staging | logs-stg.example   | watcher-stg.example   | staging     |
| prod    | logs.example       | watcher.example       | prod        |

Promote by image tag (`:staging-<sha>` → `:prod-<sha>`) via CI → Coolify deploy webhook.
