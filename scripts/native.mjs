// Troca o binário nativo do better-sqlite3 entre os ABIs do Electron e do Node,
// usando os prebuilds oficiais (sem precisar de Visual Studio).
//   node scripts/native.mjs electron  -> para rodar/empacotar o app
//   node scripts/native.mjs node      -> para rodar `pnpm smoke` (Node puro)
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { dirname } from 'node:path'

const require = createRequire(import.meta.url)
const runtime = process.argv[2] ?? 'electron'

const moduloDir = dirname(require.resolve('better-sqlite3/package.json'))
const prebuildBin = require.resolve('prebuild-install/bin.js')

const args = [prebuildBin]
if (runtime === 'electron') {
  const versaoElectron = require('electron/package.json').version
  args.push('--runtime=electron', `--target=${versaoElectron}`)
} else if (runtime !== 'node') {
  console.error(`runtime desconhecido: ${runtime} (use "electron" ou "node")`)
  process.exit(1)
}

const res = spawnSync(process.execPath, args, { cwd: moduloDir, stdio: 'inherit' })
if (res.status !== 0) {
  console.error(`prebuild-install falhou para runtime=${runtime}`)
  process.exit(res.status ?? 1)
}
console.log(`better-sqlite3 pronto para runtime=${runtime}`)
