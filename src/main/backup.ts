import { randomBytes, scrypt, createCipheriv, createDecipheriv } from 'node:crypto'
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate'
import { existsSync, lstatSync, readdirSync, readFileSync, mkdirSync, writeFileSync, renameSync, rmSync } from 'node:fs'
import { join, resolve, dirname, basename } from 'node:path'
import { validateNotes } from './note-validation.ts'
import type { Note } from '../shared/notes'

const MAGIC = Buffer.from('DNBACK01')
const LIMIT = 100 * 1024 * 1024
const MAX_FILES = 5000
function passwordCheck(password: string) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 256) throw new Error('备份密码需为 8～256 个字符')
}
async function keyFor(password: string, salt: Buffer) {
  passwordCheck(password)
  return await new Promise<Buffer>((ok, fail) => scrypt(password, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? fail(error) : ok(key)))
}
function safePath(name: string) {
  if (name.includes('\\') || name.startsWith('/') || name.length > 1000) throw new Error('备份包含不安全路径')
  const parts = name.replace(/\/$/, '').split('/')
  if (parts.some(part => !part || part === '.' || part === '..' || /[<>:"|?*\x00-\x1f]/.test(part) || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) throw new Error('备份包含不安全路径')
  if (name !== 'notes.json' && name !== 'manifest.json' && !name.startsWith('tasks/')) throw new Error('备份包含未知文件')
}
export function collectBackup(notes: Note[], tasksRoot: string) {
  const files: Record<string, Uint8Array> = {
    'manifest.json': strToU8(JSON.stringify({ format: 'desktop-note', version: 1, createdAt: new Date().toISOString(), scope: 'notes-and-tasks' })),
    'notes.json': strToU8(JSON.stringify(validateNotes(notes)))
  }
  let size = files['notes.json'].length
  let count = 2
  const visit = (directory: string, prefix: string) => {
    if (lstatSync(directory).isSymbolicLink()) throw new Error('tasks 中包含链接，请移除链接后备份')
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const name = prefix + entry.name + (entry.isDirectory() ? '/' : '')
      safePath(name)
      if (++count > MAX_FILES) throw new Error('备份最多支持 5000 个文件及目录')
      const path = join(directory, entry.name)
      const stat = lstatSync(path)
      if (stat.isSymbolicLink()) throw new Error('tasks 中包含链接，请移除链接后备份')
      if (stat.isDirectory()) { files[name] = new Uint8Array(); visit(path, name) }
      else if (stat.isFile()) {
        size += stat.size
        if (size > LIMIT) throw new Error('备份原始数据超过 100 MB')
        files[name] = readFileSync(path)
      } else throw new Error('tasks 中包含不支持的文件类型')
    }
  }
  if (existsSync(tasksRoot)) visit(tasksRoot, 'tasks/')
  if (size > LIMIT) throw new Error('备份原始数据超过 100 MB')
  return files
}
export async function encodeBackup(files: Record<string, Uint8Array>, password: string) {
  const salt = randomBytes(16), iv = randomBytes(12)
  const key = await keyFor(password, salt)
  try {
    const zip = zipSync(files, { level: 6 })
    const prefix = Buffer.concat([MAGIC, salt, iv])
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    cipher.setAAD(prefix)
    const data = Buffer.concat([cipher.update(zip), cipher.final()])
    const result = Buffer.concat([prefix, cipher.getAuthTag(), data])
    if (result.length > LIMIT + 1024 * 1024) throw new Error('压缩备份超过 101 MB，请减少 tasks 文件')
    return result
  } finally { key.fill(0) }
}
export async function decodeBackup(data: Buffer, password: string) {
  if (data.length < 53 || data.length > LIMIT + 1024 * 1024 || !data.subarray(0, 8).equals(MAGIC)) throw new Error('不是有效的每日记事备份文件')
  const key = await keyFor(password, data.subarray(8, 24))
  let zip: Buffer
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, data.subarray(24, 36))
    decipher.setAAD(data.subarray(0, 36)); decipher.setAuthTag(data.subarray(36, 52))
    zip = Buffer.concat([decipher.update(data.subarray(52)), decipher.final()])
  } catch { throw new Error('密码错误或备份文件已损坏') }
  finally { key.fill(0) }
  let size = 0, count = 0
  const names = new Set<string>()
  const files = unzipSync(zip, { filter: file => {
    safePath(file.name)
    const name = file.name.replace(/\/$/, '').toLowerCase()
    if (names.has(name)) throw new Error('备份文件路径重复')
    names.add(name)
    size += file.originalSize
    if (++count > MAX_FILES || size > LIMIT) throw new Error('备份解压大小或文件数量超出限制')
    return true
  } })
  const manifest = JSON.parse(strFromU8(files['manifest.json'] ?? new Uint8Array()))
  if (manifest?.format !== 'desktop-note' || manifest.version !== 1) throw new Error('不支持的备份版本')
  const notes = validateNotes(JSON.parse(strFromU8(files['notes.json'] ?? new Uint8Array())))
  // Only task subfolders may be restored, never loose files under tasks/.
  for (const name of Object.keys(files)) if (name.startsWith('tasks/') && !name.endsWith('/') && name.split('/').length < 3) throw new Error('任务目录结构无效')
  return { notes, files }
}
export function writeBackup(path: string, data: Buffer) {
  const temporary = join(dirname(path), '.' + basename(path) + '.' + randomBytes(6).toString('hex') + '.tmp')
  try { writeFileSync(temporary, data, { flag: 'wx', mode: 0o600 }); renameSync(temporary, path) }
  finally { if (existsSync(temporary)) rmSync(temporary) }
}
export function restoreTasks(files: Record<string, Uint8Array>, tasksRoot: string) {
  mkdirSync(tasksRoot, { recursive: true })
  if (lstatSync(tasksRoot).isSymbolicLink()) throw new Error('tasks 根目录不能是链接')
  const roots = new Set(Object.keys(files).filter(name => name.startsWith('tasks/')).map(name => name.split('/')[1]).filter(Boolean))
  const created: string[] = []
  try {
    for (const root of roots) {
      let destination = join(tasksRoot, root)
      if (existsSync(destination)) destination = join(tasksRoot, root + '-恢复-' + randomBytes(5).toString('hex'))
      mkdirSync(destination) // Exclusive creation; never overwrite existing tasks.
      created.push(resolve(destination))
      for (const [name, bytes] of Object.entries(files)) {
        if (!name.startsWith('tasks/' + root + '/')) continue
        const relative = name.slice(('tasks/' + root + '/').length)
        if (!relative) continue
        const path = join(destination, ...relative.split('/'))
        if (name.endsWith('/')) mkdirSync(path, { recursive: true })
        else { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, bytes, { flag: 'wx' }) }
      }
    }
  } catch (error) { rollbackTasks(created, tasksRoot); throw error }
  return created
}
export function rollbackTasks(paths: string[], root: string) {
  for (const path of paths) {
    if (dirname(resolve(path)) !== resolve(root)) throw new Error('拒绝清理任务根目录以外的路径')
    rmSync(path, { recursive: true, force: true })
  }
}
