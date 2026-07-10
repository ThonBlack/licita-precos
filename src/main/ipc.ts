import { dialog, ipcMain, shell } from 'electron'
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import type { DB } from './db'
import type {
  ConfigApp,
  DecisaoLinha,
  LinhaImportacao,
  Mapa,
  MensagemChat,
  MetadadosMapa,
  Resp
} from '../shared/types'
import { gerarModelo } from './services/template'
import { aplicarMatches, confirmarImportacao, parseArquivo } from './services/importer'
import {
  adicionarAlias,
  atualizarItem,
  criarItem,
  excluirItem,
  listarCatalogo,
  removerAlias
} from './services/catalogo'
import { historicoItem } from './services/historico'
import { LIMIAR_BUSCA, matchTermo } from './services/matcher'
import { perguntar } from './services/chat'
import { categorizar } from './services/categorizar'
import { exportarBackup } from './services/backup'
import { obterConfig, salvarConfig } from './services/settings'
import { exportarMapa, exportarTodos, importarPendentes, listarPendentes } from './services/sync'
import { detectarPastaDrive } from './services/drive'
import { instalarUpdateAgora, obterEstadoUpdate, verificarUpdateManual } from './updater'

const ANTIGRAVITY_URL = 'https://antigravity.google/download'

/** Procura o Antigravity (fork do VS Code) nos caminhos de instalação padrão do Windows. */
function detectarAntigravity(): string | null {
  const local = process.env.LOCALAPPDATA
  const prog = process.env.ProgramFiles
  const candidatos = [
    local && join(local, 'Programs', 'Antigravity', 'Antigravity.exe'),
    local && join(local, 'Programs', 'antigravity', 'Antigravity.exe'),
    prog && join(prog, 'Antigravity', 'Antigravity.exe')
  ].filter((c): c is string => typeof c === 'string')
  return candidatos.find((c) => existsSync(c)) ?? null
}

