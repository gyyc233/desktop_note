# 每日记事（desktop-note）

本地优先的桌面 Markdown 记事本，使用 Electron、React 和 TypeScript 开发。当前主要在 Windows x64 上开发和验证；架构可用于跨平台开发，但 macOS、Linux 的构建、系统密钥存储和窗口行为仍需验证。

## 当前功能

- 每天一篇笔记，日期归档、正文搜索、日历中的笔记标记。
- 生活、学习、工作三个分类，每篇选择一个分类；支持分类筛选。
- Markdown 编辑、双栏和只读预览；段落、标题、列表、待办、表格、引用、删除线等格式工具。
- 行内及独立数学公式渲染，支持分式、根号、求和、积分和矩阵等常用 KaTeX 语法。
- 笔记书签、自动保存、本地加密数据库、关闭或退出前保存。
- 打开本地 Markdown 文件并只读预览，不修改源文件、不覆盖每日笔记。
- 窗口置顶、35%～100% 整窗透明度、可缩放的便签小窗口。
- 中文菜单；点击标题栏 × 收起到系统托盘，双击托盘图标恢复。

## 技术框架

| 层次 | 技术 | 职责 |
| --- | --- | --- |
| 桌面主进程 | Electron 45、TypeScript | 窗口、托盘、菜单、文件读取、数据库和系统密钥保护 |
| 预加载桥接 | Electron contextBridge、IPC | 向界面暴露有限的类型化 API |
| 界面 | React 19、TypeScript、CSS | 日期、分类、编辑与预览界面 |
| 编辑器 | CodeMirror 6、@uiw/react-codemirror | Markdown 编辑、选区格式化、撤销重做 |
| 文档渲染 | react-markdown、remark-gfm | Markdown、表格和任务列表 |
| 公式渲染 | remark-math、rehype-katex、KaTeX | 本地公式解析、排版及字体 |
| 内容净化 | rehype-sanitize | 先净化文档，再进行受限的公式渲染 |
| 数据库 | better-sqlite3-multiple-ciphers | SQLite 加密、事务和 WAL |
| 开发构建 | electron-vite 6、Vite 8、TypeScript 7 | 主进程、预加载及界面构建 |

具体依赖及锁定版本以 `package.json` 和 `package-lock.json` 为准。

界面通过 `window.notes` 调用预加载 API，再由主进程访问本地数据。窗口启用 `contextIsolation` 和 `sandbox`，禁用界面的 Node.js 集成。新增系统能力时应扩展预加载接口，不应直接在 React 中访问文件系统或数据库。

## 环境准备

### Windows

建议先使用与本项目已验证环境接近的版本：

- Node.js 24.x；已验证 24.18.0，附带 npm 11.16.0。
- Git。
- Python 3；已验证 3.14.6，用于原生模块编译。
- Visual Studio Build Tools，安装 C++ 桌面开发工具及 Windows SDK；已验证 Build Tools 2026 和 Windows SDK 10.0.26100.0。
- VS Code 或其他编辑器（可选）。

不用安装独立的数据库服务器，也不需要创建 Conda 环境。Python 仅用于原生依赖构建，应用本身由 Electron 运行。

macOS 构建原生模块通常需要 Xcode Command Line Tools，Linux 需要 Python、make、C/C++ 编译工具和桌面运行环境。这两个平台尚未在本仓库完成验证，不能视为已支持的发布版本。

## 安装与启动

在克隆后的仓库根目录打开终端：

```powershell
node --version
npm.cmd --version
python --version
npm.cmd ci
npm.cmd run dev
```

Windows 示例使用 `npm.cmd`，可避免 PowerShell 对 `npm.ps1` 的执行策略限制；macOS/Linux 使用 `npm`。

`npm ci` 根据锁文件安装项目依赖，`postinstall` 会下载 Electron 并将数据库原生模块重新编译为 Electron 对应版本，需要网络和编译工具链。开发服务器端口由 Vite 分配，以终端实际输出为准。

如果装有多个 Python，可在同一个终端中指定构建所用版本，路径替换为自己的实际路径：

```powershell
$env:PYTHON = 'C:\Python314\python.exe'
npm.cmd ci
```

添加依赖时使用 `npm install <包名>`，并将更新后的 `package.json`、`package-lock.json` 一起提交。

### Electron 下载缓慢

可在当前终端临时指定下载镜像，不必修改系统级配置：

```powershell
$env:ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'
node node_modules/electron/install.js
npm.cmd run rebuild
```

镜像由第三方提供，是否使用由开发者自行选择；默认下载失败也可能是代理或网络配置问题。

### 原生模块版本不匹配

升级 Electron、切换 CPU 架构或遇到 `NODE_MODULE_VERSION` 错误时执行：

```powershell
npm.cmd run rebuild
```

若安装器报告依赖脚本未获允许运行，应按当前 npm 的提示审查该包。数据库模块的项目级重建命令为上面的 `rebuild`，不建议为此全局放开所有依赖脚本。

## 常用命令

