import ExcelJS from 'exceljs'
import { basename } from 'node:path'
import type { DB } from '../db'
import type {
  DecisaoLinha,
  ImportacaoParseada,
  LinhaImportacao,
  MetadadosMapa,
  Proposta,
  ResumoImportacao
} from '../../shared/types'
import { normalizar } from './normalize'
import { matchDescricao } from './matcher'
import { adicionarAlias, criarItem } from './catalogo'

const MAX_LINHAS = 5000

// ---------------------------------------------------------------------------
// Leitura de células
// ---------------------------------------------------------------------------

function cellTexto(cell: ExcelJS.Cell): string {
  const v = cell.value
  if (v == null) return ''
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'object') {
    if ('richText' in v) return v.richText.map((t) => t.text).join('').trim()
    if ('text' in v && typeof v.text === 'string') return v.text.trim()
    if ('result' in v && v.result != null) return String(v.result).trim()
  }
  return ''
}

/** Converte célula em número aceitando formato BR ("1.234,56", "R$ 3,90") e US. */
export function parseNumero(bruto: string | number | null | undefined): number | null {
  if (bruto == null) return null
  if (typeof bruto === 'number') return Number.isFinite(bruto) ? bruto : null
  let s = bruto.trim().toLowerCase().replace(/r\$\s*/g, '').replace(/\s/g, '')
  if (!s || s === 'ilegivel' || s === 'ilegível') return null
  const temVirgula = s.includes(',')
  const temPonto = s.includes('.')
  if (temVirgula && temPonto) {
    // o separador que aparece por último é o decimal
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  } else if (temVirgula) {
    s = s.replace(',', '.')
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function cellNumero(cell: ExcelJS.Cell): number | null {
  const v = cell.value
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (v != null && typeof v === 'object' && 'result' in v && typeof v.result === 'number') {
    return Number.isFinite(v.result) ? v.result : null
  }
  return parseNumero(cellTexto(cell))
}

// ---------------------------------------------------------------------------
// Parse da planilha preenchida
// ---------------------------------------------------------------------------

interface MapaColunas {
  item: number | null
  descricao: number
  quantidade: number | null
  unidade: number | null
  pares: { proponente: number; valor: number | null }[]
  vencedor: number | null
}

function detectarColunas(ws: ExcelJS.Worksheet): { linhaCabecalho: number; colunas: MapaColunas } | null {
  const limite = Math.min(ws.actualRowCount, 10)
  for (let r = 1; r <= limite; r++) {
    const row = ws.getRow(r)
    const colunas: MapaColunas = {
      item: null,
      descricao: 0,
      quantidade: null,
      unidade: null,
      pares: [],
      vencedor: null
    }
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const h = normalizar(cellTexto(cell))
      if (!h) return
      if (h === 'item' || h === 'n' || h === 'no' || h === 'num') colunas.item = col
      else if (h.startsWith('descricao')) colunas.descricao = col
      else if (h.startsWith('quant') || h === 'qtd' || h === 'qtde') colunas.quantidade = col
      else if (h.startsWith('unidade') || h === 'und' || h === 'un') colunas.unidade = col
      else if (h.startsWith('proponente') || h.startsWith('licitante') || h.startsWith('fornecedor')) {
        colunas.pares.push({ proponente: col, valor: null })
      } else if (h.startsWith('valor') || h.startsWith('vl') || h.startsWith('preco')) {
        const pendente = colunas.pares.find((p) => p.valor == null)
        if (pendente) pendente.valor = col
      } else if (h.startsWith('vencedor')) colunas.vencedor = col
    })
    if (colunas.descricao > 0 && colunas.pares.some((p) => p.valor != null)) {
      return { linhaCabecalho: r, colunas }
    }
  }
  return null
}

export async function parseArquivo(caminho: string): Promise<ImportacaoParseada> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(caminho)

  let ws: ExcelJS.Worksheet | undefined
  let deteccao: ReturnType<typeof detectarColunas> = null
  for (const planilha of wb.worksheets) {
    deteccao = detectarColunas(planilha)
    if (deteccao) {
      ws = planilha
      break
    }
  }
  if (!ws || !deteccao) {
    throw new Error(
      'Não encontrei as colunas esperadas (Descrição + Proponente/Valor). Use a planilha modelo gerada pelo app.'
    )
  }

  const { linhaCabecalho, colunas } = deteccao
  const avisos: string[] = []
  const linhas: LinhaImportacao[] = []
  const nomesProponentes = new Map<number, string>() // coluna do proponente -> último nome visto

  const ultimaLinha = Math.min(ws.actualRowCount, linhaCabecalho + MAX_LINHAS)
  for (let r = linhaCabecalho + 1; r <= ultimaLinha; r++) {
    const row = ws.getRow(r)
    const descricao = cellTexto(row.getCell(colunas.descricao))
    if (!descricao) continue

    const propostas: Proposta[] = []
    for (const par of colunas.pares) {
      let proponente = cellTexto(row.getCell(par.proponente))
      // planilhas reais costumam repetir o proponente só na primeira linha
      if (proponente) nomesProponentes.set(par.proponente, proponente)
      else proponente = nomesProponentes.get(par.proponente) ?? ''

      const valorUnitario = par.valor ? cellNumero(row.getCell(par.valor)) : null
      if (!proponente && valorUnitario == null) continue
      if (!proponente) {
        avisos.push(`Linha ${r}: valor sem proponente foi ignorado.`)
        continue
      }
      if (valorUnitario == null) continue
      propostas.push({ proponente, valorUnitario, valorTotal: null })
    }

    if (propostas.length === 0) {
      avisos.push(`Linha ${r}: "${descricao.slice(0, 40)}" sem nenhum valor — ignorada.`)
      continue
    }

    const quantidade = colunas.quantidade ? cellNumero(row.getCell(colunas.quantidade)) : null
    for (const p of propostas) {
      if (quantidade != null && p.valorUnitario != null) {
        p.valorTotal = Math.round(quantidade * p.valorUnitario * 100) / 100
      }
    }

    linhas.push({
      linha: r,
      numeroItem: colunas.item ? cellTexto(row.getCell(colunas.item)) || null : null,
      descricao,
      quantidade,
      unidade: colunas.unidade ? cellTexto(row.getCell(colunas.unidade)) || null : null,
      propostas,
      vencedorInformado: colunas.vencedor ? cellTexto(row.getCell(colunas.vencedor)) || null : null,
      match: { tipo: 'nenhum', itemId: null, itemNome: null, similaridade: 0, sugestoes: [] }
    })
  }

  if (linhas.length === 0) throw new Error('A planilha não tem nenhuma linha de item preenchida.')

  return { arquivo: basename(caminho), caminho, linhas, avisos }
}

