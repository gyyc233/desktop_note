import { screen } from 'electron'
import type { BrowserWindow, Rectangle } from 'electron'

export function edgeDock(window: BrowserWindow, eligible: () => boolean = () => true) {
  let enabled = false
  let hidden = false
  let expanded: Rectangle | null = null
  let edge: 'left' | 'right' | 'top' | 'bottom' | null = null
  let moved = Date.now()
  let away = 0
  let internal = false
  let animation: ReturnType<typeof setInterval> | null = null
  function stopAnimation() {
    if (animation) clearInterval(animation)
    animation = null
  }
  // Keep one fixed size for the entire animation. On Windows with fractional
  // DPI, setPosition can round-trip the current size and grow it every frame.
  const apply = (bounds: Rectangle) => {
    internal = true
    const current = window.getBounds()
    if (current.x !== bounds.x || current.y !== bounds.y) window.setBounds(bounds)
    internal = false
  }
  function slide(target: Rectangle, duration = 240) {
    stopAnimation()
    const from = window.getBounds()
    const started = Date.now()
    animation = setInterval(() => {
      if (window.isDestroyed()) { stopAnimation(); return }
      const progress = Math.min(1, (Date.now() - started) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      apply({ ...target, x: Math.round(from.x + (target.x - from.x) * eased), y: Math.round(from.y + (target.y - from.y) * eased) })
      if (progress === 1) { stopAnimation(); moved = Date.now(); away = 0 }
    }, 16)
  }
  function restore(animated = false) {
    if (hidden && expanded && !window.isDestroyed()) {
      if (animated) slide(expanded)
      else { stopAnimation(); apply(expanded) }
    } else if (!animated) {
      // Finish an interrupted unfolding before another window mode changes size.
      if (animation && expanded && !window.isDestroyed()) { stopAnimation(); apply(expanded) }
    }
    hidden = false; away = 0; moved = Date.now()
  }
  const onMove = () => { if (!internal && !hidden && !animation) { moved = Date.now(); away = 0 } }
  window.on('move', onMove)
  window.on('resize', onMove)
  window.on('focus', () => restore(true))
  const timer = setInterval(() => {
    if (!enabled || !eligible()) { if (hidden) restore(); return }
    if (window.isDestroyed() || !window.isVisible() || window.isMinimized() || window.isMaximized() || window.isFullScreen()) return
    const now = Date.now()
    const bounds = window.getBounds()
    const point = screen.getCursorScreenPoint()
    if (hidden && expanded) {
      const area = screen.getDisplayMatching(expanded).workArea
      const hover = edge === 'left' ? point.x >= area.x && point.x < area.x + 8 && point.y >= expanded.y && point.y < expanded.y + expanded.height
        : edge === 'right' ? point.x >= area.x + area.width - 8 && point.x < area.x + area.width && point.y >= expanded.y && point.y < expanded.y + expanded.height
          : edge === 'bottom' ? point.y >= area.y + area.height - 8 && point.y < area.y + area.height && point.x >= expanded.x && point.x < expanded.x + expanded.width
          : point.y >= area.y && point.y < area.y + 8 && point.x >= expanded.x && point.x < expanded.x + expanded.width
      if (hover) restore(true)
      return
    }
    if (animation) return
    if (now - moved < 180) return
    const area = screen.getDisplayMatching(bounds).workArea
    const candidates = [
      { edge: 'left' as const, distance: Math.abs(bounds.x - area.x) },
      { edge: 'right' as const, distance: Math.abs(bounds.x + bounds.width - area.x - area.width) },
      { edge: 'top' as const, distance: Math.abs(bounds.y - area.y) },
      { edge: 'bottom' as const, distance: Math.abs(bounds.y + bounds.height - area.y - area.height) }
    ].sort((a, b) => a.distance - b.distance)
    edge = candidates[0].distance <= 32 ? candidates[0].edge : null
    if (!edge) { away = 0; return }
    const snapped = { ...bounds }
    if (edge === 'left') snapped.x = area.x
    if (edge === 'right') snapped.x = area.x + area.width - bounds.width
    if (edge === 'top') snapped.y = area.y
    if (edge === 'bottom') snapped.y = area.y + area.height - bounds.height
    // Treat sub-pixel/DPI rounding as already snapped rather than replaying
    // the snap animation forever. Keep a small hover margin at the edge.
    if (Math.abs(snapped.x - bounds.x) > 2 || Math.abs(snapped.y - bounds.y) > 2) { expanded = snapped; slide(snapped, 160); return }
    const inside = point.x >= bounds.x - 4 && point.x < bounds.x + bounds.width + 4 && point.y >= bounds.y - 4 && point.y < bounds.y + bounds.height + 4
    if (inside) { away = 0; return }
    if (!away) away = now
    if (now - away < 800) return
    expanded = snapped
    const tucked = { ...snapped }
    if (edge === 'left') tucked.x = area.x - snapped.width + 6
    if (edge === 'right') tucked.x = area.x + area.width - 6
    if (edge === 'top') tucked.y = area.y - snapped.height + 6
    if (edge === 'bottom') tucked.y = area.y + area.height - 6
    hidden = true
    slide(tucked)
  }, 120)
  window.once('closed', () => { clearInterval(timer); stopAnimation() })
  return { get: () => enabled, set(value: boolean) { enabled = value; restore() }, restore }
}
