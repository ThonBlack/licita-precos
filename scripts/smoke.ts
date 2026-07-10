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
import { criarItem, adicionarAlias, listarCatalogo } from '../src/main/services/catalogo'
import { gerarModelo } from '../src/main/services/template'
import { parseArquivo, aplicarMatches, confirmarImportacao, parseNumero } from '../src/main/services/importer'
import { exportarMapa, listarPendentes, importarPendentes } from '../src/main/services/sync'
import { matchTermo } from '../src/main/services/matcher'
import { historicoItem } from '../src/main/services/historico'
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
    ws.addRow([1, 'PAPEL SULFITE CHAMEX A4 75G PCT 500 FLS', 10, 'Pacote', 'Papelaria Alfa', 25.9, 'Distribuidora Beta', '24,50'])
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

  // idempotência: reimportar a mesma pasta não duplica
  check('sem pendentes após importar', listarPendentes(db2, pastaSync).length === 0)
  const rsync2 = importarPendentes(db2, pastaSync)
  check('reimportação não duplica', rsync2.mapasImportados === 0, rsync2)
  const totalMapasDb2 = (db2.prepare('SELECT COUNT(*) AS n FROM mapas').get() as { n: number }).n
  check('outro PC tem exatamente 1 mapa', totalMapasDb2 === 1, totalMapasDb2)

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
