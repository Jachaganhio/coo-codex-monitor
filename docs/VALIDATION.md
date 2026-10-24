# 验证记录（2026-10-24，Windows 11）

不能把本页的自动化测试等同于 Desktop 全链路集成通过。

## 已实际执行

- 新项目 `node --test tests/*.test.ts`：14/14 通过；TypeScript strict 检查通过。
- 测试覆盖真实临时 JSONL 文件、并行会话、历史基线、偏移持久化、损坏/半行/大行恢复、截断与重命名、去重、不以静默完成、工具失败不误报、真实 HTTP 认证、真实 Hook relay 子进程、消费者重启与崩溃认领行为。
- Coopanion 根测试：48 个测试文件通过，374 项通过、1 项上游跳过。
- 桌宠 World 测试：20 个文件、188 项通过，包括原有 dialog 不向 Bot 投递事件的测试。
- 上游 `typecheck`、`typecheck:web`、`typecheck:worlds` 通过；`scripts/stage.ts` 构建通过。
- 用 Cortico 真正的 `parseExtensionManifest()` 与 `dryMountWorld()` 检查新扩展：0 failures、0 warnings。上游整套 extension-check CLI 会预加载 Coopanion 未安装的 Minecraft 依赖，因此改用相同底层检查器，没有为此修改 Cortico。
- `npm pack` 已产生 `cortico-world-codex-monitor-0.1.0.tgz`，只包含扩展源码、manifest、自描述、README 和许可证，不含 `.local` 数据。
- 只读本机真实 Desktop 日志：识别 originator/source/thread_source；观察 `task_started`、`task_complete`；历史会话也有带 turn_id 的 `turn_aborted`，可识别中断。后台 guardian 会话排除。
- 正在进行的这条 Desktop 会话被 Bridge 实际识别为 running，时间戳随真实活动推进。没有为验证而追加伪造 Codex 日志。
- Bridge 实际停止/重启，epoch、偏移与状态保留，World 自动重连、消费游标追上 Bridge；历史通知数量为 0。
- 无 API Key 的隔离 Coopanion 进程启动成功，日志明确 `World 已启动: codex-monitor`、`桌宠页面已连接`，消费者 cursor 实际持续更新。隔离数据在 `.local/coopanion-data`，没有修改已安装应用数据。
- 通过真实 `DesktopPetWorld.dialog()` 和真实 Web 页面观察到测试气泡：“本地通知连接测试：这是一条界面测试消息，不代表 Codex 任务完成。” Bot events=0。这个探针使用测试 Host，不运行模型，不证明真实 Desktop 完成通知已端到端通过。

初次上游测试因 Electron 二进制未下载和 Windows 受限身份导致失败；补齐锁定运行时并在正常用户环境重跑后上述检查通过。

## 验收矩阵

| 用户要求场景 | 自动化/局部实测 | Desktop GUI 全链路 |
| --- | --- | --- |
| 新建 Desktop 任务 | 实机存在 task_started；新文件发现单测通过 | 待人工新建并验收 |
| 执行期间活动 | 当前真实 Desktop 会话持续采集通过 | 采集已实测；桌面活动气泡未复用 |
| 成功完成 | 实机历史 task_complete + 解析测试通过 | 新任务完成→原生桌面气泡待人工验证 |
| 异常终止 | 历史明确中断；静默不判完成测试通过 | 硬崩溃、GUI Interrupt 待人工验证 |
| 两个并行任务 | 双 session/turn 自动化通过 | 两个 GUI 任务并发待人工验证 |
| 重启 Bridge | 本机真实进程重启/消费者重连通过 | 已实测此范围 |
| 重启 Coopanion | 消费者持久化/重启测试通过 | 原生 GUI 重启待人工验证 |
| 重启 Codex Desktop | 文件替换与重新发现测试通过 | 待人工验证，未中断当前工作 |
| 历史不会重复通知 | 真正历史导入及 Bridge 重启后 0 历史提醒 | 已实测采集与消费者范围 |
| 无 API Key | Bridge、World 挂载、真实测试气泡通过 | 测试气泡通过；完整新完成通知待人工验证 |
| 权限等待 | Hook relay 与协议测试通过 | 插件安装/信任与 GUI PermissionRequest 待人工验证 |
| ChatGPT 订阅聊天 | 源码与 README 支持已确认 | 未替用户登录，待用户选择 |

原生透明桌宠窗口没有被当前 Windows 窗口枚举工具列出，不能据此声称已目视验收桌面位置/点击穿透；页面连接日志及浏览器内真实渲染已验证。任务列表前端已实现并注册，实际高级模式页面的视觉验收待人工完成。
