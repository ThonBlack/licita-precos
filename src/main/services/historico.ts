import type { DB } from '../db'
import type {
  Estatisticas,
  FiltrosBusca,
  HistoricoItem,
  ItemCanonico,
  RegistroHistorico
} from '../../shared/types'
import { normalizar } from './normalize'
import { matchTermo } from './matcher'

export function historicoItem(db: DB, itemId: number, filtroProponente?: string): HistoricoItem {
  const item = db.prepare(`SELECT * FROM itens_canonicos WHERE id = ?`).get(itemId) as
    | ItemCanonico
    | undefined
  if (!item) throw new Error(`Item canônico ${itemId} não encontrado.`)

  let registros = db
    .prepare(
      `SELECT o.proponente, o.valor_unitario, o.valor_total, o.quantidade, o.unidade, o.venceu,
              o.descricao_original, m.orgao, m.data_autenticacao, m.id_compra, o.preco_referencia
       FROM ofertas o
       JOIN mapas m ON m.id = o.mapa_id
       WHERE o.item_canonico_id = ?
       ORDER BY (m.data_autenticacao IS NULL), m.data_autenticacao DESC, o.valor_unitario ASC`
    )
    .all(itemId) as RegistroHistorico[]

  if (filtroProponente) {
    const alvo = normalizar(filtroProponente)
    registros = registros.filter((r) => {
      const p = normalizar(r.proponente)
      return p.includes(alvo) || alvo.includes(p)
    })
  }

  return { item, stats: calcularEstatisticas(registros), registros }
}

export function calcularEstatisticas(registros: RegistroHistorico[]): Estatisticas {
  const valores = registros
    .map((r) => r.valor_unitario)
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b)

  const vitorias = new Map<string, number>()
  for (const r of registros) {
    if (r.venceu) vitorias.set(r.proponente, (vitorias.get(r.proponente) ?? 0) + 1)
  }
  let vencedorFrequente: string | null = null
  let maxVitorias = 0
  for (const [proponente, n] of vitorias) {
    if (n > maxVitorias) {
      maxVitorias = n
      vencedorFrequente = proponente
    }
  }

  const mapas = new Set(registros.map((r) => `${r.id_compra}|${r.orgao}|${r.data_autenticacao}`))
  const datas = registros.map((r) => r.data_autenticacao).filter((d): d is string => !!d)

  const vencedores = registros
    .filter((r) => r.venceu && r.valor_unitario != null)
    .map((r) => r.valor_unitario as number)
  const precoVencedorMedio = vencedores.length
    ? Math.round((vencedores.reduce((s, v) => s + v, 0) / vencedores.length) * 100) / 100
    : null

  // registros já vêm ordenados por data desc → o 1º com referência é o mais recente
  const comRef = registros.find((r) => r.preco_referencia != null)
  const precoReferencia = comRef ? comRef.preco_referencia : null
  const acimaDoTeto = registros.filter(
    (r) => r.valor_unitario != null && r.preco_referencia != null && r.valor_unitario > r.preco_referencia
  ).length

  return {
    registros: registros.length,
    mapas: registros.length ? mapas.size : 0,
    minimo: valores.length ? valores[0]! : null,
    mediana: valores.length ? mediana(valores) : null,
    maximo: valores.length ? valores[valores.length - 1]! : null,
    vencedorFrequente,
    precoVencedorMedio,
    precoReferencia,
    acimaDoTeto,
    ultimaData: datas.length ? datas.sort().at(-1)! : null
  }
}

/**
 * Busca de produtos com filtros. O termo seleciona itens (fuzzy); fornecedor/órgão/período
 * restringem a QUAIS itens aparecem (que tenham ao menos uma oferta batendo o filtro), mas o
 * histórico de cada item vem completo, para dar contexto de preço.
 */
export function buscarProdutos(db: DB, f: FiltrosBusca): HistoricoItem[] {
  const termo = f.termo?.trim()
  let ids: number[] = termo
    ? matchTermo(db, termo, 300).map((c) => c.itemId)
    : (db.prepare(`SELECT id FROM itens_canonicos ORDER BY nome COLLATE NOCASE`).all() as { id: number }[]).map(
        (r) => r.id
      )

  if (f.fornecedor || f.orgao || f.de || f.ate) {
    const cond: string[] = ['o.item_canonico_id IS NOT NULL']
    const args: unknown[] = []
    if (f.fornecedor) {
      cond.push('UPPER(TRIM(o.proponente)) = UPPER(TRIM(?))')
      args.push(f.fornecedor)
    }
    if (f.orgao) {
      cond.push('m.orgao = ?')
      args.push(f.orgao)
    }
    if (f.de) {
      cond.push('m.data_autenticacao >= ?')
      args.push(f.de)
    }
    if (f.ate) {
      cond.push('m.data_autenticacao <= ?')
      args.push(f.ate)
    }
    const permitidos = new Set(
      (
        db
          .prepare(
            `SELECT DISTINCT o.item_canonico_id id FROM ofertas o JOIN mapas m ON m.id = o.mapa_id
             WHERE ${cond.join(' AND ')}`
          )
          .all(...args) as { id: number }[]
      ).map((r) => r.id)
    )
    ids = ids.filter((id) => permitidos.has(id))
  }

  const out: HistoricoItem[] = []
  for (const id of ids) {
    const h = historicoItem(db, id)
    if (f.categoria && (h.item.categoria ?? '').toLowerCase() !== f.categoria.toLowerCase()) continue
    out.push(h)
  }
  return out
}

function mediana(ordenados: number[]): number {
  const meio = Math.floor(ordenados.length / 2)
  return ordenados.length % 2 === 1 ? ordenados[meio]! : (ordenados[meio - 1]! + ordenados[meio]!) / 2
}
