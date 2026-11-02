const { spawnSync } = require('node:child_process')
const result = spawnSync(require('electron'), ['scripts/smoke.cjs'], { stdio: 'inherit', timeout: 30000 })
if (result.error) console.error(result.error)
process.exit(result.status ?? 1)
