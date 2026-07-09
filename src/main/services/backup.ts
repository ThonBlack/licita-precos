import { copyFileSync } from 'node:fs'
import type { DB } from '../db'

/** Copia o arquivo .db para o destino escolhido, após descarregar o WAL. */
export function exportarBackup(db: DB, dbPath: string, destino: string): void {
  db.pragma('wal_checkpoint(TRUNCATE)')
  copyFileSync(dbPath, destino)
}
