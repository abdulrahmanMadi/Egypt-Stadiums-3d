import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  inject,
  PLATFORM_ID,
} from '@angular/core';
import {
  initStadium,
  listStadiums,
  readStoredStadiumId,
  switchStadium,
} from './stadium/stadium.engine.js';

@Component({
  selector: 'app-root',
  imports: [],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements AfterViewInit {
  private readonly platformId = inject(PLATFORM_ID);
  private switching = false;

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const select = document.getElementById(
      'stadium-select',
    ) as HTMLSelectElement | null;
    const initialId = readStoredStadiumId();

    if (select) {
      for (const s of listStadiums()) {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.draft ? `${s.name} (draft)` : s.name;
        if (s.id === initialId) opt.selected = true;
        select.appendChild(opt);
      }
      select.addEventListener('change', async () => {
        if (this.switching) return;
        this.switching = true;
        select.disabled = true;
        try {
          await switchStadium(select.value);
        } catch (err) {
          console.error(err);
        } finally {
          select.disabled = false;
          this.switching = false;
        }
      });
    }

    void initStadium(initialId);
  }
}
