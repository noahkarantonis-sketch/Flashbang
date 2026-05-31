import { app, BrowserWindow, ipcMain, safeStorage, shell } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import {
  setApiKey,
  hasKey,
  generateCardsFromText,
  generateCardsFromImage,
  generateCardsFromPdf,
  getHint,
  explain
} from './ai'

// --- API key persistence -----------------------------------------------------
// Stored encrypted at rest via Electron safeStorage (OS-level crypto), in the
// app's userData folder. Never bundled into the renderer.
function keyPath() {
  return join(app.getPath('userData'), 'apikey.bin')
}

function loadKey(): string {
  try {
    const p = keyPath()
    if (!existsSync(p)) return ''
    const buf = readFileSync(p)
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(buf)
    }
    return buf.toString('utf8')
  } catch {
    return ''
  }
}

function persistKey(key: string) {
  const p = keyPath()
  const data = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(key)
    : Buffer.from(key, 'utf8')
  writeFileSync(p, data)
}

function createWindow() {
  const iconPath = join(__dirname, '../../build/icon.png')
  const win = new BrowserWindow({
    width: 1100,
    height: 820,
    minWidth: 880,
    minHeight: 640,
    backgroundColor: '#1B1A17',
    titleBarStyle: 'hiddenInset',
    show: false,
    icon: existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.once('ready-to-show', () => win.show())

  // Open any window.open() target (e.g. the Stripe checkout URL) in the user's
  // real browser instead of a bare Electron window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Make Windows use our app identity (taskbar grouping + icon).
  if (process.platform === 'win32') app.setAppUserModelId('com.noah.flashbang')

  // Load any saved key on boot.
  const saved = loadKey()
  if (saved) setApiKey(saved)

  // --- IPC: key management ---
  ipcMain.handle('key:status', () => hasKey())
  ipcMain.handle('key:set', (_e, key: string) => {
    setApiKey(key)
    persistKey(key)
    return hasKey()
  })

  // --- IPC: AI work (renderer never touches the key) ---
  ipcMain.handle('ai:cardsFromText', (_e, text: string) =>
    generateCardsFromText(text)
  )
  ipcMain.handle('ai:cardsFromImage', (_e, base64: string, mime: string) =>
    generateCardsFromImage(base64, mime)
  )
  ipcMain.handle('ai:cardsFromPdf', (_e, base64: string) =>
    generateCardsFromPdf(base64)
  )
  ipcMain.handle('ai:hint', (_e, input) => getHint(input))
  ipcMain.handle('ai:explain', (_e, input) => explain(input))

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
