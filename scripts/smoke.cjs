const { app, BrowserWindow, ipcMain } = require('electron')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { randomBytes } = require('node:crypto')
const { openStore } = require('../src/main/store.ts')
const Database = require('better-sqlite3-multiple-ciphers')
const { formatSelection } = require('../src/renderer/src/formatting.ts')
const { attachTray } = require('../src/main/tray.ts')
const { readMarkdownFile } = require('../src/main/markdown-file.ts')
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-note-test-'))
const file = path.join(directory, 'test.db')
const key = randomBytes(32).toString('hex')
let store
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
app.on('window-all-closed', () => {})
async function waitFor(window, expression) {
  for (let i = 0; i < 100; i++) {
    if (await window.webContents.executeJavaScript(expression)) return
    await delay(100)
  }
  throw new Error('Timed out: ' + expression)
}
app.whenReady().then(async () => {
  try {
    assert.equal(formatSelection('甲\n乙\n丙', 0, 4, 'ordered').insert, '1. 甲\n2. 乙')
    assert.equal(formatSelection('## 标题', 0, 5, 'paragraph').insert, '标题')
    assert.equal(formatSelection('已取消', 0, 3, 'strike').insert, '~~已取消~~')
    assert.equal(formatSelection('~~已取消~~', 2, 5, 'strike').insert, '已取消')
    assert.ok(formatSelection('事项\t状态\n任务\t待办', 0, 11, 'table').insert.includes('| 事项 | 状态 |'))
    const legacy = new Database(file)
    legacy.pragma("cipher='sqlcipher'"); legacy.pragma('legacy=4'); legacy.pragma(`key='${key}'`)
    legacy.exec('CREATE TABLE notes(date TEXT PRIMARY KEY, body TEXT NOT NULL, updatedAt TEXT NOT NULL); PRAGMA user_version=1;')
    legacy.prepare('INSERT INTO notes VALUES (?, ?, ?)').run('2026-10-28', '旧版本笔记', '2026-10-28T00:00:00Z')
    legacy.close()
    store = openStore(file, key)
    assert.equal(store.list()[0].body, '旧版本笔记')
    assert.equal(store.list()[0].bookmarked, false)
    assert.equal(store.list()[0].category, '工作')
    store.save('2026-10-28', '旧版本笔记', false, '学习')
    assert.equal(store.list()[0].category, '学习')
    assert.throws(() => store.save('2026-10-28', 'invalid', false, '其他'))
    const original = '# 私密测试记录\n\n| 事项 | 状态 |\n| --- | --- |\n| 数据安全 | 已验证 |\n\n- [ ] 跟进事项'
    store.save('2026-10-29', original, true)
    assert.throws(() => store.save('2026-02-30', 'invalid'))
    store.close()
    assert.equal(fs.readFileSync(file).includes(Buffer.from('私密测试记录')), false)
    assert.throws(() => openStore(file, 'b'.repeat(64)))
    store = openStore(file, key)
    assert.equal(store.list()[0].body, original)
    assert.equal(store.list()[0].bookmarked, true)
    ipcMain.handle('notes:list', () => store.list())
    ipcMain.handle('notes:save', (_event, date, body, bookmarked, category) => store.save(date, body, bookmarked, category))
    const fixture = path.join(directory, '公式示例.md')
    const formulas = String.raw`# 公式预览

行内公式：$E=mc^2$，根号：$\sqrt{x^2+y^2}$。

$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$

$$
\sum_{n=1}^{N} n = \frac{N(N+1)}{2}
$$

$$
\begin{bmatrix}1 & 2 \\ 3 & 4\end{bmatrix}
$$

| 项目 | 结果 |
| --- | --- |
| 测试 | 通过 |

<script>window.__unsafeExecuted = true</script>
`
    fs.writeFileSync(fixture, formulas)
    const utf16 = path.join(directory, 'utf16.markdown')
    fs.writeFileSync(utf16, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('中文文档', 'utf16le')]))
    assert.equal((await readMarkdownFile(utf16)).body, '中文文档')
    assert.equal((await readMarkdownFile(fixture)).body, formulas)
    await assert.rejects(() => readMarkdownFile(path.join(directory, 'file.exe')))
    const invalid = path.join(directory, 'invalid.md')
    fs.writeFileSync(invalid, Buffer.from([0xff, 0x00, 0x81]))
    await assert.rejects(() => readMarkdownFile(invalid))
    const oversized = path.join(directory, 'large.md')
    fs.writeFileSync(oversized, Buffer.alloc(5 * 1024 * 1024 + 1))
    await assert.rejects(() => readMarkdownFile(oversized))
    let cancelOpen = false
    ipcMain.handle('markdown:open', () => cancelOpen ? null : readMarkdownFile(fixture))
    const window = new BrowserWindow({ show: false, width: 1200, height: 800, webPreferences: { preload: path.resolve('out/preload/index.js'), sandbox: true, contextIsolation: true, nodeIntegration: false } })
    await window.loadFile(path.resolve('out/renderer/index.html'))
    window.show()
    await waitFor(window, `document.querySelector('.template') && !document.querySelector('.today').disabled`)
    await window.webContents.executeJavaScript(`document.querySelector('.template').click()`)
    await waitFor(window, `document.querySelector('.save-state').textContent.includes('已保存到本地')`)
    assert.ok(store.list().some(note => note.body.includes('今日事项')))
    await window.webContents.executeJavaScript(`document.querySelector('button[aria-label="书签"]').click()`)
    await waitFor(window, `document.querySelector('.save-state').textContent.includes('已保存到本地')`)
    assert.ok(store.list().some(note => note.body.includes('今日事项') && note.bookmarked))
    await window.webContents.executeJavaScript(`document.querySelector('button[aria-label="删除线"]').click()`)
    await waitFor(window, `!!document.querySelector('.markdown del')`)
    await window.webContents.executeJavaScript(`document.querySelector('button[aria-label="表格"]').click()`)
    await waitFor(window, `!!document.querySelector('.markdown table')`)
    // Undo table insertion, then strikethrough; formatting edits must use editor history.
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'z', modifiers: ['control'] })
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'z', modifiers: ['control'] })
    await waitFor(window, `!document.querySelector('.markdown table')`)
    await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.modes button')).find(b => b.textContent === '预览').click()`)
    await waitFor(window, `!document.querySelector('.cm-editor')`)
    await window.webContents.executeJavaScript(`document.querySelector('button[aria-label="加粗"]').click()`)
    await waitFor(window, `!!document.querySelector('.markdown strong') && !!document.querySelector('.cm-editor')`)
    await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.day')).find(button => button.textContent.includes('10 月 29')).click()`)
    await waitFor(window, `!!document.querySelector('.markdown table')`)
    assert.equal(await window.webContents.executeJavaScript(`document.querySelectorAll('.markdown input[type=checkbox]').length`), 1)
    await delay(250)
    fs.mkdirSync('artifacts', { recursive: true })
    fs.writeFileSync('artifacts/notes-preview.png', (await window.webContents.capturePage()).toPNG())
    window.reload()
    await waitFor(window, `document.querySelector('.cm-content')?.textContent.includes('今日事项')`)
    assert.equal(await window.webContents.executeJavaScript(`document.querySelector('button[aria-label="书签"]').getAttribute('aria-pressed')`), 'true')
    await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.archive-tabs button')).find(b => b.textContent.includes('书签')).click()`)
    assert.equal(await window.webContents.executeJavaScript(`document.querySelectorAll('.day').length`), 2)
    const beforePreview = store.list()
    await window.webContents.executeJavaScript(`document.querySelector('.open-document').click()`)
    await waitFor(window, `document.querySelector('h1').textContent === '公式示例.md' && document.querySelectorAll('.katex').length === 5`)
    assert.equal(await window.webContents.executeJavaScript(`document.querySelectorAll('.katex-display').length`), 3)
    assert.equal(await window.webContents.executeJavaScript(`document.querySelectorAll('.katex-error').length`), 0)
    assert.equal(await window.webContents.executeJavaScript(`!!window.__unsafeExecuted`), false)
    assert.equal(await window.webContents.executeJavaScript(`!!document.querySelector('.markdown table')`), true)
    assert.equal(await window.webContents.executeJavaScript(`!!document.querySelector('.cm-editor')`), false)
    await window.webContents.executeJavaScript('document.fonts.ready.then(() => true)')
    await delay(300)
    fs.writeFileSync('artifacts/formula-preview.png', (await window.webContents.capturePage()).toPNG())
    assert.deepEqual(store.list(), beforePreview, 'Opening files must not overwrite daily notes')
    assert.equal(fs.readFileSync(fixture, 'utf8'), formulas)
    cancelOpen = true
    await window.webContents.executeJavaScript(`document.querySelector('.open-document').click()`)
    await waitFor(window, `!document.querySelector('.open-document').disabled`)
    assert.equal(await window.webContents.executeJavaScript(`document.querySelector('h1').textContent`), '公式示例.md')
    await window.webContents.executeJavaScript(`document.querySelector('.return-notes').click()`)
    await waitFor(window, `!!document.querySelector('.cm-editor')`)
    const desktopTray = attachTray(window)
    assert.equal(desktopTray.tray.isDestroyed(), false)
    desktopTray.show()
    await window.webContents.executeJavaScript(`document.querySelector('.cm-content').focus()`)
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Home', modifiers: ['control'] })
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Home', modifiers: ['control'] })
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Right' })
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Right' })
    await waitFor(window, `document.querySelector('.cursor-position').textContent.includes('第 1 行，第 2 列')`)
    await waitFor(window, `!!document.querySelector('.cm-cursor') && !!document.querySelector('.cm-activeLine')`)
    const caret = await window.webContents.executeJavaScript(`(() => {
      const cursor = document.querySelector('.cm-cursor'); const rect = cursor.getBoundingClientRect();
      const scroller = document.querySelector('.cm-scroller').getBoundingClientRect();
      const style = getComputedStyle(cursor);
      return { width: parseFloat(style.borderLeftWidth), inside: rect.left >= scroller.left && rect.right <= scroller.right && rect.top >= scroller.top && rect.bottom <= scroller.bottom, lines: document.querySelectorAll('.cm-lineNumbers .cm-gutterElement').length };
    })()`)
    assert.equal(caret.width, 2)
    assert.ok(caret.inside, 'Caret must remain inside the visible editor')
    assert.ok(caret.lines > 1)
    await delay(120)
    fs.writeFileSync('artifacts/editor-cursor.png', (await window.webContents.capturePage()).toPNG())
    window.minimize()
    for (let i = 0; i < 50 && window.isVisible(); i++) await delay(100)
    assert.equal(window.isVisible(), false, 'Minimize should hide to system tray')
    desktopTray.show()
    window.close()
    assert.equal(window.isDestroyed(), false, 'Close button should keep the app running')
    assert.equal(window.isVisible(), false, 'Close button should hide to tray')
    desktopTray.tray.emit('double-click', {}, { x: 0, y: 0, width: 16, height: 16 })
    assert.equal(window.isVisible(), true, 'Tray double-click should restore the window')
    assert.equal(window.isMinimized(), false)
    desktopTray.menu.items.find(item => item.label === '退出').click()
    for (let i = 0; i < 50 && !window.isDestroyed(); i++) await delay(100)
    assert.equal(window.isDestroyed(), true, 'Tray exit should actually close the window')
    assert.equal(desktopTray.tray.isDestroyed(), true)
    store.close(); store = undefined
    console.log('PASS: Markdown file open/cancel/return, UTF-8/UTF-16/size checks, inline/display formulas, inert HTML, daily notes preserved, close to tray, normal minimize, double-click restore, tray exit/cleanup, caret tracking, bookmarks, encrypted persistence and formatting')
    app.exit(0)
  } catch (error) {
    console.error(error)
    app.exit(1)
  } finally {
    try { store?.close() } catch {}
    fs.rmSync(directory, { recursive: true, force: true })
  }
})
