import { Component, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';

import { CsvService } from '../core/csv.service';
import { EventParametersService } from '../core/event-parameters.service';
import { FileSaveService } from '../core/file-save.service';
import { EventParameter } from '../core/electron-api';
import { FileDropDirective } from '../core/file-drop.directive';
import { Result } from '../core/result.interface';
import { Grade, grades } from '../grades';
import { eventConstants } from '../event.constants';

@Component({
  selector: 'app-import',
  imports: [
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
    MatButtonModule,
    FileDropDirective,
  ],
  templateUrl: './import.html',
  styleUrl: './import.scss',
})
export class Import {
  private readonly csv = inject(CsvService);
  private readonly eventParameters = inject(EventParametersService);
  private readonly fileSave = inject(FileSaveService);
  private readonly snackBar = inject(MatSnackBar);

  /** TODO: replace with the real selection items later. */
  protected readonly options: Grade[] = [...grades];

  /** Currently selected dropdown value; required before the file area is enabled. */
  protected readonly selectedGrade = signal<Grade | null>(null);

  /** Name of the last successfully loaded file (for user feedback). */
  protected readonly loadedFileName = signal<string | null>(null);

  /** Whether a file is currently being parsed. */
  protected readonly parsing = signal(false);

  /** The parsed CSV held in memory as JSON. Not displayed yet. */
  protected readonly jsonData = signal<Result[] | null>(null);

  protected get fileAreaDisabled(): boolean {
    return this.selectedGrade() === null || this.parsing();
  }

  protected onSelectionChange(value: Grade): void {
    this.selectedGrade.set(value);
  }

  /** Handle a file chosen via the hidden <input type="file">. */
  protected onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.handleFile(file);
    }
    // Reset so selecting the same file again re-triggers the change event.
    input.value = '';
  }

  protected async handleFile(file: File): Promise<void> {
    if (this.fileAreaDisabled) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      this.snackBar.open('Παρακαλώ επιλέξτε ένα αρχείο .csv.', 'Κλείσιμο', { duration: 4000 });
      return;
    }

    this.parsing.set(true);
    try {
      const rows = await this.csv.parse(file);
      this.jsonData.set(rows);
      this.loadedFileName.set(file.name);
      /* this.snackBar.open(`Φορτώθηκαν ${rows.length} γραμμή(ές) από ${file.name}.`, 'Εντάξει', {
        duration: 3000,
      }); */
      // TODO: remove — temporary confirmation that CSV parsed to JSON in memory.
      //console.log('Parsed CSV → JSON in memory:', this.jsonData());

      // Load the user-defined event parameters before processing the rows.
      const params = await this.eventParameters.load();
      await this.processRows(rows, params);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Άγνωστο σφάλμα ανάλυσης';
      this.snackBar.open(`Δεν ήταν δυνατή η ανάλυση του CSV: ${message}`, 'Κλείσιμο', {
        duration: 5000,
      });
    } finally {
      this.parsing.set(false);
    }
  }
  async processRows(rows: Result[], params: Record<string, EventParameter>): Promise<void> {
    let filteredRows = this.removeDNSAthletes(rows);
    filteredRows = rows
      .filter((row) => (row.StartStatus === 'OK' || row.StartStatus === 'NM') && row.RelayId === '')
      .map((row) => ({
        ...row,
        Grade: null,
        RectifiedResult:
          row.ResultRounded === ''
            ? Number(row.Result.replaceAll('.', '').replaceAll(':', ''))
            : Number(row.ResultRounded.replaceAll('.', '').replaceAll(':', '')),
      }));

    // Collect one formatted text block per event, then save them all together.
    const blocks: string[] = [];
    let gradedResultsCollection: Result[] = [];
    for (const [key, param] of Object.entries(params)) {
      if (param.performance !== '') {
        const [eventCode, gender] = key.split('|');
        const event = eventConstants.find(
          (e) => e.EventCode === eventCode && e.EventGender === gender,
        );
        if (event) {
          const resultsWithGrades = this.applyGrades(
            filteredRows,
            event.EventCode,
            event.EventGender,
            event.BiggerIsBetter,
            this.selectedGrade()!,
            param.performance,
            param.multipliedBy,
          );
          gradedResultsCollection = [...resultsWithGrades, ...gradedResultsCollection];
          const resultsForExport = resultsWithGrades.map((row) => {
            return {
              Place: row.Place,
              Name: row.FullName,
              Dob: row.DateOfBirth,
              Club: row.ClubName,
              Result: row.ResultRounded || row.Result,
              Grade: row.Grade,
            };
          });
          blocks.push(this.formatEventBlock(param.name, event.EventGender, resultsForExport));
        }
      }
    }

    if (blocks.length === 0) {
      this.snackBar.open('Δεν υπάρχουν βαθμολογημένα αποτελέσματα για αποθήκευση.', 'Κλείσιμο', {
        duration: 4000,
      });
      return;
    }

    // Sum each club's grades per gender and append the standings.
    const clubSumsByGender = this.sumGradesByClubPerGender(gradedResultsCollection);
    for (const [gender, clubSums] of clubSumsByGender) {
      blocks.push(this.formatClubsBlock(gender, clubSums));
    }

    // Combine both genders into one overall ranking with a final place.
    blocks.push(this.formatOverallClubsBlock(clubSumsByGender));

    const content = blocks.join('\n\n');
    const saved = await this.fileSave.saveText('graded-results.txt', content);
    if (saved) {
      this.snackBar.open('Τα βαθμολογημένα αποτελέσματα αποθηκεύτηκαν.', 'Εντάξει', {
        duration: 3000,
      });
    }
  }

  /** Render a single event's graded results as a tab-separated text block. */
  private formatEventBlock(
    name: string,
    gender: string,
    results: {
      Place: number | null;
      Name: string;
      Dob: Date | string | null;
      Club: string;
      Result: string;
      Grade: number | null;
    }[],
  ): string {
    const header = `=== ${name} (${gender}) ===`;
    const columns = ['Θέση', 'Όνομα', 'Ημ. Γέννησης', 'Σύλλογος', 'Επίδοση', 'Βαθμοί'].join('\t');
    const lines = results.map((r) => {
      const place = r.Place ?? '';
      const dob = this.formatDob(r.Dob);
      const grade = r.Grade == null ? '' : Math.round(r.Grade * 100) / 100;
      return [place, r.Name, dob, r.Club, r.Result, grade].join('\t');
    });
    return [header, columns, ...lines].join('\n');
  }

  /**
   * Format a date of birth as dd/mm/yyyy. Accepts a "yyyy-mm-dd" string,
   * a Date, or an empty/null value (rendered as an empty string).
   */
  private formatDob(dob: Date | string | null): string {
    if (!dob) {
      return '';
    }
    if (typeof dob === 'string') {
      const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dob);
      return match ? `${match[3]}/${match[2]}/${match[1]}` : dob;
    }
    const day = String(dob.getDate()).padStart(2, '0');
    const month = String(dob.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${dob.getFullYear()}`;
  }

  /**
   * Group graded results by EventGender, then sum each club's Grade within
   * that gender. Returns gender -> (clubName -> total Grade).
   */
  private sumGradesByClubPerGender(results: Result[]): Map<string, Map<string, number>> {
    const byGender = new Map<string, Map<string, number>>();
    for (const row of results) {
      let clubSums = byGender.get(row.EventGender);
      if (!clubSums) {
        clubSums = new Map<string, number>();
        byGender.set(row.EventGender, clubSums);
      }
      clubSums.set(row.ClubName, (clubSums.get(row.ClubName) ?? 0) + (row.Grade ?? 0));
    }
    return byGender;
  }

  /** Render one gender's club totals as a tab-separated text block, best first. */
  private formatClubsBlock(gender: string, clubSums: Map<string, number>): string {
    const header = `=== Βαθμολογία συλλόγων (${gender}) ===`;
    return this.formatClubStandings(header, clubSums);
  }

  /**
   * Combine every gender's club totals into a single overall grade per club,
   * then rank the clubs to give each a final Place. Rendered best first.
   */
  private formatOverallClubsBlock(clubSumsByGender: Map<string, Map<string, number>>): string {
    const overall = new Map<string, number>();
    for (const clubSums of clubSumsByGender.values()) {
      for (const [club, total] of clubSums) {
        overall.set(club, (overall.get(club) ?? 0) + total);
      }
    }
    return this.formatClubStandings('=== Βαθμολογία συλλόγων (Γενική) ===', overall);
  }

  /**
   * Render club totals as a ranked, tab-separated block (best first). Clubs
   * with an equal total share the same Place, and the next place skips the
   * tied entries (e.g. 1, 2, 2, 4).
   */
  private formatClubStandings(header: string, clubSums: Map<string, number>): string {
    const columns = ['Θέση', 'Σύλλογος', 'Σύνολο Βαθμών'].join('\t');
    const sorted = Array.from(clubSums.entries())
      .map(([club, total]) => ({ club, total: Math.round(total * 100) / 100 }))
      .sort((a, b) => b.total - a.total);

    let place = 0;
    let previousTotal: number | null = null;
    const lines = sorted.map((entry, index) => {
      if (previousTotal === null || entry.total !== previousTotal) {
        place = index + 1;
        previousTotal = entry.total;
      }
      return [place, entry.club, entry.total].join('\t');
    });
    return [header, columns, ...lines].join('\n');
  }

  removeDNSAthletes(rows: Result[]): Result[] {
    const dnsAthletes = rows
      .filter((row) => row.StartStatus === 'DNS')
      .map((r) => {
        return {
          eventCode: r.EventCode,
          gender: r.EventGender,
          greekAthleteId: r.License_GreekAth,
        };
      });

    return rows.filter(
      (row) =>
        !dnsAthletes.some(
          (dns) =>
            dns.eventCode === row.EventCode &&
            dns.gender === row.EventGender &&
            dns.greekAthleteId === row.License_GreekAth,
        ),
    );
  }

  applyGrades(
    filteredRows: Result[],
    EventCode: string,
    EventGender: string,
    BiggerIsBetter: boolean,
    grade: Grade,
    performance: string,
    multipliedBy: number | null,
  ): Result[] {
    let finalists = filteredRows.filter(
      (row) =>
        row.EventCode === EventCode &&
        row.EventGender === EventGender &&
        row.EventStage === 'Final',
    );
    const finalistsWithGrades = finalists.map((row) => {
      if (
        this.athleteHasReachedPerformance(
          row,
          filteredRows,
          Number(performance.replaceAll('.', '').replaceAll(':', '')),
          BiggerIsBetter,
        )
      ) {
        if (row.StartStatus !== 'NM') {
          //row.Grade = Number(grade[row.Place! as unknown as keyof Grade] ?? 0) * (multipliedBy ?? 1);
        } else {
          row.Grade =
            Number(grade[finalists.length as unknown as keyof Grade] ?? 0) * (multipliedBy ?? 1);
        }
      } else {
        row.Grade = 0;
      }
      return row;
    });

    // Group finalists by Place, then give every finalist in a group the
    // average of the Grades in that group (splits ties evenly).
    const finalistsByPlace = new Map<number, Result[]>();
    for (const row of finalistsWithGrades) {
      const group = finalistsByPlace.get(row.Place!);
      if (group) {
        group.push(row);
      } else {
        finalistsByPlace.set(row.Place!, [row]);
      }
    }
    for (const group of finalistsByPlace.values()) {
      if (group.length > 0 && group[0].StartStatus !== 'NM') {
        group.forEach((row, index) => {
          row.Grade = Number(
            grade[(index + Number(row.Place ?? 0)) as unknown as keyof Grade] ??
              0 * (multipliedBy ?? 1),
          );
        });

        const averageGrade = group.reduce((sum, row) => sum + (row.Grade ?? 0), 0) / group.length;
        for (const row of group) {
          row.Grade = averageGrade;
        }
      }
    }

    const numberOfGradedFinalists = finalistsWithGrades.filter((row) => row.Grade ?? 0 > 0).length;
    let preliminaristsByPlace: Map<number, Result[]> = new Map<number, Result[]>();
    if (numberOfGradedFinalists < grade.BATHMOL) {
      let preliminarists = filteredRows.filter(
        (row) =>
          row.EventCode === EventCode &&
          row.EventGender === EventGender &&
          row.EventStage !== 'Final',
      );

      preliminarists = preliminarists.filter(
        (row) =>
          !finalistsWithGrades.some(
            (f) =>
              f.EventGender === row.EventGender &&
              f.EventCode === row.EventCode &&
              f.License_GreekAth === row.License_GreekAth,
          ) &&
          this.athleteHasReachedPerformance(
            row,
            filteredRows,
            Number(performance.replaceAll('.', '').replaceAll(':', '')),
            BiggerIsBetter,
          ),
      );

      // Group preliminarists by Place, then give every preliminarist in a group
      // the average of the Grades in that group (splits ties evenly).
      for (const row of preliminarists) {
        const group = preliminaristsByPlace.get(row.Place!);
        if (group) {
          group.push(row);
        } else {
          preliminaristsByPlace.set(row.Place!, [row]);
        }
      }
      let count = 1;
      for (const group of preliminaristsByPlace.values()) {
        group.forEach((row, index) => {
          row.Grade = Number(
            grade[(index + 1 + finalists.length) as unknown as keyof Grade] ??
              0 * (multipliedBy ?? 1),
          );
        });
        const averageGrade =
          group.reduce(
            (sum, row) =>
              sum +
              Number(grade[(count + finalists.length) as unknown as keyof Grade] ?? 0) *
                (multipliedBy ?? 1),
            0,
          ) / group.length;
        for (const row of group) {
          row.Grade = averageGrade;
        }
        count++;
      }
    }
    return [
      ...Array.from(finalistsByPlace.values()).flat(),
      ...Array.from(preliminaristsByPlace.values()).flatMap((g) =>
        g
          .map((r) => {
            r.Place = null;
            return r;
          })
          .filter((r) => r.Grade ?? 0 > 0),
      ),
    ];
  }

  athleteHasReachedPerformance(
    row: Result,
    filteredRows: Result[],
    rectifiedPerformance: number,
    BiggerIsBetter: boolean,
  ) {
    if (
      (BiggerIsBetter &&
        filteredRows.some(
          (r) =>
            r.License_GreekAth === row.License_GreekAth ||
            (r.RelayTeamName === row.RelayTeamName &&
              r.EventCode === row.EventCode &&
              r.EventGender === row.EventGender &&
              r.Result !== '' &&
              Number(r.RectifiedResult) >= rectifiedPerformance),
        )) ||
      (!BiggerIsBetter &&
        filteredRows.some(
          (r) =>
            r.License_GreekAth === row.License_GreekAth ||
            (r.RelayTeamName === row.RelayTeamName &&
              r.EventCode === row.EventCode &&
              r.EventGender === row.EventGender &&
              r.Result !== '' &&
              Number(r.RectifiedResult) <= rectifiedPerformance),
        ))
    ) {
      return true;
    }
    return false;
  }
}
