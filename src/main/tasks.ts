import { mkdirSync, realpathSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs'
import { join, basename, extname, relative, isAbsolute } from 'node:path'
import { randomUUID, createHash } from 'node:crypto'
import type { TaskDocument } from '../shared/notes'

const directories = ['img', 'docs', 'audio', 'video', 'files']
const digest = (body: string) => createHash('sha256').update(body).digest('hex')
export function taskStore() {
  const sessions = new Map<string, { root: string; hash: string }>()
  function session(id: string) {
    const value = sessions.get(id)
    if (!value) throw new Error('任务未打开，请重新打开任务文件夹')
    return value
  }
  function contained(root: string, target: string) {
    const resolved = realpathSync(target)
    const rel = relative(root, resolved)
    if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('资源路径超出任务文件夹')
    return resolved
  }
  function open(root: string): TaskDocument {
    root = realpathSync(root)
    const file = contained(root, join(root, 'task.md'))
    const body = readFileSync(file, 'utf8')
    if (Buffer.byteLength(body) > 5 * 1024 * 1024) throw new Error('任务正文不能超过 5 MB')
    const id = randomUUID()
    sessions.set(id, { root, hash: digest(body) })
    return { id, name: basename(root), root, body }
  }
  return {
    locate(id: string, path: string) {
      const { root } = session(id)
      if (typeof path !== 'string' || isAbsolute(path)) throw new Error('无效资源路径')
      return contained(root, join(root, path))
    },
    open,
    create(parent: string, name: string) {
      name = name.trim()
      if (!name || name.length > 80 || /[<>:"/\\|?*\x00-\x1f]/.test(name) || /[. ]$/.test(name) || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(name) || name === '.' || name === '..') throw new Error('任务名称不合法，请使用不含路径符号的名称')
      const root = join(realpathSync(parent), name)
      if (existsSync(root)) throw new Error('同名文件夹已存在，请换一个任务名称')
      mkdirSync(root)
      for (const dir of directories) mkdirSync(join(root, dir))
      writeFileSync(join(root, 'task.md'), `# ${name}\n\n## 待办\n\n- [ ] \n\n## 记录\n\n`, { flag: 'wx' })
      return open(root)
    },
    save(id: string, body: string) {
      const value = session(id)
      if (typeof body !== 'string' || Buffer.byteLength(body) > 5 * 1024 * 1024) throw new Error('任务正文不能超过 5 MB')
      const file = contained(value.root, join(value.root, 'task.md'))
      if (digest(readFileSync(file, 'utf8')) !== value.hash) throw new Error('task.md 已被其他程序修改。请保留当前内容并重新打开，避免覆盖外部修改')
      const temp = join(value.root, `.task-${randomUUID()}.tmp`)
      writeFileSync(temp, body, { flag: 'wx' })
      renameSync(temp, file)
      value.hash = digest(body)
    },
    attach(id: string, name: string, bytes: Uint8Array) {
      const { root } = session(id)
      if (!(bytes instanceof Uint8Array) || bytes.length > 50 * 1024 * 1024) throw new Error('附件不能超过 50 MB')
      const ext = extname(name).toLowerCase()
      const image = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].includes(ext)
      const dir = image ? 'img' : ['.mp3', '.wav', '.ogg', '.flac', '.m4a'].includes(ext) ? 'audio' : ['.mp4', '.webm', '.mov', '.avi'].includes(ext) ? 'video' : ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.md'].includes(ext) ? 'docs' : 'files'
      mkdirSync(join(root, dir), { recursive: true })
      const folder = contained(root, join(root, dir))
      const filename = `${Date.now()}-${randomUUID().slice(0, 8)}${/^\.[a-z0-9]{1,10}$/.test(ext) ? ext : '.bin'}`
      writeFileSync(join(folder, filename), bytes, { flag: 'wx' })
      return { path: `${dir}/${filename}`, image, name: basename(name) }
    },
    image(id: string, path: string) {
      const { root } = session(id)
      const ext = extname(path).toLowerCase()
      const mime: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp' }
      if (!mime[ext] || isAbsolute(path)) throw new Error('不支持的图片路径')
      const data = readFileSync(contained(root, join(root, path)))
      if (data.length > 10 * 1024 * 1024) throw new Error('预览图片不能超过 10 MB')
      return `data:${mime[ext]};base64,${data.toString('base64')}`
    }
  }
}