/** Roda o matching de cada linha contra o catálogo atual. */
export function aplicarMatches(db: DB, parseada: ImportacaoParseada): ImportacaoParseada {
  return {
    ...parseada,
    linhas: parseada.linhas.map((l) => ({ ...l, match: matchDescricao(db, l.descricao) }))
  }
}

// ---------------------------------------------------------------------------
// Commit da importação (após revisão da usuária)
// ---------------------------------------------------------------------------

export function confirmarImportacao(
  db: DB,
  meta: MetadadosMapa,
  linhas: LinhaImportacao[],
  decisoes: DecisaoLinha[]
): ResumoImportacao {
  const porLinha = new Map(decisoes.map((d) => [d.linha, d]))
  const insereOferta = db.prepare(
    `INSERT INTO ofertas (mapa_id, item_canonico_id, descricao_original, quantidade, unidade,
                          proponente, valor_unitario, valor_total, venceu)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )

  const tx = db.transaction((): ResumoImportacao => {
    const info = db
      .prepare(`INSERT INTO mapas (origem_arquivo, id_compra, orgao, data_autenticacao) VALUES (?, ?, ?, ?)`)
      .run(
        meta.arquivo || null,
        meta.idCompra?.trim() || null,
        meta.orgao?.trim() || null,
        meta.dataAutenticacao?.trim() || null
      )
    const mapaId = Number(info.lastInsertRowid)

    let ofertasCriadas = 0
    let itensCriados = 0
    let aliasesCriados = 0
    let linhasPuladas = 0
    let linhasPendentes = 0

    for (const linha of linhas) {
      const decisao: DecisaoLinha =
        porLinha.get(linha.linha) ??
        (linha.match.itemId != null && (linha.match.tipo === 'exato' || linha.match.tipo === 'forte')
          ? { linha: linha.linha, acao: 'associar', itemId: linha.match.itemId, salvarAlias: true }
          : { linha: linha.linha, acao: 'pendente', salvarAlias: false })

      if (decisao.acao === 'pular') {
        linhasPuladas++
        continue
      }

      let itemId: number | null = null
      if (decisao.acao === 'associar') {
        if (!decisao.itemId) throw new Error(`Linha ${linha.linha}: decisão "associar" sem item.`)
        itemId = decisao.itemId
      } else if (decisao.acao === 'criar') {
        if (!decisao.novoItem) throw new Error(`Linha ${linha.linha}: decisão "criar" sem dados do item.`)
        itemId = criarItem(db, decisao.novoItem).id
        itensCriados++
      } else {
        linhasPendentes++
      }

      if (itemId != null && decisao.salvarAlias) {
        if (adicionarAlias(db, itemId, linha.descricao, 'confirmado_usuario')) aliasesCriados++
      }

      const vencedora = decidirVencedora(linha)
      for (const p of linha.propostas) {
        insereOferta.run(
          mapaId,
          itemId,
          linha.descricao,
          linha.quantidade,
          linha.unidade,
          p.proponente,
          p.valorUnitario,
          p.valorTotal,
          p === vencedora ? 1 : 0
        )
        ofertasCriadas++
      }
    }

    if (ofertasCriadas === 0) throw new Error('Nenhuma oferta foi importada — importação cancelada.')

    return { mapaId, ofertasCriadas, itensCriados, aliasesCriados, linhasPuladas, linhasPendentes }
  })

  return tx()
}

function decidirVencedora(linha: LinhaImportacao): Proposta | null {
  const validas = linha.propostas.filter((p) => p.valorUnitario != null)
  if (validas.length === 0) return null

  if (linha.vencedorInformado) {
    const alvo = normalizar(linha.vencedorInformado)
    const porNome = validas.find((p) => {
      const nome = normalizar(p.proponente)
      return nome === alvo || nome.includes(alvo) || alvo.includes(nome)
    })
    if (porNome) return porNome
  }
  return validas.reduce((menor, p) => (p.valorUnitario! < menor.valorUnitario! ? p : menor))
}
