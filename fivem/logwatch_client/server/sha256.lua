-- Minimal HMAC-SHA256 in pure Lua (5.3+). Returns lowercase hex string.
-- Adequate for signing small JSON bodies (a few KB).
-- Source-derived from public-domain references; trimmed for FiveM use.

local band, bor, bxor, bnot = bit32 and bit32.band or function(a,b)return a&b end,
                              bit32 and bit32.bor or function(a,b)return a|b end,
                              bit32 and bit32.bxor or function(a,b)return a~b end,
                              bit32 and bit32.bnot or function(a)return ~a end
local rshift = bit32 and bit32.rshift or function(a,n) return a>>n end
local lshift = bit32 and bit32.lshift or function(a,n) return (a<<n) & 0xffffffff end

local function rrot(x, n) return bor(rshift(x, n), lshift(x, 32 - n)) & 0xffffffff end

local K = {
 0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
 0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
 0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
 0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
 0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
 0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
 0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
 0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
}

local function preprocess(msg)
  local len = #msg
  local bits = len * 8
  msg = msg .. "\128"
  while (#msg % 64) ~= 56 do msg = msg .. "\0" end
  -- 64-bit big-endian length
  for i = 7, 0, -1 do
    msg = msg .. string.char(band(rshift(bits, i*8), 0xff))
  end
  return msg
end

local function digest(msg)
  msg = preprocess(msg)
  local H = {0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,
             0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19}
  for chunk = 1, #msg, 64 do
    local w = {}
    for i = 0, 15 do
      local j = chunk + i*4
      w[i] = lshift(string.byte(msg, j),   24)
           + lshift(string.byte(msg, j+1), 16)
           + lshift(string.byte(msg, j+2), 8)
           + string.byte(msg, j+3)
    end
    for i = 16, 63 do
      local s0 = bxor(rrot(w[i-15], 7), bxor(rrot(w[i-15], 18), rshift(w[i-15], 3)))
      local s1 = bxor(rrot(w[i-2], 17), bxor(rrot(w[i-2], 19), rshift(w[i-2], 10)))
      w[i] = (w[i-16] + s0 + w[i-7] + s1) & 0xffffffff
    end
    local a,b,c,d,e,f,g,h = H[1],H[2],H[3],H[4],H[5],H[6],H[7],H[8]
    for i = 0, 63 do
      local S1 = bxor(rrot(e,6), bxor(rrot(e,11), rrot(e,25)))
      local ch = bxor(band(e,f), band(bnot(e) & 0xffffffff, g))
      local temp1 = (h + S1 + ch + K[i+1] + w[i]) & 0xffffffff
      local S0 = bxor(rrot(a,2), bxor(rrot(a,13), rrot(a,22)))
      local mj = bxor(bxor(band(a,b), band(a,c)), band(b,c))
      local temp2 = (S0 + mj) & 0xffffffff
      h = g; g = f; f = e
      e = (d + temp1) & 0xffffffff
      d = c; c = b; b = a
      a = (temp1 + temp2) & 0xffffffff
    end
    H[1]=(H[1]+a)&0xffffffff; H[2]=(H[2]+b)&0xffffffff
    H[3]=(H[3]+c)&0xffffffff; H[4]=(H[4]+d)&0xffffffff
    H[5]=(H[5]+e)&0xffffffff; H[6]=(H[6]+f)&0xffffffff
    H[7]=(H[7]+g)&0xffffffff; H[8]=(H[8]+h)&0xffffffff
  end
  return string.format("%08x%08x%08x%08x%08x%08x%08x%08x",
    H[1],H[2],H[3],H[4],H[5],H[6],H[7],H[8])
end

local function hex_to_bytes(hex)
  return (hex:gsub("..", function(b) return string.char(tonumber(b, 16)) end))
end

local function hmac_sha256(key, msg)
  if #key > 64 then key = hex_to_bytes(digest(key)) end
  if #key < 64 then key = key .. string.rep("\0", 64 - #key) end
  local o, i = {}, {}
  for n = 1, 64 do
    local b = string.byte(key, n)
    o[n] = string.char(bxor(b, 0x5c))
    i[n] = string.char(bxor(b, 0x36))
  end
  return digest(table.concat(o) .. hex_to_bytes(digest(table.concat(i) .. msg)))
end

_G.LogwatchHmacSha256 = hmac_sha256
