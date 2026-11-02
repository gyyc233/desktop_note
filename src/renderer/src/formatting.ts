export type Format = 'paragraph' | 'h1' | 'h2' | 'h3' | 'quote' | 'ordered' | 'bullet' | 'task' | 'bold' | 'italic' | 'strike' | 'code' | 'table' | 'math'
export function formatSelection(text: string, from: number, to: number, kind: Format) {
  const wrappers: Partial<Record<Format, string>> = { bold: '**', italic: '*', strike: '~~', code: '`', math: '$' }
  const marker = wrappers[kind]
  if (marker) {
    const selected = text.slice(from, to)
    if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length >= marker.length * 2) {
      const insert = selected.slice(marker.length, -marker.length)
      return { from, to, insert, anchor: from, head: from + insert.length }
    }
    if (text.slice(from - marker.length, from) === marker && text.slice(to, to + marker.length) === marker) {
      return { from: from - marker.length, to: to + marker.length, insert: selected, anchor: from - marker.length, head: to - marker.length }
    }
    const content = selected || ({ bold: '加粗文字', italic: '斜体文字', strike: '已删除的文字', code: '代码', math: 'E=mc^2' } as Record<string, string>)[kind]
    return { from, to, insert: marker + content + marker, anchor: from + marker.length, head: from + marker.length + content.length }
  }
  // A selection ending at the next line's start should not format that line.
  const start = text.lastIndexOf('\n', from - 1) + 1
  const endPosition = to > from && text[to - 1] === '\n' ? to - 1 : to
  const nextBreak = text.indexOf('\n', endPosition)
  const end = nextBreak === -1 ? text.length : nextBreak
  const selected = text.slice(start, end)
  if (kind === 'table') {
    const cell = (value: string) => value.trim().replace(/\|/g, '\\|')
    const rows = selected.trim() ? selected.split('\n').map(line => line.split('\t').map(cell)) : [['事项', '状态'], ['待办事项', '待处理'], ['补充事项', '待处理']]
    const width = Math.max(2, ...rows.map(row => row.length))
    const rowText = (row: string[]) => '| ' + Array.from({ length: width }, (_, i) => row[i] || ' ').join(' | ') + ' |'
    const table = [rowText(rows[0]), rowText(Array(width).fill('---')), ...rows.slice(1).map(rowText)]
    if (rows.length === 1) table.push(rowText(Array(width).fill('内容')))
    const before = start > 0 && text[start - 2] !== '\n' ? '\n' : ''
    const after = end < text.length && text[end + 1] !== '\n' ? '\n' : ''
    const insert = before + table.join('\n') + after
    return { from: start, to: end, insert, anchor: start + before.length + 2, head: start + before.length + 2 + (rows[0][0]?.length || 1) }
  }
  const clean = (line: string) => line.replace(/^\s*(?:#{1,6}\s+|>\s?|(?:[-+*]|\d+[.)])\s+(?:\[[ xX]\]\s+)?)/, '')
  const lines = selected.split('\n')
  let number = 0
  const insert = lines.map(line => {
    const content = clean(line)
    if (!content && lines.length > 1) return ''
    const prefix = kind === 'paragraph' ? '' : kind === 'quote' ? '> ' : kind === 'ordered' ? `${++number}. ` : kind === 'bullet' ? '- ' : kind === 'task' ? '- [ ] ' : '#'.repeat(Number(kind.slice(1))) + ' '
    return prefix + content
  }).join('\n')
  return { from: start, to: end, insert, anchor: start, head: start + insert.length }
}
