import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  stadiumRouteSlug,
  STADIUM_CATALOG,
} from './stadium/registry.js';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink],
  templateUrl: './home-page.html',
  styleUrl: './home-page.css',
})
export class HomePage {
  readonly stadiums = STADIUM_CATALOG.map((stadium) => ({
    ...stadium,
    route: ['/stadium', stadiumRouteSlug(stadium.id)],
  }));
}
