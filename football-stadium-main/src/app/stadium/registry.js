/**
 * Stadium catalog — add a new stadium here after creating its engine file.
 *
 * Steps to add a stadium:
 * 1. Create `src/app/stadium/stadiums/<id>.engine.js`
 * 2. Export `stadiumMeta` and `createStadium(opts)`
 * 3. Register it in STADIUM_LOADERS below
 */

/** @typedef {{
 *   id: string,
 *   name: string,
 *   shortName?: string,
 *   location: string,
 *   subtitle?: string,
 *   loaderText?: string,
 *   draft?: boolean
 * }} StadiumMeta */

/** @type {Record<string, () => Promise<{ stadiumMeta: StadiumMeta, createStadium: Function }>>} */
export const STADIUM_LOADERS = {
  misr: () => import('./stadiums/misr.engine.js'),
  cairo: () => import('./stadiums/cairo.engine.js'),
};

const STADIUM_ROUTE_SLUGS = {
  misr: 'NewAdministrativeCapital',
  cairo: 'cairo',
};

/** Static catalog used by the UI before modules load */
export const STADIUM_CATALOG = [
  {
    id: 'misr',
    name: 'Misr Stadium',
    shortName: 'Misr',
    location: 'New Administrative Capital',
    subtitle: 'Stadium View',
    seats: true,
  },
  {
    id: 'cairo',
    name: 'Cairo International Stadium',
    shortName: 'Cairo',
    location: 'Nasr City, Cairo',
    subtitle: 'Stadium View',
    seats: true,
    teams: { home: 'AL AHLY', away: 'ZAMALEK' },
    flagHome: 'ahly',
    flagAway: 'zam',
    matchLabel: 'Cairo Derby · Day',
  },
];

export const DEFAULT_STADIUM_ID = 'cairo';

export function getStadiumMeta(id) {
  return (
    STADIUM_CATALOG.find((s) => s.id === id) ||
    STADIUM_CATALOG.find((s) => s.id === DEFAULT_STADIUM_ID)
  );
}

export function resolveStadiumId(raw) {
  const id = (raw || '').toString().trim().toLowerCase();
  if (id === 'newadministrativecapital') return 'misr';
  if (id && STADIUM_LOADERS[id]) return id;
  return DEFAULT_STADIUM_ID;
}

export function stadiumRouteSlug(id) {
  return STADIUM_ROUTE_SLUGS[resolveStadiumId(id)];
}

/** The other stadium in the Misr ↔ Cairo pair */
export function otherStadiumId(id) {
  return resolveStadiumId(id) === 'cairo' ? 'misr' : 'cairo';
}
