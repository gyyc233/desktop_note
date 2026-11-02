import type { BrowserWindow } from 'electron'
export function windowControls(window: BrowserWindow) {
  let compact = false
  let bounds = window.getNormalBounds()
  let maximized = false
  return {
    get: () => ({ compact, pinned: window.isAlwaysOnTop(), opacity: window.getOpacity() }),
    set(value: { compact?: boolean; pinned?: boolean; opacity?: number }) {
      if (!value || typeof value !== 'object') throw new Error('Invalid window settings')
      if (value.opacity !== undefined) {
        if (!Number.isFinite(value.opacity) || value.opacity < 0.35 || value.opacity > 1) throw new Error('Invalid opacity')
        window.setOpacity(value.opacity)
      }
      if (value.pinned !== undefined) {
        if (typeof value.pinned !== 'boolean') throw new Error('Invalid pin state')
        window.setAlwaysOnTop(value.pinned)
      }
      if (value.compact !== undefined && value.compact !== compact) {
        if (typeof value.compact !== 'boolean') throw new Error('Invalid compact state')
        if (value.compact) {
          bounds = window.getNormalBounds(); maximized = window.isMaximized()
          if (maximized) window.unmaximize()
          window.setMinimumSize(300, 260)
          window.setSize(360, 420)
        } else {
          window.setMinimumSize(640, 480)
          window.setBounds(bounds)
          if (maximized) window.maximize()
        }
        compact = value.compact
      }
      return this.get()
    }
  }
}
