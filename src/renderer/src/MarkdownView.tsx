import { sourceLines } from './sourceLines'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { Children, isValidElement, useEffect, useState, type ReactNode } from 'react'
import { MermaidDiagram } from './MermaidDiagram'

function MarkdownPre({ children, ...props }: { children?: ReactNode; 'data-source-line'?: number }) {
  const child = Children.toArray(children)[0]
  if (isValidElement<{ className?: string; children?: ReactNode }>(child) && /\blanguage-mermaid\b/i.test(child.props.className ?? '')) {
    return <div data-source-line={props['data-source-line'] as number | undefined}><MermaidDiagram source={String(child.props.children ?? '').replace(/\n$/, '')}/></div>
  }
  return <pre data-source-line={props['data-source-line'] as number | undefined}>{children}</pre>
}

function TaskImage({ id, src, alt }: { id: string; src: string; alt: string }) {
  const [url, setUrl] = useState('')
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true
    setUrl(''); setFailed(false)
    void Promise.resolve().then(() => window.notes.taskImage(id, decodeURIComponent(src))).then(value => { if (active) setUrl(value) }).catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [id, src])
  return url ? <img src={url} alt={alt} style={{ maxWidth: '100%' }}/> : <span>{failed ? `[图片不可用：${alt}]` : '图片加载中…'}</span>
}
function TaskLink({ id, href, children }: { id: string; href: string; children: React.ReactNode }) {
  const [error, setError] = useState('')
  return <><button className="task-link" title="在文件夹中定位附件" onClick={() => { void Promise.resolve().then(() => window.notes.revealTask(id, decodeURIComponent(href))).catch(e => setError(String(e))) }}>{children}</button>{error && <small role="alert">{error}</small>}</>
}

const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [['className', /^language-./, 'math-inline', 'math-display']]
  }
}
export function MarkdownView({ body, taskId }: { body: string; taskId?: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[[rehypeSanitize, schema], [rehypeKatex, { trust: false, maxExpand: 1000, maxSize: 20 }], sourceLines]} components={{ pre: MarkdownPre, img: ({ src, alt }) => taskId && typeof src === 'string' ? <TaskImage id={taskId} src={src} alt={alt ?? ''}/> : <span className="image-placeholder">[图片：请在任务中导入]</span>, a: ({ children, href }) => taskId && href && /^(img|docs|audio|video|files)\//.test(href) ? <TaskLink id={taskId} href={href}>{children}</TaskLink> : <span className="link-text">{children}</span> }}>{body}</ReactMarkdown>
}