| 命令 | 功能 |
| --- | --- |
| `npm run dev` | 启动开发服务器及 Electron 窗口 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run build` | 类型检查并生成 `out/` 构建产物 |
| `npm run preview` | 启动已构建的应用，需先执行 build |
| `npm run rebuild` | 为当前 Electron 重建数据库原生模块 |
| `npm test` | 构建后运行界面冒烟测试及主进程生命周期测试 |

`build` 仅生成应用代码。使用 `npm run package:win` 制作 Windows x64 NSIS 安装包与便携版，输出到 `dist/`；`npm run package:dir` 生成未封装程序目录，便于调试。安装包配置见 `electron-builder.yml`。当前产物未进行代码签名，尚未实现自动更新。

## 使用说明

1. 默认打开今天的笔记，在编辑区输入即可，停止输入约 400 ms 后自动保存。以界面保存状态为准。
2. 通过日期列表或右上角日历查看、补写其他日期。有内容或已加书签的日期会显示圆点。
3. 使用“笔记分类”修改当前笔记分类，左侧分类按钮用于筛选。已有笔记升级后默认归为“工作”。
4. 选中文字后点击格式按钮；未选文字时，根据按钮插入示例或修改当前行。
5. “书签”标记整篇笔记，左侧可筛选书签。
6. “打开 Markdown”或 `Ctrl+O` 可打开本地文件；“返回每日笔记”返回记录界面。
7. 顶部可调整透明度、切换置顶或便签模式；便签模式仍编辑同一篇笔记，可展开恢复窗口。
8. 标题栏 × 收起到托盘，— 普通最小化。真正退出请选择托盘右键“退出”或菜单“文件 → 退出程序”。

支持的外部文档扩展名为 `.md`、`.markdown`、`.mdown`、`.mkd`，文件上限 5 MB；支持 UTF-8 和带 BOM 的 UTF-16。单篇笔记正文上限为 5 MB（UTF-8 字节数）。

### Markdown 和公式示例

```markdown
## 今日事项

- [ ] 跟进项目
- [x] 整理资料

| 事项 | 状态 |
| --- | --- |
| 合同审核 | 待处理 |

~~已经取消的事项~~

行内公式：$E=mc^2$

$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$
```

预览中的任务复选框目前仅用于展示，需要在编辑区修改 `[ ]` 或 `[x]`。

## 目录结构

```text
src/
  main/
    index.ts               应用入口、IPC、保存与退出流程
    store.ts               加密数据库、校验及表结构迁移
    markdown-file.ts       Markdown 文件读取和编码检查
    window-controls.ts     置顶、透明度、便签窗口
    tray.ts                托盘和关闭到托盘逻辑
    menu.ts                中文应用菜单
  preload/index.ts         contextBridge API
  shared/notes.ts          笔记、分类和窗口接口类型
  renderer/
    index.html             页面入口与内容安全策略
    src/
      main.tsx             React 主界面和自动保存队列
      NoteCalendar.tsx     笔记日历
      MarkdownView.tsx     Markdown 净化和公式渲染
      formatting.ts        选区格式化逻辑
      style.css            样式
scripts/
  smoke.cjs                数据、界面和托盘集成测试
  lifecycle.cjs            实际主进程及保存退出测试
  run-smoke.cjs            测试进程启动器
  run-lifecycle.cjs        独立用户目录测试启动器
electron.vite.config.ts   三个进程的构建配置
```

## 数据位置与加密

数据写入 Electron 的 `app.getPath('userData')`，不在仓库目录。当前 Windows 开发版通常位于：

```text
%APPDATA%\desktop-note\
  notes.db       加密数据库
  database.key   经系统安全存储保护的数据库密钥
