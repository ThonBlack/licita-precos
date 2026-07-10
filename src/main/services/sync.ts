// Sincronização entre PCs via pasta compartilhada (Opção A: Drive/OneDrive/rede).
// O app só escreve/le arquivos JSON numa pasta que o usuário aponta; quem sincroniza
// a pasta entre as máquinas é a nuvem dele. Sem servidor, sem dependência de Electron aqui.
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DB } from '../db'
import type { DecisaoLinha, LinhaImportacao, PendenteSync, ResumoSync } from '../../shared/types'
import { aplicarMatches, confirmarImportacao } from './importer'

interface PropostaPacote {
  proponente: string
  valorUnitario: number | null
  valorTotal: number | null
  venceu: boolean
}

interface ItemCanonicoPacote {
  nome: string
  categoria: string | null
  unidade: string | null
}

interface ItemPacote {
  numeroItem: string | null
  descricao: string
  quantidade: number | null
  unidade: string | null
  vencedorInformado: string | null
  // item canônico ao qual a oferta estava ligada no PC de origem (p/ o outro PC recriar o catálogo)
  itemCanonico: ItemCanonicoPacote | null
  propostas: PropostaPacote[]
}

interface PacoteMapa {
  versao: 1
  uuid: string
  device: string
  criadoEm: string
  origemArquivo: string | null
  idCompra: string | null
  orgao: string | null
  dataAutenticacao: string | null
  itens: ItemPacote[]
}

interface OfertaRow {
  descricao_original: string
  quantidade: number | null
  unidade: string | null
  proponente: string
  valor_unitario: number | null
  valor_total: number | null
  venceu: number
  item_nome: string | null
  item_categoria: string | null
  item_unidade: string | null
}

interface MapaRow {
  uuid: string | null
  origem_arquivo: string | null
  id_compra: string | null
  orgao: string | null
  data_autenticacao: string | null
}

// ---------------------------------------------------------------------------
// Saída (outbox): grava o mapa recém-importado na pasta compartilhada
// ---------------------------------------------------------------------------

/** Remonta o pacote de um mapa a partir das ofertas gravadas (agrupa por item). */
function montarPacote(db: DB, mapaId: number, device: string): PacoteMapa {
  const mapa = db
    .prepare(
      `SELECT uuid, origem_arquivo, id_compra, orgao, data_autenticacao FROM mapas WHERE id = ?`
    )
    .get(mapaId) as MapaRow | undefined
  if (!mapa || !mapa.uuid) throw new Error('Mapa sem uuid — não dá para exportar.')

  const ofertas = db
    .prepare(
      `SELECT o.descricao_original, o.quantidade, o.unidade, o.proponente, o.valor_unitario, o.valor_total, o.venceu,
              ic.nome AS item_nome, ic.categoria AS item_categoria, ic.unidade_padrao AS item_unidade
       FROM ofertas o LEFT JOIN itens_canonicos ic ON ic.id = o.item_canonico_id
       WHERE o.mapa_id = ? ORDER BY o.id`
    )
    .all(mapaId) as OfertaRow[]

  const grupos = new Map<string, ItemPacote>()
  for (const o of ofertas) {
    const chave = `${o.descricao_original}${o.quantidade ?? ''}${o.unidade ?? ''}`
    let item = grupos.get(chave)
    if (!item) {
      item = {
        numeroItem: null,
        descricao: o.descricao_original,
        quantidade: o.quantidade,
        unidade: o.unidade,
        vencedorInformado: null,
        itemCanonico: o.item_nome
          ? { nome: o.item_nome, categoria: o.item_categoria, unidade: o.item_unidade }
          : null,
        propostas: []
      }
      grupos.set(chave, item)
    }
    item.propostas.push({
      proponente: o.proponente,
      valorUnitario: o.valor_unitario,
      valorTotal: o.valor_total,
      venceu: o.venceu === 1
    })
    if (o.venceu === 1) item.vencedorInformado = o.proponente
  }

  return {
    versao: 1,
    uuid: mapa.uuid,
    device,
    criadoEm: new Date().toISOString(),
    origemArquivo: mapa.origem_arquivo,
    idCompra: mapa.id_compra,
    orgao: mapa.orgao,
    dataAutenticacao: mapa.data_autenticacao,
    itens: [...grupos.values()]
  }
}

/** Escreve o pacote na pasta de sync (grava .tmp e renomeia p/ o outro PC nunca ler pela metade). */
export function exportarMapa(db: DB, pastaSync: string, mapaId: number, device: string): void {
  if (!pastaSync) return
  if (!existsSync(pastaSync)) mkdirSync(pastaSync, { recursive: true })
  const pacote = montarPacote(db, mapaId, device)
  const destino = join(pastaSync, `mapa-${pacote.uuid}.json`)
  const tmp = `${destino}.tmp`
  writeFileSync(tmp, JSON.stringify(pacote, null, 2))
  renameSync(tmp, destino)
}

/**
 * Publica (reescreve) todos os mapas locais na pasta. Sempre sobrescreve para propagar
 * atualizações do formato do pacote (ex: nome/categoria do item canônico). Retorna quantos.
 */
export function exportarTodos(db: DB, pastaSync: string, device: string): number {
  if (!pastaSync) return 0
  if (!existsSync(pastaSync)) mkdirSync(pastaSync, { recursive: true })
  const mapas = db
    .prepare(`SELECT id, uuid FROM mapas WHERE uuid IS NOT NULL`)
    .all() as { id: number; uuid: string }[]
  for (const m of mapas) exportarMapa(db, pastaSync, m.id, device)
  return mapas.length
}

