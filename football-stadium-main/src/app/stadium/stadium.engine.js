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
    try {
      const handle = mod.createStadium({
        meta: { ...meta, ...mod.stadiumMeta },
      });
      if (!handle.canvas) handle.canvas = getLiveCanvas();
      active = handle;
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
