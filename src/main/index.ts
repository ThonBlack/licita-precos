import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'
import { openDb } from './db'
import { registrarIpc } from './ipc'
import { initConfig, obterConfig, salvarConfig } from './services/settings'
import { backupAutomatico } from './services/backup'
import { detectarPastaDrive } from './services/drive'
import { iniciarUpdater } from './updater'

// Diretório de dados fixo, igual em dev e empacotado, para o banco não "mudar de lugar"
const userDataDir = join(app.getPath('appData'), 'LicitaPrecos')
app.setPath('userData', userDataDir)

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    show: !process.env.LICITA_SMOKE,
    autoHideMenuBar: true,
    title: 'LicitaPreços',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }
  return win
}

app.whenReady().then(() => {
  mkdirSync(userDataDir, { recursive: true })
  initConfig(userDataDir)
  const dbPath = join(userDataDir, 'licitaprecos.db')
  const db = openDb(dbPath)
  registrarIpc(db, dbPath)

  // Backup automático do banco a cada abertura (máx 1/12h, últimos 10) — sem depender do usuário.
  try {
    backupAutomatico(db, dbPath, userDataDir)
  } catch (err) {
    console.error('[backup] auto falhou:', err instanceof Error ? err.message : err)
  }

  // Auto-detecção da pasta do Drive: se ainda não há pasta válida, procura "Licita Precos Mih".
  try {
    const cfg = obterConfig()
    if (!cfg.pastaSync || !existsSync(cfg.pastaSync)) {
      const achada = detectarPastaDrive()
      if (achada) salvarConfig({ pastaSync: achada })
    }
  } catch (err) {
    console.error('[drive] auto-detect falhou:', err instanceof Error ? err.message : err)
  }

  const win = createWindow()

  if (process.env.LICITA_SMOKE) {
    win.webContents.once('did-finish-load', () => {
      console.log('SMOKE_OK')
      app.quit()
    })
    win.webContents.once('did-fail-load', (_e, code, desc) => {
      console.error('SMOKE_FAIL', code, desc)
      app.exit(1)
    })
  }

  iniciarUpdater()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  app.quit()
})
