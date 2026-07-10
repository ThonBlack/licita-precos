import { app, dialog } from 'electron'
import updater from 'electron-updater'
import type { EstadoUpdate } from '../shared/types'

const { autoUpdater } = updater

const CHECK_INICIAL_MS = 10_000
const CHECK_PERIODICO_MS = 4 * 60 * 60 * 1000 // 4h, igual ao Epic-Suit

let estado: EstadoUpdate = {
  fase: 'idle',
  versaoAtual: '',
  versaoNova: null,
  progresso: null,
  erro: null
}
let listenersRegistrados = false

function versaoApp(): string {
  try {
    return app.getVersion()
  } catch {
    return ''
  }
}

/** Registra os listeners do autoUpdater uma única vez (auto ou verificação manual). */
function registrarListeners(): void {
  if (listenersRegistrados) return
  listenersRegistrados = true

  autoUpdater.on('checking-for-update', () => {
    estado = { ...estado, fase: 'verificando', erro: null }
  })

  autoUpdater.on('update-available', (info) => {
    estado = { ...estado, fase: 'baixando', versaoNova: info.version, progresso: 0 }
    console.log(`[updater] Nova versão disponível: ${info.version} (atual: ${versaoApp()})`)
  })

  autoUpdater.on('download-progress', (p) => {
    estado = { ...estado, fase: 'baixando', progresso: Math.round(p.percent) }
  })

  autoUpdater.on('update-not-available', () => {
    estado = { ...estado, fase: 'atual', versaoNova: null, progresso: null }
    console.log('[updater] Versão atual é a mais recente.')
  })

  autoUpdater.on('update-downloaded', (info) => {
    estado = { ...estado, fase: 'pronto', versaoNova: info.version, progresso: 100 }
    console.log(`[updater] Download completo: ${info.version}`)
    void dialog
      .showMessageBox({
        type: 'info',
        title: 'Atualização pronta',
        message: `A versão ${info.version} do LicitaPreços foi baixada.`,
        detail: 'Reinicie agora para aplicar, ou ela será instalada quando você fechar o app.',
        buttons: ['Reiniciar agora', 'Depois'],
        defaultId: 0,
        cancelId: 1
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall()
      })
  })

  autoUpdater.on('error', (err) => {
    estado = { ...estado, fase: 'erro', erro: err instanceof Error ? err.message : String(err) }
    console.error('[updater] Erro:', err instanceof Error ? err.message : err)
  })
}

/** Checagem automática de update ao ligar + periódica. Nunca derruba o app. */
export function iniciarUpdater(): void {
  estado = { ...estado, versaoAtual: versaoApp() }
  if (!app.isPackaged) {
    estado = { ...estado, fase: 'dev' }
    return
  }

  autoUpdater.disableWebInstaller = true
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  registrarListeners()

  const checar = () =>
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[updater] Falha ao verificar:', err instanceof Error ? err.message : err)
    })

  setTimeout(checar, CHECK_INICIAL_MS)
  setInterval(checar, CHECK_PERIODICO_MS)
}

export function obterEstadoUpdate(): EstadoUpdate {
  return { ...estado, versaoAtual: versaoApp() }
}

/** Dispara uma verificação manual (botão em Configurações). A UI acompanha via obterEstadoUpdate. */
export async function verificarUpdateManual(): Promise<EstadoUpdate> {
  if (!app.isPackaged) {
    estado = { ...estado, fase: 'dev', versaoAtual: versaoApp() }
    return obterEstadoUpdate()
  }

  autoUpdater.autoDownload = true
  registrarListeners()
  estado = { ...estado, fase: 'verificando', erro: null }
  try {
    await autoUpdater.checkForUpdates()
  } catch (err) {
    estado = { ...estado, fase: 'erro', erro: err instanceof Error ? err.message : String(err) }
  }
  return obterEstadoUpdate()
}

export function instalarUpdateAgora(): void {
  autoUpdater.quitAndInstall()
}
