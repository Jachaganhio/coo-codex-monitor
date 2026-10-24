# Codex Task Monitor World

Cortico World API 6 extension. Select this directory in Coopanion's advanced extension installer, restart, and enable `codex-monitor`.

Start the companion Task Bridge first, and set `COO_MONITOR_CONNECTION` to its `connection.json` before launching Coopanion. Alternatively set `worlds.codex-monitor.connectionFile` in deployment configuration.

Default `mode=status` displays an advanced task panel and offers `codex_tasks`; it does not invoke a model. Optional `mode=model` sends generic transition events to Coo, using its configured subscription/model. `notifyStarted=false` suppresses start reminders.

Model-free native pet bubbles require the host to call `createMonitorDefinition(BubbleSink)` during assembly. No generic Cortico World interface grants direct access to another World's UI. See the parent project's `docs/WINDOWS.md` for the small source integration and tested upstream revision.

No raw prompt or tool input is displayed. Running means last observed activity; completion requires explicit upstream evidence. Offline state is shown as cached. First connection skips history; subsequent reconnects resume from a persistent consumer cursor.
