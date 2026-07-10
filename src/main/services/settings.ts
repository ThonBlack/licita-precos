import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { ConfigApp } from '../../shared/types'

export const MODELO_PADRAO = 'llama-3.3-70b-versatile'

let caminhoConfig = ''

export function initConfig(dirUserData: string): void {
  caminhoConfig = join(dirUserData, 'config.json')
}

function ler(): Partial<ConfigApp> {
  try {
    return JSON.parse(readFileSync(caminhoConfig, 'utf8')) as Partial<ConfigApp>
  } catch {
    return {}
  }
}

function normalizar(lida: Partial<ConfigApp>): ConfigApp {
  return {
    groqApiKey: typeof lida.groqApiKey === 'string' ? lida.groqApiKey : '',
    groqModel:
      typeof lida.groqModel === 'string' && lida.groqModel.trim() ? lida.groqModel : MODELO_PADRAO,
    pastaSync: typeof lida.pastaSync === 'string' ? lida.pastaSync : '',
    deviceId: typeof lida.deviceId === 'string' && lida.deviceId ? lida.deviceId : randomUUID()
  }
}

/** Lê o config, gerando e persistindo o deviceId na primeira vez que faltar. */
export function obterConfig(): ConfigApp {
  const lida = ler()
  const cfg = normalizar(lida)
  if (lida.deviceId !== cfg.deviceId) {
    try {
      writeFileSync(caminhoConfig, JSON.stringify(cfg, null, 2))
    } catch {
      /* se não der pra escrever agora, gera de novo na próxima leitura */
    }
  }
  return cfg
}

/** Salva mesclando com o disco: salvar só a IA não zera pastaSync/deviceId, e vice-versa. */
export function salvarConfig(parcial: Partial<ConfigApp>): void {
  const atual = normalizar(ler())
  const merge: ConfigApp = {
    groqApiKey: (parcial.groqApiKey ?? atual.groqApiKey).trim(),
    groqModel: (parcial.groqModel ?? atual.groqModel).trim() || MODELO_PADRAO,
    pastaSync: (parcial.pastaSync ?? atual.pastaSync).trim(),
    deviceId: atual.deviceId
  }
  writeFileSync(caminhoConfig, JSON.stringify(merge, null, 2))
}
