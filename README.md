# Coopanion × Codex Desktop Monitor

Windows 本地任务监控 MVP。Node.js + TypeScript，无模型 SDK、无 API Key、无 DeepSeek Harness。源码调研日期：2026-10-24。

**重要发现：Coopanion 0.2.8 已支持 ChatGPT 订阅登录。** 只想养桌宠和聊天，可以先使用它内置的登录方式。这个项目额外解决「你仍在 Codex Desktop GUI 工作，桌宠感知任务状态」的问题。

## 已实现

- 只读 Codex `sessions/**/*.jsonl`；默认 `CODEX_HOME`，否则 `%USERPROFILE%\.codex`。
- Desktop 主任务过滤、独立 session/turn ID、增量字节游标、原子持久化、历史静默导入、轮换/截断检测、半行与损坏行恢复。
- 官方 Hooks 插件生成器：开始、工具活动、权限请求、中断；不改变 Codex 行为、不存 Prompt/命令。
- Bridge：`127.0.0.1:43129`，读写均需随机 bearer token，拒绝浏览器 Origin/Fetch Metadata，无 CORS、无命令执行接口。
- 独立 API 6 World：高级模式任务列表、数量、项目名（默认隐藏）、最后活动、离线提示，消费者游标与通知去重。
- 可选 Coopanion 装配补丁：通过真实 `DesktopPetWorld.dialog()` 串行显示气泡，不调用模型。
- 不假设静默代表完成；不把工具报错当作任务失败；不伪造进度。

## 启动

需要 Node.js >=22.18 和 npm（建议 Node 24 LTS）：

```powershell
cd C:\code\coo-codex-monitor
npm install
npm test
npm run typecheck
npm start
```

另开 PowerShell：

```powershell
node scripts/status.ts
npm run diagnose
npm run prepare:hooks
```

Bridge 不需要 API Key；首次启动只导入历史，不弹旧完成提醒。监听周期约 1 秒。配置和 token 在 `.local/`，不要分享该目录。

## 接入桌宠

| 方式 | 修改 Coopanion | 模型消耗 | 能力 |
| --- | --- | --- | --- |
| 独立 World 默认模式 | 无 | 无 | 高级模式状态列表；不主动显示气泡 |
| 独立 World `mode=model` | 无 | 使用 Coopanion 配置的订阅/模型 | 投递事件，由 Coo 决定提醒；不是确定性通知 |
| 可选装配补丁 | `core/companion.ts` 小改动 | 提醒无模型调用 | 原生 Coo 气泡、串行队列 |

这是当前上游接口的真实边界。独立 World 没有获得其他 World 对象或直接操作气泡的官方接口；不能承诺“零补丁 + 原生气泡 + 零模型调用”同时成立。

完整安装、可回滚补丁与手工验收：[Windows 指南](docs/WINDOWS.md)。协议、证据、限制：[架构与源码调研](docs/ARCHITECTURE.md)。实际验证记录：[验证结果](docs/VALIDATION.md)。

## 文件

- `packages/task-bridge/src/adapters/codex.ts`：只读增量采集。
- `packages/task-bridge/src/adapters/hooks.ts`：官方 Hook 的语义映射。
- `scripts/hook-relay.mjs`：无需编译的 Hooks 子进程，限时发送脱敏事件。
- `packages/task-bridge/src/state.ts`：任务与去重记录、游标持久化。
- `packages/task-bridge/src/server.ts`：认证 HTTP 状态、事件订阅接口。
- `packages/coopanion-world/src/index.ts`：独立 World 和可注入气泡接收器。
- `packages/coopanion-world/src/webui.js`：Cortico 高级模式任务列表。
- `scripts/prepare-coopanion-patch.ts`：生成可审查源码副本，不改安装程序。
- `tests/`：真实临时文件、HTTP、Hook 子进程、状态与恢复测试。

## 范围

当前 Windows MVP。`completed` 指 Codex 明确结束该轮，不保证代码正确或用户业务目标完成。异常退出无法可靠分类时保持最后观察值或重启后 `unknown`；`failed` 预留，当前不自动猜测。macOS 与 Claude 支持尚未实现。

独立监控代码 MIT。Coopanion 是 AGPL-3.0-or-later；分发修改后的 Coopanion 须保留其许可并遵守相应源码提供要求。此目录不包含角色素材或上游应用二进制。
# 2026-10-25：开始提醒与本地答复摘录

新配置默认 `notifyStarted: true`；已有配置需要将该项改为 true。每个任务仅提醒一次开始，运行中状态在任务列表更新，不反复弹窗。

完成提醒从同一条 `task_complete.last_agent_message` 提取首段及测试、待办相关行，标明“答复摘录”，不调用 DeepSeek 或其他模型。没有最终答复时明确显示暂无结论，不猜测成功。任务列表可展开查看最多 64000 字符的答复，超长内容请回到 Codex 查看。

此功能会将新的最终答复保存在本地 Bridge 状态中，并提供给本地 World；不再是严格的纯元数据采集。不会主动上传，不回填历史答复。常见凭据模式会被隐藏，但自动脱敏不能保证覆盖所有敏感内容。默认 status 模式直接显示气泡，不产生总结模型费用；显式启用 model 模式或让桌宠调用任务查询工具，可能将相关数据纳入模型上下文。
