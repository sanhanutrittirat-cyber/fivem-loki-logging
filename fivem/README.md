# FiveM integration

## 1. Install the resource

Copy `logwatch_client/` into `resources/[logwatch]/logwatch_client/` and add to `server.cfg`:

```
ensure logwatch_client

set logwatch_url    "https://logs.example.com/ingest"
set logwatch_token  "REPLACE_WITH_INGEST_API_TOKEN"
set logwatch_secret "REPLACE_WITH_PER_SERVER_HMAC_SECRET"
set logwatch_server "srv-eu-1"
set logwatch_flush_ms  "1000"
set logwatch_max_batch "200"
```

The `logwatch_secret` value must match an entry in the API's `SERVER_SECRETS_JSON`,
keyed by `logwatch_server`.

## 2. Use the export

From any other resource:

```lua
exports.logwatch_client:log({
  identifier = xPlayer.identifier,    -- "steam:11000010xxxxxxx"
  name       = itemName,              -- item, weapon, money, bank, black_money…
  amount     = count,
  type       = "add",                 -- or "remove"
  -- optional:
  reason     = "shop:purchase",
  char_id    = tostring(xPlayer.charId or ""),
})
```

Items, weapons, and money all flow through the **same** `name` field. The Log Watcher
makes no category split — keep names consistent server-side.

## 3. Patch es_extended (example)

In `es_extended/server/classes/player.lua` (the file may differ per fork), wrap
inventory + money mutators:

```lua
function self.addInventoryItem(name, count, ...)
  -- ... existing logic ...
  exports.logwatch_client:log({
    identifier = self.identifier,
    name       = name,
    amount     = count,
    type       = "add",
    resource   = GetInvokingResource() or "esx_extended",
  })
end

function self.removeInventoryItem(name, count, ...)
  -- ... existing logic ...
  exports.logwatch_client:log({
    identifier = self.identifier,
    name       = name,
    amount     = count,
    type       = "remove",
    resource   = GetInvokingResource() or "esx_extended",
  })
end

function self.addMoney(amount)        log("money",  amount, "add") end
function self.removeMoney(amount)     log("money",  amount, "remove") end
function self.addAccountMoney(acct, a)  log(acct, a, "add") end     -- "bank","black_money"
function self.removeAccountMoney(acct, a) log(acct, a, "remove") end

function log(name, amount, type)
  exports.logwatch_client:log({
    identifier = self.identifier, name = name, amount = amount,
    type = type, resource = GetInvokingResource() or "esx_extended",
  })
end
```

(Adjust signatures to your ESX version — the point is: every add/remove path emits
one export call.)

## 4. Weapons

Same pattern — `name = "WEAPON_PISTOL"` etc. Don't split into a separate system.
