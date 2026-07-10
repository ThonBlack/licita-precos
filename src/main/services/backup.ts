import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import type { DB } from '../db'

/** Copia o arquivo .db para o destino escolhido, após descarregar o WAL. */
export function exportarBackup(db: DB, dbPath: string, destino: string): void {
  db.pragma('wal_checkpoint(TRUNCATE)')
  copyFileSync(dbPath, destino)
}

const MAX_BACKUPS = 10
const INTERVALO_MS = 12 * 60 * 60 * 1000 // no máximo 1 backup automático a cada 12h

/** Pasta fixa de backups automáticos (dentro do userData). */
export function pastaBackups(userDataDir: string): string {
  return join(userDataDir, 'backups')
}

/**
 * Backup automático do banco: cria no máximo 1 a cada 12h e mantém os últimos 10.
 * Roda no boot do app — o usuário não precisa lembrar de exportar. Retorna o caminho criado ou null.
 */
export function backupAutomatico(db: DB, dbPath: string, userDataDir: string): string | null {
  const pasta = pastaBackups(userDataDir)
  mkdirSync(pasta, { recursive: true })
  const listar = (): string[] => readdirSync(pasta).filter((a) => a.endsWith('.db')).sort()

  const ultimo = listar().at(-1)
  if (ultimo) {
    try {
      if (Date.now() - statSync(join(pasta, ultimo)).mtimeMs < INTERVALO_MS) return null
    } catch {
      // não deu para ler o mtime: segue e cria um novo mesmo assim
    }
  }

  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
  let destino = join(pasta, `licitaprecos-${stamp}.db`)
  if (existsSync(destino)) destino = join(pasta, `licitaprecos-${stamp}-${Date.now()}.db`)
  db.pragma('wal_checkpoint(TRUNCATE)')
  copyFileSync(dbPath, destino)

  // rotaciona: mantém só os MAX_BACKUPS mais recentes
  for (const velho of listar().slice(0, -MAX_BACKUPS)) {
    try {
      unlinkSync(join(pasta, velho))
    } catch {
      // arquivo em uso / já removido: ignora
    }
  }
  return destino
}
