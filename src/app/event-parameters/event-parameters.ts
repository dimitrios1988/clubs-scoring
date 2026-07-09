import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';

import { eventConstants } from '../event.constants';
import { EventParametersService } from '../core/event-parameters.service';
import { EventParameter } from '../core/electron-api';

/** One event row shown in the table. */
interface EventRow {
  key: string;
  eventName: string;
  eventCode: string;
  eventGender: string;
  order: number;
  /** Raw regex string bound to the input's [pattern] validator. */
  validationRegex: string;
  /** Compiled regex, reused for the save-time guard. null if none supplied. */
  validationPattern: RegExp | null;
}

/** Builds the stable identity key for an event: UKAEventCode + Gender. */
function eventKey(eventCode: string, eventGender: string): string {
  return `${eventCode}|${eventGender}`;
}

@Component({
  selector: 'app-event-parameters',
  imports: [
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './event-parameters.html',
  styleUrl: './event-parameters.scss',
})
export class EventParameters {
  private readonly store = inject(EventParametersService);
  private readonly snackBar = inject(MatSnackBar);

  /** The events to display, derived from event.constants.ts. */
  protected readonly rows: EventRow[] = eventConstants
    .map((e) => ({
      key: eventKey(e.EventCode, e.EventGender),
      eventName: e.EventName,
      eventCode: e.EventCode,
      eventGender: e.EventGender,
      order: e.Order,
      validationRegex: e.ValidationRegex ?? '',
      validationPattern: e.ValidationRegex ? new RegExp(e.ValidationRegex) : null,
    }))
    .sort((a, b) => a.order - b.order);

  /** Current parameters (Name + Performance) per event key. Seeded from disk. */
  protected readonly values = signal<Record<string, EventParameter>>({});

  /** Whether a save is in progress. */
  protected readonly saving = signal(false);

  constructor() {
    void this.store.load().then((saved) => this.values.set(saved));
  }

  protected nameFor(key: string): string {
    return this.values()[key]?.name ?? '';
  }

  protected performanceFor(key: string): string {
    return this.values()[key]?.performance ?? '';
  }

  protected multipliedByFor(key: string): number | null {
    return this.values()[key]?.multipliedBy ?? null;
  }

  private paramsFor(key: string): EventParameter {
    return this.values()[key] ?? { name: '', performance: '', multipliedBy: null };
  }

  protected onFieldInput(key: string, field: 'name', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.values.update((current) => ({
      ...current,
      [key]: { ...this.paramsFor(key), [field]: value },
    }));
  }

  protected setPerformance(key: string, value: string): void {
    this.values.update((current) => ({
      ...current,
      [key]: { ...this.paramsFor(key), performance: value },
    }));
  }

  /** True when a non-empty performance value fails the event's validation regex. */
  protected performanceInvalid(row: EventRow): boolean {
    const value = this.performanceFor(row.key);
    return value !== '' && row.validationPattern !== null && !row.validationPattern.test(value);
  }

  protected onMultipliedByInput(key: string, event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const multipliedBy = raw === '' ? null : Number(raw);
    this.values.update((current) => ({
      ...current,
      [key]: { ...this.paramsFor(key), multipliedBy },
    }));
  }

  protected async save(): Promise<void> {
    const invalidCount = this.rows.filter((row) => this.performanceInvalid(row)).length;
    if (invalidCount > 0) {
      this.snackBar.open(
        `Διορθώστε ${invalidCount} μη έγκυρη(ες) τιμή(ές) επίδοσης πριν την αποθήκευση.`,
        'Κλείσιμο',
        { duration: 5000 },
      );
      return;
    }

    this.saving.set(true);
    try {
      await this.store.save(this.values());
      this.snackBar.open('Τα όρια βαθμολόγησης αποθηκεύτηκαν.', 'Εντάξει', { duration: 3000 });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Άγνωστο σφάλμα';
      this.snackBar.open(`Δεν ήταν δυνατή η αποθήκευση: ${message}`, 'Κλείσιμο', {
        duration: 5000,
      });
    } finally {
      this.saving.set(false);
    }
  }
}
