/**
 * Type definitions for the `window.electronAPI` bridge exposed by
 * `electron/preload.ts`. The bridge is only present when the app runs inside
 * Electron; in a plain browser (e.g. `ng serve`) `window.electronAPI` is
 * `undefined`, so consumers must treat it as optional.
 */

/** The parameters stored for a single event. */
export interface EventParameter {
  name: string;
  performance: string;
  /** Numeric multiplier; null when the field is left blank. */
  multipliedBy: number | null;
  /** Whether the event participates in import/scoring. */
  active: boolean;
}

/** Persistence channels for the Event Parameters screen. */
export interface EventParametersApi {
  /** Load the saved { "UKAEventCode|Gender": EventParameter } map. */
  load(): Promise<Record<string, EventParameter>>;
  /** Persist the full { "UKAEventCode|Gender": EventParameter } map. */
  save(params: Record<string, EventParameter>): Promise<void>;
}

/** Generic file-saving channels backed by native OS dialogs. */
export interface FilesApi {
  /**
   * Prompt the user with a native "Save As" dialog and write `content` as a
   * UTF-8 text file. Resolves to `true` when saved, `false` if cancelled.
   */
  saveText(defaultName: string, content: string): Promise<boolean>;
}

export interface ElectronApi {
  platform: string;
  versions: {
    electron: string;
    chrome: string;
    node: string;
  };
  eventParameters: EventParametersApi;
  files: FilesApi;
  /**
   * Subscribe to the native menu's "About" command. Returns an unsubscribe
   * function; call it to remove the listener.
   */
  onShowAbout(listener: () => void): () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronApi;
  }
}
