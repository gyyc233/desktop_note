import { open } from 'node:fs/promises'
import { basename, extname } from 'node:path'

export async function readMarkdownFile(path: string) {
  if (!['.md', '.markdown', '.mdown', '.mkd'].includes(extname(path).toLowerCase())) throw new Error('请选择 Markdown 文件（.md 或 .markdown）')
  const handle = await open(path, 'r')
  try {
    const stat = await handle.stat()
    if (!stat.isFile() || stat.size > 5 * 1024 * 1024) throw new Error('仅支持 5 MB 以内的 Markdown 文件')
    const buffer = Buffer.alloc(5 * 1024 * 1024 + 1)
    let bytesRead = 0
    while (bytesRead < buffer.length) {
      const result = await handle.read(buffer, bytesRead, buffer.length - bytesRead, bytesRead)
      if (!result.bytesRead) break
      bytesRead += result.bytesRead
    }
    if (bytesRead > 5 * 1024 * 1024) throw new Error('文件过大')
    const data = buffer.subarray(0, bytesRead)
    const encoding = data[0] === 0xff && data[1] === 0xfe ? 'utf-16le' : data[0] === 0xfe && data[1] === 0xff ? 'utf-16be' : 'utf-8'
    try {
      return { name: basename(path), body: new TextDecoder(encoding, { fatal: true }).decode(data) }
    } catch { throw new Error('无法读取文件编码，请将文件保存为 UTF-8 或带 BOM 的 UTF-16') }
  } finally { await handle.close() }
}
