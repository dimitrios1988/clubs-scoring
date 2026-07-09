import { Injectable } from '@angular/core';
import Papa from 'papaparse';
import { Result } from './result.interface';

/**
 * Reads a CSV file and converts it to JSON in memory using PapaParse.
 * Parsing happens entirely in the renderer — no file-system access needed.
 */
@Injectable({ providedIn: 'root' })
export class CsvService {
  async parse(file: File): Promise<Result[]> {
    const text = await file.text();

    return new Promise<Result[]>((resolve, reject) => {
      Papa.parse<Result>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim(),
        complete: (result) => {
          if (result.errors.length) {
            reject(new Error(result.errors[0].message));
            return;
          }
          resolve(result.data);
        },
        error: (err: Error) => reject(err),
      });
    });
  }
}
