export type Category = '生活' | '学习' | '工作'
export interface Note { date: string; body: string; updatedAt: string; bookmarked: boolean; category: Category }
export interface NotesAPI {
  deleteNote(date: string): Promise<boolean>
  createTask(name: string): Promise<TaskDocument | null>
  openTask(): Promise<TaskDocument | null>
  saveTask(id: string, body: string): Promise<void>
  attachTask(id: string, name: string, bytes: Uint8Array): Promise<{ path: string; image: boolean; name: string }>
  taskImage(id: string, path: string): Promise<string>
  revealTask(id: string, path: string): Promise<void>
  onOpenMarkdown(callback: () => void): () => void
  getWindow(): Promise<WindowSettings>
  setWindow(settings: Partial<WindowSettings>): Promise<WindowSettings>
  openMarkdown(): Promise<{ name: string; body: string } | null>
  list(): Promise<Note[]>
  save(date: string, body: string, bookmarked: boolean, category: Category): Promise<Note>
  onBeforeClose(callback: () => void): () => void
  confirmClose(): void
  cancelClose(): void
  onBeforeHide(callback: () => void): () => void
}
export interface WindowSettings { compact: boolean; pinned: boolean; opacity: number; dock: boolean }
export interface TaskDocument { id: string; name: string; root: string; body: string }
