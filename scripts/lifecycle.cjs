const { app, BrowserWindow, safeStorage, dialog, screen } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const { openStore } = require('../src/main/store.ts')
const temporary = process.env.NOTE_TEST_USER_DATA
if (!temporary) throw new Error('Run with scripts/run-lifecycle.cjs')
app.setPath('userData', temporary)
require('../out/main/index.js')
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
async function waitFor(condition) {
  for (let i = 0; i < 100; i++) { if (await condition()) return; await delay(100) }
  throw new Error('Lifecycle test timed out')
}
let savedAfterClose = false
app.whenReady().then(async () => {
  try {
    const window = BrowserWindow.getAllWindows()[0]
    await waitFor(() => window.webContents.executeJavaScript(`!!document.querySelector('.template') && !document.querySelector('.today').disabled`))
    await window.webContents.executeJavaScript(`const select=document.querySelector('select[aria-label="笔记分类"]'); select.value='生活'; select.dispatchEvent(new Event('change',{bubbles:true}))`)
    await waitFor(() => window.webContents.executeJavaScript(`window.notes.list().then(notes => notes.some(n => n.category==='生活'))`))
    await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.category-filters button')).find(b=>b.textContent.startsWith('学习')).click()`)
    await waitFor(() => window.webContents.executeJavaScript(`document.querySelectorAll('.day').length===0`))
    await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.category-filters button')).find(b=>b.textContent.startsWith('生活')).click()`)
    await waitFor(() => window.webContents.executeJavaScript(`document.querySelectorAll('.day').length===1`))
    console.log('PASS: category assignment, autosave and filtering')
    await window.webContents.executeJavaScript(`document.querySelector('.day').dispatchEvent(new MouseEvent('contextmenu', {bubbles:true,cancelable:true,clientX:100,clientY:250}))`)
    await waitFor(() => window.webContents.executeJavaScript(`!!document.querySelector('.note-actions')`))
    dialog.showMessageBox = async () => ({ response: 0, checkboxChecked: false })
    await window.webContents.executeJavaScript(`document.querySelector('.delete-note').click()`)
    await waitFor(() => window.webContents.executeJavaScript(`!document.querySelector('.note-actions')`))
    assert.equal(await window.webContents.executeJavaScript(`window.notes.list().then(n=>n.length)`), 1)
    await window.webContents.executeJavaScript(`document.querySelector('.day').dispatchEvent(new MouseEvent('contextmenu', {bubbles:true,cancelable:true,clientX:100,clientY:250}))`)
    dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false })
    await waitFor(() => window.webContents.executeJavaScript(`!!document.querySelector('.delete-note')`))
    await window.webContents.executeJavaScript(`document.querySelector('.delete-note').click()`)
    await waitFor(() => window.webContents.executeJavaScript(`window.notes.list().then(n=>n.length===0)`))
    // Reset category filter after deleting its last record.
    await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.category-filters button')).find(b=>b.textContent.startsWith('全部')).click()`)
    console.log('PASS: right-click note menu, cancel deletion, confirmed database deletion')
    const originalBounds = window.getBounds()
    await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.desktop-controls button')).find(b => b.textContent === '便签模式').click()`)
    await waitFor(() => window.webContents.executeJavaScript(`!!document.querySelector('.app.compact')`))
    assert.ok(Math.abs(window.getBounds().width - 360) <= 2)
    await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.desktop-controls button')).find(b => b.textContent === '置顶').click()`)
    await waitFor(() => window.isAlwaysOnTop())
    await window.webContents.executeJavaScript(`window.notes.setWindow({opacity:0.6})`)
    assert.ok(Math.abs(window.getOpacity() - 0.6) < 0.02)
    await window.webContents.executeJavaScript(`window.notes.setWindow({opacity:1, pinned:false})`)
    await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.desktop-controls button')).find(b => b.textContent === '展开窗口').click()`)
    await waitFor(() => window.webContents.executeJavaScript(`!document.querySelector('.app.compact')`))
    assert.ok(Math.abs(window.getBounds().width - originalBounds.width) <= 2)
    console.log('PASS: compact window, restore bounds, always-on-top, opacity')
    const area = screen.getDisplayMatching(window.getBounds()).workArea
    const cursorReader = screen.getCursorScreenPoint
    let fakeCursor = { x: area.x + area.width - 2, y: area.y + area.height - 2 }
    screen.getCursorScreenPoint = () => fakeCursor
    window.setBounds({ x: area.x, y: area.y + 30, width: 640, height: 480 })
    await window.webContents.executeJavaScript(`window.notes.setWindow({dock:true})`)
    await delay(2000)
    assert.ok(window.getBounds().x >= area.x - 2, 'Normal mode must not tuck')
    await window.webContents.executeJavaScript(`window.notes.setWindow({compact:true})`)
    window.setBounds({x:area.x+24,y:area.y+60,width:360,height:420})
    fakeCursor={x:area.x+100,y:area.y+100}
    await waitFor(() => Math.abs(window.getBounds().x-area.x)<=2)
    fakeCursor={x:area.x+area.width-2,y:area.y+area.height-2}
    await waitFor(() => window.getBounds().x < area.x - 100)
    fakeCursor = { x: area.x + 2, y: area.y + 60 }
    await waitFor(() => Math.abs(window.getBounds().x - area.x) <= 2)
    fakeCursor = { x: area.x + area.width - 2, y: area.y + area.height - 2 }
    await waitFor(() => window.getBounds().x < area.x - 100)
    await window.webContents.executeJavaScript(`window.notes.setWindow({dock:false})`)
    assert.ok(Math.abs(window.getBounds().x - area.x) <= 2)
    const stableWidth = window.getBounds().width
    const stableHeight = window.getBounds().height
    fakeCursor = { x: area.x + area.width - 2, y: area.y + 100 }
    window.setPosition(area.x + area.width - stableWidth - 20, area.y + 60)
    await window.webContents.executeJavaScript(`window.notes.setWindow({dock:true})`)
    await waitFor(() => Math.abs(window.getBounds().x + window.getBounds().width - area.x - area.width) <= 2)
    await delay(300)
    let movements = 0
    const countMoves = () => movements++
    window.on('move', countMoves)
    await delay(1500)
    window.removeListener('move', countMoves)
    assert.ok(movements <= 2, 'Right-edge snapping must settle instead of oscillating')
    assert.ok(Math.abs(window.getBounds().width - stableWidth) <= 2, 'Dock animation must not repeatedly grow the window')
    assert.ok(Math.abs(window.getBounds().height - stableHeight) <= 2)
    await window.webContents.executeJavaScript(`window.notes.setWindow({dock:false})`)
    console.log('PASS: right-edge stable position and unchanged dimensions')
    screen.getCursorScreenPoint = cursorReader
    await window.webContents.executeJavaScript(`window.notes.setWindow({compact:false})`)
    window.setBounds(originalBounds)
    console.log('PASS: edge tuck, cursor-edge restore and disable restore')

    await window.webContents.executeJavaScript(`document.querySelector('.template').click()`)
    await window.webContents.executeJavaScript(`document.querySelector('.calendar-trigger').click()`)
    await waitFor(() => window.webContents.executeJavaScript(`!!document.querySelector('.calendar-day .note-dot')`))
    assert.equal(await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.calendar-popup button')).some(b=>b.textContent==='清除')`), false)
    await window.webContents.executeJavaScript(`document.querySelector('button[aria-label="上个月"]').click()`)
    await window.webContents.executeJavaScript(`document.querySelector('button[aria-label="下个月"]').click()`)
    await window.webContents.executeJavaScript(`document.querySelector('.calendar-day.selected').click()`)
    await waitFor(() => window.webContents.executeJavaScript(`!document.querySelector('.calendar-popup')`))
    console.log('PASS: calendar note markers, month navigation, date selection, no misleading clear action')
    window.close()
    assert.equal(window.isDestroyed(), false)
    assert.equal(window.isVisible(), false)
    await waitFor(() => window.webContents.executeJavaScript(`window.notes.list().then(notes => notes.some(n => n.body.includes('今日事项')))`))
    savedAfterClose = true
    window.show()
    await window.webContents.executeJavaScript(`document.querySelector('.cm-content').focus()`)
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'End', modifiers: ['control'] })
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'End', modifiers: ['control'] })
    await window.webContents.insertText('退出前立即输入，必须保存')
    app.quit()
  } catch (error) { console.error(error); app.exit(1) }
})
app.on('will-quit', () => {
  try {
    assert.ok(savedAfterClose)
    const key = safeStorage.decryptString(fs.readFileSync(path.join(temporary, 'database.key')))
    const store = openStore(path.join(temporary, 'notes.db'), key)
    assert.ok(store.list().some(note => note.body.includes('退出前立即输入，必须保存')))
    store.close()
    console.log('PASS: actual main-process close-to-tray flush and application-quit flush')
  } catch (error) { console.error(error); app.exit(1) }
})


