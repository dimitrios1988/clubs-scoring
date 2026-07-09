import { contextBridge, ipcRenderer } from 'electron';

/**
 * Minimal, secure bridge between the Electron main process and the Angular
 * renderer. Exposes app info plus the Event Parameters persistence channels,
 * all without enabling nodeIntegration.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  eventParameters: {
    load: (): Promise<
      Record<string, { name: string; performance: string; multipliedBy: number | null }>
    > => ipcRenderer.invoke('event-params:load'),
    save: (
      params: Record<string, { name: string; performance: string; multipliedBy: number | null }>,
    ): Promise<void> => ipcRenderer.invoke('event-params:save', params),
  },
  files: {
    saveText: (defaultName: string, content: string): Promise<boolean> =>
      ipcRenderer.invoke('file:save-text', defaultName, content),
  },
  /**
   * Subscribe to the native menu's "Πληροφορίες" (About) command. Returns an
   * unsubscribe function that removes the listener.
   */
  onShowAbout: (listener: () => void): (() => void) => {
    const handler = (): void => listener();
    ipcRenderer.on('menu:about', handler);
    return () => ipcRenderer.removeListener('menu:about', handler);
  },
});
