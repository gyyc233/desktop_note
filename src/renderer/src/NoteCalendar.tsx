import { useEffect, useRef, useState } from 'react'
import type { Note } from '../../shared/notes'

export function NoteCalendar({ date, notes, disabled, onSelect }: { date: string; notes: Record<string, Note>; disabled: boolean; onSelect: (date: string) => void }) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(date.slice(0, 7))
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const click = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('pointerdown', click)
    window.addEventListener('keydown', key)
    return () => { window.removeEventListener('pointerdown', click); window.removeEventListener('keydown', key) }
  }, [])
  const [year, index] = month.split('-').map(Number)
  const first = new Date(year, index - 1, 1)
  const start = new Date(year, index - 1, 1 - (first.getDay() + 6) % 7)
  const keyOf = (day: Date) => `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
  const today = keyOf(new Date())
  function move(delta: number) {
    const next = new Date(year, index - 1 + delta, 1)
    if (next.getFullYear() >= 100 && next.getFullYear() <= 9999) setMonth(keyOf(next).slice(0, 7))
  }
  function choose(day: string) { onSelect(day); setOpen(false) }
  return <div className="note-calendar" ref={root}>
    <button className="calendar-trigger" aria-label="选择归档日期" aria-expanded={open} disabled={disabled} onClick={() => { setMonth(date.slice(0, 7)); setOpen(!open) }}>{date.replaceAll('-', '/')} ▦</button>
    {open && <div className="calendar-popup" role="dialog" aria-label="笔记日历">
      <div className="calendar-heading"><button aria-label="上个月" onClick={() => move(-1)}>‹</button><strong>{year} 年 {index} 月</strong><button aria-label="下个月" onClick={() => move(1)}>›</button></div>
      <div className="calendar-grid">{['一','二','三','四','五','六','日'].map(day => <span className="weekday" key={day}>{day}</span>)}
        {Array.from({ length: 42 }, (_, i) => {
          const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
          const value = keyOf(day)
          const hasNote = !!notes[value] && (notes[value].body.trim().length > 0 || notes[value].bookmarked)
          return <button key={value} className={`calendar-day ${day.getMonth() !== index - 1 ? 'other-month' : ''} ${value === date ? 'selected' : ''} ${value === today ? 'is-today' : ''}`} aria-label={`${value}${hasNote ? '，有笔记' : ''}`} aria-current={value === today ? 'date' : undefined} aria-pressed={value === date} title={hasNote ? `${notes[value].category} · 有笔记` : value} onClick={() => choose(value)}>{day.getDate()}{hasNote && <i className="note-dot"/>}</button>
        })}
      </div>
      <div className="calendar-bottom"><span><i className="note-dot"/> 有笔记（全部分类）</span><button onClick={() => choose(today)}>今天</button></div>
    </div>}
  </div>
}
