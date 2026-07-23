import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./home-page').then((m) => m.HomePage),
  },
  {
    path: 'stadium/:id',
    loadComponent: () =>
      import('./stadium-page').then((m) => m.StadiumPage),
  },
  { path: '**', redirectTo: '' },
];