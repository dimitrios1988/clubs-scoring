# Clubs Scoring

A desktop application built with **Angular 22**, **Angular Material** (Material 3), and
**Electron 43**. It lets you pick an option from a dropdown and then import a **CSV** file
(via drag-and-drop or a file picker), which is parsed and converted to **JSON in memory**.

## Features

- Modern Material 3 UI (Azure/Blue theme, Roboto typography, Material icons).
- A selection dropdown that **must be chosen before** the file area is enabled.
- A combined **drag-and-drop + click-to-browse** CSV upload zone.
- In-memory CSV → JSON conversion using [PapaParse](https://www.papaparse.com/)
  (header row becomes the JSON keys).
- Secure Electron setup: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`,
  with a `preload` bridge for future IPC.

## Project layout

```
src/app/
  app.ts / app.html / app.scss   Root component: toolbar, card, dropdown, drop zone
  core/csv.service.ts            CSV -> JSON (PapaParse)
  core/file-drop.directive.ts    HTML5 drag-and-drop target -> emits File
electron/
  main.ts                        BrowserWindow; dev (localhost:4200) vs prod (file://)
  preload.ts                     contextBridge stub (electronAPI)
  tsconfig.json                  Compiles electron TS -> dist-electron/
```

## Scripts

| Command           | What it does                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------- |
| `npm run dev`     | Compile Electron, start `ng serve`, wait for it, then open the Electron window (hot reload). |
| `npm start`       | Angular dev server only (browser), at `http://localhost:4200`.                               |
| `npm run build`   | Production Angular build **and** compile the Electron main/preload.                          |
| `npm run package` | Build, then package a distributable with electron-builder (`release/`).                      |
| `npm test`        | Run unit tests (Vitest).                                                                     |

### Develop

```bash
npm run dev
```

### Package a desktop build

```bash
npm run package
```

The build outputs are:

- Angular renderer → `dist/clubs-scoring/browser/`
- Electron main/preload → `dist-electron/`
- Installer/binary → `release/`

## Notes

- If launching Electron fails with `Cannot read properties of undefined (reading 'isPackaged')`,
  your terminal has `ELECTRON_RUN_AS_NODE=1` set (some editor integrated terminals do this).
  Clear it before running: `set ELECTRON_RUN_AS_NODE=` (cmd) /
  `Remove-Item Env:\ELECTRON_RUN_AS_NODE` (PowerShell).
