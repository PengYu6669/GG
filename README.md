# FocusPet / LianJie

> Last updated: 2026-06-20

FocusPet is a desktop focus companion built with Electron, React, TypeScript, Zustand, and Canvas spritesheet animation.

The current product direction is a low-pressure attention pullback pet for ADHD-friendly work:

- help the user start with 2/5 minute micro-starts
- keep the current task visible enough to return to
- monitor app/site context during focus
- nudge with pet bubbles instead of harsh system popups
- make task breakdown and recovery prompts small and low-friction

## Current App

Main project:

```text
focuspet-desktop/
```

Run in development:

```bash
cd focuspet-desktop
npm run dev
```

Build:

```bash
cd focuspet-desktop
npm run build
```

Package:

```bash
cd focuspet-desktop
npm run dist:win
npm run dist:mac
```

## Documentation Map

- `FocusPet_产品需求文档.md`  
  Product requirements, implemented features, current gaps, and product principles.

- `FocusPet_反思与改进方案.md`  
  Product reflection, risk assessment, and next-stage strategy.

- `FocusPet_Electron_桌面打包指南.md`  
  Electron architecture, window behavior, IPC, persistence, build, and packaging notes.

- `focuspet-desktop/docs/product-next-todo.md`  
  Implementation-oriented product TODO list.

- `focuspet-desktop/docs/app-monitor-todo.md`  
  App/browser monitoring behavior, limitations, and next work.

The `hatch-pet-extracted/` folder contains an extracted pet-generation skill reference. It is useful for future pet asset production, but it is not the main FocusPet app documentation.

## Current Implementation Snapshot

Implemented:

- draggable transparent Electron pet window
- smaller collapsed footprint and side-aware panel opening
- right-click/double-click/tray panel wakeup
- Canvas spritesheet pet renderer
- low-frequency idle variation
- task list with scheduled/unscheduled/done views
- bulk and clipboard task import
- local-template task breakdown button
- adjustable focus, short break, and long break durations
- 2/5 minute micro-starts
- low-distraction pet bubbles
- foreground app monitoring on Windows/macOS
- best-effort browser URL/domain detection
- allow/block rules for apps, titles, and domains
- basic daily/weekly focus rollups

Not yet done:

- LLM-backed task breakdown
- task-to-app/domain context matching
- reliable browser URL capture across all browsers and permissions
- VSCode/Cursor workspace and terminal task integration
- tray reset-position action
- hover affordance for opening the panel
- modal-free pet bubble check-ins
- full release metadata, icon, signing, notarization, and auto-update

## Product Boundaries

Deferred for now by product decision:

- pet collection
- dress-up system
- asset marketplace
- complex cultivation or achievement shop

The product should stay focused on attention recovery, task initiation, and context-aware pullback before investing in cosmetic progression.
