# Windows 安装与验收

## 本机现状

源码：`C:\code\coo-codex-monitor`。上游检出：`C:\code\Coopanion`，子模块已初始化。已有 Node 的备用 npm 路径：`C:\code\node-v26.1.0-win-x64\npm.cmd`。标准命令以 PATH 中 npm/node 为准。

## 1. 启动 Bridge

```powershell
cd C:\code\coo-codex-monitor
npm install
npm test
npm run typecheck
# 可选：显示项目目录末级名称，不保存完整目录
# $env:COO_MONITOR_PROJECT_NAMES = '1'
# 可选：自定义 Codex 数据目录
# $env:CODEX_HOME = 'D:\CodexData'
npm start
```

`.local/connection.json` 是 World 的连接配置，包含 token 文件位置；不把 token 打到终端。不关闭此终端；停止用 Ctrl+C。重启保留 `.local`，不要删去去重状态。

独立查看：`node scripts/status.ts`。诊断：`npm run diagnose`，只输出结构计数，不输出原始记录内容。

## 2. 官方 Hooks（补充权限等待与中断）

Bridge 至少成功启动一次后运行 `npm run prepare:hooks`。生成 `.local/codex-plugin`，命令使用当前 Node 的绝对路径。在 Codex Desktop 插件管理中手动添加此本地插件，查看 Hook 定义并信任，然后新建测试任务。若当前版本 UI 不提供导入入口，按 [官方插件说明](https://developers.openai.com/plugins/build/plugins) 的当前手工安装流程操作，不盲改内部配置。

该步骤需要人在 Desktop 完成信任审查；生成器未自动写入 `config.toml`、未覆盖用户其他 hooks、未读取 auth.json。Node 路径或 Bridge 端口改变后重新生成并重新审查。移除本地插件即可禁用 Hooks，日志监控仍能运行。不要把 `.local/codex-plugin` 分享给他人，它包含你本机连接位置。

## 3A. 独立安装 World（无需修改 Coopanion）

启动 Coopanion 前设置：

```powershell
$env:COO_MONITOR_CONNECTION = 'C:\code\coo-codex-monitor\.local\connection.json'
```

在 Coopanion 高级模式 → 扩展 → World → 本机目录，选择：
`C:\code\coo-codex-monitor\packages\coopanion-world`，重启并启用 `codex-monitor`。

也可 `npm run pack:world` 得到 npm 安装包；尚未发布到公共 npm，不能声称可以从市场搜索下载。

若使用快捷方式启动无法继承上述变量，可在自己的部署 `config.json` 的 worlds 中**合并**（不要覆盖原文件）：

```json
{"codex-monitor":{"enabled":true,"connectionFile":"C:\\code\\coo-codex-monitor\\.local\\connection.json","mode":"status","notifyStarted":false}}
```

默认展示高级模式任务面板，不显示主动气泡。`mode=model` 可让 Coo 通过订阅模型读事件并说话，但会消耗模型额度且呈现由模型决定。

## 3B. 零模型气泡（可选源码装配）

本机 `C:\code\Coopanion` 已应用小型装配改动；没有修改已安装应用。补丁仅由宿主注入 `ready/show`，实际通知队列仍在独立 World 内。补丁版本绑定已审查的上游提交，升级后需检查接口。

对一个新的干净 checkout：

```powershell
cd C:\code\coo-codex-monitor
node scripts/prepare-coopanion-patch.ts C:\code\Coopanion
git -C C:\code\Coopanion diff
# 先检查生成的 companion.ts 与 original 副本，再复制到源码 checkout
Copy-Item .local\coopanion-patch\companion.ts C:\code\Coopanion\core\companion.ts
```

生成器不会覆盖已打补丁的源码，会拒绝不匹配的装配位置。恢复时，确认没有其他修改后复制 `.local/coopanion-patch/companion.original.ts` 回去即可；不需要修改 Cortico 子模块。

也交付了 `patches/coopanion-0.2.8.patch`（基于上游 AGPL 源码的装配补丁，保留上游许可）。在匹配版本的干净源码目录执行 `git apply --check <补丁路径>` 后 `git apply <补丁路径>`；回滚为 `git apply -R <补丁路径>`。本机已验证反向应用检查通过。直接补丁假定两个项目按本文相邻放置；其他目录布局使用生成器。

构建和启动隔离测试数据：

```powershell
cd C:\code\Coopanion
npx --yes pnpm@11.28.6 install --frozen-lockfile
node node_modules/electron/install.js
npx pnpm run build:cortico
$env:CORTICO_COMPANION_DATA = 'C:\code\coo-codex-monitor\.local\coopanion-data'
$env:COO_MONITOR_CONNECTION = 'C:\code\coo-codex-monitor\.local\connection.json'
npx pnpm start
```

首次正常引导可关闭，无需填写 Key。关闭测试副本后，在上述隔离 data 的 `home/companion/config.json` 中合并启用 `worlds.codex-monitor.enabled=true`，并设 `companion.telemetry=false`。重新启动。此模式不要再从扩展页装相同 ID 的包，避免与内置装配冲突。

Coopanion 自带没有模型连接的引导/提醒仍可能出现；这是应用本身的行为。本项目没有伪造登录状态，也没有把 API Key 请求改成假成功。

## 4. Desktop 手工验收（不要向 Bridge 注入假完成事件）

1. Bridge + World 启动后，第一次消费建立基线。打开现有 Desktop，新建简单任务，例如让它列出测试空目录；确认 status 从 started 到 running。
2. 正常完成后，等待真实 `task_complete`；看到 completed，补丁模式应出现一次气泡。完成表示该轮结束，不表示代码质量检查通过。
3. 让任务执行较长操作，在 Desktop 点停止；已信任的 Interrupt 应对应 cancelled。硬杀进程没有明确中断证据时，不应该宣称 cancelled/completed。
4. 用需要审批的无害命令触发 Desktop 权限框；PermissionRequest 应是 needs_attention；若本版本未发送 Hook，记录“未覆盖”，不要通过日志静默推断。
5. 同时开两个不同任务，核对 sessionId/taskId 不互相覆盖，完成提醒依次显示。
6. Ctrl+C 停 Bridge，再启动同一数据目录；旧完成不应重复提醒，尚无新活动的旧活动状态显示 unknown。
7. 重启测试 Coopanion，同一 consumer cursor 保留，已提醒的完成不得再出现。
8. 正常重启 Codex Desktop 后创建新任务，检查新日志发现；重启期间旧任务状态不自动变为成功。
9. 回看旧会话、复制历史日志到另一个测试目录、重启 Bridge，历史记录不应触发新提醒。
10. 不配置任何模型 API Key、不登录测试 Coopanion 的模型，Bridge 和状态面板应继续工作；补丁气泡无需模型。

测试“通知路径是否接通”时可以使用明确标注的 UI 测试消息，不能将其写为 Codex completed 或当作真实任务完成验收。只将实际执行过的项目勾选通过，参照 VALIDATION.md。
