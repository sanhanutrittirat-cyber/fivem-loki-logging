fx_version 'cerulean'
game 'gta5'

author 'logwatch'
description 'Batches FiveM transaction logs to the Log Watcher API'
version '0.1.0'

server_scripts {
  'server/sha256.lua',
  'server/sv_logwatch.lua',
}
