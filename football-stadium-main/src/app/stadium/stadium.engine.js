import {
  DEFAULT_STADIUM_ID,
  getStadiumMeta,
  otherStadiumId,
  resolveStadiumId,
  stadiumRouteSlug,
  STADIUM_CATALOG,
  STADIUM_LOADERS,
} from './registry.js';

export {
  DEFAULT_STADIUM_ID,
  getStadiumMeta,
  otherStadiumId,
  resolveStadiumId,
  stadiumRouteSlug,
};

let active = null;
/** @type {Promise<any> | null} */
let switching = null;
let crowdCapacityPercent = 80;
let qualityMode = 'auto';
let environment = { timeOfDay: 'day', weather: 'clear' };

try {
  const storedCapacity = Number(localStorage.getItem('crowdCapacityPercentV2'));
  if (Number.isFinite(storedCapacity)) {
    crowdCapacityPercent = Math.max(0, Math.min(100, storedCapacity));
  }
} catch (_) {}

try {
  const storedQuality = localStorage.getItem('qualityModeV1');
  if (['auto', 'low', 'medium', 'high', 'ultra'].includes(storedQuality)) {
    qualityMode = storedQuality;
  }
  const storedEnvironment = JSON.parse(
    localStorage.getItem('environmentV1') || 'null',
  );
  if (storedEnvironment) {
    environment = { ...environment, ...storedEnvironment };
  }
} catch (_) {}

export function getCrowdCapacity() {
  return crowdCapacityPercent;
}

export function setCrowdCapacity(percent) {
  const value = Math.max(0, Math.min(100, Number(percent) || 0));
  crowdCapacityPercent = value;
  try {
    localStorage.setItem('crowdCapacityPercentV2', String(value));
  } catch (_) {}
  active?.setCrowdCapacity?.(value);
}

export function getQualityMode() {
  return qualityMode;
}

export function setQualityMode(mode) {
  if (!['auto', 'low', 'medium', 'high', 'ultra'].includes(mode)) return;
  qualityMode = mode;
  try {
    localStorage.setItem('qualityModeV1', mode);
  } catch (_) {}
  active?.setQualityMode?.(mode);
}

export function getEnvironment() {
  return { ...environment };
}

export function setEnvironment(next) {
  environment = { ...environment, ...next };
  try {
    localStorage.setItem('environmentV1', JSON.stringify(environment));
  } catch (_) {}
  active?.setEnvironment?.(environment);
}

export async function toggleFullscreen() {
  if (document.fullscreenElement) {
    await document.exitFullscreen();
  } else {
    await document.documentElement.requestFullscreen();
  }
}

export function openSeat(seat, options) {
  return active?.openSeat?.(seat, options) || false;
}

export function getCurrentSeat() {
  return active?.getCurrentSeat?.() || null;
}

export function listTifoBlocks() {
  return active?.listTifoBlocks?.() || [];
}

export function previewTifo(image, blockLabels) {
  return active?.previewTifo?.(image, blockLabels) || false;
}

export function applyTifo() {
  return active?.applyTifo?.() || false;
}

export function cancelTifo() {
  return active?.cancelTifo?.() || false;
}

export function clearTifo() {
  return active?.clearTifo?.() || false;
}

function applyBranding(meta) {
  const nameEl = document.querySelector('.brand-name');
  const subEl = document.querySelector('.brand-sub');
  const loaderText = document.getElementById('loader-text');
  const locEl = document.getElementById('match-location');
  if (nameEl) nameEl.textContent = meta.name;
  if (subEl) subEl.textContent = meta.subtitle || 'Stadium View';
  if (loaderText) {
    loaderText.textContent =
      meta.loaderText || `Loading ${meta.name}…`;
  }
  if (locEl) locEl.textContent = meta.location;
  document.title = `${meta.name} · Stadium View`;
  document.body.dataset.stadium = meta.id;
  document.body.classList.toggle('stadium-draft', !!meta.draft);
  document.body.classList.remove('stadium-noseats');

  const flags = document.querySelectorAll('#match .flag');
  if (flags[0]) {
    flags[0].className = `flag ${meta.flagHome || 'egy'}`;
    flags[0].setAttribute('aria-label', meta.teams?.home || 'Home');
  }
  if (flags[1]) {
    flags[1].className = `flag ${meta.flagAway || 'arg'}`;
    flags[1].setAttribute('aria-label', meta.teams?.away || 'Away');
  }
  if (meta.teams?.home || meta.teams?.away) {
    const names = document.querySelectorAll('#match .team .name');
    if (names[0] && meta.teams?.home) names[0].textContent = meta.teams.home;
    if (names[1] && meta.teams?.away) names[1].textContent = meta.teams.away;
  }
  if (meta.matchLabel) {
    const eyebrow = document.querySelector('#match .eyebrow');
    if (eyebrow) eyebrow.textContent = meta.matchLabel;
  }
}

