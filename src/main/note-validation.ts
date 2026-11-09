import type { Note } from '../shared/notes'
export function validateNotes(value: unknown): Note[] {
  if (!Array.isArray(value) || value.length > 50000) throw new Error('笔记数据格式无效')
  const dates = new Set<string>()
  return value.map((item: Note) => {
    if (!item || typeof item.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) throw new Error('笔记日期无效')
    const date = new Date(item.date + 'T12:00:00Z')
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== item.date || dates.has(item.date)) throw new Error('笔记日期无效或重复')
    dates.add(item.date)
    if (typeof item.body !== 'string' || Buffer.byteLength(item.body) > 5 * 1024 * 1024 || typeof item.bookmarked !== 'boolean' || !['生活', '学习', '工作'].includes(item.category) || typeof item.updatedAt !== 'string' || !Number.isFinite(Date.parse(item.updatedAt))) throw new Error('笔记内容或元数据无效')
    return { date: item.date, body: item.body, bookmarked: item.bookmarked, category: item.category, updatedAt: item.updatedAt }
  })
}
