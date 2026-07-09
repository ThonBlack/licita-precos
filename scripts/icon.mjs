// Gera build/icon.ico (multi-tamanho) e build/icon.png a partir do build/icon.svg.
//   node scripts/icon.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const svg = readFileSync(new URL('../build/icon.svg', import.meta.url))
const tamanhos = [16, 24, 32, 48, 64, 128, 256]

const pngs = await Promise.all(
  tamanhos.map((t) => sharp(svg, { density: 300 }).resize(t, t).png().toBuffer())
)

writeFileSync(new URL('../build/icon.png', import.meta.url), pngs.at(-1))
writeFileSync(new URL('../build/icon.ico', import.meta.url), await pngToIco(pngs))
console.log(`build/icon.ico gerado (${tamanhos.join(', ')} px)`)
