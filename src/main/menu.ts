import { app, Menu } from 'electron'
import type { BrowserWindow, MenuItemConstructorOptions } from 'electron'

export function installMenu(window: BrowserWindow) {
  const template: MenuItemConstructorOptions[] = [
    { label: '文件', submenu: [
      { label: '打开 Markdown 文档…', accelerator: 'CmdOrCtrl+O', click: () => window.webContents.send('markdown:request-open') },
      { type: 'separator' },
      { label: '收起到托盘', click: () => window.close() },
      { label: '退出程序', click: () => app.quit() }
    ] },
    { label: '编辑', submenu: [
      { label: '撤销', role: 'undo' }, { label: '重做', role: 'redo' },
      { type: 'separator' },
      { label: '剪切', role: 'cut' }, { label: '复制', role: 'copy' },
      { label: '粘贴', role: 'paste' }, { label: '全选', role: 'selectAll' }
    ] },
    { label: '视图', submenu: [
      { label: '放大', role: 'zoomIn' }, { label: '缩小', role: 'zoomOut' },
      { label: '恢复默认缩放', role: 'resetZoom' },
      { type: 'separator' }, { label: '切换全屏', role: 'togglefullscreen' }
    ] },
    { label: '窗口', submenu: [
      { label: '最小化', role: 'minimize' },
      { label: '显示记事本', click: () => { if (window.isMinimized()) window.restore(); window.show(); window.focus() } }
    ] },
    { label: '帮助', submenu: [
      { label: '关于每日记事', click: () => app.showAboutPanel() }
    ] }
  ]
  if (process.platform === 'darwin') template.unshift({ label: '每日记事', submenu: [{ label: '关于每日记事', role: 'about' }, { type: 'separator' }, { label: '隐藏每日记事', role: 'hide' }, { label: '隐藏其他应用', role: 'hideOthers' }, { label: '显示全部', role: 'unhide' }, { type: 'separator' }, { label: '退出每日记事', role: 'quit' }] })
  app.setAboutPanelOptions({ applicationName: '每日记事', applicationVersion: app.getVersion(), copyright: '本地优先的每日记事本' })
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
