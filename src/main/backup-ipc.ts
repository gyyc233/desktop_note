import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'node:path'
import { mkdirSync, readFileSync, statSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { collectBackup, encodeBackup, decodeBackup, writeBackup, restoreTasks, rollbackTasks } from './backup'
import type { openStore } from './store'

export function installBackup(store: ReturnType<typeof openStore>, tasksRoot: string) {
  let busy = false
  app.on('before-quit', event => { if (busy) event.preventDefault() })
  for (const mode of ['export', 'import'] as const) ipcMain.handle('backup:' + mode, async (event, password: string, overwrite = false) => {
    const owner = BrowserWindow.fromWebContents(event.sender)
    if (!owner || busy) throw new Error('备份操作正在进行或窗口不可用')
    if (typeof overwrite !== 'boolean') throw new Error('导入选项无效')
    busy = true
    try {
      const filters = [{ name: '每日记事加密备份', extensions: ['dnbak'] }]
      if (mode === 'export') {
        const chosen = await dialog.showSaveDialog(owner, { title: '导出笔记与 tasks 备份', defaultPath: '每日记事-' + new Date().toISOString().slice(0, 10) + '.dnbak', filters })
        if (chosen.canceled || !chosen.filePath) return null
        const notes = store.list()
        const files = collectBackup(notes, tasksRoot)
        const data = await encodeBackup(files, password)
        writeBackup(chosen.filePath, data)
        return { path: chosen.filePath, notes: notes.length, tasks: new Set(Object.keys(files).filter(name => name.startsWith('tasks/')).map(name => name.split('/')[1])).size, skipped: 0 }
      }
      const chosen = await dialog.showOpenDialog(owner, { title: '导入每日记事备份', properties: ['openFile'], filters })
      if (chosen.canceled || !chosen.filePaths[0]) return null
      if (statSync(chosen.filePaths[0]).size > 101 * 1024 * 1024) throw new Error('备份文件超过 101 MB')
      const backup = await decodeBackup(readFileSync(chosen.filePaths[0]), password)
      const localDates = new Set(store.list().map(note => note.date))
      const conflicts = backup.notes.filter(note => localDates.has(note.date)).length
      const confirmation = await dialog.showMessageBox(owner, { type: 'question', title: '确认导入备份', message: `备份包含 ${backup.notes.length} 篇笔记，其中 ${conflicts} 篇日期重复。`, detail: `重复日期将${overwrite ? '覆盖本地笔记' : '保留本地笔记'}；本地其他日期不删除。同名 task 自动改名。导入前会用本次密码加密备份现有笔记和 tasks。`, buttons: ['取消', '导入'], defaultId: 0, cancelId: 0 })
      if (confirmation.response !== 1) return null
      const directory = join(app.getPath('userData'), 'backups')
      mkdirSync(directory, { recursive: true })
      const safetyPath = join(directory, 'before-import-' + Date.now() + '-' + randomBytes(4).toString('hex') + '.dnbak')
      writeBackup(safetyPath, await encodeBackup(collectBackup(store.list(), tasksRoot), password))
      const created = restoreTasks(backup.files, tasksRoot)
      try {
        const result = store.importNotes(backup.notes, overwrite)
        return { path: safetyPath, notes: result.imported, skipped: result.skipped, tasks: created.length }
      } catch (error) { rollbackTasks(created, tasksRoot); throw error }
    } finally { busy = false }
  })
}
