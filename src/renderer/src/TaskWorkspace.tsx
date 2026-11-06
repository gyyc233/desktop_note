import { useScrollSync } from './useScrollSync'
import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import CodeMirror from './StableCodeMirror'
import { EditorView } from '@codemirror/view'
import { markdown } from '@codemirror/lang-markdown'
import { MarkdownView } from './MarkdownView'
import type { TaskDocument } from '../../shared/notes'

const taskExtensions = [markdown(), EditorView.lineWrapping]
const editorSetup = { lineNumbers: true, highlightActiveLine: true }

export function TaskWorkspace({ task, compact, flushRef, onBack }: { task: TaskDocument; compact: boolean; flushRef: MutableRefObject<null | (() => Promise<void>)>; onBack: () => void }) {
  const [body, setBody] = useState(task.body)
  const [status, setStatus] = useState('已打开任务')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(true)
  const [compactPreview, setCompactPreview] = useState(false)
  const showEditor = !compact || !compactPreview
  const showPreview = compact ? compactPreview : preview
  const scrollSync = useScrollSync(body, showEditor && showPreview)
  const text = useRef(task.body)
  const dirty = useRef(false)
  const view = useRef<EditorView | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const uploads = useRef<Promise<void>>(Promise.resolve())
  const saves = useRef<Promise<void>>(Promise.resolve())
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { if (!showEditor) view.current = null }, [showEditor])
  function change(value: string) {
    text.current = value; dirty.current = true; setBody(value); setStatus('等待保存…')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => { void flush().catch(showError) }, 500)
  }
  function showError(e: unknown) { setError(String(e)); setStatus('保存或导入失败') }
  function flush() {
    clearTimeout(timer.current)
    const job = saves.current.catch(() => {}).then(async () => {
      await uploads.current
      if (!dirty.current) return
      const value = text.current
      await window.notes.saveTask(task.id, value)
      if (text.current === value) dirty.current = false
      setStatus(dirty.current ? '等待保存…' : '已保存 task.md'); setError('')
    })
    saves.current = job
    return job
  }
  useEffect(() => {
    flushRef.current = flush
    return () => { flushRef.current = null; clearTimeout(timer.current) }
  }, [])
  function attach(files: File[]) {
    if (!files.length) return
    // Track both uploads and the inserted Markdown so closing cannot lose references.
    const currentView = view.current
    const insertion = currentView?.state.selection.main.head ?? text.current.length
    setBusy(true); setError('')
    uploads.current = uploads.current.then(async () => {
      const snippets: string[] = []
      for (const file of files) {
        if (file.size > 50 * 1024 * 1024) throw new Error(`${file.name} 超过 50 MB`)
        const extension = ({ 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' } as Record<string, string>)[file.type]
        const name = file.name && /\.[a-z0-9]+$/i.test(file.name) ? file.name : `${file.name || 'clipboard'}${extension || '.bin'}`
        const result = await window.notes.attachTask(task.id, name, new Uint8Array(await file.arrayBuffer()))
        const label = result.name.replace(/[\\\[\]\n\r]/g, '_')
        snippets.push(`${result.image ? '!' : ''}[${label}](${result.path})`)
      }
      const insert = '\n' + snippets.join('\n') + '\n'
      const position = Math.min(insertion, text.current.length)
      if (view.current) view.current.dispatch({ changes: { from: position, insert }, selection: { anchor: position + insert.length }, scrollIntoView: true })
      else change(text.current + insert)
    }).catch(e => { showError(e); throw e }).finally(() => setBusy(false))
    void uploads.current.catch(() => {})
  }
  return <main className="task-workspace" onPasteCapture={event => {
    const files = Array.from(event.clipboardData.files)
    if (files.length) { event.preventDefault(); event.stopPropagation(); attach(files) }
  }} onDragOver={event => { if (event.dataTransfer.types.includes('Files')) event.preventDefault() }} onDropCapture={event => {
    const files = Array.from(event.dataTransfer.files)
    if (files.length) { event.preventDefault(); event.stopPropagation(); attach(files) }
  }}>
    <header><div className="eyebrow">TASK / 本地任务资料</div><h1>{task.name}</h1><p className="subtitle task-path" title={task.root}>{task.root}</p><button className="return-notes" onClick={() => { void window.notes.revealTask(task.id, '.').catch(showError) }}>打开任务文件夹</button></header>
    <div className="toolbar"><button className="return-notes" disabled={busy} onClick={onBack}>返回每日笔记</button><button className="return-notes" disabled={busy} onClick={() => input.current?.click()}>添加材料</button><button className="return-notes" onClick={() => compact ? setCompactPreview(!compactPreview) : setPreview(!preview)}>{compact ? (compactPreview ? '编辑' : '预览') : preview ? '仅编辑' : '显示预览'}</button><span className="save-state">{busy ? '正在归档附件…' : status}</span></div>
    <input ref={input} type="file" multiple hidden onChange={event => { attach(Array.from(event.target.files ?? [])); event.target.value = '' }}/>
    {error && <div className="error" role="alert">{error}<button onClick={() => { uploads.current = uploads.current.catch(() => {}); void flush().catch(showError) }}>重试保存</button></div>}
    <div className="task-hint">可粘贴图片、文件或拖入材料 · 图片 → img，文档 → docs，音视频 → audio / video，其他 → files</div>
    <section ref={scrollSync} className={`workspace ${showEditor && showPreview ? 'split' : showPreview ? 'preview' : 'edit'}`}>
      {showEditor && <div className="editor-pane"><CodeMirror value={body} extensions={taskExtensions} onCreateEditor={editor => { view.current = editor }} onChange={change} editable={!busy} height="100%" basicSetup={editorSetup} /></div>}
      {showPreview && <div className="preview-pane"><article className="markdown"><MarkdownView body={body} taskId={task.id}/></article></div>}
    </section>
    <footer><span>{body.length} 字符 · task.md</span><span>任务文件以普通文件保存在所选目录</span></footer>
  </main>
}
