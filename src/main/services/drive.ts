// Auto-detecção da pasta de sincronização dentro do Google Drive para computador.
// A pasta compartilhada "Licita Precos Mih" é criada 1x pelo dono e adicionada ao
// "Meu Drive" de cada PC (atalho). Aqui só localizamos onde o Drive a montou localmente,
// para o usuário não precisar escolher pasta nenhuma no app.
import { existsSync } from 'node:fs'
import { join } from 'node:path'

/** Nome fixo da pasta compartilhada no Drive (dona: thonblack7). Deve bater com o Drive. */
export const NOME_PASTA_DRIVE = 'Licita Precos Mih'

/** Raízes candidatas onde o Google Drive para computador costuma montar o "Meu Drive". */
export function raizesDrive(): string[] {
  const raizes: string[] = []
  // Modo streaming: monta como unidade virtual (padrão G:, mas configurável) → <L>:\Meu Drive
  for (let c = 68 /* D */; c <= 90 /* Z */; c++) {
    const letra = String.fromCharCode(c)
    raizes.push(`${letra}:\\Meu Drive`, `${letra}:\\My Drive`)
  }
  // Modo espelhar / Drive legado: dentro do perfil do usuário
  const home = process.env.USERPROFILE
  if (home) {
    raizes.push(join(home, 'Meu Drive'), join(home, 'My Drive'), join(home, 'Google Drive'))
  }
  return raizes
}

/**
 * Procura a pasta compartilhada nas raízes do Drive. Retorna o caminho local ou null.
 * `raizes`/`nome` são injetáveis para o teste E2E rodar sem depender do Drive real.
 */
export function detectarPastaDrive(raizes: string[] = raizesDrive(), nome = NOME_PASTA_DRIVE): string | null {
  for (const raiz of raizes) {
    const alvo = join(raiz, nome)
    try {
      if (existsSync(alvo)) return alvo
    } catch {
      // unidade inexistente / sem permissão: ignora e tenta a próxima
    }
  }
  return null
}
