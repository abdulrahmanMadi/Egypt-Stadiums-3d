import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  OnDestroy,
  inject,
  PLATFORM_ID,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest, Subscription } from 'rxjs';
import {
  disposeActiveStadium,
  getActiveStadiumId,
  getCrowdCapacity,
  getCurrentSeat,
  getEnvironment,
  getQualityMode,
  getStadiumMeta,
  initStadium,
  openSeat,
  otherStadiumId,
  resolveStadiumIdFromRoute,
  setCrowdCapacity,
  setEnvironment,
  setQualityMode,
  stadiumRouteSlug,
  toggleFullscreen,
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
    const crowdSlider = document.getElementById(
      'crowd-capacity',
    ) as HTMLInputElement | null;
    const crowdValue = document.getElementById(
      'crowd-capacity-value',
    ) as HTMLOutputElement | null;

    if (crowdSlider) {
      const initialCapacity = getCrowdCapacity();
      crowdSlider.value = String(initialCapacity);
      if (crowdValue) crowdValue.value = `${initialCapacity}%`;
      const onCapacityInput = () => {
        const capacity = Number(crowdSlider.value);
        setCrowdCapacity(capacity);
        if (crowdValue) crowdValue.value = `${capacity}%`;
      };
      crowdSlider.addEventListener('input', onCapacityInput);
      this.cleanupUi.push(() =>
        crowdSlider.removeEventListener('input', onCapacityInput),
      );
    }

    const qualitySelect = document.getElementById(
      'quality-mode',
    ) as HTMLSelectElement | null;
    const timeSelect = document.getElementById(
      'time-of-day',
    ) as HTMLSelectElement | null;
    const weatherSelect = document.getElementById(
      'weather-mode',
    ) as HTMLSelectElement | null;
    const fullscreenButton = document.getElementById(
      'fullscreen-toggle',
    ) as HTMLButtonElement | null;
    const shareButton = document.getElementById(
      'share-seat',
    ) as HTMLButtonElement | null;

    if (qualitySelect) {
      qualitySelect.value = getQualityMode();
      const onQualityChange = () => setQualityMode(qualitySelect.value);
      qualitySelect.addEventListener('change', onQualityChange);
      this.cleanupUi.push(() =>
        qualitySelect.removeEventListener('change', onQualityChange),
      );
    }

    const environment = getEnvironment();
    if (timeSelect) timeSelect.value = environment.timeOfDay;
    if (weatherSelect) weatherSelect.value = environment.weather;
    const onEnvironmentChange = () =>
      setEnvironment({
        timeOfDay: timeSelect?.value || 'day',
        weather: weatherSelect?.value || 'clear',
      });
    timeSelect?.addEventListener('change', onEnvironmentChange);
    weatherSelect?.addEventListener('change', onEnvironmentChange);
    this.cleanupUi.push(() => {
      timeSelect?.removeEventListener('change', onEnvironmentChange);
      weatherSelect?.removeEventListener('change', onEnvironmentChange);
    });

    if (fullscreenButton) {
      const paintFullscreen = () => {
        fullscreenButton.textContent = document.fullscreenElement
          ? 'Exit fullscreen'
          : 'Enter fullscreen';
      };
      const onFullscreenClick = () => void toggleFullscreen();
      fullscreenButton.addEventListener('click', onFullscreenClick);
      document.addEventListener('fullscreenchange', paintFullscreen);
      this.cleanupUi.push(() => {
        fullscreenButton.removeEventListener('click', onFullscreenClick);
        document.removeEventListener('fullscreenchange', paintFullscreen);
      });
    }

    if (shareButton) {
      const onShareClick = async () => {
        const seat = getCurrentSeat();
        const activeId = getActiveStadiumId();
        if (!seat || !activeId) return;
        const url = new URL(
          `/stadium/${stadiumRouteSlug(activeId)}`,
          window.location.origin,
        );
        url.searchParams.set('section', String(seat.section));
        url.searchParams.set('row', String(seat.row));
        url.searchParams.set('seat', String(seat.seat));
        url.searchParams.set('view', '1');
        await navigator.clipboard.writeText(url.toString());
        shareButton.textContent = 'Link copied';
        window.setTimeout(() => (shareButton.textContent = 'Copy seat link'), 1600);
      };
      shareButton.addEventListener('click', onShareClick);
      this.cleanupUi.push(() =>
        shareButton.removeEventListener('click', onShareClick),
      );
    }

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

    this.sub = combineLatest([
      this.route.paramMap,
      this.route.queryParamMap,
    ]).subscribe(([params, query]) => {
      const id = resolveStadiumIdFromRoute(params.get('id'));
      const section = Number(query.get('section'));
      const row = Number(query.get('row'));
      const seat = Number(query.get('seat'));
      const seatLink =
        section > 0 && row > 0 && seat > 0
          ? {
              section,
              row,
              seat,
              fly: query.get('view') === '1',
            }
          : null;
      paintTarget(id);
      void this.loadStadium(id, btn, seatLink);
    });
  }

  private async loadStadium(
    id: string,
    btn: HTMLButtonElement | null,
    seatLink: {
      section: number;
      row: number;
      seat: number;
      fly: boolean;
    } | null,
  ): Promise<void> {
    const seq = ++this.loadSeq;
    if (btn) btn.disabled = true;
    try {
      await initStadium(id);
      if (seq !== this.loadSeq) return;
      if (seatLink) {
        openSeat(seatLink, { fly: seatLink.fly });
      }
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
          queryParamsHandling: 'preserve',
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
