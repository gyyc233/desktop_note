import { useEffect, useRef, useState } from 'react'

let engine: Promise<typeof import('mermaid')['default']> | undefined
let sequence = 0
function getEngine() {
  return engine ??= import('mermaid').then(({ default: mermaid }) => {
    mermaid.initialize({
      startOnLoad: false, securityLevel: 'strict', suppressErrorRendering: true,
      maxTextSize: 50_000, maxEdges: 500, theme: 'neutral',
      fontFamily: 'Segoe UI, Microsoft YaHei, sans-serif'
    })
    return mermaid
  })
}

export function MermaidDiagram({ source }: { source: string }) {
  const [result, setResult] = useState<{ source: string; url?: string; width?: number; height?: number; error?: string }>()
  const [scale, setScale] = useState(70)
  const [availableWidth, setAvailableWidth] = useState(300)
  const viewport = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = viewport.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setAvailableWidth(entry.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [result?.url])
  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      void (async () => {
        try {
          if (source.length > 50_000) throw new Error('图表代码超过 50,000 字符，请拆分图表')
          const mermaid = await getEngine()
          if (!active) return
          const { svg } = await mermaid.render(`note-diagram-${++sequence}`, source)
          const root = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement
          const box = root.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number)
          const width = box && box[2] > 0 ? box[2] : 640
          const height = box && box[3] > 0 ? box[3] : 400
          root.setAttribute('width', String(width))
          root.setAttribute('height', String(height))
          const image = new XMLSerializer().serializeToString(root)
          // Display as an image so diagram links, scripts and event handlers stay inert.
          if (active) setResult({ source, width, height, url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(image)}` })
        } catch (error) {
          if (active) setResult({ source, error: error instanceof Error ? error.message : String(error) })
        }
      })()
    }, 200)
    return () => { active = false; clearTimeout(timer) }
  }, [source])
  const current = result?.source === source ? result : undefined
  const fittedWidth = Math.min(current?.width ?? 640, availableWidth, 600 * (current?.width ?? 640) / (current?.height ?? 400))
  return <figure className="mermaid-diagram" aria-label="Mermaid 图表">
    {current?.url ? <>
      <div className="diagram-controls"><label>缩放 <input aria-label="流程图缩放" type="range" min="30" max="150" step="10" value={scale} onChange={event => setScale(Number(event.target.value))}/><span>{scale}%</span></label><button onClick={() => setScale(70)}>重置</button></div>
      <div className="diagram-viewport" ref={viewport}><img src={current.url} alt="Mermaid 图表" style={{ width: `${Math.max(1, fittedWidth * scale / 100)}px` }}/></div>
    </> : current?.error ? <div role="alert"><strong>流程图渲染失败，请检查 Mermaid 语法</strong><pre>{current.error}</pre></div> : <div role="status">正在渲染图表…</div>}
    <details open={!!current?.error}><summary>查看图表代码</summary><pre><code>{source}</code></pre></details>
  </figure>
}
