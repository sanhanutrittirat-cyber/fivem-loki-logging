-- LogWatch FiveM sender
-- Batches transaction logs and POSTs them to the Log Watcher API.
--
-- server.cfg convars:
--   set logwatch_url    "https://logs.example.com/ingest"
--   set logwatch_token  "<INGEST_API_TOKEN>"
--   set logwatch_secret "<per-server HMAC secret>"
--   set logwatch_server "srv-eu-1"
--   set logwatch_flush_ms "1000"
--   set logwatch_max_batch "200"

local ENDPOINT  = GetConvar("logwatch_url",       "")
local TOKEN     = GetConvar("logwatch_token",     "")
local SECRET    = GetConvar("logwatch_secret",    "")
local SERVER    = GetConvar("logwatch_server",    "default")
local FLUSH_MS  = tonumber(GetConvar("logwatch_flush_ms", "1000")) or 1000
local MAX_BATCH = tonumber(GetConvar("logwatch_max_batch", "200")) or 200

local queue = {}

local function nowMs() return math.floor(os.time() * 1000) end

local function flush()
  if #queue == 0 then return end
  if ENDPOINT == "" or TOKEN == "" or SECRET == "" then
    print("[logwatch] missing convar(s); dropping " .. #queue .. " logs")
    queue = {}
    return
  end
  local batch = { logs = queue }
  queue = {}
  local body = json.encode(batch)
  local sig  = LogwatchHmacSha256(SECRET, body)
  PerformHttpRequest(ENDPOINT, function(status, _resp, _hdrs)
    if status >= 300 then
      print(("[logwatch] push failed status=%s lines=%d"):format(tostring(status), #batch.logs))
    end
  end, "POST", body, {
    ["Content-Type"]   = "application/json",
    ["X-Ingest-Token"] = TOKEN,
    ["X-Server-Id"]    = SERVER,
    ["X-Signature"]    = sig,
  })
end

CreateThread(function()
  while true do
    Wait(FLUSH_MS)
    flush()
  end
end)

AddEventHandler("onResourceStop", function(res)
  if res == GetCurrentResourceName() then flush() end
end)

--- Public export.
-- payload: { identifier, name, amount, resource, type, [ts], [server_id], [char_id], [reason] }
exports("log", function(payload)
  if type(payload) ~= "table" then return end
  if not payload.identifier or not payload.name or not payload.type or not payload.amount then return end
  payload.ts       = payload.ts       or nowMs()
  payload.resource = payload.resource or (GetInvokingResource() or "unknown")
  queue[#queue + 1] = payload
  if #queue >= MAX_BATCH then flush() end
end)
