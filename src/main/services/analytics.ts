// Agregações para Painel e Fornecedores. Trabalha sobre os dados já existentes
// (mapas + ofertas), sem campos novos no schema.
import type { DB } from '../db'
import type { Fornecedor, OpcoesFiltro, ResumoPainel } from '../../shared/types'

/** Normaliza nome de fornecedor p/ unificar grafias (caixa/espaços) sem perder legibilidade. */
function chaveFornecedor(nome: string): string {
  return nome.trim().toUpperCase().replace(/\s+/g, ' ')
}

export function resumoPainel(db: DB): ResumoPainel {
  const n = (sql: string): number => (db.prepare(sql).get() as { n: number }).n
  const totais = {
    mapas: n('SELECT COUNT(*) n FROM mapas'),
    itens: n('SELECT COUNT(*) n FROM itens_canonicos'),
    ofertas: n('SELECT COUNT(*) n FROM ofertas'),
    fornecedores: n('SELECT COUNT(DISTINCT UPPER(TRIM(proponente))) n FROM ofertas')
  }

  const gastoPorOrgao = db
    .prepare(
      `SELECT COALESCE(m.orgao,'(sem órgão)') orgao, COUNT(DISTINCT m.id) mapas,
              COALESCE(SUM(o.valor_total),0) total
       FROM ofertas o JOIN mapas m ON m.id = o.mapa_id
       WHERE o.venceu = 1 AND o.valor_total IS NOT NULL
       GROUP BY m.orgao ORDER BY total DESC`
    )
    .all() as { orgao: string; total: number; mapas: number }[]

  const topItens = db
    .prepare(
      `SELECT i.id itemId, i.nome nome, MAX(o.valor_unitario) maxUnit
       FROM ofertas o JOIN itens_canonicos i ON i.id = o.item_canonico_id
       WHERE o.valor_unitario IS NOT NULL
       GROUP BY i.id ORDER BY maxUnit DESC LIMIT 8`
    )
    .all() as { itemId: number; nome: string; maxUnit: number }[]

  const ultimosMapas = db
    .prepare(
      `SELECT m.id, m.orgao, m.id_compra idCompra, m.data_autenticacao data,
              (SELECT COUNT(*) FROM ofertas o WHERE o.mapa_id = m.id) ofertas
       FROM mapas m ORDER BY m.importado_em DESC LIMIT 8`
    )
    .all() as ResumoPainel['ultimosMapas']

  return { totais, gastoPorOrgao, topItens, ultimosMapas }
}

export function listaFornecedores(db: DB): Fornecedor[] {
  const rows = db
    .prepare(
      `SELECT proponente, venceu, valor_total, item_canonico_id FROM ofertas`
    )
    .all() as { proponente: string; venceu: number; valor_total: number | null; item_canonico_id: number | null }[]

  const acc = new Map<
    string,
    { nome: string; ofertas: number; vitorias: number; itens: Set<number>; somaTicket: number; nTicket: number }
  >()
  for (const r of rows) {
    const k = chaveFornecedor(r.proponente)
    let a = acc.get(k)
    if (!a) {
      a = { nome: r.proponente.trim(), ofertas: 0, vitorias: 0, itens: new Set(), somaTicket: 0, nTicket: 0 }
      acc.set(k, a)
    }
    a.ofertas++
    if (r.venceu === 1) {
      a.vitorias++
      if (r.valor_total != null) {
        a.somaTicket += r.valor_total
        a.nTicket++
      }
    }
    if (r.item_canonico_id != null) a.itens.add(r.item_canonico_id)
  }

  return [...acc.values()]
    .map((a) => ({
      nome: a.nome,
      ofertas: a.ofertas,
      vitorias: a.vitorias,
      taxaVitoria: a.ofertas ? a.vitorias / a.ofertas : 0,
      itens: a.itens.size,
      ticketMedio: a.nTicket ? a.somaTicket / a.nTicket : null
    }))
    .sort((x, y) => y.vitorias - x.vitorias || y.ofertas - x.ofertas)
}

export function opcoesFiltro(db: DB): OpcoesFiltro {
  const col = (sql: string): string[] =>
    (db.prepare(sql).all() as { v: string }[]).map((r) => r.v).filter((v) => v && v.trim())
  // fornecedores: unifica grafias, ordena por frequência
  const forn = db
    .prepare(`SELECT proponente v, COUNT(*) c FROM ofertas GROUP BY UPPER(TRIM(proponente)) ORDER BY c DESC`)
    .all() as { v: string; c: number }[]
  return {
    fornecedores: forn.map((f) => f.v.trim()).filter(Boolean),
    orgaos: col(`SELECT DISTINCT orgao v FROM mapas WHERE orgao IS NOT NULL ORDER BY orgao`),
    categorias: col(`SELECT DISTINCT categoria v FROM itens_canonicos WHERE categoria IS NOT NULL ORDER BY categoria`)
  }
}
