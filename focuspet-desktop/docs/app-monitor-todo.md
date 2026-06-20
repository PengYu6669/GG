# App Monitor TODO

> Updated: 2026-06-20

## Implemented

- Detect foreground application every 3 seconds in the main process.
- Windows uses PowerShell plus `user32.dll`.
- macOS uses `osascript` and System Events.
- Renderer receives normalized `foreground-app` events.
- Built-in allowlist for coding, terminal, AI assistant, and document workflows.
- Built-in blocklist for short video, games, and high-risk entertainment apps/sites.
- Editable allowlist/blocklist UI.
- Editable title keyword rules.
- Editable domain rules.
- Persist app rules and usage under Electron `userData`.
- Pause app monitor events while FocusPet itself is foreground.
- Window-title keyword classification.
- Browser URL/domain classification where platform permissions allow it:
  - Windows Chrome/Edge via UIAutomation best effort.
  - macOS Chrome/Edge/Safari via AppleScript best effort.
- Lightweight app context inference:
  - browser
  - editor
  - ai
  - terminal
  - dev-server
  - generic
- Current app, title, domain, context, and usage displayed in stats panel.
- Focus scoring telemetry:
  - allow seconds
  - neutral seconds
  - blocked seconds
  - drift seconds
  - switch counts
  - pullbacks
  - recoveries
  - longest drift span
- Basic today/7-day rollups.
- System idle-time signal from Electron `powerMonitor`.

## Current Behavior

During focus:

- `allow` app/domain -> pet stays focused and pullback level resets.
- `neutral` context -> drift accumulates; pet can ask whether this is still task-related.
- `block` context -> distraction is recorded; pet uses escalating pullback bubbles.
- long keyboard/mouse idle during focus -> pet uses a low-pressure bubble, especially when waiting on AI/terminal/dev-server contexts.

Outside focus:

- Blacklisted context can trigger a soft pet nudge after sustained usage.
- Meal/task reminders still run through pet bubbles.

Classification order in the renderer:

1. domain block / allow rules
2. built-in AI title/domain allowance
3. title keyword block / allow rules
4. app block / allow rules
5. neutral fallback

This means a browser process is not treated as good or bad by itself. The domain/title decides whenever URL or title data is available.

Idle signal design:

- Idle is not automatically treated as failure.
- Waiting for AI, terminal tasks, or local builds is allowed, but after sustained no-input FocusPet asks the user to glance back.
- The user can choose “continue waiting” to create a short grace period.
- Choosing “I drifted” records a distraction and triggers the normal pet pullback path.

## Known Limitations

- Browser URL capture is not guaranteed.
  - Windows UIAutomation depends on browser UI structure.
  - macOS may require Automation permissions.
- Browser extensions would be more reliable for URL capture.
- App context inference is heuristic, not true task-state integration.
- VSCode workspace/build status is not yet read directly.
- Claude/Doubao/Kimi task state is inferred from app/title/domain only.
- Local dev server status is inferred from title/domain/process hints only.

## Next

1. Add task-to-context matching:
   - expected apps
   - expected domains
   - expected keywords
2. Add one-click “allow/block current app/domain”.
3. Improve browser URL reliability.
4. Add explicit URL permission/status display:
   - Windows UIAutomation available or failed
   - macOS Automation permission hint
5. Add VSCode/Cursor workspace detection.
6. Add terminal/dev-server process activity detection.
7. Add more detailed daily/weekly rollups:
   - most distracting domains
   - best focus windows
   - recovery-after-prompt rate
