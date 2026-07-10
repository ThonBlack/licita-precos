import ExcelJS from 'exceljs'
import type { DB } from '../db'
import type { FiltrosBusca } from '../../shared/types'
import { buscarProdutos } from './historico'

const MOEDA = 'R$ #,##0.00'

/** Gera um .xlsx com o resumo por item + os lances detalhados dos produtos que batem o filtro. */
export async function gerarRelatorio(db: DB, filtros: FiltrosBusca, caminho: string): Promise<number> {
  const itens = buscarProdutos(db, filtros)
  const wb = new ExcelJS.Workbook()

  const resumo = wb.addWorksheet('Resumo por item')
  resumo.addRow([
    'Item', 'Categoria', 'Unidade', 'Lances', 'Licitações',
    'Mínimo', 'Mediana', 'Máximo', 'Vencedor médio', 'Última data'
  ]).font = { bold: true }
  for (const h of itens) {
    resumo.addRow([
      h.item.nome, h.item.categoria ?? '', h.item.unidade_padrao ?? '',
      h.stats.registros, h.stats.mapas,
      h.stats.minimo, h.stats.mediana, h.stats.maximo, h.stats.precoVencedorMedio,
      h.stats.ultimaData ?? ''
    ])
  }
  resumo.columns.forEach((c, i) => (c.width = i === 0 ? 55 : 14))
  for (const ci of [6, 7, 8, 9]) resumo.getColumn(ci).numFmt = MOEDA
  resumo.views = [{ state: 'frozen', ySplit: 1 }]

  const lances = wb.addWorksheet('Lances detalhados')
  lances.addRow([
    'Item', 'Data', 'Escola/Órgão', 'ID compra', 'Proponente', 'Qtd', 'Unid', 'Valor unit.', 'Venceu'
  ]).font = { bold: true }
  for (const h of itens) {
    for (const r of h.registros) {
      lances.addRow([
        h.item.nome, r.data_autenticacao ?? '', r.orgao ?? '', r.id_compra ?? '',
        r.proponente, r.quantidade, r.unidade ?? '', r.valor_unitario, r.venceu ? 'sim' : ''
      ])
    }
  }
  lances.columns.forEach((c, i) => (c.width = i === 0 ? 50 : 16))
  lances.getColumn(8).numFmt = MOEDA
  lances.views = [{ state: 'frozen', ySplit: 1 }]

  await wb.xlsx.writeFile(caminho)
  return itens.length
}
