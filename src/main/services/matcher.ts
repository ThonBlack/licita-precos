import Fuse from 'fuse.js'
import type { DB } from '../db'
import type { InfoMatch, Sugestao } from '../../shared/types'
import { normalizar } from './normalize'

// Limiares de confiança (similaridade 0..1)
export const LIMIAR_AUTO = 0.92 // associa automaticamente na importação
export const LIMIAR_SUGESTAO = 0.55 // vira sugestão para a usuária confirmar
export const LIMIAR_BUSCA = 0.75 // resolve direto na tela de busca

interface EntradaMatch {
  itemId: number
  itemNome: string
  textoNorm: string
}

function carregarEntradas(db: DB): EntradaMatch[] {
  return db
    .prepare(
      `SELECT a.item_canonico_id AS itemId, i.nome AS itemNome, a.alias_norm AS textoNorm
       FROM itens_aliases a
       JOIN itens_canonicos i ON i.id = a.item_canonico_id`
    )
    .all() as EntradaMatch[]
}

/**
 * Busca fuzzy de um termo livre contra o catálogo (aliases + nomes canônicos).
 * Retorna candidatos únicos por item, ordenados por similaridade.
 */
export function matchTermo(db: DB, termo: string, limite = 5): Sugestao[] {
  const norm = normalizar(termo)
  if (!norm) return []

  const entradas = carregarEntradas(db)
  if (entradas.length === 0) return []

  const porItem = new Map<number, Sugestao>()
  const registrar = (e: EntradaMatch, similaridade: number) => {
    const atual = porItem.get(e.itemId)
    if (!atual || similaridade > atual.similaridade) {
      porItem.set(e.itemId, { itemId: e.itemId, itemNome: e.itemNome, similaridade })
    }
  }

  const tokensTermo = norm.split(' ')

  for (const e of entradas) {
    if (e.textoNorm === norm) {
      registrar(e, 1)
      continue
    }
    const tokensAlias = e.textoNorm.split(' ')
    const setAlias = new Set(tokensAlias)
    const setTermo = new Set(tokensTermo)
    // todos os tokens do alias aparecem na descrição buscada (ex: alias "chamex"
    // dentro de "papel sulfite chamex a4") ou vice-versa
    if (tokensAlias.every((t) => setTermo.has(t))) registrar(e, 0.8)
    else if (tokensTermo.every((t) => setAlias.has(t))) registrar(e, 0.78)
  }

  const fuse = new Fuse(entradas, {
    keys: ['textoNorm'],
    includeScore: true,
    threshold: 0.45,
    ignoreLocation: true
  })
  for (const r of fuse.search(norm)) {
    registrar(r.item, Math.max(0, 1 - (r.score ?? 1)))
  }

  return [...porItem.values()]
    .sort((a, b) => b.similaridade - a.similaridade)
    .slice(0, limite)
}

/** Classifica o match de uma descrição de linha importada. */
export function matchDescricao(db: DB, descricao: string): InfoMatch {
  const candidatos = matchTermo(db, descricao, 4)
  const melhor = candidatos[0]

  if (!melhor || melhor.similaridade < LIMIAR_SUGESTAO) {
    return { tipo: 'nenhum', itemId: null, itemNome: null, similaridade: 0, sugestoes: candidatos }
  }
  if (melhor.similaridade >= 1) {
    return {
      tipo: 'exato',
      itemId: melhor.itemId,
      itemNome: melhor.itemNome,
      similaridade: 1,
      sugestoes: candidatos
    }
  }
  if (melhor.similaridade >= LIMIAR_AUTO) {
    return {
      tipo: 'forte',
      itemId: melhor.itemId,
      itemNome: melhor.itemNome,
      similaridade: melhor.similaridade,
      sugestoes: candidatos
    }
  }
  return {
    tipo: 'sugestao',
    itemId: melhor.itemId,
    itemNome: melhor.itemNome,
    similaridade: melhor.similaridade,
    sugestoes: candidatos
  }
}
