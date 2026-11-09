import { contextBridge, ipcRenderer } from 'electron'
import type { NotesAPI } from '../shared/notes'

const api: NotesAPI = {
  exportBackup: password => ipcRenderer.invoke('backup:export', password),
  importBackup: (password, overwrite) => ipcRenderer.invoke('backup:import', password, overwrite),
  onBackup(callback) {
    const handler = () => callback()
    ipcRenderer.on('backup:request-open', handler)
    return () => ipcRenderer.removeListener('backup:request-open', handler)
  },
  deleteNote: date => ipcRenderer.invoke('notes:delete', date),
  createTask: name => ipcRenderer.invoke('task:create', name),
  openTask: () => ipcRenderer.invoke('task:open'),
  saveTask: (id, body) => ipcRenderer.invoke('task:save', id, body),
  attachTask: (id, name, bytes) => ipcRenderer.invoke('task:attach', id, name, bytes),
  taskImage: (id, path) => ipcRenderer.invoke('task:image', id, path),
  revealTask: (id, path) => ipcRenderer.invoke('task:reveal', id, path),
  onOpenMarkdown(callback) {
    const handler = () => callback()
    ipcRenderer.on('markdown:request-open', handler)
    return () => ipcRenderer.removeListener('markdown:request-open', handler)
  },
  getWindow: () => ipcRenderer.invoke('window:get'),
  setWindow: settings => ipcRenderer.invoke('window:set', settings),
  openMarkdown: () => ipcRenderer.invoke('markdown:open'),
  list: () => ipcRenderer.invoke('notes:list'),
  save: (date, body, bookmarked, category) => ipcRenderer.invoke('notes:save', date, body, bookmarked, category),
  onBeforeClose(callback) {
    const handler = () => callback()
    ipcRenderer.on('notes:before-close', handler)
    return () => ipcRenderer.removeListener('notes:before-close', handler)
  },
  confirmClose: () => ipcRenderer.send('notes:confirm-close'),
  cancelClose: () => ipcRenderer.send('notes:cancel-close'),
  onBeforeHide(callback) {
    const handler = () => callback()
    ipcRenderer.on('notes:before-hide', handler)
    return () => ipcRenderer.removeListener('notes:before-hide', handler)
  }
}
contextBridge.exposeInMainWorld('notes', api)