function getLiveCanvas() {
  const c = document.getElementById('c');
  return c && c.isConnected ? c : null;
}

/** Fresh canvas so WebGL can re-init after a stadium dispose */
function resetStadiumCanvas() {
  const old = document.getElementById('c');
  if (!old?.parentNode) return null;
  const next = document.createElement('canvas');
  next.id = 'c';
  for (const { name, value } of Array.from(old.attributes)) {
    if (name === 'id') continue;
    next.setAttribute(name, value);
  }
  if (!next.getAttribute('aria-label')) {
    next.setAttribute(
      'aria-label',
      'Interactive 3D stadium. Drag to orbit the venue.',
    );
  }
  old.parentNode.replaceChild(next, old);
  return next;
}

function showLoaderError(message) {
  const loader = document.getElementById('loader');
  const loaderText = document.getElementById('loader-text');
  if (loaderText) loaderText.textContent = message;
  if (loader) loader.classList.add('hide');
  const toast = document.getElementById('toast');
  if (toast) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 4200);
  }
}

export function resolveStadiumIdFromRoute(raw) {
  return resolveStadiumId(raw);
}

export function disposeActiveStadium() {
  if (!active?.dispose) {
    active = null;
          return;
        }
  try {
    active.dispose();
  } catch (err) {
    console.warn('Stadium dispose failed', err);
  }
  active = null;
}

/**
 * Boot or switch the active stadium experience.
 * Rebuilds if the live canvas is missing / detached (HMR / remount safe).
 * @param {string} [stadiumId]
 * @returns {Promise<{ id: string, dispose: () => void, canvas?: HTMLCanvasElement }>}
 */
export async function initStadium(stadiumId = DEFAULT_STADIUM_ID) {
  const id = resolveStadiumId(stadiumId);
  const live = getLiveCanvas();

  // Skip only when this stadium is still bound to the CURRENT canvas
  if (active?.id === id && live && active.canvas === live) {
    applyBranding(getStadiumMeta(id));
    const loader = document.getElementById('loader');
    if (loader) loader.classList.add('hide');
    return active;
  }

  if (switching) {
    try {
      await switching;
    } catch (_) {}
    const live2 = getLiveCanvas();
    if (active?.id === id && live2 && active.canvas === live2) {
      applyBranding(getStadiumMeta(id));
      const loader = document.getElementById('loader');
      if (loader) loader.classList.add('hide');
      return active;
    }
  }

  const meta = getStadiumMeta(id);
  applyBranding(meta);

  const loader = document.getElementById('loader');
  if (loader) loader.classList.remove('hide');

  const run = (async () => {
    const hadPrevious = !!active;
    if (active?.dispose) {
      try {
        active.dispose();
      } catch (err) {
        console.warn('Stadium dispose failed', err);
      }
      active = null;
    }

    // Fresh canvas when switching OR when DOM remounted without a live canvas
    if (hadPrevious || !getLiveCanvas()) resetStadiumCanvas();

    const loaderFn = STADIUM_LOADERS[id];
    if (!loaderFn) throw new Error(`Unknown stadium: ${id}`);
    const mod = await loaderFn();
    // Paint the loader before synchronous geometry and crowd construction.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    try {
      const handle = mod.createStadium({
        meta: { ...meta, ...mod.stadiumMeta },
      });
      if (!handle.canvas) handle.canvas = getLiveCanvas();
      active = handle;
      handle.setCrowdCapacity?.(crowdCapacityPercent);
      handle.setQualityMode?.(qualityMode);
      handle.setEnvironment?.(environment);
      try {
        localStorage.setItem('stadiumId', id);
      } catch (_) {}
      return handle;
    } catch (err) {
      console.error('Stadium failed to start', err);
      showLoaderError(
        `Failed to load ${meta.name}. Check the console for details.`,
      );
      throw err;
    }
        })();

  switching = run;
  try {
    return await run;
  } finally {
    if (switching === run) switching = null;
  }
}

export async function switchStadium(stadiumId) {
  return initStadium(stadiumId);
}

export function getActiveStadiumId() {
  return active?.id || null;
}

export function listStadiums() {
  return STADIUM_CATALOG.slice();
}

export function readStoredStadiumId() {
  try {
    return resolveStadiumId(localStorage.getItem('stadiumId'));
  } catch (_) {
    return DEFAULT_STADIUM_ID;
  }
}
