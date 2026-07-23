import {
  DEFAULT_STADIUM_ID,
  getStadiumMeta,
  resolveStadiumId,
  STADIUM_CATALOG,
  STADIUM_LOADERS,
} from './registry.js';

let active = null;
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
}

/**
 * Boot or switch the active stadium experience.
 * @param {string} [stadiumId]
 * @returns {Promise<{ id: string, dispose: () => void }>}
 */
export async function initStadium(stadiumId = DEFAULT_STADIUM_ID) {
  const id = resolveStadiumId(stadiumId);
  const meta = getStadiumMeta(id);
  applyBranding(meta);

  const loader = document.getElementById('loader');
  if (loader) loader.classList.remove('hide');

  // serialize switches
  const run = (async () => {
    if (active?.dispose) {
      try {
        active.dispose();
      } catch (err) {
        console.warn('Stadium dispose failed', err);
      }
      active = null;
    }

    const loaderFn = STADIUM_LOADERS[id];
    if (!loaderFn) throw new Error(`Unknown stadium: ${id}`);
    const mod = await loaderFn();
    const handle = mod.createStadium({ meta: { ...meta, ...mod.stadiumMeta } });
    active = handle;
    try {
      localStorage.setItem('stadiumId', id);
    } catch (_) {}
    return handle;
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
