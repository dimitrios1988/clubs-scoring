# Build resources

electron-builder reads packaging assets from this folder.

## Application icon

Place a single square PNG here named **`icon.png`**:

- **Size:** 1024×1024 px (minimum 512×512), square.
- **Format:** PNG with transparency.

electron-builder automatically generates the platform-specific icons from it
during `npm run package`:

- Windows: embeds it into the `.exe` and installer (`.ico`).
- macOS: generates the `.icns`.
- Linux: uses the PNG directly.

No further configuration is needed — the paths are already set in
`package.json` (`build.win/mac/linux.icon`) and the dev window icon is set in
`electron/main.ts`.