// ---------------------------------------------------------------------------
// Entrada (inbox): lê a pasta e importa mapas que ainda não existem localmente
// ---------------------------------------------------------------------------

function uuidsLocais(db: DB): Set<string> {
  const rows = db.prepare(`SELECT uuid FROM mapas WHERE uuid IS NOT NULL`).all() as { uuid: string }[]
  return new Set(rows.map((r) => r.uuid))
}

/** Lista pacotes na pasta cujo uuid ainda não foi importado neste PC. */
export function listarPendentes(db: DB, pastaSync: string): PendenteSync[] {
  if (!pastaSync || !existsSync(pastaSync)) return []
  const locais = uuidsLocais(db)
  const pendentes: PendenteSync[] = []
  for (const arq of readdirSync(pastaSync)) {
    if (!arq.startsWith('mapa-') || !arq.endsWith('.json')) continue
    try {
      const pac = JSON.parse(readFileSync(join(pastaSync, arq), 'utf8')) as PacoteMapa
      if (!pac.uuid || locais.has(pac.uuid)) continue
      pendentes.push({
        uuid: pac.uuid,
        arquivo: arq,
        origemArquivo: pac.origemArquivo ?? null,
        idCompra: pac.idCompra ?? null,
        orgao: pac.orgao ?? null,
        dataAutenticacao: pac.dataAutenticacao ?? null,
        totalItens: Array.isArray(pac.itens) ? pac.itens.length : 0
      })
    } catch {
      // arquivo corrompido ou gravação parcial de outro PC: ignora nesta rodada
    }
  }
  return pendentes
}

function pacoteParaLinhas(pac: PacoteMapa): LinhaImportacao[] {
  return pac.itens.map((it, i) => ({
    linha: i + 1,
    numeroItem: it.numeroItem ?? null,
    descricao: it.descricao,
    quantidade: it.quantidade ?? null,
    unidade: it.unidade ?? null,
    propostas: it.propostas.map((p) => ({
      proponente: p.proponente,
      valorUnitario: p.valorUnitario,
      valorTotal: p.valorTotal
    })),
    vencedorInformado: it.vencedorInformado ?? null,
    match: { tipo: 'nenhum', itemId: null, itemNome: null, similaridade: 0, sugestoes: [] }
  }))
}

/**
 * Importa todos os pacotes pendentes da pasta. Cada mapa é reconhecido contra o catálogo
 * LOCAL (o match é refeito aqui), preservando o "efeito rede" de apelidos de cada máquina.
 * Idempotente: o uuid do mapa é a chave; reimportar não duplica.
 */
export function importarPendentes(db: DB, pastaSync: string): ResumoSync {
  const resumo: ResumoSync = { mapasImportados: 0, ofertasCriadas: 0, itensCriados: 0, falhas: 0 }
  if (!pastaSync || !existsSync(pastaSync)) return resumo

  const locais = uuidsLocais(db)
  for (const arq of readdirSync(pastaSync)) {
    if (!arq.startsWith('mapa-') || !arq.endsWith('.json')) continue
    let pac: PacoteMapa
    try {
      pac = JSON.parse(readFileSync(join(pastaSync, arq), 'utf8')) as PacoteMapa
    } catch {
      continue
    }
    if (!pac.uuid || locais.has(pac.uuid) || !Array.isArray(pac.itens) || pac.itens.length === 0) {
      continue
    }
    try {
      const parseada = aplicarMatches(db, {
        arquivo: pac.origemArquivo ?? arq,
        caminho: '',
        linhas: pacoteParaLinhas(pac),
        avisos: []
      })
      // Decisões automáticas: se bate com o catálogo local, associa; senão CRIA o item
      // (usando o nome/categoria vindos do PC de origem, ou a descrição) — assim o outro
      // PC constrói o próprio catálogo e os itens aparecem em Busca/Catálogo.
      const decisoes: DecisaoLinha[] = parseada.linhas.map((l, i) => {
        if (l.match.itemId != null && (l.match.tipo === 'exato' || l.match.tipo === 'forte')) {
          return { linha: l.linha, acao: 'associar', itemId: l.match.itemId, salvarAlias: l.match.tipo !== 'exato' }
        }
        const src = pac.itens[i]?.itemCanonico ?? null
        const nome = (src?.nome || l.descricao).trim()
        const existente = acharItemPorNome(db, nome)
        if (existente != null) {
          return { linha: l.linha, acao: 'associar', itemId: existente, salvarAlias: true }
        }
        return {
          linha: l.linha,
          acao: 'criar',
          novoItem: { nome, categoria: src?.categoria ?? null, unidade: src?.unidade ?? l.unidade ?? null },
          salvarAlias: true
        }
      })
      const r = confirmarImportacao(
        db,
        {
          arquivo: pac.origemArquivo ?? '',
          idCompra: pac.idCompra ?? null,
          orgao: pac.orgao ?? null,
          dataAutenticacao: pac.dataAutenticacao ?? null,
          uuid: pac.uuid
        },
        parseada.linhas,
        decisoes
      )
      locais.add(pac.uuid)
      resumo.mapasImportados++
      resumo.ofertasCriadas += r.ofertasCriadas
      resumo.itensCriados += r.itensCriados
    } catch {
      resumo.falhas++
    }
  }
  return resumo
}

/** Acha um item canônico local pelo nome (case-insensitive) para não duplicar na sincronização. */
function acharItemPorNome(db: DB, nome: string): number | null {
  if (!nome) return null
  const row = db.prepare(`SELECT id FROM itens_canonicos WHERE lower(nome) = lower(?) LIMIT 1`).get(nome) as
    | { id: number }
    | undefined
  return row?.id ?? null
}