function handle(canal: string, fn: (...args: never[]) => unknown): void {
  ipcMain.handle(canal, async (_evento, ...args): Promise<Resp<unknown>> => {
    try {
      return { ok: true, data: await fn(...(args as never[])) }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}

export function registrarIpc(db: DB, dbPath: string): void {
  const userDataDir = dirname(dbPath)

  /** Cria uma pasta de trabalho nova (uma "sessão" de preenchimento) dentro do userData. */
  function novaSessao(): string {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    const dir = join(userDataDir, 'trabalho', stamp)
    mkdirSync(join(dir, 'arquivos'), { recursive: true })
    return dir
  }

  handle('template:baixar', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Salvar planilha modelo',
      defaultPath: 'modelo-mapa-apuracao.xlsx',
      filters: [{ name: 'Planilha Excel', extensions: ['xlsx'] }]
    })
    if (canceled || !filePath) return null
    await gerarModelo(filePath)
    return { caminho: filePath }
  })

  handle('importacao:abrir', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Selecionar planilha preenchida',
      properties: ['openFile'],
      filters: [{ name: 'Planilha Excel', extensions: ['xlsx'] }]
    })
    const caminho = filePaths[0]
    if (canceled || !caminho) return null
    const parseada = await parseArquivo(caminho)
    return aplicarMatches(db, parseada)
  })

  handle('importacao:confirmar', (meta: MetadadosMapa, linhas: LinhaImportacao[], decisoes: DecisaoLinha[]) => {
    const resumo = confirmarImportacao(db, meta, linhas, decisoes)
    try {
      const cfg = obterConfig()
      if (cfg.pastaSync) exportarMapa(db, cfg.pastaSync, resumo.mapaId, cfg.deviceId)
    } catch (err) {
      // sync é best-effort: uma falha ao gravar na pasta não pode derrubar a importação
      console.error('[sync] falha ao exportar mapa:', err instanceof Error ? err.message : err)
    }
    return resumo
  })

  handle('mapas:listar', () =>
    db
      .prepare(
        `SELECT m.*, (SELECT COUNT(*) FROM ofertas o WHERE o.mapa_id = m.id) AS totalOfertas
         FROM mapas m ORDER BY m.importado_em DESC`
      )
      .all() as Mapa[]
  )

  handle('mapas:excluir', (mapaId: number) => {
    db.prepare(`DELETE FROM mapas WHERE id = ?`).run(mapaId)
    return null
  })

  handle('catalogo:listar', () => listarCatalogo(db))
  handle('catalogo:criarItem', (dados: { nome: string; categoria: string | null; unidade: string | null }) =>
    criarItem(db, dados)
  )
  handle(
    'catalogo:atualizarItem',
    (id: number, dados: { nome: string; categoria: string | null; unidade: string | null }) => {
      atualizarItem(db, id, dados)
      return null
    }
  )
  handle('catalogo:excluirItem', (id: number) => {
    excluirItem(db, id)
    return null
  })
  handle('catalogo:addAlias', (itemId: number, alias: string) => {
    adicionarAlias(db, itemId, alias, 'confirmado_usuario')
    return null
  })
  handle('catalogo:removerAlias', (aliasId: number) => {
    removerAlias(db, aliasId)
    return null
  })

  handle('busca:termo', (termo: string) => {
    const candidatos = matchTermo(db, termo, 6)
    const melhor = candidatos[0]
    const resolvido = melhor && melhor.similaridade >= LIMIAR_BUSCA ? melhor : null
    return { resolvido, candidatos: resolvido ? candidatos.slice(1) : candidatos }
  })

  handle('historico:item', (itemId: number) => historicoItem(db, itemId))

  handle('chat:perguntar', async (mensagens: MensagemChat[]) => {
    const cfg = obterConfig()
    return perguntar(db, cfg.groqApiKey, cfg.groqModel, mensagens)
  })

  handle('ia:categorizar', async (descricoes: string[]) => {
    const cfg = obterConfig()
    return categorizar(cfg.groqApiKey, cfg.groqModel, descricoes)
  })

  handle('backup:exportar', async () => {
    const hoje = new Date().toISOString().slice(0, 10)
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Exportar backup do banco',
      defaultPath: `backup-licitaprecos-${hoje}.db`,
      filters: [{ name: 'Banco SQLite', extensions: ['db'] }]
    })
    if (canceled || !filePath) return null
    exportarBackup(db, dbPath, filePath)
    return { caminho: filePath }
  })

  handle('config:obter', () => {
    const contagem = (tabela: string) =>
      (db.prepare(`SELECT COUNT(*) AS n FROM ${tabela}`).get() as { n: number }).n
    return {
      ...obterConfig(),
      dbPath,
      itens: contagem('itens_canonicos'),
      aliases: contagem('itens_aliases'),
      mapas: contagem('mapas'),
      ofertas: contagem('ofertas')
    }
  })

  handle('config:salvar', (cfg: Partial<ConfigApp>) => {
    salvarConfig(cfg)
    return null
  })

  handle('update:verificar', () => verificarUpdateManual())
  handle('update:estado', () => obterEstadoUpdate())
  handle('update:instalar', () => {
    instalarUpdateAgora()
    return null
  })

  handle('sync:escolherPasta', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Escolher pasta de sincronização (dentro do Drive/OneDrive)',
      properties: ['openDirectory', 'createDirectory']
    })
    const pasta = filePaths[0]
    if (canceled || !pasta) return null
    salvarConfig({ pastaSync: pasta })
    return { pasta }
  })

  handle('sync:status', () => {
    const cfg = obterConfig()
    if (!cfg.pastaSync) {
      return { pastaConfigurada: false, pasta: '', erro: null, pendentes: [] }
    }
    try {
      return {
        pastaConfigurada: true,
        pasta: cfg.pastaSync,
        erro: null,
        pendentes: listarPendentes(db, cfg.pastaSync)
      }
    } catch (err) {
      return {
        pastaConfigurada: true,
        pasta: cfg.pastaSync,
        erro: err instanceof Error ? err.message : String(err),
        pendentes: []
      }
    }
  })

  handle('sync:importar', () => {
    const cfg = obterConfig()
    return importarPendentes(db, cfg.pastaSync)
  })

  // Botão "Sincronizar": envia meus mapas que faltam + puxa os de outros PCs, num clique só.
  handle('sync:sincronizar', () => {
    const cfg = obterConfig()
    if (!cfg.pastaSync) {
      return { enviados: 0, mapasImportados: 0, ofertasCriadas: 0, itensCriados: 0, falhas: 0 }
    }
    const enviados = exportarTodos(db, cfg.pastaSync, cfg.deviceId)
    const rec = importarPendentes(db, cfg.pastaSync)
    return { enviados, ...rec }
  })

  // Acha sozinho a pasta "Licita Precos Mih" no Google Drive deste PC e a fixa como pasta de sync.
  handle('sync:autoDetectar', () => {
    const cfg = obterConfig()
    if (cfg.pastaSync && existsSync(cfg.pastaSync)) return { pasta: cfg.pastaSync, detectada: false }
    const achada = detectarPastaDrive()
    if (achada) {
      salvarConfig({ pastaSync: achada })
      return { pasta: achada, detectada: true }
    }
    return { pasta: '', detectada: false }
  })

  // --- Fluxo "Preencher com IA (Antigravity)": planilha + arquivos numa pasta de trabalho ---
  handle('mapa:preparar', async () => {
    const pastaSessao = novaSessao()
    const caminhoXlsx = join(pastaSessao, 'mapa-modelo.xlsx')
    await gerarModelo(caminhoXlsx)
    return { pastaSessao, caminhoXlsx, caminhosMapas: [] }
  })

  handle('mapa:adicionarArquivos', async (pastaSessao: string) => {
    const destinoDir = join(pastaSessao, 'arquivos')
    mkdirSync(destinoDir, { recursive: true })
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Selecionar arquivos do mapa (pode marcar vários)',
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Mapas (imagem, PDF, Word, texto, planilha)',
          extensions: [
            // imagens
            'jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tif', 'tiff', 'heic',
            // pdf
            'pdf',
            // documentos
            'doc', 'docx', 'txt', 'rtf', 'odt',
            // planilhas
            'xls', 'xlsx', 'csv', 'ods'
          ]
        },
        { name: 'Todos os arquivos', extensions: ['*'] }
      ]
    })
    if (!canceled) {
      for (const src of filePaths) {
        try {
          copyFileSync(src, join(destinoDir, basename(src)))
        } catch {
          // arquivo inacessível: ignora, os demais seguem
        }
      }
    }
    // fonte da verdade: tudo que está na pasta de arquivos da sessão
    return readdirSync(destinoDir).map((a) => join(destinoDir, a))
  })

  handle('mapa:importarSessao', async (caminhoXlsx: string) => {
    const parseada = await parseArquivo(caminhoXlsx)
    return aplicarMatches(db, parseada)
  })

  handle('sys:antigravity', () => ({ instalado: detectarAntigravity() != null, url: ANTIGRAVITY_URL }))

  handle('sys:abrirAntigravity', async () => {
    const exe = detectarAntigravity()
    if (exe) await shell.openPath(exe)
    else await shell.openExternal(ANTIGRAVITY_URL)
    return { instalado: exe != null, url: ANTIGRAVITY_URL }
  })
}
