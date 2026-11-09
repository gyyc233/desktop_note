import { useEffect, useRef, useState } from 'react'
export function BackupPanel({ before, after, onClose }: { before: () => Promise<void>; after: () => Promise<void>; onClose: () => void }) {
  const overlay = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const siblings = Array.from(overlay.current?.parentElement?.children ?? []).filter(element => element !== overlay.current) as HTMLElement[]
    const previous = siblings.map(element => element.inert)
    siblings.forEach(element => { element.inert = true })
    return () => siblings.forEach((element, i) => { element.inert = previous[i] })
  }, [])
  const [mode, setMode] = useState<'export' | 'import'>('export')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [overwrite, setOverwrite] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  async function run() {
    setBusy(true); setError(''); setMessage('')
    try {
      await before()
      const result = mode === 'export' ? await window.notes.exportBackup(password) : await window.notes.importBackup(password, overwrite)
      if (!result) return
      if (mode === 'import') await after()
      setPassword(''); setConfirmation('')
      setMessage(mode === 'export' ? `已导出 ${result.notes} 篇笔记、${result.tasks} 个 task。文件：${result.path}` : `已导入 ${result.notes} 篇笔记、${result.tasks} 个 task，跳过 ${result.skipped} 篇。导入前的安全备份：${result.path}（使用本次导入密码恢复）`)
    } catch (e) { setError(String(e)) }
    finally { setBusy(false) }
  }
  return <div ref={overlay} className="backup-overlay"><section className="backup-panel" role="dialog" aria-modal="true" aria-labelledby="backup-title">
    <h2 id="backup-title">备份与恢复</h2>
    <p>包含全部每日笔记、分类、书签，以及默认 tasks 目录下的任务和附件。其他目录的 task 不包含在内。</p>
    <div className="backup-tabs"><button disabled={busy} aria-pressed={mode === 'export'} onClick={() => { setMode('export'); setError(''); setMessage('') }}>导出备份</button><button disabled={busy} aria-pressed={mode === 'import'} onClick={() => { setMode('import'); setError(''); setMessage('') }}>导入备份</button></div>
    <p>备份先 ZIP 压缩再密码加密，可跨电脑恢复。密码至少 8 个字符，忘记后无法恢复。最多 100 MB 原始数据、5000 个文件及目录。</p>
    <label>备份密码<input autoFocus type="password" autoComplete="off" aria-label="备份密码" minLength={8} maxLength={256} disabled={busy} value={password} onChange={e => setPassword(e.target.value)}/></label>
    {mode === 'export' ? <label>确认密码<input type="password" autoComplete="off" aria-label="确认备份密码" disabled={busy} value={confirmation} onChange={e => setConfirmation(e.target.value)}/></label> : <label>同日期笔记<select aria-label="导入冲突处理" disabled={busy} value={String(overwrite)} onChange={e => setOverwrite(e.target.value === 'true')}><option value="false">保留本地笔记（推荐）</option><option value="true">使用备份覆盖同日期笔记</option></select></label>}
    {mode === 'import' && <p>同名 task 自动改名；不会删除现有其他笔记。导入前自动备份当前全部数据。</p>}
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <div className="backup-actions"><button disabled={busy} onClick={onClose}>关闭</button><button disabled={busy || password.length < 8 || (mode === 'export' && password !== confirmation)} onClick={() => void run()}>{busy ? '正在处理，请稍候…' : mode === 'export' ? '选择位置并导出' : '选择备份并导入'}</button></div>
  </section></div>
}
