import { Component, DestroyRef, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';

import { AboutDialog } from './about-dialog/about-dialog';

@Component({
  selector: 'app-root',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly dialog = inject(MatDialog);

  protected readonly title = 'Βαθμολογία Συλλόγων';

  constructor() {
    // The "Πληροφορίες" entry lives in the native Electron menu; it asks us to
    // open the in-app About dialog. No-op in a plain browser (ng serve).
    const unsubscribe = window.electronAPI?.onShowAbout(() => this.openAbout());
    if (unsubscribe) {
      inject(DestroyRef).onDestroy(unsubscribe);
    }
  }

  private openAbout(): void {
    // Guard against stacking multiple dialogs if the menu is clicked repeatedly.
    if (this.dialog.openDialogs.length > 0) return;
    this.dialog.open(AboutDialog);
  }
}
