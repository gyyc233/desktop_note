const { app, BrowserWindow, dialog } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const temporary = process.env.NOTE_TEST_USER_DATA
if (!temporary) throw new Error('Run with run-lifecycle.cjs')
app.setPath('userData', temporary)
app.getAppPath = () => temporary
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [temporary] })
require('../out/main/index.js')
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
async function waitFor(window, expression) {
  for (let i = 0; i < 100; i++) { if (await window.webContents.executeJavaScript(expression)) return; await delay(100) }
  throw new Error('Timed out: ' + expression)
}
app.whenReady().then(async () => {
  try {
    const window = BrowserWindow.getAllWindows()[0]
    await waitFor(window, `!!document.querySelector('.task-actions') && !document.querySelector('.today').disabled`)
    await window.webContents.executeJavaScript(`document.querySelector('.task-actions button').click()`)
    await waitFor(window, `!!document.querySelector('input[aria-label="任务名称"]')`)
    await window.webContents.executeJavaScript(`document.querySelector('input[aria-label="任务名称"]').focus()`)
    await window.webContents.insertText('Task alpha')
    await window.webContents.executeJavaScript(`document.querySelector('.task-create').requestSubmit()`)
    await waitFor(window, `!!document.querySelector('.task-workspace .cm-editor')`)
    await window.webContents.executeJavaScript(`document.querySelector('.cm-content').focus()`)
    await window.webContents.insertText('alpha bravo charlie\n')
    await delay(700)
    window.webContents.sendInputEvent({type:'keyDown',keyCode:'Home',modifiers:['control']})
    window.webContents.sendInputEvent({type:'keyUp',keyCode:'Home',modifiers:['control']})
    await delay(200)
    const point = await window.webContents.executeJavaScript(`(() => { const node=document.querySelector('.cm-line').firstChild; const range=document.createRange(); range.setStart(node,7); range.setEnd(node,8); const r=range.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)} })()`)
    window.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:2,...point})
    window.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:2,...point})
    await delay(700)
    assert.equal(await window.webContents.executeJavaScript(`getSelection().toString()`), 'bravo')
    console.log('PASS: task double-click selection survives autosave')
    const directory = path.join(temporary, 'tasks', 'Task alpha')
    assert.ok(fs.existsSync(path.join(directory, 'task.md')))
    await window.webContents.executeJavaScript(`(() => {
      const data = new DataTransfer();
      const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII='), c=>c.charCodeAt(0));
      data.items.add(new File([png], '截图.png', {type:'image/png'}));
      data.items.add(new File(['合同资料'], '合同.txt', {type:'text/plain'}));
      document.querySelector('.task-workspace').dispatchEvent(new ClipboardEvent('paste', {clipboardData:data, bubbles:true}));
    })()`)
    await waitFor(window, `!!document.querySelector('.task-workspace .markdown img') && document.querySelector('.task-workspace .save-state').textContent.includes('已保存')`)
    assert.equal(fs.readdirSync(path.join(directory, 'img')).length, 1)
    assert.equal(fs.readdirSync(path.join(directory, 'docs')).length, 1)
    const body = fs.readFileSync(path.join(directory, 'task.md'), 'utf8')
    assert.ok(body.includes('](img/'))
    assert.ok(body.includes('](docs/'))
    assert.equal(await window.webContents.executeJavaScript(`window.notes.list().then(notes=>notes.length)`), 0)
    await window.webContents.executeJavaScript(`document.querySelector('.task-workspace .toolbar .return-notes').click()`)
    await waitFor(window, `!document.querySelector('.task-workspace')`)
    // Reopen the same task through the native-dialog path.
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [directory] })
    await window.webContents.executeJavaScript(`document.querySelectorAll('.task-actions button')[1].click()`)
    await waitFor(window, `!!document.querySelector('.task-workspace .markdown img')`)
    assert.ok(await window.webContents.executeJavaScript(`document.querySelector('.task-workspace .cm-content').textContent.includes('img/')`))
    await window.webContents.executeJavaScript(`document.querySelector('.task-workspace .cm-content').focus()`)
    window.webContents.sendInputEvent({ type:'keyDown', keyCode:'End', modifiers:['control'] })
    window.webContents.sendInputEvent({ type:'keyUp', keyCode:'End', modifiers:['control'] })
    await window.webContents.insertText('任务退出前的未保存内容')
    console.log('PASS: task creation dialog, clipboard image/file routing, image preview, autosave, daily notes isolation, reopen')
    app.quit()
  } catch (error) { console.error(error); app.exit(1) }
})

app.on('will-quit', () => {
  try {
    assert.ok(fs.readFileSync(path.join(temporary, 'tasks', 'Task alpha', 'task.md'), 'utf8').includes('任务退出前的未保存内容'))
    console.log('PASS: task pending edits flushed before app quit')
  } catch (error) { console.error(error); app.exit(1) }
})

