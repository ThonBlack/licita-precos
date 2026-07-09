import { app, dialog } from 'electron'
import updater from 'electron-updater'

const { autoUpdater } = updater

const CHECK_INICIAL_MS = 10_000
const CHECK_PERIODICO_MS = 4 * 60 * 60 * 1000 // 4h, igual ao Epic-Suit

/** Checagem automática de update ao ligar + periódica. Nunca derruba o app. */
export function iniciarUpdater(): void {
  if (!app.isPackaged) return

  autoUpdater.disableWebInstaller = true
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    console.log(`[updater] Nova versão disponível: ${info.version} (atual: ${app.getVersion()})`)
  })

  autoUpdater.on('update-not-available', () => {
    console.log('[updater] Versão atual é a mais recente.')
  })

  autoUpdater.on('update-downloaded', (info) => {
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
    console.error('[updater] Erro:', err.message)
  })

  const checar = () => autoUpdater.checkForUpdates().catch((err) => {
    console.error('[updater] Falha ao verificar:', err instanceof Error ? err.message : err)
  })

  setTimeout(checar, CHECK_INICIAL_MS)
  setInterval(checar, CHECK_PERIODICO_MS)
}
