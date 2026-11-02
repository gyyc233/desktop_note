import { appIconData } from './icons'
import { app, BrowserWindow, dialog, ipcMain, safeStorage, nativeImage, shell } from 'electron'
import { join, dirname } from 'node:path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { openStore } from './store'
import { attachTray } from './tray'
import { readMarkdownFile } from './markdown-file'
import { windowControls } from './window-controls'
import { installMenu } from './menu'
import { taskStore } from './tasks'

let store: ReturnType<typeof openStore>
let desktopTray: ReturnType<typeof attachTray> | undefined
if (!app.requestSingleInstanceLock()) app.exit(0)
app.on('second-instance', () => {
  desktopTray?.show()
})

function createWindow(): void {
  const window = new BrowserWindow({
    icon: nativeImage.createFromDataURL(appIconData),
    width: 1100,
    height: 760,
    minWidth: 640,
    minHeight: 480,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  window.once('ready-to-show', () => window.show())
  installMenu(window)
  const controls = windowControls(window)
  ipcMain.handle('window:get', () => controls.get())
  ipcMain.handle('window:set', (event, settings) => {
    if (event.sender !== window.webContents) throw new Error('Invalid window')
    return controls.set(settings)
  })
  window.once('closed', () => { ipcMain.removeHandler('window:get'); ipcMain.removeHandler('window:set') })
  try {
    desktopTray = attachTray(window)
  } catch (error) {
    // Keep ordinary taskbar minimization if tray creation is unavailable.
    console.error('System tray unavailable:', error)
  }
  let canClose = false
  window.on('close', (event) => {
    if (event.defaultPrevented) return
    if (!canClose && !window.webContents.isDestroyed()) {
      event.preventDefault()
      window.webContents.send('notes:before-close')
    }
  })
  const confirmClose = (event: Electron.IpcMainEvent) => {
    if (event.sender === window.webContents) { canClose = true; const quit = desktopTray?.isExiting(); window.close(); if (quit) app.quit() }
  }
  const cancelClose = (event: Electron.IpcMainEvent) => {
    if (event.sender === window.webContents) desktopTray?.cancelExit()
  }
  ipcMain.on('notes:confirm-close', confirmClose)
  ipcMain.on('notes:cancel-close', cancelClose)
  window.on('closed', () => { ipcMain.removeListener('notes:confirm-close', confirmClose); ipcMain.removeListener('notes:cancel-close', cancelClose) })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

void app.whenReady().then(() => {
  try {
    if (!safeStorage.isEncryptionAvailable() || (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')) throw new Error('系统安全密钥存储不可用')
    mkdirSync(app.getPath('userData'), { recursive: true })
    const keyPath = join(app.getPath('userData'), 'database.key')
    const dbPath = join(app.getPath('userData'), 'notes.db')
    if (!existsSync(keyPath) && existsSync(dbPath)) throw new Error('数据库密钥丢失，已停止打开以保护原有数据')
    if (!existsSync(keyPath)) writeFileSync(keyPath, safeStorage.encryptString(randomBytes(32).toString('hex')), { flag: 'wx', mode: 0o600 })
    store = openStore(dbPath, safeStorage.decryptString(readFileSync(keyPath)))
    ipcMain.handle('notes:list', () => store.list())
    ipcMain.handle('notes:save', (_event, date, body, bookmarked, category) => store.save(date, body, bookmarked, category))
    ipcMain.handle('markdown:open', async event => {
      const owner = BrowserWindow.fromWebContents(event.sender)
      if (!owner) throw new Error('窗口不可用')
      const result = await dialog.showOpenDialog(owner, { title: '打开 Markdown 文档', properties: ['openFile'], filters: [{ name: 'Markdown 文档', extensions: ['md', 'markdown', 'mdown', 'mkd'] }] })
      if (result.canceled || !result.filePaths[0]) return null
      return readMarkdownFile(result.filePaths[0])
    })
  } catch (error) {
    dialog.showErrorBox('无法打开本地记事库', String(error))
    app.quit()
    return
  }
  createWindow()
  const tasks = taskStore()
  const taskRoot = join(app.isPackaged ? dirname(process.execPath) : app.getAppPath(), 'tasks')
  ipcMain.handle('task:create', async (event, name) => {
    const owner = BrowserWindow.fromWebContents(event.sender)
    if (!owner) throw new Error('窗口不可用')
    mkdirSync(taskRoot, { recursive: true })
    return tasks.create(taskRoot, name)
  })
  ipcMain.handle('task:open', async event => {
    const owner = BrowserWindow.fromWebContents(event.sender)
    if (!owner) throw new Error('窗口不可用')
    mkdirSync(taskRoot, { recursive: true })
    const result = await dialog.showOpenDialog(owner, { title: '打开任务文件夹（包含 task.md）', defaultPath: taskRoot, properties: ['openDirectory'] })
    return result.canceled ? null : tasks.open(result.filePaths[0])
  })
  ipcMain.handle('task:save', (_event, id, body) => tasks.save(id, body))
  ipcMain.handle('task:attach', (_event, id, name, bytes) => tasks.attach(id, name, bytes))
  ipcMain.handle('task:image', (_event, id, path) => tasks.image(id, path))
  ipcMain.handle('task:reveal', async (_event, id, path) => {
    const target = tasks.locate(id, path)
    if (path === '.') {
      const error = await shell.openPath(target)
      if (error) throw new Error(error)
    } else shell.showItemInFolder(target)
  })
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    else desktopTray?.show()
  })
})
app.on('will-quit', () => store?.close())
app.on('before-quit', () => desktopTray?.prepareExit())
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
