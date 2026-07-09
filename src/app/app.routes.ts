import { Routes } from '@angular/router';

import { Import } from './import/import';
import { EventParameters } from './event-parameters/event-parameters';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'import' },
  { path: 'import', component: Import, title: 'Εισαγωγή Αποτελεσμάτων' },
  {
    path: 'event-parameters',
    component: EventParameters,
    title: 'Όρια Βαθμολόγησης',
  },
];
