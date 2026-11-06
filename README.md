# 每日记事 · Desktop Note

本地优先的桌面 Markdown 记事本，基于 **Electron + React + TypeScript**，当前主要支持 Windows x64。

## 功能

- 每日笔记：自动保存、日期归档、日历标记、搜索、书签，以及生活 / 学习 / 工作分类。
- Markdown：编辑、双栏预览、表格、待办、常用格式工具、KaTeX 数学公式和 Mermaid 流程图。
- 本地文档：打开 Markdown 文件，只读预览。
- Task：独立任务文件夹，支持粘贴图片、拖入文件和按类型归档材料。
- 桌面体验：菜单收起、置顶、透明度、便签模式、便签靠边吸附与滑动收起。
- 右键日期卡片可删除笔记，确认后执行，暂不支持撤销。

## 安装与启动

需要 Node.js 24、Git，以及用于数据库原生模块编译的 Python 3、Visual Studio Build Tools（C++ 桌面工具和 Windows SDK）。无需 Conda 环境或数据库服务器。

在仓库根目录运行：

```powershell
npm.cmd ci
npm.cmd run dev
```

Windows 使用 `npm.cmd` 可避开 PowerShell 的脚本执行策略限制，其他系统使用 `npm`。安装时会下载 Electron 并重建数据库模块，需要网络连接。

遇到原生模块版本不匹配时执行 `npm.cmd run rebuild`。有多个 Python 时，可先设置 `$env:PYTHON` 为实际的 Python 可执行文件路径。

## 使用

- 选择日期编辑笔记，停止输入后自动保存；顶部可切换编辑和预览模式。
- 左侧按分类或书签筛选；日历中有笔记的日期显示圆点。
- 左键打开笔记，右键显示操作菜单。
- “打开 Markdown”或 `Ctrl+O` 打开文档；公式使用 `$…$` 或 `$$…$$`。
- 流程图使用标记为 `mermaid` 的代码块，例如 `flowchart TD; A[开始] --> B[结束]`；也支持 Mermaid 时序图等图表。
- 图表默认缩放为 70%，可用滑块调整；双栏模式下编辑区和预览区按内容双向同步滚动。
- 便签模式下开启“靠边收起”，接近屏幕边缘自动吸附，鼠标移开后滑动收起，靠近窄边展开。
- 最小化和关闭窗口均收进系统托盘，双击托盘图标恢复。真正退出请选择托盘“退出”或“文件 → 退出程序”。

### Task 资料

点击“新建 task”输入名称，默认创建在仓库下：

```text
tasks/任务名称/
├─ task.md
├─ img/
├─ docs/
├─ audio/
├─ video/
└─ files/
```

粘贴截图、粘贴剪贴板提供的文件、拖入或“添加材料”，会复制附件到对应目录并插入相对路径。图片可预览，其他附件可点击定位。整体打包任务目录后，解压并使用“打开 task”继续编辑。

单个附件最大 50 MB，图片预览最大 10 MB，Markdown 正文最大 5 MB。Task 使用普通文件保存，**不加密**；外部程序修改 `task.md` 后会阻止覆盖，避免丢失修改。

## 数据与限制

每日笔记使用加密 SQLite，密钥由系统账号保护。Windows 数据通常位于 `%APPDATA%\desktop-note\`，与仓库及 `tasks/` 分开。不要删除 `database.key`；复制数据文件到其他电脑不保证能解密。

目前一天一篇笔记。每日笔记暂不支持附件导入；飞书同步、密码备份恢复、回收站和自动更新尚未实现。窗口设置暂不跨启动保存，macOS/Linux 尚未完成发布验证。

## 开发与发布

核心组件：CodeMirror 编辑器、react-markdown / remark-gfm 渲染、KaTeX 公式、better-sqlite3-multiple-ciphers 数据库。

| 目录 | 内容 |
| --- | --- |
| `src/main/` | 数据库、文件、窗口、菜单和托盘 |
| `src/preload/`、`src/shared/` | IPC 接口与共享类型 |
| `src/renderer/` | React 界面与编辑器 |
| `scripts/` | 测试与图标生成 |
| `.github/workflows/` | CI 和版本发布 |

```powershell
npm.cmd run typecheck    # 类型检查
npm.cmd test             # 构建及集成测试，需要图形桌面
npm.cmd run package:win  # Windows 安装包和便携版，输出到 dist/
```

GitHub Actions 在推送 `main` 和 PR 时执行测试；推送与 `package.json` 版本一致的 `v*` 标签时，生成 Windows x64 安装版、便携版和 SHA256 校验文件，并创建 Release 草稿。手动运行发布流程只上传构建产物。

安装包不包含个人 Task 资料。便携版 Task 默认保存在 exe 旁的 `tasks/`。当前安装包未签名，仓库尚未声明开源许可证。

## 致谢

本项目由作者主导，借助 **OpenAI Codex** 协助完成方案设计、代码实现、测试、文档和 CI/CD；图标设计使用 OpenAI 图像生成工具。最终设计取舍及代码维护由作者负责。