```

启用 WAL 时还可能出现 `notes.db-wal` 和 `notes.db-shm`。数据库通过 SQLite3 Multiple Ciphers 的 SQLCipher 配置打开，不应将其等同于已验证可与任意 SQLCipher 工具直接交换的格式。

随机数据库密钥由 Electron `safeStorage` 保护。在 Windows 上依赖当前系统账号，不能保证把数据库和密钥文件复制到另一台电脑或另一账号后还能解密。系统密钥存储不可用时应用会拒绝打开；Linux 的 `basic_text` 后端也被拒绝。

当前没有密码恢复、便携加密备份或备份导入功能。不要删除 `database.key`，不要在应用运行时仅复制 `notes.db` 当作完整备份，也不要把个人数据目录提交到 Git。

## 测试和开发约定

- `npm test` 需要可运行 Electron 的图形桌面；测试会短暂显示窗口和托盘图标，不是纯 Node.js 或无界面单元测试。
- 测试使用临时数据库和独立用户目录，不应写入个人笔记库。
- 测试覆盖加密重开、错误密钥、旧表结构升级、自动保存、分类筛选、格式操作、公式、文件预览、日历标记、托盘和窗口控制等。
- 截图和构建日志写入 `artifacts/`；`artifacts/`、`node_modules/`、`out/`、`dist/` 已忽略。
- 只运行一个开发实例。应用具有单实例锁，旧进程可能仍在托盘中；修改主进程或预加载后，应从托盘正常退出旧版，再启动。
- 数据结构变更需在 `store.ts` 中提供迁移，保留旧内容；新增功能应同时检查共享类型、预加载接口和主进程处理器。

## 当前限制与后续方向

- 一天一篇笔记，暂不支持同一天分别创建多篇生活、学习、工作笔记。
- 每日笔记和普通只读文档尚不支持附件导入。Task 模式支持图片预览及材料归档；任务附件链接可在文件管理器中定位，外部网络链接暂不直接跳转。
- 窗口置顶、透明度和便签状态目前不跨启动保存。
- 飞书双向同步处于方案讨论阶段，尚未实现，也不需要配置飞书密钥。
- 未实现笔记删除/回收站、密码备份恢复、自动更新和跨平台发布验证。
- 仓库尚未声明开源许可证；使用或分发前需与维护者确认授权，并检查第三方依赖许可。

## 本地 Task 任务资料

左侧“新建 task”输入名称，程序会在仓库根目录的 `tasks/` 下创建同名子文件夹，不再弹出父目录选择框；已有同名目录会被拒绝，不会覆盖。使用“打开 task”选择包含 `task.md` 的目录继续编辑。

```text
仓库根目录/tasks/
  任务名称/
    task.md       任务 Markdown 正文
    img/          PNG、JPEG、GIF、WebP、BMP 图片
    docs/         PDF、Office、文本、CSV、Markdown 文档
    audio/        音频
    video/        视频
    files/        其他材料
```

- 在任务编辑区粘贴截图、剪贴板提供的文件，或拖入文件，自动复制到对应目录。普通文字粘贴仍进入正文。
- “添加材料”也支持多文件选择。附件使用时间戳和随机 ID 命名，避免重名覆盖，原文件保留。
- 正文插入相对路径，文件夹整体移动后可重新打开；图片显示在任务预览中，其他附件链接可定位原文件。
- 每个附件不超过 50 MB；图片内嵌预览不超过 10 MB；正文不超过 5 MB。SVG 不作为图片内嵌预览。
- 保存、切换任务、收起和退出会等待正在进行的附件写入和正文保存；若导入失败，按界面提示重试保存。
- 任务正文被其他程序修改时会拒绝覆盖。请先复制保留当前编辑内容，再重新打开处理冲突。
- 可整体打包仓库或 `tasks/`，解压后使用“打开 task”选择对应任务目录；引用使用相对路径。开发版以项目位置定位 `tasks/`，未来打包版以可执行文件所在目录定位，需要该目录可写。
- Task 是普通文件资料模式，**正文和附件不使用每日笔记数据库加密**。自行选择受保护的文件夹，并整体备份任务目录。
- 粘贴能否获得文件取决于来源软件是否向系统剪贴板提供文件数据；只提供文字路径时，可改用拖入或“添加材料”。

实现入口：`src/main/tasks.ts`、`src/renderer/src/TaskWorkspace.tsx`。任务由主进程分配会话 ID，资源读取限制在已打开的任务目录内。

## CI / CD

GitHub Actions 配置位于 `.github/workflows/`：

- `ci.yml`：推送到 `main`、创建或更新 PR、手动运行时，在 Windows 上安装依赖并执行 `npm test`，上传测试截图和日志。
- `release.yml`：推送 `v*` 标签时先执行完整测试，再构建 Windows x64 安装版和便携版，计算 SHA256 校验值，上传 Actions 构建产物并创建 GitHub Release 草稿。检查附件后在 GitHub 发布草稿。
- 手动运行 Release workflow 只构建、上传 Actions 产物，不创建版本发布。
- 普通 CI 使用只读仓库权限；只有创建 Release 的独立任务获得 `contents: write`。无需另外配置个人访问令牌。
- 当前只验证 Windows；不将未验证的 macOS/Linux 安装包作为发布产物。

发布示例（版本号必须与标签一致）：

```powershell
npm version 0.1.1 --no-git-tag-version
# 提交 package.json、package-lock.json 和本次版本修改
# 确认提交已经推送至 main 后，再创建并推送对应标签：
git tag v0.1.1
git push origin v0.1.1
```

产物包括 `desktop-note-<版本>-x64-setup.exe`、`desktop-note-<版本>-x64-portable.exe` 和 `SHA256SUMS.txt`。安装包不包含 `tasks/`、历史图标设计稿、测试数据或本地笔记数据库。便携版的 task 默认位于便携 exe 旁的 `tasks/`，可将两者一起打包；加密每日笔记数据库仍位于系统用户数据目录。

## 开发协助与致谢

本项目在作者主导下，借助 **OpenAI Codex** 协作开发。Codex 协助进行了技术方案梳理、界面与功能实现、问题修复、测试编写、README 文档以及 CI/CD 配置；图标探索和编辑使用了 OpenAI 图像生成工具。

项目需求、设计取舍和最终采纳由作者决定。AI 协助生成的代码与资源仍需开发者审查、测试和维护；此说明不代表 OpenAI 对本项目提供官方背书。
