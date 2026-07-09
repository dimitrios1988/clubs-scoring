import { Injectable } from '@angular/core';
import { EventParameter } from './electron-api';

/** localStorage key used as a fallback when the Electron bridge is absent. */
const STORAGE_KEY = 'eventParameters';

/** A validated map of event key -> parameters, discarding malformed entries. */
function normalize(parsed: unknown): Record<string, EventParameter> {
  if (!parsed || typeof parsed !== 'object') return {};
  const result: Record<string, EventParameter> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (value && typeof value === 'object') {
      const entry = value as Partial<EventParameter>;
      result[key] = {
        name: typeof entry.name === 'string' ? entry.name : '',
        performance: typeof entry.performance === 'string' ? entry.performance : '',
        multipliedBy: typeof entry.multipliedBy === 'number' ? entry.multipliedBy : null,
      };
    }
  }
  return result;
}

/**
 * Loads and saves per-event parameters (Name, Performance, Multiplied By), keyed by
 * `UKAEventCode|Gender`. Prefers the Electron IPC bridge (writes a JSON file in
 * the app's userData folder); falls back to localStorage so the screen still
 * works in a plain browser (`ng serve`).
 */
@Injectable({ providedIn: 'root' })
export class EventParametersService {
  async load(): Promise<Record<string, EventParameter>> {
    const api = window.electronAPI?.eventParameters;
    if (api) {
      return normalize(await api.load());
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    try {
      return normalize(JSON.parse(raw));
    } catch {
      return {};
    }
  }

  async save(params: Record<string, EventParameter>): Promise<void> {
    const api = window.electronAPI?.eventParameters;
    if (api) {
      await api.save(params);
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(params));
  }
}
