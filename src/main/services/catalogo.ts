import type { DB } from '../db'
import type { Alias, ItemCanonico, ItemComAliases, Sugestao } from '../../shared/types'
import { normalizar } from './normalize'
import { matchTermo } from './matcher'

export function listarCatalogo(db: DB): ItemComAliases[] {
  const itens = db
    .prepare(
      `SELECT i.*, (SELECT COUNT(*) FROM ofertas o WHERE o.item_canonico_id = i.id) AS totalOfertas
       FROM itens_canonicos i
       ORDER BY i.nome COLLATE NOCASE`
    )
    .all() as (ItemCanonico & { totalOfertas: number })[]

  const aliases = db
    .prepare(`SELECT id, item_canonico_id, alias, origem FROM itens_aliases ORDER BY alias COLLATE NOCASE`)
    .all() as Alias[]

  const porItem = new Map<number, Alias[]>()
  for (const a of aliases) {
    const lista = porItem.get(a.item_canonico_id) ?? []
    lista.push(a)
    porItem.set(a.item_canonico_id, lista)
  }
  return itens.map((i) => ({ ...i, aliases: porItem.get(i.id) ?? [] }))
}

export function criarItem(
  db: DB,
  dados: { nome: string; categoria: string | null; unidade: string | null }
): ItemCanonico {
  const nome = dados.nome.trim()
  if (!nome) throw new Error('Nome do item é obrigatório.')
  const info = db
    .prepare(`INSERT INTO itens_canonicos (nome, categoria, unidade_padrao) VALUES (?, ?, ?)`)
    .run(nome, dados.categoria?.trim() || null, dados.unidade?.trim() || null)
  const id = Number(info.lastInsertRowid)
  // o próprio nome canônico entra como alias, para o matching funcionar de forma uniforme
  adicionarAlias(db, id, nome, 'confirmado_usuario')
  return db.prepare(`SELECT * FROM itens_canonicos WHERE id = ?`).get(id) as ItemCanonico
}

export function atualizarItem(
  db: DB,
  id: number,
  dados: { nome: string; categoria: string | null; unidade: string | null }
): void {
  const nome = dados.nome.trim()
  if (!nome) throw new Error('Nome do item é obrigatório.')
  const res = db
    .prepare(`UPDATE itens_canonicos SET nome = ?, categoria = ?, unidade_padrao = ? WHERE id = ?`)
    .run(nome, dados.categoria?.trim() || null, dados.unidade?.trim() || null, id)
  if (res.changes === 0) throw new Error('Item não encontrado.')
  adicionarAlias(db, id, nome, 'confirmado_usuario')
}

export function excluirItem(db: DB, id: number): void {
  // ofertas ficam com item_canonico_id NULL (ON DELETE SET NULL); aliases caem em cascata
  const res = db.prepare(`DELETE FROM itens_canonicos WHERE id = ?`).run(id)
  if (res.changes === 0) throw new Error('Item não encontrado.')
}

/** Insere alias se ainda não existir para o item (dedupe por texto normalizado). Retorna true se criou. */
export function adicionarAlias(db: DB, itemId: number, alias: string, origem: string): boolean {
  const texto = alias.trim()
  const norm = normalizar(texto)
  if (!texto || !norm) return false
  const res = db
    .prepare(
      `INSERT OR IGNORE INTO itens_aliases (item_canonico_id, alias, alias_norm, origem) VALUES (?, ?, ?, ?)`
    )
    .run(itemId, texto, norm, origem)
  return res.changes > 0
}

export function removerAlias(db: DB, aliasId: number): void {
  db.prepare(`DELETE FROM itens_aliases WHERE id = ?`).run(aliasId)
}

/**
 * Mescla itens de `origem` no item `destino`: move as ofertas, copia nomes/apelidos como
 * apelidos do destino (p/ reconhecer no futuro) e apaga os itens de origem. Idempotente e
 * transacional. Retorna quantas ofertas moveu e quantos itens removeu.
 */
export function mesclarItens(
  db: DB,
  origem: number[],
  destino: number
): { ofertasMovidas: number; itensRemovidos: number } {
  const orig = [...new Set(origem)].filter((id) => id !== destino)
  if (orig.length === 0) return { ofertasMovidas: 0, itensRemovidos: 0 }

  const tx = db.transaction(() => {
    const ph = orig.map(() => '?').join(',')
    // nomes e apelidos dos itens de origem viram apelidos do destino (dedupe automático)
    const nomes = db
      .prepare(`SELECT nome FROM itens_canonicos WHERE id IN (${ph})`)
      .all(...orig) as { nome: string }[]
    for (const { nome } of nomes) adicionarAlias(db, destino, nome, 'merge')
    const aliases = db
      .prepare(`SELECT alias, origem FROM itens_aliases WHERE item_canonico_id IN (${ph})`)
      .all(...orig) as { alias: string; origem: string | null }[]
    for (const a of aliases) adicionarAlias(db, destino, a.alias, a.origem ?? 'merge')

    const r = db
      .prepare(`UPDATE ofertas SET item_canonico_id = ? WHERE item_canonico_id IN (${ph})`)
      .run(destino, ...orig)
    db.prepare(`DELETE FROM itens_canonicos WHERE id IN (${ph})`).run(...orig)
    return { ofertasMovidas: r.changes, itensRemovidos: orig.length }
  })
  return tx()
}

/** Sugere itens do catálogo parecidos com `itemId` (candidatos a mesclar). */
export function itensParecidos(db: DB, itemId: number, limite = 8): Sugestao[] {
  const item = db.prepare(`SELECT nome FROM itens_canonicos WHERE id = ?`).get(itemId) as
    | { nome: string }
    | undefined
  if (!item) return []
  return matchTermo(db, item.nome, limite + 1)
    .filter((c) => c.itemId !== itemId)
    .slice(0, limite)
}
