import type { DB } from '../db'
import type { Estatisticas, HistoricoItem, ItemCanonico, RegistroHistorico } from '../../shared/types'
import { normalizar } from './normalize'

export function historicoItem(db: DB, itemId: number, filtroProponente?: string): HistoricoItem {
  const item = db.prepare(`SELECT * FROM itens_canonicos WHERE id = ?`).get(itemId) as
    | ItemCanonico
    | undefined
  if (!item) throw new Error(`Item canônico ${itemId} não encontrado.`)

  let registros = db
    .prepare(
      `SELECT o.proponente, o.valor_unitario, o.valor_total, o.quantidade, o.unidade, o.venceu,
              o.descricao_original, m.orgao, m.data_autenticacao, m.id_compra
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

  return {
    registros: registros.length,
    mapas: registros.length ? mapas.size : 0,
    minimo: valores.length ? valores[0]! : null,
    mediana: valores.length ? mediana(valores) : null,
    maximo: valores.length ? valores[valores.length - 1]! : null,
    vencedorFrequente,
    ultimaData: datas.length ? datas.sort().at(-1)! : null
  }
}

function mediana(ordenados: number[]): number {
  const meio = Math.floor(ordenados.length / 2)
  return ordenados.length % 2 === 1 ? ordenados[meio]! : (ordenados[meio - 1]! + ordenados[meio]!) / 2
}
