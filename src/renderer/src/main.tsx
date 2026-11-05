import { TaskWorkspace } from './TaskWorkspace'
import brandIcon from '../../../resources/icon.png'
import { NoteCalendar } from './NoteCalendar'
import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import CodeMirror from './StableCodeMirror'
import { EditorView } from '@codemirror/view'
import { markdown } from '@codemirror/lang-markdown'
import { MarkdownView } from './MarkdownView'
import { CalendarDays, Check, Columns2, FilePenLine, Search, ShieldCheck, Bold, Italic, Strikethrough, ListOrdered, List, ListTodo, Table2, Bookmark, Code, FolderOpen, ArrowLeft, Sigma } from 'lucide-react'
import type { Note, WindowSettings, Category, TaskDocument } from '../../shared/notes'
import { formatSelection, type Format } from './formatting'
import './style.css'

function localDate() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const starter = '## 今日事项\n\n- [ ] 写下需要跟进的事情\n\n## 随手记\n\n\n'
const extensions = [
  markdown(),
  EditorView.lineWrapping,
  EditorView.contentAttributes.of({ 'aria-label': '笔记编辑区' }),
  EditorView.theme({
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#245b3e', borderLeftWidth: '2px' },
    '.cm-content': { caretColor: '#245b3e' },
    // Selection is painted behind the text lines. An opaque active-line fill hides it.
    '.cm-activeLine': { backgroundColor: 'rgba(53, 94, 73, 0.06)' },
    '.cm-activeLineGutter': { backgroundColor: '#e0e9d7', color: '#355e49' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: '#cbdcb9 !important' },
    '.cm-scroller': { scrollPadding: '24px' }
  })
]
const editorSetup = { lineNumbers: true, foldGutter: false, highlightActiveLine: true, highlightActiveLineGutter: true, drawSelection: true }
function App() {
  const [notes, setNotes] = useState<Record<string, Note>>({})
  const [date, setDate] = useState(localDate)
  const [body, setBody] = useState('')
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState('正在打开本地记事库…')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'split' | 'edit' | 'preview'>('split')
  const [compactPreview, setCompactPreview] = useState(false)
  const [closing, setClosing] = useState(false)
  const [onlyBookmarks, setOnlyBookmarks] = useState(false)
  const [sidebarHidden, setSidebarHidden] = useState(false)
  const [noteMenu, setNoteMenu] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 })
  useEffect(() => {
    const dismiss = (event: PointerEvent) => { if (!(event.target instanceof Element) || !event.target.closest('.note-actions')) setNoteMenu(null) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setNoteMenu(null) }
    window.addEventListener('pointerdown', dismiss)
    window.addEventListener('keydown', escape)
    window.addEventListener('resize', closeMenu)
    function closeMenu() { setNoteMenu(null) }
    return () => { window.removeEventListener('pointerdown', dismiss); window.removeEventListener('keydown', escape); window.removeEventListener('resize', closeMenu) }
  }, [])
  const [deleting, setDeleting] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<Category | '全部'>('全部')
  const [position, setPosition] = useState({ line: 1, column: 1 })
  const [document, setDocument] = useState<{ name: string; body: string } | null>(null)
  const [opening, setOpening] = useState(false)
  const [task, setTask] = useState<TaskDocument | null>(null)
  const [taskName, setTaskName] = useState('')
  const [creatingTask, setCreatingTask] = useState(false)
  const taskFlush = useRef<null | (() => Promise<void>)>(null)
  async function chooseTask(create: boolean) {
    if (opening || closing) return
    setOpening(true)
    try {
      await flush()
      const result = create ? await window.notes.createTask(taskName) : await window.notes.openTask()
      if (result) { setDocument(null); setTask(result); setCreatingTask(false); setTaskName('') }
    } catch (e) { setError(`任务操作失败：${String(e)}`) }
    finally { setOpening(false) }
  }
  async function backToNotes() {
    try { await flush(); setTask(null) } catch (e) { setError(`任务保存失败：${String(e)}`) }
  }
  const [desktop, setDesktop] = useState<WindowSettings>({ compact: false, pinned: false, opacity: 1, dock: false })
  async function updateDesktop(value: Partial<WindowSettings>) {
    try { setDesktop(await window.notes.setWindow(value)) } catch (e) { setError(`窗口设置失败：${String(e)}`) }
  }
  useEffect(() => { void window.notes.getWindow().then(setDesktop).catch(() => {}) }, [])
  const editor = useRef<EditorView | null>(null)
  const pendingFormat = useRef<Format | null>(null)
  const dirty = useRef(new Map<string, Note>())
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const chain = useRef<Promise<void>>(Promise.resolve())
  const readyRef = useRef(false)

  function flush(): Promise<void> {
    clearTimeout(timer.current)
    const job = chain.current.catch(() => {}).then(async () => {
      await taskFlush.current?.()
      for (const [day, draft] of [...dirty.current]) {
        const saved = await window.notes.save(day, draft.body, draft.bookmarked, draft.category)
        if (dirty.current.get(day) === draft) dirty.current.delete(day)
        setNotes(previous => previous[day] === draft ? { ...previous, [day]: saved } : previous)
      }
      setError('')
      setStatus(dirty.current.size ? '等待保存…' : '已保存到本地')
    })
    chain.current = job
    return job
  }
  function save() {
    void flush().catch(e => { setError(`保存失败：${String(e)}。内容仍保留在当前窗口，请重试。`); setStatus('保存失败') })
  }
  useEffect(() => {
    let active = true
    void window.notes.list().then(items => {
      if (!active) return
      const indexed = Object.fromEntries(items.map(note => [note.date, note]))
      setNotes(indexed)
      setBody(indexed[localDate()]?.body ?? '')
      readyRef.current = true
      setReady(true)
      setStatus('已打开本地记事库')
    }).catch(e => { if (active) setError(`读取失败：${String(e)}`) })
    const off = window.notes.onBeforeClose(() => {
      if (!readyRef.current) { window.notes.confirmClose(); return }
      setClosing(true)
      void flush().then(() => window.notes.confirmClose()).catch(e => {
        window.notes.cancelClose()
        setClosing(false)
        setStatus('保存失败')
        setError(`关闭前保存失败：${String(e)}。窗口已保留，请重试保存。`)
      })
    })
    const offHide = window.notes.onBeforeHide(() => {
      void flush().catch(e => {
        window.notes.cancelClose()
        setError(`收起前保存失败：${String(e)}。窗口已恢复，请重试保存。`)
        setStatus('保存失败')
      })
    })
    return () => { active = false; off(); offHide(); clearTimeout(timer.current) }
  }, [])
  function change(text: string, bookmarked = notes[date]?.bookmarked ?? false, category: Category = notes[date]?.category ?? '工作') {
    if (deleting) return
    setBody(text)
    const draft = { date, body: text, bookmarked, category, updatedAt: notes[date]?.updatedAt ?? '' }
    dirty.current.set(date, draft)
    setNotes(previous => ({ ...previous, [date]: draft }))
    setStatus('等待保存…')
    clearTimeout(timer.current)
    timer.current = setTimeout(save, 400)
  }
  async function select(day: string) {
    if (!day || !ready || closing || deleting) return
    if (task) { try { await flush(); setTask(null) } catch (e) { setError(String(e)); return } }
    setDocument(null)
    if (day === date) return
    save()
    setDate(day)
    setBody(notes[day]?.body ?? '')
  }
  async function deleteNote(day: string) {
    if (deleting) return
    setDeleting(true)
    try {
      await flush()
      if (await window.notes.deleteNote(day)) {
        dirty.current.delete(day)
        setNotes(previous => { const next = { ...previous }; delete next[day]; return next })
        if (day === date) { const today = localDate(); setDate(today); setBody(day === today ? '' : notes[today]?.body ?? '') }
        setStatus('笔记已删除')
      }
      setNoteMenu(null)
    } catch (e) { setError(`删除失败：${String(e)}`) }
    finally { setDeleting(false) }
  }
  async function openDocument() {
    if (opening || closing || !ready) return
    setOpening(true)
    try {
      await flush()
      const opened = await window.notes.openMarkdown()
      if (opened) { setTask(null); setDocument(opened); setError('') }
    } catch (e) { setError(`打开失败：${String(e)}`) }
    finally { setOpening(false) }
  }
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'o') { event.preventDefault(); void openDocument() }
    }
    window.addEventListener('keydown', handler)
    const off = window.notes.onOpenMarkdown(() => void openDocument())
    return () => { window.removeEventListener('keydown', handler); off() }
  }, [opening, closing, ready])
  function applyFormat(kind: Format, view = editor.current) {
    if (!ready || closing) return
    if (mode === 'preview' || !view) {
      pendingFormat.current = kind
      setMode('split')
      return
    }
    const { from, to } = view.state.selection.main
    const result = formatSelection(view.state.doc.toString(), from, to, kind)
    view.dispatch({ changes: { from: result.from, to: result.to, insert: result.insert }, selection: { anchor: result.anchor, head: result.head }, scrollIntoView: true })
    view.focus()
  }
  const days = [...new Set([localDate(), date, ...Object.keys(notes)])].sort().reverse().filter(day => (categoryFilter === '全部' || notes[day]?.category === categoryFilter) && (!onlyBookmarks || notes[day]?.bookmarked) && `${day} ${notes[day]?.body ?? ''}`.toLowerCase().includes(query.toLowerCase()))
  const title = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date(`${date}T12:00:00`))
  const displayMode = document ? 'preview' : desktop.compact ? (compactPreview ? 'preview' : 'edit') : mode
  const displayBody = document?.body ?? body
  return <div className={`app ${desktop.compact ? 'compact' : ''} ${sidebarHidden ? 'sidebar-hidden' : ''}`}>
    <div className="desktop-controls">
      {!desktop.compact && <button className="sidebar-toggle" aria-label={sidebarHidden ? '展开左侧菜单' : '收起左侧菜单'} aria-expanded={!sidebarHidden} aria-controls="notes-sidebar" onClick={() => setSidebarHidden(!sidebarHidden)}>{sidebarHidden ? '☰ 展开菜单' : '☰ 收起菜单'}</button>}
      <button aria-pressed={desktop.pinned} onClick={() => void updateDesktop({ pinned: !desktop.pinned })}>{desktop.pinned ? '已置顶' : '置顶'}</button>
      {desktop.compact && !task && !document && <button aria-pressed={compactPreview} onClick={() => setCompactPreview(!compactPreview)}>{compactPreview ? '编辑' : '预览'}</button>}
      <label>透明度 <input aria-label="窗口透明度" type="range" min="35" max="100" value={Math.round(desktop.opacity * 100)} onChange={e => void updateDesktop({ opacity: Number(e.target.value) / 100 })}/><span>{Math.round(desktop.opacity * 100)}%</span></label>
      <button title="仅便签模式生效：接近屏幕边缘自动贴边，移开鼠标收起" disabled={!desktop.compact} aria-pressed={desktop.compact && desktop.dock} onClick={() => void updateDesktop({ dock: !desktop.dock })}>{!desktop.compact ? '靠边收起（便签）' : desktop.dock ? '靠边收起：开' : '靠边收起'}</button>
      <button aria-pressed={desktop.compact} onClick={() => void updateDesktop({ compact: !desktop.compact })}>{desktop.compact ? '展开窗口' : '便签模式'}</button>
    </div>
    <aside id="notes-sidebar">
      <div className="brand"><img className="brand-image" src={brandIcon} alt="每日记事图标"/><div>每日记事</div></div>
      <button className="today" disabled={!ready || closing} onClick={() => select(localDate())}><CalendarDays size={17}/> 回到今天 <span>↗</span></button>
      <button className="open-document" disabled={!ready || closing || opening} onClick={() => void openDocument()}><FolderOpen size={16}/>{opening ? '正在打开…' : '打开 Markdown'}<kbd>Ctrl+O</kbd></button>
      <div className="task-actions"><button disabled={opening || closing} onClick={() => setCreatingTask(!creatingTask)}>＋ 新建 task</button><button disabled={opening || closing} onClick={() => void chooseTask(false)}>打开 task</button></div>
      {creatingTask && <form className="task-create" onSubmit={event => { event.preventDefault(); void chooseTask(true) }}><input aria-label="任务名称" placeholder="任务名称" value={taskName} maxLength={80} onChange={event => setTaskName(event.target.value)}/><button disabled={!taskName.trim() || opening}>在 tasks 目录创建</button></form>}
      {task && <div className="task-current">当前任务：{task.name}</div>}
      <label className="search"><Search size={16}/><input aria-label="搜索日期或正文" placeholder="搜索日期或内容" value={query} onChange={e => setQuery(e.target.value)}/></label>
      <div className="archive-tabs"><button className={!onlyBookmarks ? 'active' : ''} onClick={() => setOnlyBookmarks(false)}>全部记录</button><button className={onlyBookmarks ? 'active' : ''} onClick={() => setOnlyBookmarks(true)}><Bookmark size={12}/>书签</button></div>
      <div className="category-filters" aria-label="分类筛选">{(['全部', '生活', '学习', '工作'] as const).map(category => <button key={category} className={categoryFilter === category ? 'active' : ''} onClick={() => setCategoryFilter(category)}>{category}<span>{Object.values(notes).filter(note => category === '全部' || note.category === category).length}</span></button>)}</div>
      <div className="section-label">{onlyBookmarks ? '书签记录' : '日期归档'} <span>{Object.keys(notes).length} 篇</span></div>
      <nav>{days.map(day => <div className="archive-entry" key={day}><button disabled={!ready || closing || deleting} className={`day ${day === date ? 'selected' : ''}`} key={day} aria-haspopup="menu" aria-expanded={noteMenu === day} onClick={() => { setNoteMenu(null); void select(day) }} onContextMenu={event => { event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); setMenuPosition({ x: Math.max(4, Math.min(event.clientX || rect.left, window.innerWidth - 164)), y: Math.max(4, Math.min(event.clientY || rect.bottom, window.innerHeight - 120)) }); setNoteMenu(day) }}><strong><span className="day-title">{notes[day]?.bookmarked && <Bookmark size={12} fill="currentColor"/>}{day === localDate() ? '今天' : day.slice(5).replace('-', ' 月 ') + ' 日'}</span><span>{day.slice(0, 4)}</span></strong><span className="category-badge">{notes[day]?.category ?? '工作'}</span><small>{notes[day]?.body.replace(/[#*\[\]`>|-]/g, '').trim().slice(0, 38) || '还没有记录，写下第一笔…'}</small></button>{noteMenu === day && <div className="note-actions" style={{ left: menuPosition.x, top: menuPosition.y }} role="menu" aria-label="笔记操作"><button role="menuitem" disabled={deleting} onClick={() => { void select(day); setNoteMenu(null) }}>打开笔记</button><button role="menuitem" className="delete-note" disabled={deleting || !notes[day]} onClick={() => void deleteNote(day)}>{deleting ? '正在处理…' : '删除笔记'}</button><button role="menuitem" disabled={deleting} onClick={() => setNoteMenu(null)}>收起</button></div>}</div>)}{!days.length && <p className="empty-search">{onlyBookmarks ? '还没有书签，点击工具栏中的书签按钮添加' : '没有找到相关记录'}</p>}</nav>
      <div className="local"><ShieldCheck size={16}/><span>本地加密存储<small>密钥由当前系统账号保护</small></span></div>
    </aside>
    {task ? <TaskWorkspace key={task.id} task={task} compact={desktop.compact} flushRef={taskFlush} onBack={() => void backToNotes()}/> : <main>
      <header><div className="eyebrow">{document ? 'MARKDOWN DOCUMENT' : `DAILY NOTES / ${date.slice(0, 4)}`}</div><div className="heading"><h1>{document?.name ?? title}</h1>{!document && <NoteCalendar date={date} notes={notes} disabled={!ready || closing} onSelect={select}/>}</div><p className="subtitle">{document ? '只读预览 · 支持表格、任务列表与数学公式' : '留一点空间，记录今天的想法与待办。'}</p></header>
      <div className="toolbar">{document ? <button className="return-notes" onClick={() => setDocument(null)}><ArrowLeft size={14}/>返回每日笔记</button> : <div className="modes">{(['edit', 'split', 'preview'] as const).map(value => <button className={mode === value ? 'active' : ''} key={value} onClick={() => setMode(value)}>{value === 'split' && <Columns2 size={14}/>}{{ edit: '编辑', split: '双栏', preview: '预览' }[value]}</button>)}</div>}<span className="save-state"><Check size={14}/>{document ? '本地文件预览' : closing ? '保存后关闭…' : status}</span></div>
      {!document && <div className="format-toolbar" role="toolbar" aria-label="文本格式">
        <select aria-label="段落格式" defaultValue="" disabled={!ready || closing} onChange={event => { applyFormat(event.target.value as Format); event.target.value = '' }}><option value="" disabled>段落 / 标题</option><option value="paragraph">普通段落</option><option value="h1">一级标题</option><option value="h2">二级标题</option><option value="h3">三级标题</option><option value="quote">引用</option></select>
        <span className="format-divider"/>
        {([{ kind: 'bold', label: '加粗', Icon: Bold }, { kind: 'italic', label: '斜体', Icon: Italic }, { kind: 'strike', label: '删除线', Icon: Strikethrough }, { kind: 'ordered', label: '序号', Icon: ListOrdered }, { kind: 'bullet', label: '列表', Icon: List }, { kind: 'task', label: '待办', Icon: ListTodo }, { kind: 'table', label: '表格', Icon: Table2 }, { kind: 'code', label: '代码', Icon: Code }, { kind: 'math', label: '公式', Icon: Sigma }] as const).map(({ kind, label, Icon }) => <button key={kind} aria-label={label} title={label === '删除线' ? '删除线：标记已删除文字，保留原文' : label} disabled={!ready || closing} onMouseDown={event => event.preventDefault()} onClick={() => applyFormat(kind)}><Icon size={15}/><span>{label}</span></button>)}
        <span className="format-divider"/>
        <button className={notes[date]?.bookmarked ? 'bookmarked' : ''} aria-label="书签" aria-pressed={notes[date]?.bookmarked ?? false} title="标记或取消当前笔记的书签" disabled={!ready || closing} onClick={() => change(body, !notes[date]?.bookmarked)}><Bookmark size={15} fill={notes[date]?.bookmarked ? 'currentColor' : 'none'}/><span>{notes[date]?.bookmarked ? '已加书签' : '书签'}</span></button>
      </div>}
      {!document && <label className="note-category">笔记分类<select aria-label="笔记分类" value={notes[date]?.category ?? '工作'} disabled={!ready || closing} onChange={event => change(body, notes[date]?.bookmarked ?? false, event.target.value as Category)}>{(['生活', '学习', '工作'] as const).map(category => <option key={category}>{category}</option>)}</select><span>分类修改后自动保存</span></label>}
      {error && <div className="error" role="alert">{error} {ready && <button onClick={save}>重试保存</button>}</div>}
      <section className={`workspace ${displayMode}`}>
        {displayMode !== 'preview' && <div className="editor-pane"><div className="pane-label">MARKDOWN <span>选中文字设置格式</span></div><CodeMirror value={body} extensions={extensions} onCreateEditor={view => { editor.current = view; const kind = pendingFormat.current; if (kind) { pendingFormat.current = null; queueMicrotask(() => applyFormat(kind, view)) } }} onUpdate={update => { if (update.docChanged || update.selectionSet) { const head = update.state.selection.main.head; const line = update.state.doc.lineAt(head); const column = Array.from(line.text.slice(0, head - line.from)).length + 1; setPosition(previous => previous.line === line.number && previous.column === column ? previous : { line: line.number, column }) } }} onChange={text => change(text)} editable={ready && !closing && !deleting} height="100%" basicSetup={editorSetup} placeholder="从这里开始记录今天…"/>{!body && ready && <button className="template" disabled={closing} onClick={() => change(starter)}>插入每日模板</button>}</div>}
        {displayMode !== 'edit' && <div className="preview-pane"><div className="pane-label">{document ? '文档预览' : '阅读预览'}</div><article className="markdown">{displayBody ? <MarkdownView body={displayBody}/> : <div className="blank"><FilePenLine size={32}/><h2>{document ? '文档内容为空' : '今天，值得被记住'}</h2><p>{document ? '可以打开其他 Markdown 文件。' : '在左侧写下文字，内容会在这里呈现。'}</p><small>支持 Markdown 标题、表格、待办与数学公式</small></div>}</article></div>}

      </section>
      <footer><span>{displayBody.length} 字符 · Markdown{displayMode !== 'preview' && <span className="cursor-position"> · 第 {position.line} 行，第 {position.column} 列</span>}</span><span>{document ? '只读预览 · 原文件不变' : '自动保存 · 每天一篇'}</span></footer>
    </main>}
    {task && error && <div className="task-global-error" role="alert">{error}<button onClick={() => setError('')}>关闭提示</button></div>}
  </div>
}
createRoot(document.getElementById('root')!).render(<App />)
