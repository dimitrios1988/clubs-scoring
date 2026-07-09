import { Injectable } from '@angular/core';

/**
 * Saves text content to disk. Prefers the Electron bridge (a native "Save As"
 * dialog lets the user choose the folder and file name); falls back to a
 * browser download so the feature still works under `ng serve`.
 */
@Injectable({ providedIn: 'root' })
export class FileSaveService {
  /**
   * Prompt the user for a location and write `content` as a text file.
   * Resolves to `true` when saved, `false` when the user cancels.
   */
  async saveText(defaultName: string, content: string): Promise<boolean> {
    const api = window.electronAPI?.files;
    if (api) {
      return api.saveText(defaultName, content);
    }

    // Browser fallback: trigger a download (the browser decides the location).
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = defaultName;
    anchor.click();
    URL.revokeObjectURL(url);
    return true;
  }
}
