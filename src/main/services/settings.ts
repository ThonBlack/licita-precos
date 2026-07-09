import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ConfigApp } from '../../shared/types'

export const MODELO_PADRAO = 'llama-3.3-70b-versatile'

const PADRAO: ConfigApp = { groqApiKey: '', groqModel: MODELO_PADRAO }

let caminhoConfig = ''

export function initConfig(dirUserData: string): void {
  caminhoConfig = join(dirUserData, 'config.json')
}

export function obterConfig(): ConfigApp {
  try {
    const lida = JSON.parse(readFileSync(caminhoConfig, 'utf8')) as Partial<ConfigApp>
    return {
      groqApiKey: typeof lida.groqApiKey === 'string' ? lida.groqApiKey : '',
      groqModel: typeof lida.groqModel === 'string' && lida.groqModel.trim() ? lida.groqModel : MODELO_PADRAO
    }
  } catch {
    return { ...PADRAO }
  }
}

export function salvarConfig(cfg: ConfigApp): void {
  const limpa: ConfigApp = {
    groqApiKey: cfg.groqApiKey.trim(),
    groqModel: cfg.groqModel.trim() || MODELO_PADRAO
  }
  writeFileSync(caminhoConfig, JSON.stringify(limpa, null, 2))
}
