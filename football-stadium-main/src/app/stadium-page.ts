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
  getStadiumMeta,
  initStadium,
  otherStadiumId,
  resolveStadiumIdFromRoute,
  stadiumRouteSlug,
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
  private cleanupUi: Array<() => void> = [];

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const btn = document.getElementById(
      'stadium-switch-btn',
    ) as HTMLButtonElement | null;
    const kickerEl = document.getElementById('ss-kicker');
    const nameEl = document.getElementById('ss-name');
    const locEl = document.getElementById('ss-loc');

    const paintTarget = (currentId: string) => {
      const next = getStadiumMeta(otherStadiumId(currentId));
      if (!next) return;
      if (kickerEl) kickerEl.textContent = 'Go to';
      if (nameEl) nameEl.textContent = next.name;
      if (locEl) locEl.textContent = next.location || '';
      if (btn) {
        btn.setAttribute('aria-label', `Open ${next.name}`);
        btn.dataset['target'] = next.id;
      }
    };

    if (btn) {
      const onClick = () => {
        const target =
          btn.dataset['target'] ||
          otherStadiumId(
            resolveStadiumIdFromRoute(this.route.snapshot.paramMap.get('id')),
          );
        void this.router.navigate(['/stadium', stadiumRouteSlug(target)]);
      };
      btn.addEventListener('click', onClick);
      this.cleanupUi.push(() => btn.removeEventListener('click', onClick));
    }

    this.sub = this.route.paramMap.subscribe((params) => {
      const id = resolveStadiumIdFromRoute(params.get('id'));
      paintTarget(id);
      void this.loadStadium(id, btn);
    });
  }

  private async loadStadium(
    id: string,
    btn: HTMLButtonElement | null,
  ): Promise<void> {
    const seq = ++this.loadSeq;
    if (btn) btn.disabled = true;
    try {
      await initStadium(id);
      const active = getActiveStadiumId();
      const routeSlug = this.route.snapshot.paramMap.get('id');
      const routeId = resolveStadiumIdFromRoute(routeSlug);
      const canonicalSlug = active ? stadiumRouteSlug(active) : null;
      if (
        active &&
        canonicalSlug &&
        (active !== routeId || routeSlug !== canonicalSlug)
      ) {
        await this.router.navigate(['/stadium', canonicalSlug], {
          replaceUrl: true,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (seq === this.loadSeq && btn) btn.disabled = false;
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.cleanupUi.forEach((fn) => {
      try {
        fn();
      } catch (_) {}
    });
    this.cleanupUi = [];
    disposeActiveStadium();
  }
}
