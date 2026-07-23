import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  OnDestroy,
  inject,
  PLATFORM_ID,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  disposeActiveStadium,
  getActiveStadiumId,
  initStadium,
  listStadiums,
  resolveStadiumIdFromRoute,
} from './stadium/stadium.engine.js';

@Component({
  selector: 'app-stadium-page',
  imports: [],
  templateUrl: './stadium-page.html',
  styleUrl: './stadium-page.css',
})
export class StadiumPage implements AfterViewInit, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private sub: Subscription | null = null;
  private loadSeq = 0;

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const select = document.getElementById(
      'stadium-select',
    ) as HTMLSelectElement | null;

    if (select) {
      const current = resolveStadiumIdFromRoute(
        this.route.snapshot.paramMap.get('id'),
      );
      // rebuild options once per mount
      select.innerHTML = '';
      for (const s of listStadiums()) {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.draft ? `${s.name} (draft)` : s.name;
        if (s.id === current) opt.selected = true;
        select.appendChild(opt);
      }
      select.addEventListener('change', () => {
        void this.router.navigate(['/stadium', select.value]);
      });
    }

    this.sub = this.route.paramMap.subscribe((params) => {
      const id = resolveStadiumIdFromRoute(params.get('id'));
      if (select && select.value !== id) select.value = id;
      void this.loadStadium(id, select);
    });
  }

  private async loadStadium(
    id: string,
    select: HTMLSelectElement | null,
  ): Promise<void> {
    // initStadium itself decides whether a rebuild is needed (canvas still live?)
    const seq = ++this.loadSeq;
    if (select) select.disabled = true;
    try {
      await initStadium(id);
      const active = getActiveStadiumId();
      const routeId = resolveStadiumIdFromRoute(
        this.route.snapshot.paramMap.get('id'),
      );
      if (active && active !== routeId) {
        await this.router.navigate(['/stadium', active], {
          replaceUrl: true,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (seq === this.loadSeq && select) select.disabled = false;
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    disposeActiveStadium();
  }
}
