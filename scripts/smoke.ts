/**
 * Smoke test E2E dos serviços (roda em Node puro, sem Electron):
 * gera modelo → preenche planilha → parse + fuzzy match → confirma importação →
 * busca por marca ("chamex") → histórico/estatísticas.
 *
 * Rodar: pnpm smoke
 * Atenção: precisa do better-sqlite3 compilado para o ABI do Node (não do Electron).
 */
import { mkdtempSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ExcelJS from 'exceljs'
import { openDb } from '../src/main/db'
import { criarItem, adicionarAlias, listarCatalogo, mesclarItens, itensParecidos } from '../src/main/services/catalogo'
import { gerarRelatorio } from '../src/main/services/relatorio'
import { gerarModelo } from '../src/main/services/template'
import { parseArquivo, aplicarMatches, confirmarImportacao, parseNumero } from '../src/main/services/importer'
import { exportarMapa, exportarTodos, listarPendentes, importarPendentes } from '../src/main/services/sync'
import { backupAutomatico } from '../src/main/services/backup'
import { detectarPastaDrive, NOME_PASTA_DRIVE } from '../src/main/services/drive'
import { montarPromptAntigravity } from '../src/shared/prompts'
import { matchTermo } from '../src/main/services/matcher'
import { buscarProdutos, historicoItem } from '../src/main/services/historico'
import { listaFornecedores, opcoesFiltro, resumoPainel } from '../src/main/services/analytics'
import { normalizar } from '../src/main/services/normalize'

let falhas = 0
function check(nome: string, cond: boolean, detalhe?: unknown): void {
  if (cond) {
    console.log(`  ok  ${nome}`)
  } else {
    falhas++
    console.error(`FALHA ${nome}`, detalhe ?? '')
  }
}

const dir = mkdtempSync(join(tmpdir(), 'licitaprecos-smoke-'))
try {
  // --- normalização e números BR ---------------------------------------
  check('normalizar acentos/pontuação', normalizar('LÁPIS Preto Nº-2, cx c/12') === 'lapis preto n 2 cx c 12')
  check('parseNumero BR', parseNumero('R$ 1.234,56') === 1234.56)
  check('parseNumero decimal simples', parseNumero('3,90') === 3.9)
  check('parseNumero US', parseNumero('1,234.56') === 1234.56)
  check('parseNumero ilegível', parseNumero('ILEGÍVEL') === null)

  // --- banco + catálogo -------------------------------------------------
  const db = openDb(join(dir, 'teste.db'))
  const papel = criarItem(db, { nome: 'Papel Sulfite A4', categoria: 'papelaria', unidade: 'Resma' })
  adicionarAlias(db, papel.id, 'Chamex', 'confirmado_usuario')
  adicionarAlias(db, papel.id, 'papel a4 75g', 'confirmado_usuario')

  // --- modelo -----------------------------------------------------------
  const modeloPath = join(dir, 'modelo.xlsx')
  await gerarModelo(modeloPath)
  check('modelo gerado', existsSync(modeloPath))

  // --- planilha preenchida ---------------------------------------------
  const preenchida = join(dir, 'mapa-preenchido.xlsx')
  {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(modeloPath)
    const ws = wb.getWorksheet('Mapa')!
    const l1row = ws.addRow([1, 'PAPEL SULFITE CHAMEX A4 75G PCT 500 FLS', 10, 'Pacote', 'Papelaria Alfa', 25.9, 'Distribuidora Beta', '24,50'])
    l1row.getCell(18).value = 26.5 // coluna "Preço de referência"
    ws.addRow([2, 'Lápis preto nº 2 Faber Castell cx c/ 12', 5, 'Caixa', 'Papelaria Alfa', '18,00', 'Distribuidora Beta', 19.9, '', '', '', '', '', '', '', '', 'Papelaria Alfa'])
    await wb.xlsx.writeFile(preenchida)
  }

  // --- parse + match ----------------------------------------------------
  const parseada = aplicarMatches(db, await parseArquivo(preenchida))
  check('2 linhas parseadas', parseada.linhas.length === 2, parseada.linhas.length)
  const [l1, l2] = parseada.linhas
  check('linha 1 com 2 propostas', l1!.propostas.length === 2)
  check('valor BR na linha 1', l1!.propostas[1]!.valorUnitario === 24.5)
  check('valor total calculado', l1!.propostas[0]!.valorTotal === 259)
  check(
    'linha 1 casa com Papel Sulfite A4 (sugestão/forte)',
    l1!.match.itemId === papel.id && l1!.match.tipo !== 'nenhum',
    l1!.match
  )
  check('linha 2 sem match', l2!.match.tipo === 'nenhum', l2!.match)
  check('vencedor informado lido', l2!.vencedorInformado === 'Papelaria Alfa')
  check('preço de referência lido da planilha', l1!.precoReferencia === 26.5, l1!.precoReferencia)

  // --- confirmar importação ----------------------------------------------
  const resumo = confirmarImportacao(
    db,
    { arquivo: 'mapa-preenchido.xlsx', idCompra: '2026.134827', orgao: 'E.E. América', dataAutenticacao: '2026-07-01' },
    parseada.linhas,
    [
      { linha: l1!.linha, acao: 'associar', itemId: papel.id, salvarAlias: true },
      {
        linha: l2!.linha,
        acao: 'criar',
        novoItem: { nome: 'Lápis Preto nº 2', categoria: 'papelaria', unidade: 'Caixa' },
        salvarAlias: true
      }
    ]
  )
  check('4 ofertas criadas', resumo.ofertasCriadas === 4, resumo)
  check('1 item criado', resumo.itensCriados === 1)
  check('aliases aprendidos', resumo.aliasesCriados === 2, resumo.aliasesCriados)

  // --- efeito rede: reimportar mesma descrição agora bate exato ----------
  const reparse = aplicarMatches(db, await parseArquivo(preenchida))
  check('reimportação: linha 1 vira exato', reparse.linhas[0]!.match.tipo === 'exato', reparse.linhas[0]!.match)
  check('reimportação: linha 2 vira exato', reparse.linhas[1]!.match.tipo === 'exato', reparse.linhas[1]!.match)

  // --- busca por marca e termo parcial ------------------------------------
  const porMarca = matchTermo(db, 'chamex', 5)
  check('busca "chamex" resolve papel', porMarca[0]?.itemId === papel.id && porMarca[0].similaridade === 1, porMarca)
  const porTermo = matchTermo(db, 'faber castell', 5)
  const itemLapis = listarCatalogo(db).find((i) => i.nome === 'Lápis Preto nº 2')!
  check('busca "faber castell" sugere lápis', porTermo.some((c) => c.itemId === itemLapis.id), porTermo)

  // --- histórico + estatísticas ------------------------------------------
  const hist = historicoItem(db, papel.id)
  check('histórico com 2 registros', hist.registros.length === 2, hist.registros.length)
  check('mínimo 24,50', hist.stats.minimo === 24.5, hist.stats)
  check('máximo 25,90', hist.stats.maximo === 25.9)
  check('mediana 25,20', hist.stats.mediana === 25.2)
  check('vencedor = menor preço (Distribuidora Beta)', hist.stats.vencedorFrequente === 'Distribuidora Beta', hist.stats)

  const histLapis = historicoItem(db, itemLapis.id)
  check(
    'vencedor informado prevalece (Papelaria Alfa)',
    histLapis.registros.find((r) => r.venceu === 1)?.proponente === 'Papelaria Alfa',
    histLapis.registros
  )

  const histFiltrado = historicoItem(db, papel.id, 'alfa')
  check('filtro por proponente', histFiltrado.registros.length === 1, histFiltrado.registros.length)

  // --- produtos (busca c/ filtros) + analytics (Painel/Fornecedores) --------
  check('estatística: preço vencedor médio', historicoItem(db, papel.id).stats.precoVencedorMedio === 24.5)
  const prods = buscarProdutos(db, {})
  check('buscarProdutos lista os itens', prods.length >= 2, prods.length)
  const soBeta = buscarProdutos(db, { fornecedor: 'Distribuidora Beta' })
  check('filtro por fornecedor restringe', soBeta.some((p) => p.item.id === papel.id), soBeta.length)
  const soAmerica = buscarProdutos(db, { orgao: 'E.E. América' })
  check('filtro por órgão', soAmerica.length >= 2, soAmerica.length)
  const forn = listaFornecedores(db)
  check('fornecedores agregados (Beta venceu 1)', forn.some((f) => /beta/i.test(f.nome) && f.vitorias === 1), forn)
  const painel = resumoPainel(db)
  check('painel totais', painel.totais.mapas === 1 && painel.totais.ofertas === 4, painel.totais)
  check('painel gasto por órgão', painel.gastoPorOrgao.some((g) => g.orgao === 'E.E. América'), painel.gastoPorOrgao)
  const ops = opcoesFiltro(db)
  check('opções de filtro', ops.fornecedores.length >= 2 && ops.orgaos.includes('E.E. América'), ops)

  // --- merge de itens + relatório Excel --------------------------------------
  const dup = criarItem(db, { nome: 'Papel Sulfite A4 (duplicado)', categoria: null, unidade: null })
  const antesCat = listarCatalogo(db).length
  const rmerge = mesclarItens(db, [dup.id], papel.id)
  check('merge remove o item de origem', rmerge.itensRemovidos === 1, rmerge)
  check('merge: catálogo diminui em 1', listarCatalogo(db).length === antesCat - 1)
  check('merge: item de origem some', !listarCatalogo(db).some((i) => i.id === dup.id))
  check('merge é idempotente/sem alvo', mesclarItens(db, [papel.id], papel.id).itensRemovidos === 0)
  check('itensParecidos não quebra', Array.isArray(itensParecidos(db, papel.id)))
  const relPath = join(dir, 'relatorio.xlsx')
  await gerarRelatorio(db, {}, relPath)
  check('relatório xlsx gerado', existsSync(relPath))
  check('papel: teto de referência guardado', historicoItem(db, papel.id).stats.precoReferencia === 26.5)

  // --- sincronização entre PCs (Opção A: pasta compartilhada) -------------
  const pastaSync = join(dir, 'sync')
  mkdirSync(pastaSync, { recursive: true })
  exportarMapa(db, pastaSync, resumo.mapaId, 'device-pc1')
  check('pacote exportado na pasta', existsSync(join(pastaSync, `mapa-${resumo.uuid}.json`)))

  const db2 = openDb(join(dir, 'teste2.db')) // simula outro PC, catálogo próprio (vazio)
  const pend = listarPendentes(db2, pastaSync)
  check('outro PC vê 1 mapa pendente', pend.length === 1, pend.length)
  check('pendente traz metadados', pend[0]?.orgao === 'E.E. América' && pend[0]?.totalItens === 2, pend[0])

  const rsync = importarPendentes(db2, pastaSync)
  check('outro PC importou 1 mapa', rsync.mapasImportados === 1, rsync)
  check('outro PC criou 4 ofertas', rsync.ofertasCriadas === 4, rsync)
  const uuidDb2 = (db2.prepare('SELECT uuid FROM mapas').get() as { uuid: string } | undefined)?.uuid
  check('uuid do mapa preservado entre PCs', uuidDb2 === resumo.uuid, uuidDb2)
  const ofertasDb2 = (db2.prepare('SELECT COUNT(*) AS n FROM ofertas').get() as { n: number }).n
  check('ofertas gravadas no outro PC', ofertasDb2 === 4, ofertasDb2)

  // sync popula o CATÁLOGO do outro PC (senão nada aparece em Busca/Catálogo)
  const catDb2 = listarCatalogo(db2)
  check('outro PC criou 2 itens no catálogo via sync', rsync.itensCriados === 2, rsync.itensCriados)
  check(
    'catálogo do outro PC recebeu os nomes canônicos',
    catDb2.length === 2 && catDb2.some((c) => c.nome === 'Papel Sulfite A4'),
    catDb2.map((c) => c.nome)
  )
  check(
    'busca no outro PC acha o item sincronizado',
    matchTermo(db2, 'papel sulfite', 5).some((c) => c.itemNome === 'Papel Sulfite A4'),
    matchTermo(db2, 'papel sulfite', 5)
  )

  // idempotência: reimportar a mesma pasta não duplica
  check('sem pendentes após importar', listarPendentes(db2, pastaSync).length === 0)
  const rsync2 = importarPendentes(db2, pastaSync)
  check('reimportação não duplica', rsync2.mapasImportados === 0, rsync2)
  const totalMapasDb2 = (db2.prepare('SELECT COUNT(*) AS n FROM mapas').get() as { n: number }).n
  check('outro PC tem exatamente 1 mapa', totalMapasDb2 === 1, totalMapasDb2)

  // --- auto-detecção da pasta do Google Drive -----------------------------
  const driveRaiz = join(dir, 'DriveFake', 'Meu Drive')
  mkdirSync(join(driveRaiz, NOME_PASTA_DRIVE), { recursive: true })
  check(
    'detecta a pasta do Drive por nome',
    detectarPastaDrive([driveRaiz]) === join(driveRaiz, NOME_PASTA_DRIVE)
  )
  check('sem a pasta do Drive → null', detectarPastaDrive([join(dir, 'DriveFake', 'Inexistente')]) === null)

  // --- backup automático do banco -----------------------------------------
  const bk = backupAutomatico(db, join(dir, 'teste.db'), dir)
  check('backup automático criado', !!bk && existsSync(bk), bk)
  check('backup não duplica em <12h', backupAutomatico(db, join(dir, 'teste.db'), dir) === null)

  // --- prompt do Antigravity com caminhos reais ---------------------------
  const promptAG = montarPromptAntigravity('C:/trab/mapa-modelo.xlsx', ['C:/trab/foto1.jpg', 'C:/trab/nota.pdf'])
  check('prompt inclui o caminho do xlsx', promptAG.includes('C:/trab/mapa-modelo.xlsx'))
  check('prompt inclui os arquivos do mapa', promptAG.includes('foto1.jpg') && promptAG.includes('nota.pdf'))

  // --- exportarTodos (push do botão "Sincronizar") ------------------------
  check('exportarTodos republica os mapas locais', exportarTodos(db, pastaSync, 'device-pc1') === 1)
  const pastaSync3 = join(dir, 'sync3')
  check('exportarTodos envia todos para pasta nova', exportarTodos(db, pastaSync3, 'device-pc1') === 1)
  check('mapa gravado na pasta nova', existsSync(join(pastaSync3, `mapa-${resumo.uuid}.json`)))

  // --- preço de referência (teto): oferta acima do teto (cria um mapa próprio) ----
  const itemTeto = criarItem(db, { nome: 'Item Teto', categoria: null, unidade: 'Und' })
  confirmarImportacao(
    db,
    { arquivo: 'ref.xlsx', idCompra: 'R1', orgao: 'Escola Ref', dataAutenticacao: '2026-07-01' },
    [
      {
        linha: 1,
        numeroItem: null,
        descricao: 'Produto com teto',
        quantidade: 1,
        unidade: 'Und',
        propostas: [
          { proponente: 'Barato', valorUnitario: 40, valorTotal: 40 },
          { proponente: 'Caro', valorUnitario: 60, valorTotal: 60 }
        ],
        vencedorInformado: null,
        precoReferencia: 50,
        match: { tipo: 'nenhum', itemId: null, itemNome: null, similaridade: 0, sugestoes: [] }
      }
    ],
    [{ linha: 1, acao: 'associar', itemId: itemTeto.id, salvarAlias: false }]
  )
  const hTeto = historicoItem(db, itemTeto.id)
  check('teto de referência = 50', hTeto.stats.precoReferencia === 50, hTeto.stats.precoReferencia)
  check('1 oferta acima do teto (Caro 60 > 50)', hTeto.stats.acimaDoTeto === 1, hTeto.stats.acimaDoTeto)
  check('registro carrega o teto', hTeto.registros.every((r) => r.preco_referencia === 50))

  db2.close()
  db.close()
} finally {
  rmSync(dir, { recursive: true, force: true })
}

if (falhas > 0) {
  console.error(`\n${falhas} verificação(ões) falharam`)
  process.exit(1)
}
console.log('\nSMOKE E2E OK')
