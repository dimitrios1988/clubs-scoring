import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  Menu,
  type MenuItemConstructorOptions,
} from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

const isDev = !app.isPackaged && process.env['NODE_ENV'] !== 'production';
const DEV_SERVER_URL = 'http://localhost:4200';

let mainWindow: BrowserWindow | null = null;

/** The parameters stored for a single event (Name, Performance, Multiplied By). */
interface EventParameter {
  name: string;
  performance: string;
  multipliedBy: number | null;
}

/** Path to the JSON file that stores per-event parameters. */
function eventParametersFile(): string {
  return path.join(app.getPath('userData'), 'event-parameters.json');
}

/**
 * Registers the IPC channels used by the Event Parameters screen. Values are
 * persisted as a { "UKAEventCode|Gender": EventParameter } map.
 */
function registerIpcHandlers(): void {
  ipcMain.handle('event-params:load', async (): Promise<Record<string, EventParameter>> => {
    try {
      const raw = await fs.readFile(eventParametersFile(), 'utf-8');
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      // File missing or unreadable on first run — start with an empty map.
      return {};
    }
  });

  ipcMain.handle(
    'event-params:save',
    async (_event, params: Record<string, EventParameter>): Promise<void> => {
      await fs.writeFile(eventParametersFile(), JSON.stringify(params, null, 2), 'utf-8');
    },
  );

  // Prompt the user with a native "Save As" dialog and write the given text.
  // Resolves true when a file was written, false when the dialog was cancelled.
  ipcMain.handle(
    'file:save-text',
    async (_event, defaultName: string, content: string): Promise<boolean> => {
      const options = {
        title: 'Save graded results',
        defaultPath: defaultName,
        filters: [
          { name: 'Text files', extensions: ['txt'] },
          { name: 'All files', extensions: ['*'] },
        ],
      };
      const result = mainWindow
        ? await dialog.showSaveDialog(mainWindow, options)
        : await dialog.showSaveDialog(options);
      if (result.canceled || !result.filePath) return false;
      await fs.writeFile(result.filePath, content, 'utf-8');
      return true;
    },
  );
}

/**
 * Builds the native application menu. Mostly the standard roles (localized to
 * Greek) plus a Βοήθεια → Πληροφορίες item that asks the renderer to open the
 * in-app About dialog via the 'menu:about' channel.
 */
function buildApplicationMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'Αρχείο',
      submenu: [{ role: 'quit', label: 'Έξοδος' }],
    },
    /* {
      label: 'Επεξεργασία',
      submenu: [
        { role: 'undo', label: 'Αναίρεση' },
        { role: 'redo', label: 'Επανάληψη' },
        { type: 'separator' },
        { role: 'cut', label: 'Αποκοπή' },
        { role: 'copy', label: 'Αντιγραφή' },
        { role: 'paste', label: 'Επικόλληση' },
        { role: 'selectAll', label: 'Επιλογή όλων' },
      ],
    },
    {
      label: 'Προβολή',
      submenu: [
        { role: 'reload', label: 'Επαναφόρτωση' },
        { role: 'forceReload', label: 'Αναγκαστική επαναφόρτωση' },
        { role: 'toggleDevTools', label: 'Εργαλεία προγραμματιστή' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Πραγματικό μέγεθος' },
        { role: 'zoomIn', label: 'Μεγέθυνση' },
        { role: 'zoomOut', label: 'Σμίκρυνση' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Πλήρης οθόνη' },
      ],
    }, */
    {
      label: 'Βοήθεια',
      submenu: [
        {
          label: 'Πληροφορίες',
          click: () => mainWindow?.webContents.send('menu:about'),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow(): void {
  // The packaged Windows executable already embeds the icon, but the dev
  // window (and Linux) need it set explicitly. The source PNG lives in the
  // electron-builder resources folder at <project>/build/icon.png.
  const windowIcon = isDev ? path.join(app.getAppPath(), 'build', 'icon.png') : undefined;

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 720,
    minHeight: 520,
    backgroundColor: '#fdfcff',
    ...(windowIcon ? { icon: windowIcon } : {}),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  // Open external links (e.g. the About dialog's website/email) in the user's
  // default browser/mail client instead of spawning an in-app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?:|mailto:)/.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // __dirname is <app>/dist-electron; the Angular browser bundle sits at
    // <app>/dist/clubs-scoring/browser.
    mainWindow.loadFile(
      path.join(__dirname, '..', 'dist', 'clubs-scoring', 'browser', 'index.html'),
    );
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  registerIpcHandlers();
  buildApplicationMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
