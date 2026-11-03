import Database from 'better-sqlite3-multiple-ciphers'
import type { Note, Category } from '../shared/notes'

export function openStore(path: string, key: string) {
  if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('Invalid database key')
  const db = new Database(path)
  try {
    db.pragma("cipher='sqlcipher'")
    db.pragma('legacy=4')
    db.pragma(`key='${key}'`)
    db.pragma('journal_mode=WAL')
    db.exec('CREATE TABLE IF NOT EXISTS notes (date TEXT PRIMARY KEY, body TEXT NOT NULL, updatedAt TEXT NOT NULL)')
    const columns = db.pragma('table_info(notes)') as { name: string }[]
    if (!columns.some(column => column.name === 'bookmarked')) {
      db.transaction(() => {
        db.exec('ALTER TABLE notes ADD COLUMN bookmarked INTEGER NOT NULL DEFAULT 0')
        db.pragma('user_version=2')
      })()
    }
    if (!columns.some(column => column.name === 'category')) {
      db.transaction(() => {
        db.exec("ALTER TABLE notes ADD COLUMN category TEXT NOT NULL DEFAULT '工作'")
        db.pragma('user_version=3')
      })()
    }
  } catch (error) { db.close(); throw error }
  return {
    remove(date: string) {
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid date')
      return db.prepare('DELETE FROM notes WHERE date = ?').run(date).changes > 0
    },
    list: () => (db.prepare('SELECT date, body, updatedAt, bookmarked, category FROM notes ORDER BY date DESC').all() as (Omit<Note, 'bookmarked'> & { bookmarked: number })[]).map(note => ({ ...note, bookmarked: Boolean(note.bookmarked) })),
    save(date: string, body: string, bookmarked = false, category: Category = '工作'): Note {
      const parsed = new Date(`${date}T12:00:00Z`)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error('Invalid date')
      if (typeof body !== 'string' || Buffer.byteLength(body, 'utf8') > 5 * 1024 * 1024) throw new Error('Note exceeds 5 MB')
      if (typeof bookmarked !== 'boolean') throw new Error('Invalid bookmark')
      if (!['生活', '学习', '工作'].includes(category)) throw new Error('Invalid category')
      const note = { date, body, bookmarked, category, updatedAt: new Date().toISOString() }
      db.prepare('INSERT INTO notes(date, body, updatedAt, bookmarked, category) VALUES (@date, @body, @updatedAt, @bookmarked, @category) ON CONFLICT(date) DO UPDATE SET body=excluded.body, updatedAt=excluded.updatedAt, bookmarked=excluded.bookmarked, category=excluded.category').run({ ...note, bookmarked: Number(bookmarked) })
      return note
    },
    close: () => db.close()
  }
}
