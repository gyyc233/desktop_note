import { Menu, Tray, nativeImage } from 'electron'
import type { BrowserWindow } from 'electron'

import { trayIconData } from './icons.ts'

export function attachTray(window: BrowserWindow) {
  const tray = new Tray(nativeImage.createFromDataURL(trayIconData))
  let exiting = false
  const show = () => {
    if (window.isDestroyed()) return
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
  }
  tray.setToolTip('每日记事 · 双击打开')
  const requestExit = () => { exiting = true; show(); window.close() }
  const menu = Menu.buildFromTemplate([
    { label: '显示记事本', click: show },
    { label: '收起到托盘', click: () => window.close() },
    { type: 'separator' },
    { label: '退出', click: requestExit }
  ])
  tray.setContextMenu(menu)
  tray.on('double-click', show)
  window.on('minimize', () => {
    window.webContents.send('notes:before-hide')
    window.hide()
  })
  window.on('close', event => {
    if (exiting) return
    event.preventDefault()
    window.webContents.send('notes:before-hide')
    window.hide()
  })
  window.once('closed', () => tray.destroy())
  return { tray, show, menu, requestExit, prepareExit: () => { exiting = true }, cancelExit: () => { exiting = false; show() }, isExiting: () => exiting }
}

