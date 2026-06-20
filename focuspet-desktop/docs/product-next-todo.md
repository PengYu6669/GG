# FocusPet Product Next TODO

> Updated: 2026-06-20

## Current Product Direction

FocusPet is a low-pressure attention companion. It should help users return to work without shame, especially when task initiation and context switching are difficult.

The core loop:

1. Know the current task.
2. Understand whether the current app/site still fits that task.
3. Use the pet to gently pull attention back before drift becomes a long distraction.
4. Make the next action small enough to start.
5. Record enough context to help the user notice patterns.

## Implemented

### Pet And Window

- Draggable pet window.
- Position persistence.
- Smaller collapsed footprint.
- Panel opens toward the better side of the screen.
- Right-click/double-click opens panel.
- Tray menu.
- Visible `...` hover affordance was removed after visual review; panel wakeup stays on direct pet gestures and tray.
- Low-frequency idle random actions.
- Focus state stays visually calm.

### Pet Animation Mapping

The spritesheet follows the 8x9 hatch-pet atlas:

- row 0 `idle` -> idle / sleep subset
- row 1 `running-right` -> walkRight
- row 2 `running-left` -> walkLeft
- row 3 `waving` -> available but not currently used by StateMachine
- row 4 `jumping` -> celebrate
- row 5 `failed` -> sad/distraction
- row 6 `waiting` -> angry/repeated distraction
- row 7 `running` -> focus/working
- row 8 `review` -> alert/checking

The app state names are product semantics; animation names now match the atlas row names.

### Focus And ADHD Support

- Pomodoro focus mode.
- Background timer continues across panel tabs and collapsed panel.
- Short/long breaks.
- Micro-start: try 2/5 minutes.
- Micro-start completion asks whether to continue.
- Low-distraction pet bubbles without inline quick buttons.
- Low-distraction pet bubble styling.
- Escalating pullback protocol:
  - soft reminder
  - task anchor
  - 10-second landing action
  - suggest break
- Focus completion praise.
- Walk/water/continue prompts.
- Lunch/dinner reminders.

### Tasks

- Timed and untimed tasks.
- Reminder and overdue pet bubbles.
- Bulk import.
- Paste import.
- Scheduled/unscheduled/all/done views.
- Task-side `✨` breakdown button.
- Template-based task breakdown.

### App / URL Context

- Foreground app detection.
- URL/domain detection where possible.
- Domain allow/block rules.
- Title keyword allow/block rules.
- Focus profiles:
  - programming
  - writing
  - study
  - strict
- AI assistant domains/apps default to allowed:
  - Kimi / Moonshot
  - Claude
  - ChatGPT / OpenAI
  - Doubao
- System idle prompt for long no-input periods during focus, especially while waiting for AI/build/terminal work.
- Task runtime state card: matching / waiting / risk / unknown.
- Task context inference from task name.

### Telemetry

- Focus score.
- Drift seconds.
- Blocked seconds.
- Neutral/allowed seconds.
- Switch counts.
- Pullback count.
- Recovery count.
- Longest drift span.
- Recent focus history.
- Today/7-day rollup.

## High-Priority Next

## Current Implementation Batch

- [x] Add pet hover `...` affordance for opening the panel.
- [x] Add tray reset-position action.
- [x] Add diagnostics copy action/API for testing.
- [x] Add one-click allow/block for current app and domain.
- [x] Replace random check-in modal with pet bubble actions.
- [x] Run TypeScript/build verification.
- [x] Remove visible `...` affordance after visual review.
- [x] Add system idle monitoring for AI/build waiting scenarios.

### 1. Panel Wakeup And Recovery

Current panel wakeup works, but it is still too hidden for normal users.

Current:

- pet direct gestures open the panel without visible extra chrome
- tray item: reset pet position
- diagnostics item: copy userData path and current window/app state

### 2. Task Context Matching

Each task should optionally know its expected work context:

- apps
- domains
- keywords
- project/workspace

Then FocusPet can judge whether “Chrome” is useful or distracting based on the current task.

### 3. AI Breakdown With LLM

Current `✨` is a local template. Next:

- add an API/provider settings surface
- connect LLM API
- send task name, priority, current time, estimated pomos
- return 5-8 small actionable subtasks
- allow user to accept/reject inserted subtasks

### 4. Browser URL Reliability

Improve URL detection:

- better Windows UIAutomation selectors
- macOS permission guidance
- optional browser extension
- explicit current-domain display and “allow/block current domain” button

### 5. Useful Review

Stats should answer:

- What pulled me away today?
- What helped me recover?
- What time of day did I focus best?
- Which tasks were too large?

### 6. Pet-Only Check-Ins

Current random check-in still uses a modal component. Next:

- replace check-in modal with pet bubble
- keep pet-only prompts
- record whether the user returned, postponed, took a break, or was stuck

## Medium Priority

- CSV export.
- Weekly chart.
- Most distracting domains/apps.
- Best focus time ranges.
- Task plan vs actual comparison.
- Focus profile onboarding.
- One-click allow/block current app/domain.
- Quiet mode for idle animations.
- Wall-clock timer correction or main-process timer.
- Lightweight diagnostics export.

## Deferred

Per user preference, defer for now:

- pet collection
- pet asset marketplace
- dress-up system
- achievement shop
- complex cultivation system

## Product Principle

Do not make the user configure a productivity system before they can start working. The pet should make the next useful action obvious and small.
