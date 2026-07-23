import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'stadium/cairo' },
  {
    path: 'stadium/:id',
    loadComponent: () =>
      import('./stadium-page').then((m) => m.StadiumPage),
  },
  { path: '**', redirectTo: 'stadium/cairo' },
];