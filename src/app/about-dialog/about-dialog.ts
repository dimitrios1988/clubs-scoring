import { Component } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { appInfo } from '../app-info';

@Component({
  selector: 'app-about-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './about-dialog.html',
  styleUrl: './about-dialog.scss',
})
export class AboutDialog {
  protected readonly info = appInfo;
}
