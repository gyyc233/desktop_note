import { useEffect, useRef } from 'react'
import { EditorView } from '@codemirror/view'

export function useScrollSync(content: string, enabled: boolean) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const root = ref.current
    if (!root || !enabled) return
    const expected = new WeakMap<HTMLElement, number>()
    let frame = 0
    const handler = (event: Event) => {
      const editor = root.querySelector<HTMLElement>('.cm-editor')
      const preview = root.querySelector<HTMLElement>('.preview-pane')
      const view = editor && EditorView.findFromDOM(editor)
      if (!view || !preview) return
      const source = event.target as HTMLElement
      if (source !== view.scrollDOM && source !== preview) return
      const previous = expected.get(source)
      expected.delete(source)
      if (previous !== undefined && Math.abs(source.scrollTop - previous) < 2) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const left = view.scrollDOM
        const leftMax = Math.max(0, left.scrollHeight - left.clientHeight)
        const rightMax = Math.max(0, preview.scrollHeight - preview.clientHeight)
        if (!leftMax || !rightMax) return
        const points = [{ left: 0, right: 0 }]
        const seen = new Set<number>()
        for (const node of preview.querySelectorAll<HTMLElement>('[data-source-line]')) {
          const line = Number(node.dataset.sourceLine)
          if (!line || line > view.state.doc.lines || seen.has(line)) continue
          seen.add(line)
          const block = view.lineBlockAt(view.state.doc.line(line).from)
          const x = block.top + view.documentTop - left.getBoundingClientRect().top + left.scrollTop
          const y = node.getBoundingClientRect().top - preview.getBoundingClientRect().top + preview.scrollTop
          const last = points[points.length - 1]
          if (x > last.left && y > last.right && x < leftMax && y < rightMax) points.push({ left: x, right: y })
        }
        points.push({ left: leftMax, right: rightMax })
        const from = source === left ? 'left' : 'right'
        const to = from === 'left' ? 'right' : 'left'
        const position = source.scrollTop
        const index = points.findIndex((point, i) => i > 0 && point[from] >= position)
        const end = points[index < 0 ? points.length - 1 : index]
        const start = points[Math.max(0, (index < 0 ? points.length - 1 : index) - 1)]
        const ratio = Math.max(0, Math.min(1, (position - start[from]) / Math.max(1, end[from] - start[from])))
        const target = source === left ? preview : left
        target.scrollTop = start[to] + ratio * (end[to] - start[to])
        expected.set(target, target.scrollTop)
      })
    }
    root.addEventListener('scroll', handler, true)
    return () => { cancelAnimationFrame(frame); root.removeEventListener('scroll', handler, true) }
  }, [content, enabled])
  return ref
}
