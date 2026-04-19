# FiveM Log Watcher

Production log watcher for FiveM/es_extended item, weapon, and money transactions.
Ships logs to an existing **Loki** (cheap raw store, queried via existing Grafana)
and to **ClickHouse** (fast filter + aggregate for the custom dashboard).

```
FiveM  ──HTTPS──▶  apps/api (Fastify)  ──┬──▶  Loki (existing)
                                          ├──▶  ClickHouse
                                          └──▶  Redis (rate-limit + cache)
                                                 │
                                       apps/web (Next.js watcher) ◀──── HTTP/SSE
```

## Layout

```
apps/api          Fastify ingest + query API (TypeScript)
apps/web          Next.js 14 watcher dashboard
infra/clickhouse  init.sql (schema + rollups + TTL)
infra/coolify     docker-compose stacks for Coolify
fivem/logwatch_client  Drop-in FiveM resource (Lua sender)
```

## Quick start (local dev)

```bash
cp .env.example .env
docker compose -f infra/coolify/clickhouse.compose.yml up -d
docker compose -f infra/coolify/redis.compose.yml up -d
pnpm install
pnpm dev:api    # http://localhost:8080
pnpm dev:web    # http://localhost:3000
```

See `infra/coolify/README.md` for production deploy on Coolify.
