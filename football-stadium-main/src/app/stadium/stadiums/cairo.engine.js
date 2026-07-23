import * as THREE from 'three';
import gsap from 'gsap';
import { createMatchPlay } from '../shared/match-play.js';

/**
 * Cairo International Stadium — open-air Olympic oval
 * Visual target: Genius&Gerry Cairo International Stadium 3D model
 * https://geniusandgerry.com/products/cairo-international-stadium-egypt-3d-model
 */

export const stadiumMeta = {
  id: 'cairo',
  name: 'Cairo International Stadium',
  shortName: 'Cairo',
  location: 'Nasr City, Cairo',
  subtitle: 'Stadium View',
  loaderText: 'Loading Cairo International Stadium…',
  seats: true,
  teams: { home: 'AL AHLY', away: 'ZAMALEK' },
  flagHome: 'ahly',
  flagAway: 'zam',
  matchLabel: 'Cairo Derby · Day',
};

const TAU = Math.PI * 2;

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTexture(w, h, draw, repX = 1, repY = 1) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.encoding = THREE.sRGBEncoding;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repX, repY);
  t.anisotropy = 4;
  return t;
}

function ellipsePoint(rx, rz, a) {
  return [rx * Math.cos(a), rz * Math.sin(a)];
}

function ringStrip(rx1, rz1, y1, rx2, rz2, y2, seg, mat, repU = 1) {
  const pos = [],
    uv = [],
    idx = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * TAU;
    const c = Math.cos(a),
      s = Math.sin(a);
    pos.push(rx1 * c, y1, rz1 * s, rx2 * c, y2, rz2 * s);
    uv.push((i / seg) * repU, 0, (i / seg) * repU, 1);
  }
  for (let i = 0; i < seg; i++) {
    const k = i * 2;
    idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

function mergeBoxes(parts) {
  let pos = [],
    norm = [];
  for (const g of parts) {
    const gg = g.index ? g.toNonIndexed() : g;
    pos.push(...gg.attributes.position.array);
    norm.push(...gg.attributes.normal.array);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  return out;
}

/**
 * @param {{ meta?: typeof stadiumMeta }} [opts]
 */
export function createStadium(opts = {}) {
  const metaInfo = { ...stadiumMeta, ...(opts.meta || {}) };
  const rng = mulberry32(19600123);
  const disposers = [];
  let disposed = false;
  let rafId = 0;
  const on = (target, type, fn, options) => {
    target.addEventListener(type, fn, options);
    disposers.push(() => target.removeEventListener(type, fn, options));
  };

  const loader = document.getElementById('loader');
  const loaderText = document.getElementById('loader-text');
  if (loader) loader.classList.remove('hide');
  if (loaderText) {
    loaderText.textContent =
      metaInfo.loaderText || `Loading ${metaInfo.name}…`;
  }

  const canvas = document.getElementById('c');
  if (!canvas) throw new Error('Stadium canvas #c not found');
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.shadowMap.enabled = false;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  // Deep dusk-blue sky (not orange sunset)
  scene.background = new THREE.Color(0x0c1828);
  scene.fog = new THREE.Fog(0x1a3048, 420, 1050);

  const camera = new THREE.PerspectiveCamera(
    46,
    innerWidth / innerHeight,
    0.4,
    1400,
  );

  /* ---------- dusk-blue lights ---------- */
  scene.add(new THREE.HemisphereLight(0x6a90c8, 0x2a3038, 0.58));
  scene.add(new THREE.AmbientLight(0x4a6080, 0.34));
  const sun = new THREE.DirectionalLight(0xc8d8f0, 0.72);
  sun.position.set(140, 90, 70);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x4868a0, 0.28);
  fill.position.set(-100, 60, -80);
  scene.add(fill);
  const floodTargets = new THREE.Object3D();
  floodTargets.position.set(0, 2, 0);
  scene.add(floodTargets);
  const fieldGlow = new THREE.PointLight(0xffe8c0, 0.28, 180, 2);
  fieldGlow.position.set(0, 22, 0);
  scene.add(fieldGlow);

  // Deep blue sky dome
  {
    const skyTex = canvasTexture(32, 256, (x, w, h) => {
      const g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#060e1a');
      g.addColorStop(0.4, '#0c1a30');
      g.addColorStop(0.72, '#1a3458');
      g.addColorStop(0.9, '#2a4a70');
      g.addColorStop(1, '#3a5a80');
      x.fillStyle = g;
      x.fillRect(0, 0, w, h);
    });
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(820, 24, 16, 0, TAU, 0, Math.PI / 1.85),
      new THREE.MeshBasicMaterial({
        map: skyTex,
        side: THREE.BackSide,
        fog: false,
      }),
    );
    dome.position.y = -40;
    scene.add(dome);
  }

  const concrete = new THREE.MeshLambertMaterial({ color: 0xc5cbd4 });
  const concreteDark = new THREE.MeshLambertMaterial({ color: 0xa8b0bc });
  const stone = new THREE.MeshLambertMaterial({ color: 0xc4b89a });
  const stoneDark = new THREE.MeshLambertMaterial({ color: 0xb5a888 });
  const beige = new THREE.MeshLambertMaterial({ color: 0xd4b07a });
  const beigeDark = new THREE.MeshLambertMaterial({ color: 0xb89258 });
  const steel = new THREE.MeshLambertMaterial({ color: 0xc8d0da });
  const whiteBuild = new THREE.MeshLambertMaterial({ color: 0xeef2f6 });

  const FIELD = { L: 105, W: 68 };
  /* Oval track fully outside the pitch (same clearances as Misr) */
  const TRACK = {
    inRx: 74.5,
    inRz: 56.4,
    outRx: 85.5,
    outRz: 64.7,
  };
  const GOAL_LINE = FIELD.L / 2 - 0.35;
  const animatedTextures = [];
  const swayU = { value: 0 };
  const exciteU = { value: 1 };
  const steelDark = new THREE.MeshLambertMaterial({ color: 0x6a7382 });
  /* Bowl: lower deck larger; upper smaller with a short mid gap */
  const BOWL = {
    inRx: 90,
    inRz: 68,
    midRx: 120,
    midRz: 94,
    /* upper deck set back slightly, modest height gap */
    upInRx: 125,
    upInRz: 98,
    outRx: 156,
    outRz: 124,
    y0: 1.4,
    midY: 16.5, // taller lower tier
    upY0: 19.4, // ~2.9 m gap (was ~7.5)
    y1: 32.5, // shorter upper deck
  };

  /* Wide flared exterior base — shared by shell, apron, floodlights */
  const EXT = (() => {
    const slopeH = BOWL.y1 + 0.8;
    // ≈48° from horizontal → base much wider than rim
    const slopeRun = slopeH * 1.12;
    const skirt = 10;
    return {
      slopeH,
      slopeRun,
      skirt,
      baseRx: BOWL.outRx + slopeRun,
      baseRz: BOWL.outRz + slopeRun * 0.82,
      footRx: BOWL.outRx + slopeRun + skirt,
      footRz: BOWL.outRz + slopeRun * 0.82 + skirt * 0.8,
      // t=0 at rim, t=1 at ground
      at(t) {
        const u = THREE.MathUtils.clamp(t, 0, 1);
        return {
          rx: BOWL.outRx + slopeRun * u,
          rz: BOWL.outRz + slopeRun * 0.82 * u,
          y: slopeH * (1 - u) + 0.08,
        };
      },
    };
  })();

  /* ---------- surroundings (dusk blue sky + medium gray ground) ---------- */
  {
    // Medium gray ground — readable under dusk blue
    const gt = canvasTexture(512, 512, (x) => {
      const g = x.createRadialGradient(256, 256, 40, 256, 256, 256);
      g.addColorStop(0, '#4a4e58');
      g.addColorStop(0.55, '#3a3e48');
      g.addColorStop(1, '#2c3038');
      x.fillStyle = g;
      x.fillRect(0, 0, 512, 512);
    });
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(600, 64),
      new THREE.MeshBasicMaterial({ map: gt }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.25;
    scene.add(ground);

    // Cool blue rim at exterior foot
    scene.add(
      ringStrip(
        EXT.footRx - 2,
        EXT.footRz - 2,
        0.1,
        EXT.footRx + 4,
        EXT.footRz + 4,
        0.1,
        128,
        new THREE.MeshBasicMaterial({
          color: 0x2a6ec8,
          transparent: true,
          opacity: 0.4,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      ),
    );

    // Service apron + ring road
    const padMat = new THREE.MeshBasicMaterial({
      color: 0x3e4450,
      side: THREE.DoubleSide,
    });
    const roadMat = new THREE.MeshBasicMaterial({
      color: 0x323840,
      side: THREE.DoubleSide,
    });
    scene.add(
      ringStrip(
        EXT.footRx + 2,
        EXT.footRz + 2,
        -0.12,
        EXT.footRx + 18,
        EXT.footRz + 14,
        -0.12,
        140,
        padMat,
        1,
      ),
    );
    scene.add(
      ringStrip(
        EXT.footRx + 18,
        EXT.footRz + 14,
        -0.08,
        EXT.footRx + 40,
        EXT.footRz + 32,
        -0.08,
        160,
        roadMat,
        1,
      ),
    );
    scene.add(
      ringStrip(
        EXT.footRx + 28,
        EXT.footRz + 22,
        -0.04,
        EXT.footRx + 29.2,
        EXT.footRz + 23,
        -0.04,
        160,
        new THREE.MeshBasicMaterial({
          color: 0x8a9098,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.55,
        }),
        1,
      ),
    );

    // Front plaza (+Z)
    const plazaZ = EXT.footRz + 48;
    const plaza = new THREE.Mesh(
      new THREE.CircleGeometry(62, 80),
      new THREE.MeshBasicMaterial({ color: 0x404650 }),
    );
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(0, -0.12, plazaZ);
    scene.add(plaza);
    for (let r = 14; r <= 54; r += 8) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(r - 0.55, r, 80),
        new THREE.MeshBasicMaterial({
          color: 0x2a6ec8,
          transparent: true,
          opacity: 0.16,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(0, -0.06, plazaZ);
      scene.add(ring);
    }
    const lawnMat = new THREE.MeshLambertMaterial({
      color: 0x1a8a2e,
      side: THREE.DoubleSide,
    });
    const lawnDark = new THREE.MeshLambertMaterial({
      color: 0x146e24,
      side: THREE.DoubleSide,
    });
    const lawnLite = new THREE.MeshLambertMaterial({ color: 0x22a038 });
    // Full-circle plaza lawn wedges (both halves)
    for (let i = 0; i < 20; i++) {
      const a0 = (i / 20) * TAU;
      const bed = new THREE.Mesh(
        new THREE.RingGeometry(18, 42, 48, 1, a0, TAU / 20 - 0.06),
        i % 2 ? lawnMat : lawnLite,
      );
      bed.rotation.x = -Math.PI / 2;
      bed.position.set(0, 0.02, plazaZ);
      scene.add(bed);
    }
    // Inner plaza green disc
    const plazaGreen = new THREE.Mesh(
      new THREE.RingGeometry(10, 16, 48),
      lawnDark,
    );
    plazaGreen.rotation.x = -Math.PI / 2;
    plazaGreen.position.set(0, 0.03, plazaZ);
    scene.add(plazaGreen);
    const center = new THREE.Mesh(
      new THREE.CircleGeometry(9, 40),
      new THREE.MeshBasicMaterial({ color: 0x3a3e48 }),
    );
    center.rotation.x = -Math.PI / 2;
    center.position.set(0, -0.04, plazaZ);
    scene.add(center);

    const trunk = new THREE.MeshLambertMaterial({ color: 0x5a3a1e });
    const leaf = new THREE.MeshLambertMaterial({ color: 0x168a28 });
    const leafDeep = new THREE.MeshLambertMaterial({ color: 0x0e6a1c });
    const bush = new THREE.MeshLambertMaterial({ color: 0x1a7a28 });
    const hedge = new THREE.MeshLambertMaterial({ color: 0x147028 });

    const addTree = (x, z, s = 1, kind = 0) => {
      const tr = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16 * s, 0.24 * s, (kind === 1 ? 5.2 : 3.6) * s, 6),
        trunk,
      );
      tr.position.set(x, (kind === 1 ? 2.6 : 1.8) * s, z);
      scene.add(tr);
      if (kind === 1) {
        // palm-ish layered canopy
        for (let L = 0; L < 3; L++) {
          const cr = new THREE.Mesh(
            new THREE.SphereGeometry((1.1 - L * 0.15) * s, 7, 5),
            L % 2 ? leaf : leafDeep,
          );
          cr.scale.set(1.35, 0.35, 1.35);
          cr.position.set(x, (4.6 + L * 0.55) * s, z);
          scene.add(cr);
        }
      } else {
        const cr = new THREE.Mesh(
          new THREE.SphereGeometry(1.55 * s, 8, 6),
          kind === 2 ? leafDeep : leaf,
        );
        cr.scale.set(1.25, 0.6, 1.25);
        cr.position.set(x, 4.0 * s, z);
        scene.add(cr);
        if (kind === 2) {
          const cr2 = new THREE.Mesh(
            new THREE.SphereGeometry(1.1 * s, 7, 5),
            leaf,
          );
          cr2.scale.set(1.1, 0.5, 1.1);
          cr2.position.set(x + 0.4 * s, 3.4 * s, z - 0.3 * s);
          scene.add(cr2);
        }
      }
    };
    const addBush = (x, z, s = 1) => {
      const b = new THREE.Mesh(
        new THREE.SphereGeometry(0.85 * s, 7, 5),
        hedge,
      );
      b.scale.set(1.3, 0.55, 1.1);
      b.position.set(x, 0.45 * s, z);
      scene.add(b);
    };

    // Full rings of trees around the plaza (complete both halves)
    for (let ring = 0; ring < 3; ring++) {
      const r = 22 + ring * 10;
      const count = 20 + ring * 8;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * TAU + ring * 0.08;
        const x = Math.sin(a) * r;
        const z = plazaZ + Math.cos(a) * r;
        addTree(x, z, 0.8 + (i % 4) * 0.1, (i + ring) % 3);
        if (i % 2 === 0) addBush(Math.sin(a) * (r - 3.5), plazaZ + Math.cos(a) * (r - 3.5), 0.7);
      }
    }

    // Continuous lawn ring around exterior foot
    scene.add(
      ringStrip(
        EXT.footRx + 4,
        EXT.footRz + 3,
        0.02,
        EXT.footRx + 16,
        EXT.footRz + 13,
        0.02,
        160,
        lawnMat,
        1,
      ),
    );
    scene.add(
      ringStrip(
        EXT.footRx + 18,
        EXT.footRz + 15,
        0.02,
        EXT.footRx + 26,
        EXT.footRz + 22,
        0.02,
        140,
        lawnDark,
        1,
      ),
    );

    // Rectangular lawn islands around the ring (denser Genius&Gerry pattern)
    const patchSpecs = [];
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * TAU + 0.05;
      const rr = EXT.footRx + 10 + (i % 4) * 4.5;
      const rz = EXT.footRz + 8 + (i % 4) * 3.5;
      const [x, z] = ellipsePoint(rr, rz, a);
      patchSpecs.push({
        x,
        z,
        a,
        w: 10 + (i % 5) * 2.0,
        d: 7 + (i % 4) * 1.8,
      });
    }
    // Extra plaza-side beds — mirrored both halves
    patchSpecs.push(
      { x: -42, z: plazaZ + 8, a: 0, w: 22, d: 12 },
      { x: 42, z: plazaZ + 8, a: 0, w: 22, d: 12 },
      { x: -42, z: plazaZ - 8, a: 0, w: 22, d: 12 },
      { x: 42, z: plazaZ - 8, a: 0, w: 22, d: 12 },
      { x: -58, z: plazaZ - 12, a: 0.12, w: 16, d: 11 },
      { x: 58, z: plazaZ - 12, a: -0.12, w: 16, d: 11 },
      { x: -58, z: plazaZ + 12, a: -0.12, w: 16, d: 11 },
      { x: 58, z: plazaZ + 12, a: 0.12, w: 16, d: 11 },
      { x: -70, z: plazaZ + 2, a: 0.08, w: 14, d: 10 },
      { x: 70, z: plazaZ + 2, a: -0.08, w: 14, d: 10 },
      { x: -70, z: plazaZ - 18, a: 0.08, w: 14, d: 10 },
      { x: 70, z: plazaZ - 18, a: -0.08, w: 14, d: 10 },
      { x: -30, z: plazaZ + 22, a: 0, w: 16, d: 9 },
      { x: 30, z: plazaZ + 22, a: 0, w: 16, d: 9 },
      { x: -30, z: plazaZ - 26, a: 0, w: 16, d: 9 },
      { x: 30, z: plazaZ - 26, a: 0, w: 16, d: 9 },
      { x: 0, z: plazaZ + 28, a: 0, w: 24, d: 10 },
      { x: 0, z: plazaZ - 30, a: 0, w: 24, d: 10 },
      { x: -18, z: plazaZ, a: 0.4, w: 12, d: 8 },
      { x: 18, z: plazaZ, a: -0.4, w: 12, d: 8 },
    );
    patchSpecs.forEach((p, i) => {
      const patch = new THREE.Mesh(
        new THREE.BoxGeometry(p.w, 0.14, p.d),
        i % 2 ? bush : lawnLite,
      );
      patch.position.set(p.x, 0.0, p.z);
      patch.rotation.y = -p.a;
      scene.add(patch);
      const n = 3 + (i % 4);
      for (let t = 0; t < n; t++) {
        const ox = (t - (n - 1) / 2) * (p.w / (n + 0.35));
        const oz = ((t % 2) - 0.5) * (p.d * 0.28);
        const ca = Math.cos(-p.a),
          sa = Math.sin(-p.a);
        const tx = p.x + ca * ox - sa * oz;
        const tz = p.z + sa * ox + ca * oz;
        addTree(tx, tz, 0.75 + (t % 4) * 0.12, t % 3);
        if (t % 2 === 0) addBush(tx + 1.2, tz - 0.8, 0.65);
      }
    });

    // Double tree ring along apron + outer road
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * TAU;
      const [x0, z0] = ellipsePoint(EXT.footRx + 6, EXT.footRz + 5, a);
      addTree(x0, z0, 0.72 + (i % 5) * 0.08, i % 3);
      if (i % 2 === 0) {
        const [x1, z1] = ellipsePoint(EXT.footRx + 12, EXT.footRz + 10, a + 0.02);
        addTree(x1, z1, 0.65 + (i % 4) * 0.07, (i + 1) % 3);
      }
      if (i % 3 === 0) {
        const [xb, zb] = ellipsePoint(EXT.footRx + 9, EXT.footRz + 7.5, a + 0.04);
        addBush(xb, zb, 0.7);
      }
    }
    // Outer boulevard tree line
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * TAU + 0.03;
      const [x, z] = ellipsePoint(EXT.footRx + 32, EXT.footRz + 26, a);
      addTree(x, z, 0.9 + (i % 3) * 0.15, i % 2 === 0 ? 1 : 0);
    }

    // Hedge strips flanking entrance / VIP approach — both directions
    [-1, 1].forEach((side) => {
      for (let k = 0; k < 8; k++) {
        const hx = side * (22 + k * 0.15);
        for (const dir of [-1, 1]) {
          const hz = plazaZ + dir * (8 + k * 3.2);
          const strip = new THREE.Mesh(
            new THREE.BoxGeometry(3.2, 1.1, 2.6),
            hedge,
          );
          strip.position.set(hx, 0.55, hz);
          scene.add(strip);
          addTree(hx + side * 2.5, hz, 0.8, 1);
        }
      }
    });

    // Parking lots near plaza (+Z sides) with planted borders
    const carCols = [0xe8ecf0, 0x2a3344, 0xb01020, 0xc8a060, 0x6a7382];
    [-1, 1].forEach((side, si) => {
      const lot = new THREE.Mesh(
        new THREE.BoxGeometry(38, 0.08, 16),
        new THREE.MeshBasicMaterial({ color: 0x383e48 }),
      );
      lot.position.set(side * 72, -0.08, plazaZ - 8);
      scene.add(lot);
      // green border around lot
      const border = new THREE.Mesh(
        new THREE.BoxGeometry(42, 0.16, 20),
        lawnDark,
      );
      border.position.set(side * 72, -0.18, plazaZ - 8);
      scene.add(border);
      for (let t = 0; t < 5; t++) {
        addTree(side * 72 + side * 22, plazaZ - 16 + t * 4, 0.75, t % 2);
        addBush(side * 72 + side * 20, plazaZ - 14 + t * 3.5, 0.8);
      }
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 6; col++) {
          const car = new THREE.Mesh(
            new THREE.BoxGeometry(2.0, 0.7, 3.5),
            new THREE.MeshLambertMaterial({
              color: carCols[(row * 6 + col + si) % carCols.length],
            }),
          );
          car.position.set(
            lot.position.x + (col - 2.5) * 5.0,
            0.35,
            lot.position.z + (row - 0.5) * 5.5,
          );
          scene.add(car);
        }
      }
    });
  }

  /* ---------- pitch + track + goals + dugouts (Misr-quality playground) ---------- */
  {
    const px = 10; // pixels per metre
    const tex = canvasTexture(FIELD.L * px, FIELD.W * px, (x, w, h) => {
      const stripes = 14,
        sw = w / stripes;
      for (let i = 0; i < stripes; i++) {
        x.fillStyle = i % 2 ? '#228a38' : '#1a7430';
        x.fillRect(i * sw, 0, sw + 1, h);
      }
      x.globalAlpha = 0.05;
      for (let i = 0; i < 2600; i++) {
        x.fillStyle = Math.random() > 0.5 ? '#0c3b18' : '#2f9b47';
        x.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
      x.globalAlpha = 1;
      x.globalAlpha = 0.22;
      x.fillStyle = '#5d6b33';
      x.beginPath();
      x.ellipse(w / 2, h / 2, 7.5 * px, 7 * px, 0, 0, TAU);
      x.fill();
      x.globalAlpha = 1;
      const vg = x.createRadialGradient(
        w / 2,
        h / 2,
        h * 0.3,
        w / 2,
        h / 2,
        w * 0.62,
      );
      vg.addColorStop(0, 'rgba(255,255,255,0.05)');
      vg.addColorStop(1, 'rgba(0,0,20,0.32)');
      x.fillStyle = vg;
      x.fillRect(0, 0, w, h);
      x.strokeStyle = 'rgba(245,250,255,.95)';
      x.lineWidth = 2.4;
      const M = 0.35 * px;
      x.strokeRect(M, M, w - 2 * M, h - 2 * M);
      x.beginPath();
      x.moveTo(w / 2, M);
      x.lineTo(w / 2, h - M);
      x.stroke();
      x.beginPath();
      x.arc(w / 2, h / 2, 9.15 * px, 0, TAU);
      x.stroke();
      x.beginPath();
      x.arc(w / 2, h / 2, 3, 0, TAU);
      x.fillStyle = '#f5faff';
      x.fill();
      const box = (side) => {
        const bx = side < 0 ? M : w - M;
        const d1 = 16.5 * px,
          w1 = 40.32 * px,
          d2 = 5.5 * px,
          w2 = 18.32 * px,
          s = side < 0 ? 1 : -1;
        const cy = h / 2;
        x.strokeRect(Math.min(bx, bx + s * d1), cy - w1 / 2, d1, w1);
        x.strokeRect(Math.min(bx, bx + s * d2), cy - w2 / 2, d2, w2);
        const spotX = bx + s * 11 * px;
        x.beginPath();
        x.arc(spotX, cy, 2.6, 0, TAU);
        x.fillStyle = '#f5faff';
        x.fill();
        const r = 9.15 * px;
        const boxEdge = bx + s * d1;
        x.beginPath();
        let pen = false;
        for (let i = 0; i <= 72; i++) {
          const ang = (i / 72) * TAU;
          const px_ = spotX + Math.cos(ang) * r;
          const py_ = cy + Math.sin(ang) * r;
          const outside = s > 0 ? px_ >= boxEdge - 0.75 : px_ <= boxEdge + 0.75;
          if (outside) {
            if (!pen) {
              x.moveTo(px_, py_);
              pen = true;
            } else x.lineTo(px_, py_);
          } else {
            pen = false;
          }
        }
        x.stroke();
      };
      box(-1);
      box(1);
    });
    tex.encoding = THREE.sRGBEncoding;
    const pitch = new THREE.Mesh(
      new THREE.PlaneGeometry(FIELD.L, FIELD.W),
      new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.82,
        metalness: 0,
        emissive: 0x145a28,
        emissiveIntensity: 0.32,
        emissiveMap: tex,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    );
    pitch.rotation.x = -Math.PI / 2;
    pitch.position.y = 0.08;
    pitch.receiveShadow = true;
    pitch.renderOrder = 2;
    scene.add(pitch);

    // dark blue-grey pitch border (reference frame around grass)
    const pitchBorder = new THREE.Mesh(
      new THREE.PlaneGeometry(FIELD.L + 1.1, FIELD.W + 1.1),
      new THREE.MeshLambertMaterial({
        color: 0x2a3544,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    );
    pitchBorder.rotation.x = -Math.PI / 2;
    pitchBorder.position.y = 0.05;
    pitchBorder.renderOrder = 1;
    scene.add(pitchBorder);

    // Dark-blue infield apron between pitch and running track
    // Keep base disk BELOW the pitch (y≈0) so distant cameras don't z-fight
    const apronMat = new THREE.MeshLambertMaterial({
      color: 0x0d2a5c,
      side: THREE.DoubleSide,
    });
    const apronDeep = new THREE.MeshLambertMaterial({
      color: 0x0a224c,
      side: THREE.DoubleSide,
    });
    const apronDisk = new THREE.Mesh(
      new THREE.CircleGeometry(1, 96),
      apronDeep,
    );
    apronDisk.scale.set(TRACK.inRx - 0.2, TRACK.inRz - 0.2, 1);
    apronDisk.rotation.x = -Math.PI / 2;
    apronDisk.position.y = 0;
    apronDisk.receiveShadow = true;
    apronDisk.renderOrder = 0;
    scene.add(apronDisk);
    // Visible ring only outside the pitch rectangle (not under the grass)
    scene.add(
      ringStrip(
        FIELD.L / 2 + 0.7,
        FIELD.W / 2 + 0.7,
        0.04,
        TRACK.inRx,
        TRACK.inRz,
        0.04,
        160,
        apronMat,
        1,
      ),
    );
    // pitchside markers / board pads on dark apron
    const markerMat = new THREE.MeshLambertMaterial({ color: 0x1a4a8c });
    const mkMarker = (x, z, w, d, rot = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), markerMat);
      m.position.set(x, 0.08, z);
      m.rotation.y = rot;
      scene.add(m);
    };
    // along touchlines
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      mkMarker(i * 18, FIELD.W / 2 + 2.4, 8, 1.1, 0);
      mkMarker(i * 18, -(FIELD.W / 2 + 2.4), 8, 1.1, 0);
    }
    // behind goals
    mkMarker(FIELD.L / 2 + 2.8, 12, 1.1, 8, 0);
    mkMarker(FIELD.L / 2 + 2.8, -12, 1.1, 8, 0);
    mkMarker(-(FIELD.L / 2 + 2.8), 12, 1.1, 8, 0);
    mkMarker(-(FIELD.L / 2 + 2.8), -12, 1.1, 8, 0);

    // tartan 8-lane track
    const trackTex = canvasTexture(
      1024,
      160,
      (x, w, h) => {
        const base = x.createLinearGradient(0, 0, 0, h);
        base.addColorStop(0, '#e07038');
        base.addColorStop(0.5, '#d45628');
        base.addColorStop(1, '#c24420');
        x.fillStyle = base;
        x.fillRect(0, 0, w, h);
        x.globalAlpha = 0.08;
        for (let i = 0; i < 1800; i++) {
          x.fillStyle = Math.random() > 0.5 ? '#6a2410' : '#f0a070';
          x.fillRect(Math.random() * w, Math.random() * h, 2, 2);
        }
        x.globalAlpha = 1;
        const lanes = 8;
        for (let i = 0; i <= lanes; i++) {
          const y = (i / lanes) * (h - 1);
          x.strokeStyle =
            i === 0 || i === lanes
              ? 'rgba(255,255,255,0.95)'
              : 'rgba(255,248,240,0.78)';
          x.lineWidth = i === 0 || i === lanes ? 3.2 : 1.6;
          x.beginPath();
          x.moveTo(0, y);
          x.lineTo(w, y);
          x.stroke();
        }
        x.fillStyle = 'rgba(255,255,255,0.55)';
        x.font = '700 18px sans-serif';
        for (let i = 1; i <= lanes; i++) {
          const y = ((i - 0.55) / lanes) * h;
          for (let k = 0; k < 6; k++) {
            x.fillText(String(i), 40 + k * (w / 6), y);
          }
        }
      },
      18,
      1,
    );
    trackTex.encoding = THREE.sRGBEncoding;
    const track = ringStrip(
      TRACK.inRx,
      TRACK.inRz,
      0.045,
      TRACK.outRx,
      TRACK.outRz,
      0.045,
      192,
      new THREE.MeshStandardMaterial({
        map: trackTex,
        roughness: 0.94,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
      1,
    );
    track.receiveShadow = true;
    scene.add(track);

    // dark-blue apron / curbs beside the track (not the orange tartan)
    const apronBlue = new THREE.MeshLambertMaterial({
      color: 0x0d2a5c,
      side: THREE.DoubleSide,
    });
    const apronBlueDeep = new THREE.MeshLambertMaterial({
      color: 0x0a224c,
      side: THREE.DoubleSide,
    });
    scene.add(
      ringStrip(
        TRACK.inRx - 0.35,
        TRACK.inRz - 0.35,
        0.055,
        TRACK.inRx,
        TRACK.inRz,
        0.055,
        160,
        apronBlue,
        40,
      ),
    );
    scene.add(
      ringStrip(
        TRACK.outRx,
        TRACK.outRz,
        0.055,
        TRACK.outRx + 0.45,
        TRACK.outRz + 0.45,
        0.055,
        160,
        apronBlue,
        40,
      ),
    );
    // raised outer walkway lip into the bowl
    scene.add(
      ringStrip(
        TRACK.outRx + 0.45,
        TRACK.outRz + 0.45,
        0.07,
        TRACK.outRx + 1.2,
        TRACK.outRz + 1.0,
        0.55,
        120,
        apronBlueDeep,
        1,
      ),
    );

    // blue jump / event pits on the track straights (Cairo Olympic feature)
    const pitMat = new THREE.MeshLambertMaterial({ color: 0x2a6db8 });
    [
      [0, (TRACK.inRz + TRACK.outRz) / 2, 22, 4.2],
      [0, -(TRACK.inRz + TRACK.outRz) / 2, 22, 4.2],
      [(TRACK.inRx + TRACK.outRx) / 2, 12, 4.2, 14],
      [-(TRACK.inRx + TRACK.outRx) / 2, -12, 4.2, 14],
    ].forEach(([x, z, w, d]) => {
      const pit = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), pitMat);
      pit.position.set(x, 0.1, z);
      scene.add(pit);
    });

    // goals + nets — posts on painted goal line
    const gmat = new THREE.MeshBasicMaterial({ color: 0xf2f6ff });
    const netMat = new THREE.LineBasicMaterial({
      color: 0xe8eef8,
      transparent: true,
      opacity: 0.62,
    });
    function buildNet(gx, dir) {
      const depth = 2.0,
        halfW = 3.66,
        H = 2.44;
      const pos = [];
      const line = (a, b) => {
        pos.push(a[0], a[1], a[2], b[0], b[1], b[2]);
      };
      const backX = gx + dir * depth;
      for (let i = 0; i <= 16; i++) {
        const z = -halfW + (i / 16) * halfW * 2;
        line([backX, 0.03, z], [backX, H, z]);
      }
      for (let j = 0; j <= 10; j++) {
        const y = (j / 10) * H;
        line([backX, y, -halfW], [backX, y, halfW]);
      }
      for (let i = 0; i <= 16; i++) {
        const z = -halfW + (i / 16) * halfW * 2;
        line([gx, H, z], [backX, H, z]);
      }
      for (let k = 1; k <= 6; k++) {
        const xx = gx + dir * depth * (k / 7);
        line([xx, H, -halfW], [xx, H, halfW]);
      }
      [-halfW, halfW].forEach((z) => {
        for (let j = 0; j <= 10; j++) {
          const y = (j / 10) * H;
          line([gx, y, z], [backX, y, z]);
        }
        for (let k = 1; k <= 6; k++) {
          const xx = gx + dir * depth * (k / 7);
          line([xx, 0.03, z], [xx, H, z]);
        }
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      return new THREE.LineSegments(geo, netMat);
    }
    [-1, 1].forEach((s) => {
      const gx = s * GOAL_LINE,
        grp = new THREE.Group();
      const post = (xx, z) => {
        const m = new THREE.Mesh(
          new THREE.CylinderGeometry(0.07, 0.07, 2.44, 6),
          gmat,
        );
        m.position.set(xx, 1.22, z);
        return m;
      };
      grp.add(post(gx, -3.66), post(gx, 3.66));
      const bar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 7.32, 6),
        gmat,
      );
      bar.rotation.x = Math.PI / 2;
      bar.position.set(gx, 2.44, 0);
      grp.add(bar);
      [-3.66, 3.66].forEach((z) => {
        const stay = new THREE.Mesh(
          new THREE.CylinderGeometry(0.035, 0.035, 2.0, 5),
          gmat,
        );
        stay.rotation.z = (s * Math.PI) / 2;
        stay.position.set(gx + s * 1.0, 0.04, z);
        grp.add(stay);
      });
      grp.add(buildNet(gx, s));
      scene.add(grp);
    });

    // Professional dugouts on the near (+Z) touchline — Ahly · Officials · Zamalek
    const dugoutZ = FIELD.W / 2 + 4.2;
    const glassMat = new THREE.MeshLambertMaterial({
      color: 0x9ecae8,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
    });
    const frameMat = new THREE.MeshLambertMaterial({ color: 0x1a2230 });
    const floorMat = new THREE.MeshLambertMaterial({ color: 0x2a3344 });
    const roofMat = new THREE.MeshLambertMaterial({ color: 0xd8e0ea });
    const mkRacingSeat = (x, y, z, yaw, seatCol, restCol) => {
      const g = new THREE.Group();
      const seatM = new THREE.MeshLambertMaterial({ color: seatCol });
      const restM = new THREE.MeshLambertMaterial({ color: restCol });
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.28, 0.38),
        frameMat,
      );
      base.position.set(0, 0.2, 0.02);
      const pan = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.09, 0.52), seatM);
      pan.position.set(0, 0.44, 0.04);
      const cushion = new THREE.Mesh(
        new THREE.BoxGeometry(0.44, 0.05, 0.42),
        seatM,
      );
      cushion.position.set(0, 0.5, 0.05);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.78, 0.09), restM);
      back.position.set(0, 0.84, -0.22);
      back.rotation.x = -0.14;
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 0.18, 0.08),
        restM,
      );
      head.position.set(0, 1.18, -0.28);
      const sideL = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.58, 0.46),
        restM,
      );
      sideL.position.set(-0.26, 0.68, -0.02);
      const sideR = sideL.clone();
      sideR.position.x = 0.26;
      g.add(base, pan, cushion, back, head, sideL, sideR);
      g.position.set(x, y, z);
      g.rotation.y = yaw;
      return g;
    };
    const dugSpecs = [
      {
        cx: -18,
        w: 13.2,
        seats: 9,
        seat: 0x8b1010,
        rest: 0x5a0808,
        plate: 0x6e0000,
        label: 'AL AHLY',
      },
      {
        cx: 0,
        w: 7.2,
        seats: 6,
        seat: 0x1a4f9c,
        rest: 0x0f3370,
        plate: 0x123a6e,
        label: '4TH OFFICIAL',
        solidSides: true,
      },
      {
        cx: 18,
        w: 13.2,
        seats: 9,
        seat: 0xf2f4f8,
        rest: 0xc8ced8,
        plate: 0x1a1a1a,
        label: 'ZAMALEK',
      },
    ];
    dugSpecs.forEach((d) => {
      const grp = new THREE.Group();
      // raised platform + front step
      const floor = new THREE.Mesh(
        new THREE.BoxGeometry(d.w, 0.28, 3.5),
        floorMat,
      );
      floor.position.set(d.cx, 0.14, dugoutZ);
      floor.receiveShadow = true;
      grp.add(floor);
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(d.w - 0.4, 0.12, 0.55),
        new THREE.MeshLambertMaterial({ color: 0x3a4558 }),
      );
      step.position.set(d.cx, 0.06, dugoutZ - 1.85);
      grp.add(step);
      // solid rear wall
      const back = new THREE.Mesh(
        new THREE.BoxGeometry(d.w, 2.35, 0.18),
        frameMat,
      );
      back.position.set(d.cx, 1.3, dugoutZ + 1.55);
      grp.add(back);
      // side walls — solid for officials box, glass+frame for team dugouts
      [-1, 1].forEach((s) => {
        if (d.solidSides) {
          const side = new THREE.Mesh(
            new THREE.BoxGeometry(0.16, 2.2, 3.2),
            new THREE.MeshLambertMaterial({ color: 0x0f2a58 }),
          );
          side.position.set(d.cx + s * (d.w * 0.5 - 0.08), 1.25, dugoutZ);
          grp.add(side);
        } else {
          const sideFrame = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 2.25, 3.15),
            frameMat,
          );
          sideFrame.position.set(d.cx + s * (d.w * 0.5 - 0.06), 1.28, dugoutZ);
          grp.add(sideFrame);
          const sideGlass = new THREE.Mesh(
            new THREE.BoxGeometry(0.05, 1.75, 2.6),
            glassMat,
          );
          sideGlass.position.set(
            d.cx + s * (d.w * 0.5 - 0.14),
            1.35,
            dugoutZ - 0.1,
          );
          grp.add(sideGlass);
        }
        // corner posts
        const post = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 2.35, 0.12),
          frameMat,
        );
        post.position.set(d.cx + s * (d.w * 0.5 - 0.06), 1.3, dugoutZ - 1.45);
        grp.add(post);
      });
      // acrylic front screen + vertical mullions
      const frontG = new THREE.Mesh(
        new THREE.BoxGeometry(d.w - 0.35, 1.45, 0.06),
        glassMat,
      );
      frontG.position.set(d.cx, 1.45, dugoutZ - 1.55);
      grp.add(frontG);
      const mullionN = Math.max(3, Math.round(d.w / 3.2));
      for (let i = 0; i < mullionN; i++) {
        const u = mullionN === 1 ? 0.5 : i / (mullionN - 1);
        const mx = d.cx - (d.w * 0.42) + u * (d.w * 0.84);
        const mull = new THREE.Mesh(
          new THREE.BoxGeometry(0.07, 1.55, 0.07),
          frameMat,
        );
        mull.position.set(mx, 1.45, dugoutZ - 1.55);
        grp.add(mull);
      }
      // opaque sloping roof + edge trim
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(d.w + 0.45, 0.14, 3.7),
        roofMat,
      );
      roof.position.set(d.cx, 2.58, dugoutZ + 0.05);
      roof.rotation.x = -0.12;
      grp.add(roof);
      const roofLip = new THREE.Mesh(
        new THREE.BoxGeometry(d.w + 0.5, 0.08, 0.12),
        frameMat,
      );
      roofLip.position.set(d.cx, 2.48, dugoutZ - 1.7);
      grp.add(roofLip);
      // team / official plate on fascia
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(Math.min(d.w - 1.2, 7.5), 0.42, 0.08),
        new THREE.MeshBasicMaterial({
          color: d.plate,
          toneMapped: false,
        }),
      );
      plate.position.set(d.cx, 2.28, dugoutZ - 1.72);
      grp.add(plate);
      // continuous bench pads under seats for a solid look
      const benchPad = new THREE.Mesh(
        new THREE.BoxGeometry(d.w - 1.0, 0.16, 0.62),
        new THREE.MeshLambertMaterial({ color: d.rest }),
      );
      benchPad.position.set(d.cx, 0.38, dugoutZ + 0.42);
      grp.add(benchPad);
      // racing seats facing pitch
      const span = d.w - 1.5;
      for (let i = 0; i < d.seats; i++) {
        const t = d.seats === 1 ? 0.5 : i / (d.seats - 1);
        const sx = d.cx - span / 2 + t * span;
        grp.add(mkRacingSeat(sx, 0.14, dugoutZ + 0.38, Math.PI, d.seat, d.rest));
      }
      // technical area line
      const tech = new THREE.Mesh(
        new THREE.BoxGeometry(d.w - 0.8, 0.035, 0.07),
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
      );
      tech.position.set(d.cx, 0.03, dugoutZ - 2.25);
      grp.add(tech);
      grp.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      scene.add(grp);
    });
  }

  /* ---------- LED perimeter ad boards (pitchside) ---------- */
  {
    const adTex = canvasTexture(
      2048,
      64,
      (x, w, h) => {
        x.fillStyle = '#04101f';
        x.fillRect(0, 0, w, h);
        x.font = '700 40px ' + getComputedStyle(document.body).fontFamily;
        x.textBaseline = 'middle';
        const words = [
          'STADIVIEW',
          'AL AHLY × ZAMALEK',
          'CAIRO INTERNATIONAL',
          'NASR CITY',
        ];
        let cx = 30;
        for (let i = 0; i < 8; i++) {
          const t = words[i % words.length];
          x.fillStyle = i % 2 ? '#2f9bff' : '#9fd3ff';
          x.fillText(t, cx, h / 2 + 2);
          cx += x.measureText(t).width + 120;
        }
      },
      4,
      1,
    );
    adTex.encoding = THREE.sRGBEncoding;
    animatedTextures.push({ t: adTex, speed: 0.018 });
    const faceMat = new THREE.MeshBasicMaterial({
      map: adTex,
      toneMapped: false,
    });
    const backMat = new THREE.MeshLambertMaterial({ color: 0x0a1220 });
    const mk = (wd, x, z, rotY) => {
      const g = new THREE.Group();
      const face = new THREE.Mesh(new THREE.PlaneGeometry(wd, 1.15), faceMat);
      face.position.z = 0.06;
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(wd, 1.15, 0.12),
        backMat,
      );
      g.add(body);
      g.add(face);
      g.position.set(x, 0.62, z);
      g.rotation.y = rotY;
      scene.add(g);
    };
    const edge = 1.15;
    const zNear = FIELD.W / 2 + edge;
    const zFar = -(FIELD.W / 2 + edge);
    const xEast = GOAL_LINE + 2.35;
    const xWest = -(GOAL_LINE + 2.35);
    mk(FIELD.L + 1.6, 0, zFar, 0);
    mk(22, -40, zNear, Math.PI);
    mk(10, 0, zNear, Math.PI);
    mk(22, 40, zNear, Math.PI);
    mk(FIELD.W + 1.6, xEast, 0, -Math.PI / 2);
    mk(FIELD.W + 1.6, xWest, 0, Math.PI / 2);
  }

  /* ---------- seating bowl: mosaic seats, concrete aisles, crowd ---------- */
  let seatSys = null;
  {
    const ROWS_LOW = 24;
    const ROWS_UP = 14;
    const SECTIONS = 18; // wide concrete stair aisles between blocks
    const SEAT_SPACING = 0.62;
    const AISLE_W = 2.65;
    const seats = [];
    const bluePal = [0x0a2e78, 0x0c3a8a, 0x1558c4, 0x1e6ad8, 0x2478e8, 0x0a2e70];
    const warmPal = [0xff9a12, 0xf07808, 0xffc428, 0xe86800, 0xffb020, 0xf5a010];

    // concrete rake slabs under each tier (not seat-coloured rings)
    const slabMat = new THREE.MeshLambertMaterial({
      color: 0x9aa3b0,
      side: THREE.DoubleSide,
    });
    const slabDark = new THREE.MeshLambertMaterial({
      color: 0x7a8494,
      side: THREE.DoubleSide,
    });
    scene.add(
      ringStrip(
        BOWL.inRx - 0.8,
        BOWL.inRz - 0.6,
        BOWL.y0 - 0.4,
        BOWL.midRx + 0.5,
        BOWL.midRz + 0.4,
        BOWL.midY - 0.1,
        160,
        slabDark,
        1,
      ),
    );
    // upper deck rake — starts ABOVE the mid gap, set back from lower
    scene.add(
      ringStrip(
        BOWL.upInRx,
        BOWL.upInRz,
        BOWL.upY0 - 0.35,
        BOWL.outRx - 2,
        BOWL.outRz - 1.8,
        BOWL.y1 - 0.2,
        160,
        slabMat,
        1,
      ),
    );

    /* ---- mid gap: concourse + tall fascia so upper isn't stuck to lower ---- */
    const fasciaMat = new THREE.MeshLambertMaterial({
      color: 0x0a3a8a,
      side: THREE.DoubleSide,
    });
    const fasciaLite = new THREE.MeshLambertMaterial({
      color: 0x1a62c8,
      side: THREE.DoubleSide,
    });
    // tall vertical face from top of lower to underside of upper
    scene.add(
      ringStrip(
        BOWL.midRx + 0.2,
        BOWL.midRz + 0.15,
        BOWL.midY - 0.2,
        BOWL.midRx + 0.45,
        BOWL.midRz + 0.35,
        BOWL.upY0 - 0.6,
        140,
        fasciaMat,
        1,
      ),
    );
    // secondary blue band (thinner mid divider)
    scene.add(
      ringStrip(
        BOWL.midRx - 0.15,
        BOWL.midRz - 0.1,
        BOWL.midY + 0.1,
        BOWL.midRx + 0.25,
        BOWL.midRz + 0.2,
        BOWL.midY + 1.35,
        140,
        fasciaLite,
        1,
      ),
    );
    // wide light-grey concourse walkway
    scene.add(
      ringStrip(
        BOWL.midRx - 0.8,
        BOWL.midRz - 0.6,
        BOWL.midY,
        BOWL.upInRx - 0.5,
        BOWL.upInRz - 0.4,
        BOWL.midY + 0.28,
        140,
        concrete,
        1,
      ),
    );
    // upper deck soffit / overhang (underside of upper stands)
    scene.add(
      ringStrip(
        BOWL.midRx + 0.3,
        BOWL.midRz + 0.25,
        BOWL.upY0 - 0.85,
        BOWL.upInRx + 0.5,
        BOWL.upInRz + 0.4,
        BOWL.upY0 - 0.55,
        140,
        new THREE.MeshLambertMaterial({
          color: 0xb8c0cc,
          side: THREE.DoubleSide,
        }),
        1,
      ),
    );
    // front lip of upper deck
    scene.add(
      ringStrip(
        BOWL.upInRx - 0.6,
        BOWL.upInRz - 0.5,
        BOWL.upY0 - 0.55,
        BOWL.upInRx - 0.35,
        BOWL.upInRz - 0.25,
        BOWL.upY0 + 0.85,
        140,
        fasciaMat,
        1,
      ),
    );

    // dark-blue paved buffer between track outer curb and first row
    scene.add(
      ringStrip(
        TRACK.outRx + 0.5,
        TRACK.outRz + 0.4,
        0.02,
        BOWL.inRx - 0.8,
        BOWL.inRz - 0.6,
        0.02,
        140,
        new THREE.MeshLambertMaterial({
          color: 0x0d2a5c,
          side: THREE.DoubleSide,
        }),
        1,
      ),
    );

    // base parapet wall between track and first row
    scene.add(
      ringStrip(
        TRACK.outRx + 1.4,
        TRACK.outRz + 1.2,
        0.05,
        BOWL.inRx - 0.4,
        BOWL.inRz - 0.3,
        BOWL.y0 - 0.15,
        140,
        new THREE.MeshLambertMaterial({
          color: 0x0a224c,
          side: THREE.DoubleSide,
        }),
        1,
      ),
    );
    // blue mesh fence along front of stands
    const fenceMat = new THREE.MeshLambertMaterial({
      color: 0x1a4a9c,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    });
    scene.add(
      ringStrip(
        BOWL.inRx - 1.6,
        BOWL.inRz - 1.3,
        BOWL.y0 - 0.2,
        BOWL.inRx - 1.45,
        BOWL.inRz - 1.15,
        BOWL.y0 + 1.35,
        160,
        fenceMat,
        1,
      ),
    );

    // top rim blue glass / screen fence
    scene.add(
      ringStrip(
        BOWL.outRx - 3.5,
        BOWL.outRz - 2.8,
        BOWL.y1,
        BOWL.outRx - 3.2,
        BOWL.outRz - 2.5,
        BOWL.y1 + 3.2,
        140,
        new THREE.MeshLambertMaterial({
          color: 0x3a6eb8,
          transparent: true,
          opacity: 0.42,
          side: THREE.DoubleSide,
        }),
        1,
      ),
    );

    /** Cairo mosaic: yellow dense at bottom of lower tier, fades to blue;
     *  main-stand centre (+Z) more solid blue; upper tier mostly blue. */
    function seatColor(tier, rowT, angle, sec) {
      const onMain = Math.cos(angle - Math.PI / 2) > 0.55; // +Z main stand
      const onEnd = Math.abs(Math.cos(angle)) > 0.7; // ±X curves
      let warmP = 0;
      if (tier === 0) {
        // bottom rows warm, fade upward
        warmP = Math.pow(1 - rowT, 1.55) * (onMain ? 0.22 : onEnd ? 0.92 : 0.72);
        if (rowT < 0.12) warmP = Math.max(warmP, onMain ? 0.35 : 0.85);
        if (onMain && rowT > 0.35) warmP *= 0.25; // central lower = blue
      } else {
        warmP = Math.pow(1 - rowT, 2.2) * 0.14;
        if (onEnd && rowT < 0.25) warmP += 0.08;
      }
      // aisle-adjacent slight warm speckles
      if (sec % 3 === 0 && rng() < 0.06) warmP += 0.1;
      const useWarm = rng() < THREE.MathUtils.clamp(warmP, 0, 0.95);
      const pal = useWarm ? warmPal : bluePal;
      const c = new THREE.Color(pal[(rng() * pal.length) | 0]);
      c.offsetHSL(0, (rng() - 0.5) * 0.04, (rng() - 0.5) * 0.06);
      return c.getHex();
    }

    const placeTier = (rows, y0, y1, rIn, rOut, rzIn, rzOut, tier) => {
      for (let r = 0; r < rows; r++) {
        const t = r / Math.max(1, rows - 1);
        const rx = rIn + (rOut - rIn) * t;
        const rz = rzIn + (rzOut - rzIn) * t;
        const y = y0 + (y1 - y0) * t;
        const h = Math.pow((rx - rz) / (rx + rz), 2);
        const circ =
          Math.PI *
          (rx + rz) *
          (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
        const secLen = circ / SECTIONS;
        const usable = Math.max(2, secLen - AISLE_W);
        const nPer = Math.max(4, Math.floor(usable / SEAT_SPACING));
        for (let s = 0; s < SECTIONS; s++) {
          const a0 = (s / SECTIONS) * TAU;
          const a1 = ((s + 1) / SECTIONS) * TAU;
          const gap = (AISLE_W / circ) * TAU * 0.5;
          for (let i = 0; i < nPer; i++) {
            const u = (i + 0.5) / nPer;
            const a = a0 + gap + u * (a1 - a0 - 2 * gap);
            const [x, z] = ellipsePoint(rx, rz, a);
            seats.push({
              x,
              y,
              z,
              a,
              // Face the pitch (local +Z toward center) — same as Misr
              yaw: Math.atan2(-x, -z),
              color: seatColor(tier, t, a, s),
              tier,
              row: r + 1,
              seat: i + 1,
              sec: s,
              label: (tier === 0 ? 101 : 201) + s,
              occ: true, // every seat filled — complete crowd
            });
          }
        }
      }
    };

    placeTier(
      ROWS_LOW,
      BOWL.y0 + 0.55,
      BOWL.midY - 0.55,
      BOWL.inRx + 0.6,
      BOWL.midRx - 1.5,
      BOWL.inRz + 0.5,
      BOWL.midRz - 1.2,
      0,
    );
    // upper deck begins clearly ABOVE the lower (upY0), set back (upInRx)
    placeTier(
      ROWS_UP,
      BOWL.upY0 + 0.35,
      BOWL.y1 - 1.4,
      BOWL.upInRx + 0.8,
      BOWL.outRx - 5,
      BOWL.upInRz + 0.6,
      BOWL.outRz - 4,
      1,
    );

    // Stepped radial aisles (one tread per row) — no long diagonal ramps
    {
      const aisleMat = new THREE.MeshLambertMaterial({ color: 0xe8ecf2 });
      const noseMat = new THREE.MeshLambertMaterial({ color: 0xd4dae4 });
      const placeStairs = (rows, y0, y1, rIn, rOut, rzIn, rzOut) => {
        const count = SECTIONS * rows;
        const drx = (rOut - rIn) / Math.max(1, rows - 1);
        const drz = (rzOut - rzIn) / Math.max(1, rows - 1);
        const treadZ = Math.max(0.58, Math.hypot(drx, drz) * 0.96);
        const treadGeo = new THREE.BoxGeometry(AISLE_W * 0.92, 0.14, treadZ);
        treadGeo.translate(0, 0.07, 0);
        const noseGeo = new THREE.BoxGeometry(AISLE_W * 0.94, 0.05, 0.1);
        noseGeo.translate(0, 0.145, treadZ * 0.5 - 0.05);
        const treadMesh = new THREE.InstancedMesh(treadGeo, aisleMat, count);
        const noseMesh = new THREE.InstancedMesh(noseGeo, noseMat, count);
        treadMesh.frustumCulled = false;
        noseMesh.frustumCulled = false;
        const dm = new THREE.Object3D();
        let ai = 0;
        for (let s = 0; s < SECTIONS; s++) {
          const a = (s / SECTIONS) * TAU;
          for (let r = 0; r < rows; r++) {
            const t = rows <= 1 ? 0 : r / (rows - 1);
            const rx = rIn + (rOut - rIn) * t;
            const rz = rzIn + (rzOut - rzIn) * t;
            const y = y0 + (y1 - y0) * t;
            const [x, z] = ellipsePoint(rx, rz, a);
            // Face pitch so tread depth follows the rake
            const yaw = Math.atan2(-x, -z);
            dm.position.set(x, y + 0.02, z);
            dm.rotation.set(0, yaw, 0);
            dm.scale.set(1, 1, 1);
            dm.updateMatrix();
            treadMesh.setMatrixAt(ai, dm.matrix);
            noseMesh.setMatrixAt(ai, dm.matrix);
            ai++;
          }
        }
        treadMesh.instanceMatrix.needsUpdate = true;
        noseMesh.instanceMatrix.needsUpdate = true;
        scene.add(treadMesh);
        scene.add(noseMesh);
      };

      // Same rake as seat rows so the path sits in the clear aisle corridor
      placeStairs(
        ROWS_LOW,
        BOWL.y0 + 0.55,
        BOWL.midY - 0.55,
        BOWL.inRx + 0.6,
        BOWL.midRx - 1.5,
        BOWL.inRz + 0.5,
        BOWL.midRz - 1.2,
      );
      placeStairs(
        ROWS_UP,
        BOWL.upY0 + 0.35,
        BOWL.y1 - 1.4,
        BOWL.upInRx + 0.8,
        BOWL.outRx - 5,
        BOWL.upInRz + 0.6,
        BOWL.outRz - 4,
      );

      // Concourse landing pads where lower aisles meet the mid walkway
      for (let s = 0; s < SECTIONS; s++) {
        const a = (s / SECTIONS) * TAU;
        const [x, z] = ellipsePoint(BOWL.midRx - 0.2, BOWL.midRz - 0.15, a);
        const pad = new THREE.Mesh(
          new THREE.BoxGeometry(AISLE_W * 1.05, 0.12, 2.4),
          aisleMat,
        );
        pad.position.set(x, BOWL.midY + 0.08, z);
        pad.rotation.y = Math.atan2(-x, -z);
        scene.add(pad);
      }
    }

    // plastic stadium seat geo (pan + backrest)
    const seatGeo = (() => {
      const pan = new THREE.BoxGeometry(0.5, 0.06, 0.46);
      pan.translate(0, 0.4, 0.04);
      const cushion = new THREE.BoxGeometry(0.46, 0.04, 0.4);
      cushion.translate(0, 0.44, 0.05);
      const back = new THREE.BoxGeometry(0.5, 0.5, 0.07);
      back.rotateX(-0.12);
      back.translate(0, 0.66, -0.2);
      const ped = new THREE.BoxGeometry(0.28, 0.32, 0.24);
      ped.translate(0, 0.16, 0.02);
      return mergeBoxes([pan, cushion, back, ped]);
    })();
    const seatMat = new THREE.MeshPhongMaterial({
      shininess: 42,
      specular: 0x3a4558,
    });
    const seatMesh = new THREE.InstancedMesh(seatGeo, seatMat, seats.length);
    seatMesh.frustumCulled = false;
    const dm = new THREE.Object3D();
    const col = new THREE.Color();
    const baseColors = new Float32Array(seats.length * 3);
    const SEAT_COUNT = seats.length;
    const meta = {
      pos: new Float32Array(SEAT_COUNT * 3),
      yaw: new Float32Array(SEAT_COUNT),
      row: new Uint8Array(SEAT_COUNT),
      seatNum: new Uint16Array(SEAT_COUNT),
      secIdx: new Uint16Array(SEAT_COUNT),
      avail: new Uint8Array(SEAT_COUNT),
      tier: new Uint8Array(SEAT_COUNT),
      label: new Uint16Array(SEAT_COUNT),
    };
    const pickGeo = new THREE.BoxGeometry(0.56, 1.05, 0.5);
    pickGeo.translate(0, 0.52, 0);
    const pickColAttr = new THREE.InstancedBufferAttribute(
      new Float32Array(SEAT_COUNT * 3),
      3,
    );
    pickGeo.setAttribute('pickColor', pickColAttr);
    const pickMesh = new THREE.InstancedMesh(
      pickGeo,
      new THREE.ShaderMaterial({
        vertexShader:
          'attribute vec3 pickColor; varying vec3 vP;\n' +
          'void main(){ vP=pickColor; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position,1.0); }',
        fragmentShader:
          'varying vec3 vP; void main(){ gl_FragColor=vec4(vP,1.0); }',
      }),
      SEAT_COUNT,
    );
    pickMesh.frustumCulled = false;

    seats.forEach((s, i) => {
      dm.position.set(s.x, s.y, s.z);
      dm.rotation.set(0, s.yaw, 0);
      dm.updateMatrix();
      seatMesh.setMatrixAt(i, dm.matrix);
      pickMesh.setMatrixAt(i, dm.matrix);
      col.setHex(s.color);
      seatMesh.setColorAt(i, col);
      baseColors[i * 3] = col.r;
      baseColors[i * 3 + 1] = col.g;
      baseColors[i * 3 + 2] = col.b;
      meta.pos[i * 3] = s.x;
      meta.pos[i * 3 + 1] = s.y;
      meta.pos[i * 3 + 2] = s.z;
      meta.yaw[i] = s.yaw;
      meta.row[i] = s.row;
      meta.seatNum[i] = s.seat;
      meta.secIdx[i] = s.sec + s.tier * SECTIONS;
      meta.avail[i] = s.occ ? 0 : 1; // occupied by fan = unavailable to preview? Misr: avail means free to book. For preview, occupied seats should still allow view OR we pick free seats. Misr: click taken seat finds nearest free. Free seats = avail. Fans sit on !avail. So avail = !occ
      meta.tier[i] = s.tier;
      meta.label[i] = s.label;
      const id = i + 1;
      pickColAttr.setXYZ(i, ((id >> 16) & 255) / 255, ((id >> 8) & 255) / 255, (id & 255) / 255);
    });
    seatMesh.instanceMatrix.needsUpdate = true;
    if (seatMesh.instanceColor) seatMesh.instanceColor.needsUpdate = true;
    pickMesh.instanceMatrix.needsUpdate = true;
    pickColAttr.needsUpdate = true;
    scene.add(seatMesh);

    const pickScene = new THREE.Scene();
    pickScene.add(pickMesh);

    // hoist for camera / picking
    seatSys = {
      seatMesh,
      pickScene,
      meta,
      baseColors,
      SEAT_COUNT,
      SECTIONS,
      tierName: (t) => (t === 0 ? 'Lower Tier' : 'Upper Tier'),
    };

    /* ---------- seated crowd (Ahly / Zamalek halves) ---------- */
    const occupied = seats.filter((s) => s.occ);
    const N = occupied.length;
    const bodyGeo = (() => {
      const torso = new THREE.BoxGeometry(0.36, 0.46, 0.24);
      torso.translate(0, 0.78, -0.04);
      const chest = new THREE.BoxGeometry(0.32, 0.16, 0.26);
      chest.translate(0, 0.92, -0.02);
      return mergeBoxes([torso, chest]);
    })();
    const armsGeo = (() => {
      const L = new THREE.BoxGeometry(0.11, 0.34, 0.13);
      L.translate(-0.26, 0.72, 0.02);
      const R = new THREE.BoxGeometry(0.11, 0.34, 0.13);
      R.translate(0.26, 0.72, 0.02);
      return mergeBoxes([L, R]);
    })();
    const legsGeo = (() => {
      const shorts = new THREE.BoxGeometry(0.34, 0.18, 0.28);
      shorts.translate(0, 0.52, 0.05);
      const thighL = new THREE.BoxGeometry(0.13, 0.26, 0.26);
      thighL.translate(-0.09, 0.38, 0.12);
      const thighR = new THREE.BoxGeometry(0.13, 0.26, 0.26);
      thighR.translate(0.09, 0.38, 0.12);
      return mergeBoxes([shorts, thighL, thighR]);
    })();
    const headGeo = new THREE.SphereGeometry(0.12, 7, 5);
    headGeo.translate(0, 1.12, -0.02);
    const hairGeo = new THREE.SphereGeometry(
      0.124,
      7,
      4,
      0,
      TAU,
      0,
      Math.PI / 2.05,
    );
    hairGeo.translate(0, 1.14, -0.02);

    const ahlyShirts = ['#4a0000', '#5c0000', '#3a0000', '#6e0000', '#2e0000'];
    const zamShirts = ['#ffffff', '#fafafa', '#f5f5f5', '#ffffff', '#f0f0f0'];
    const skinTones = [
      '#8d5a3b',
      '#c98d63',
      '#eac1a4',
      '#6b4226',
      '#a5714b',
      '#d4a574',
    ];
    const hairTones = ['#171310', '#2b1c10', '#4a3520', '#0d0d0d', '#1a120c'];
    // Ahly: white shorts · Zamalek: black shorts
    const ahlyShorts = ['#f2f4f8', '#ffffff', '#e8ecf2'];
    const zamShorts = ['#141414', '#1a1a1a', '#0d0d0d'];

    function swayify(mat, amp) {
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = swayU;
        sh.uniforms.uExcite = exciteU;
        sh.vertexShader =
          'uniform float uTime; uniform float uExcite;\n' +
          sh.vertexShader.replace(
            '#include <begin_vertex>',
            [
              '#include <begin_vertex>',
              'float swPh = instanceMatrix[3].x*1.7 + instanceMatrix[3].z*2.3;',
              'float swW = smoothstep(0.35,1.15,position.y)*uExcite;',
              'transformed.x += sin(uTime*1.7+swPh)*' + amp + '*swW;',
              'transformed.z += cos(uTime*1.25+swPh)*' + amp + '*0.6*swW;',
            ].join('\n'),
          );
      };
    }
    const shirtMat = new THREE.MeshLambertMaterial();
    const armsMat = new THREE.MeshLambertMaterial();
    const legsMat = new THREE.MeshLambertMaterial();
    const headMat = new THREE.MeshLambertMaterial();
    const hairMat = new THREE.MeshLambertMaterial();
    swayify(shirtMat, '0.028');
    swayify(armsMat, '0.04');
    swayify(legsMat, '0.012');
    swayify(headMat, '0.05');
    swayify(hairMat, '0.05');

    const shirts = new THREE.InstancedMesh(bodyGeo, shirtMat, N);
    const arms = new THREE.InstancedMesh(armsGeo, armsMat, N);
    const legs = new THREE.InstancedMesh(legsGeo, legsMat, N);
    const heads = new THREE.InstancedMesh(headGeo, headMat, N);
    const hairs = new THREE.InstancedMesh(hairGeo, hairMat, N);
    [shirts, arms, legs, heads, hairs].forEach((m) => {
      m.frustumCulled = false;
    });

    const cc = new THREE.Color();
    occupied.forEach((s, k) => {
      // Home halves: Ahly (−X) / Zamalek (+X) — only ~1% rival pocket
      let ahly = s.x < 0;
      if (rng() < 0.01) ahly = !ahly;
      const shirtsPal = ahly ? ahlyShirts : zamShirts;
      const shortsPal = ahly ? ahlyShorts : zamShorts;
      dm.position.set(s.x, s.y, s.z);
      dm.rotation.set(
        (rng() - 0.5) * 0.08,
        s.yaw + (rng() - 0.5) * 0.32,
        0,
      );
      dm.scale.setScalar(0.9 + rng() * 0.16);
      dm.updateMatrix();
      shirts.setMatrixAt(k, dm.matrix);
      arms.setMatrixAt(k, dm.matrix);
      legs.setMatrixAt(k, dm.matrix);
      heads.setMatrixAt(k, dm.matrix);
      hairs.setMatrixAt(k, dm.matrix);
      // Keep team colours pure (deep dark red / white)
      cc.set(shirtsPal[(rng() * shirtsPal.length) | 0]);
      if (ahly) {
        // slight darken only — never brighten Ahly red
        cc.offsetHSL(0, (rng() - 0.5) * 0.015, -rng() * 0.04);
      } else {
        cc.offsetHSL(0, 0, (rng() - 0.5) * 0.02);
      }
      shirts.setColorAt(k, cc);
      // Arms match shirt colour (team block), occasional bare skin
      if (rng() < 0.15) cc.set(skinTones[(rng() * skinTones.length) | 0]);
      arms.setColorAt(k, cc);
      cc.set(shortsPal[(rng() * shortsPal.length) | 0]);
      legs.setColorAt(k, cc);
      cc.set(skinTones[(rng() * skinTones.length) | 0]);
      heads.setColorAt(k, cc);
      cc.set(hairTones[(rng() * hairTones.length) | 0]);
      hairs.setColorAt(k, cc);
    });
    [shirts, arms, legs, heads, hairs].forEach((m) => {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      scene.add(m);
    });

    if (loaderText) {
      loaderText.textContent =
        'Placing ' +
        seats.length.toLocaleString() +
        ' seats · ' +
        N.toLocaleString() +
        ' fans…';
    }
  }

  /* ---------- exterior shell: wide flared base (~120°+ outward) ---------- */
  {
    const { slopeH, slopeRun, baseRx, baseRz, footRx, footRz } = EXT;

    const stoneTex = canvasTexture(
      256,
      256,
      (x, w, h) => {
        x.fillStyle = '#c8b89a';
        x.fillRect(0, 0, w, h);
        for (let i = 0; i < 1200; i++) {
          const n = 150 + ((Math.random() * 40) | 0);
          x.fillStyle =
            'rgba(' + n + ',' + (n - 14) + ',' + (n - 32) + ',0.32)';
          x.fillRect(
            Math.random() * w,
            Math.random() * h,
            2 + Math.random() * 5,
            2 + Math.random() * 4,
          );
        }
      },
      10,
      3,
    );
    const slopeMat = new THREE.MeshLambertMaterial({
      map: stoneTex,
      color: 0xd2c2a4,
      side: THREE.DoubleSide,
    });
    const slopeDark = new THREE.MeshLambertMaterial({
      color: 0xb8a888,
      side: THREE.DoubleSide,
    });

    // Main continuous outer slope: rim → MUCH wider base
    scene.add(
      ringStrip(
        BOWL.outRx - 0.5,
        BOWL.outRz - 0.4,
        BOWL.y1 + 0.6,
        baseRx,
        baseRz,
        0.08,
        180,
        slopeMat,
        12,
      ),
    );
    // Extra lower flare skirt (even wider foot)
    scene.add(
      ringStrip(
        baseRx - 1.5,
        baseRz - 1.2,
        2.8,
        footRx,
        footRz,
        0.05,
        160,
        slopeDark,
        1,
      ),
    );
    // Mid band shadow line for depth
    scene.add(
      ringStrip(
        BOWL.outRx + slopeRun * 0.35,
        BOWL.outRz + slopeRun * 0.28,
        BOWL.y1 * 0.55,
        BOWL.outRx + slopeRun * 0.38,
        BOWL.outRz + slopeRun * 0.31,
        BOWL.y1 * 0.52,
        140,
        slopeDark,
        1,
      ),
    );
    // Top rim walkway / coping
    scene.add(
      ringStrip(
        BOWL.outRx - 4,
        BOWL.outRz - 3.2,
        BOWL.y1 + 0.5,
        BOWL.outRx + 3,
        BOWL.outRz + 2.5,
        BOWL.y1 + 1.15,
        140,
        new THREE.MeshLambertMaterial({
          color: 0xa8b0bc,
          side: THREE.DoubleSide,
        }),
        1,
      ),
    );
    scene.add(
      ringStrip(
        BOWL.outRx - 2.5,
        BOWL.outRz - 2,
        BOWL.y1 + 1.1,
        BOWL.outRx + 0.8,
        BOWL.outRz + 0.6,
        BOWL.y1 + 2.0,
        120,
        concrete,
        1,
      ),
    );

    // light-blue utility boxes on rim
    const blueBox = new THREE.MeshLambertMaterial({ color: 0x3a8ad0 });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU + 0.08;
      const [x, z] = ellipsePoint(BOWL.outRx + 1.5, BOWL.outRz + 1.2, a);
      const box = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.5, 1.8), blueBox);
      box.position.set(x, BOWL.y1 + 2.0, z);
      box.rotation.y = -a;
      scene.add(box);
    }
  }

  /* ---------- main entrance (+Z): twin beige halls + vertical-slat facade ---------- */
  {
    const facadeZ = EXT.footRz + 6;
    // flanking solid beige buildings
    [-1, 1].forEach((side) => {
      const wing = new THREE.Mesh(
        new THREE.BoxGeometry(28, 22, 14),
        beige,
      );
      wing.position.set(side * 42, 11, facadeZ + 2);
      scene.add(wing);
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(30, 0.5, 16),
        concrete,
      );
      roof.position.set(side * 42, 22.4, facadeZ + 2);
      scene.add(roof);
    });

    // center vertical-slat / mesh facade
    const panelW = 1.15;
    const panelH = 24;
    const n = 42;
    const total = n * panelW;
    for (let i = 0; i < n; i++) {
      const px = -total / 2 + panelW * 0.5 + i * panelW;
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(panelW - 0.35, panelH, 1.6),
        i % 2 ? beigeDark : beige,
      );
      panel.position.set(px, panelH / 2, facadeZ);
      scene.add(panel);
    }
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(total * 0.55, 14, 0.3),
      new THREE.MeshLambertMaterial({
        color: 0x1a3048,
        transparent: true,
        opacity: 0.75,
      }),
    );
    glass.position.set(0, 8, facadeZ + 0.9);
    scene.add(glass);
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(total + 8, 0.45, 14),
      whiteBuild,
    );
    canopy.position.set(0, panelH + 0.3, facadeZ - 2);
    scene.add(canopy);

    const mkSign = (text, y, size) => {
      const cv = document.createElement('canvas');
      cv.width = 1024;
      cv.height = 128;
      const x = cv.getContext('2d');
      x.fillStyle = '#101820';
      x.fillRect(0, 0, 1024, 128);
      x.fillStyle = '#f2f2f2';
      x.font = `700 ${size}px sans-serif`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText(text, 512, 64);
      const tex = new THREE.CanvasTexture(cv);
      tex.encoding = THREE.sRGBEncoding;
      const board = new THREE.Mesh(
        new THREE.PlaneGeometry(32, 3.2),
        new THREE.MeshBasicMaterial({ map: tex }),
      );
      board.position.set(0, y, facadeZ + 1.0);
      scene.add(board);
    };
    mkSign('CAIRO INTERNATIONAL STADIUM', panelH - 3.2, 36);
    mkSign('استاد القاهرة الدولي', panelH - 6.6, 40);
  }

  /* ---------- VIP / press box on +Z main stand (behind dugouts) ---------- */
  {
    const zVip = BOWL.outRz - 6;
    const vip = new THREE.Mesh(
      new THREE.BoxGeometry(72, 12, 14),
      whiteBuild,
    );
    vip.position.set(0, BOWL.y1 - 2.2, zVip);
    scene.add(vip);
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(78, 0.55, 16),
      concrete,
    );
    roof.position.set(0, BOWL.y1 + 4.0, zVip);
    scene.add(roof);
    const overhang = new THREE.Mesh(
      new THREE.BoxGeometry(76, 0.25, 4),
      concrete,
    );
    overhang.position.set(0, BOWL.y1 + 3.7, zVip - 8);
    scene.add(overhang);
    const win = new THREE.MeshLambertMaterial({
      color: 0x1a2838,
      transparent: true,
      opacity: 0.85,
    });
    const winLite = new THREE.MeshBasicMaterial({
      color: 0x6a92b8,
      transparent: true,
      opacity: 0.55,
    });
    for (let band = 0; band < 2; band++) {
      for (let i = -7; i <= 7; i++) {
        const w = new THREE.Mesh(
          new THREE.BoxGeometry(4.0, 3.6, 0.22),
          band === 0 ? win : winLite,
        );
        w.position.set(i * 4.6, BOWL.y1 - 4.2 + band * 4.2, zVip - 6.9);
        scene.add(w);
      }
    }
    for (let i = -7; i <= 8; i++) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 10, 0.3),
        steelDark,
      );
      m.position.set(i * 4.6 - 2.3, BOWL.y1 - 2.2, zVip - 6.85);
      scene.add(m);
    }
  }

  /* ---------- live scoreboards at ±X ends ---------- */
  const scoreboardPainters = [];
  {
    const mkBoard = (side, title, homeLabel, awayLabel) => {
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(2.8, 13, 26),
        new THREE.MeshLambertMaterial({ color: 0x12161c }),
      );
      frame.position.set(side * (BOWL.outRx - 6), BOWL.y1 + 5.5, 0);
      scene.add(frame);
      const cv = document.createElement('canvas');
      cv.width = 512;
      cv.height = 256;
      const x = cv.getContext('2d');
      const tex = new THREE.CanvasTexture(cv);
      tex.encoding = THREE.sRGBEncoding;
      const paint = (sc) => {
        x.fillStyle = '#05070c';
        x.fillRect(0, 0, 512, 256);
        // Al Ahly (dark red) · Zamalek (white)
        x.fillStyle = '#6e0000';
        x.fillRect(24, 70, 100, 48);
        x.fillStyle = '#ffffff';
        x.fillRect(388, 70, 100, 48);
        x.strokeStyle = '#1a1a1a';
        x.lineWidth = 2;
        x.strokeRect(388, 70, 100, 48);
        x.fillStyle = '#e8eef8';
        x.font = '700 28px sans-serif';
        x.textAlign = 'center';
        x.fillText(title, 256, 42);
        x.fillStyle = '#ffffff';
        x.font = '700 18px sans-serif';
        x.fillText(homeLabel, 74, 100);
        x.fillStyle = '#1a1a1a';
        x.fillText(awayLabel, 438, 100);
        x.fillStyle = '#9aa8bc';
        x.font = '600 20px sans-serif';
        x.fillText(`${homeLabel}  ·  ${awayLabel}`, 256, 148);
        x.fillStyle = '#3bc4ff';
        x.font = '800 64px sans-serif';
        x.fillText(`${sc.home} — ${sc.away}`, 256, 200);
        x.fillStyle = '#f0c014';
        x.font = '600 24px sans-serif';
        x.fillText(
          sc.minute < 90 ? `LIVE · ${sc.minute}'` : 'FULL TIME',
          256,
          238,
        );
        tex.needsUpdate = true;
      };
      paint({ home: 0, away: 0, minute: 0 });
      scoreboardPainters.push(paint);
      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(24, 11),
        new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
      );
      screen.position.set(side * (BOWL.outRx - 7.5), BOWL.y1 + 5.5, 0);
      screen.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      scene.add(screen);
    };
    const homeShort = (metaInfo.teams?.home || 'AHLY').split(' ').pop();
    const awayShort = (metaInfo.teams?.away || 'ZAMALEK').split(' ').pop();
    mkBoard(-1, 'استاد القاهرة', homeShort, awayShort);
    mkBoard(1, 'CAIRO STADIUM', homeShort, awayShort);
  }

  /* ---------- big screen on stand facing VIP (−Z opposite presidential box) ---------- */
  {
    const homeShort = (metaInfo.teams?.home || 'AHLY').split(' ').pop();
    const awayShort = (metaInfo.teams?.away || 'ZAMALEK').split(' ').pop();
    const zScr = -(BOWL.outRz - 5.5);
    const yScr = BOWL.y1 + 5.2;
    const frameMat = new THREE.MeshLambertMaterial({ color: 0x0c2a58 });
    const frameDark = new THREE.MeshLambertMaterial({ color: 0x081828 });

    // Thick blue outer frame (matches Genius&Gerry top-stand screen)
    const outer = new THREE.Mesh(
      new THREE.BoxGeometry(48, 16.5, 2.4),
      frameMat,
    );
    outer.position.set(0, yScr, zScr);
    scene.add(outer);
    const inner = new THREE.Mesh(
      new THREE.BoxGeometry(44, 13.2, 1.6),
      frameDark,
    );
    inner.position.set(0, yScr, zScr + 0.35);
    scene.add(inner);
    // Side stilts into the rim
    [-1, 1].forEach((s) => {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 8, 2.0),
        frameMat,
      );
      leg.position.set(s * 20, BOWL.y1 + 1.2, zScr);
      scene.add(leg);
    });

    const cv = document.createElement('canvas');
    cv.width = 1024;
    cv.height = 384;
    const ctx = cv.getContext('2d');
    const tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    const paint = (sc) => {
      const w = cv.width,
        h = cv.height;
      ctx.fillStyle = '#03060c';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(40,120,200,0.55)';
      ctx.lineWidth = 6;
      ctx.strokeRect(10, 10, w - 20, h - 20);
      ctx.fillStyle = '#6e0000';
      ctx.fillRect(48, 90, 180, 72);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(w - 228, 90, 180, 72);
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 3;
      ctx.strokeRect(w - 228, 90, 180, 72);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#c8d8f0';
      ctx.font = '700 36px sans-serif';
      ctx.fillText('CAIRO INTERNATIONAL', w / 2, 56);
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 28px sans-serif';
      ctx.fillText(homeShort, 138, 136);
      ctx.fillStyle = '#111111';
      ctx.fillText(awayShort, w - 138, 136);
      ctx.fillStyle = '#3bc4ff';
      ctx.font = '800 110px sans-serif';
      ctx.fillText(`${sc.home}  —  ${sc.away}`, w / 2, 250);
      ctx.fillStyle = '#f0c014';
      ctx.font = '700 32px sans-serif';
      ctx.fillText(
        sc.minute < 90 ? `LIVE · ${sc.minute}'` : 'FULL TIME',
        w / 2,
        330,
      );
      tex.needsUpdate = true;
    };
    paint({ home: 0, away: 0, minute: 0 });
    scoreboardPainters.push(paint);

    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(42, 12.2),
      new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
    );
    // Face the pitch / VIP (+Z)
    screen.position.set(0, yScr, zScr + 1.35);
    scene.add(screen);
  }

  /* ---------- stadium crowd audio (Mixkit) · orbit = ambience only · seat = cheer ---------- */
  let AC = null,
    crowdMaster = null,
    ambGain = null,
    cheerGain = null,
    whoopTimer = null,
    audioReady = false,
    audioLoading = null,
    muted = false,
    audioNear = false; // true in seat POV
  const SFX = {
    ambience: '/sounds/crowd-ambience.mp3',
    cheer: '/sounds/crowd-cheer.mp3',
    cheerBig: '/sounds/crowd-cheer-big.mp3',
    yell: '/sounds/crowd-yell.mp3',
    stadium: '/sounds/crowd-stadium.mp3',
    chant: '/sounds/crowd-chant.mp3',
  };
  const buffers = {};
  async function loadBuffer(key, url) {
    const res = await fetch(url);
    const arr = await res.arrayBuffer();
    buffers[key] = await AC.decodeAudioData(arr.slice(0));
  }
  function playBuffer(key, opts) {
    opts = opts || {};
    if (!AC || !buffers[key] || muted) return null;
    const src = AC.createBufferSource();
    src.buffer = buffers[key];
    src.loop = !!opts.loop;
    if (opts.rate) src.playbackRate.value = opts.rate;
    const g = AC.createGain();
    const t = AC.currentTime + (opts.delay || 0);
    const vol = opts.gain == null ? 1 : opts.gain;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + (opts.fadeIn || 0.08));
    src.connect(g);
    g.connect(opts.dest || crowdMaster);
    src.start(t);
    return { src, g };
  }
  function rampNode(node, level, sec) {
    if (!AC || !node) return;
    const t = AC.currentTime;
    const v = muted ? 0.0001 : Math.max(0.0001, level);
    node.gain.cancelScheduledValues(t);
    node.gain.setValueAtTime(Math.max(0.0001, node.gain.value), t);
    node.gain.linearRampToValueAtTime(v, t + (sec == null ? 0.7 : sec));
  }
  /** Orbit = crowd ambience only · seat = ambience + chant + whoops/cheers */
  function setAudioNear(near) {
    audioNear = !!near;
    if (!AC || !audioReady) return;
    if (audioNear) {
      rampNode(ambGain, 0.85, 0.7);
      rampNode(cheerGain, 0.55, 0.7);
      setCrowd(0.55);
    } else {
      rampNode(ambGain, 1, 0.8);
      rampNode(cheerGain, 0.0001, 0.5); // kill chant / cheer bed from afar
      setCrowd(0.34);
    }
  }
  function ensureAudio() {
    if (AC && audioReady) {
      if (AC.state === 'suspended') AC.resume();
      return;
    }
    if (audioLoading) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      return;
    }
    audioLoading = (async () => {
      try {
        crowdMaster = AC.createGain();
        crowdMaster.gain.value = 0.0001;
        const comp = AC.createDynamicsCompressor();
        comp.threshold.value = -18;
        comp.knee.value = 12;
        comp.ratio.value = 2.6;
        comp.attack.value = 0.02;
        comp.release.value = 0.25;
        crowdMaster.connect(comp);
        comp.connect(AC.destination);

        ambGain = AC.createGain();
        cheerGain = AC.createGain();
        ambGain.gain.value = 0.0001;
        cheerGain.gain.value = 0.0001;
        ambGain.connect(crowdMaster);
        cheerGain.connect(crowdMaster);

        await Promise.all([
          loadBuffer('ambience', SFX.ambience),
          loadBuffer('cheer', SFX.cheer),
          loadBuffer('cheerBig', SFX.cheerBig),
          loadBuffer('yell', SFX.yell),
          loadBuffer('stadium', SFX.stadium),
          loadBuffer('chant', SFX.chant),
        ]);

        // Distant bed: pure crowd ambience only
        playBuffer('ambience', {
          loop: true,
          gain: 0.95,
          fadeIn: 1.4,
          dest: ambGain,
        });
        // Near bed: soft chant (muted while orbiting)
        playBuffer('chant', {
          loop: true,
          gain: 0.45,
          fadeIn: 2.0,
          rate: 0.98,
          dest: cheerGain,
        });

        audioReady = true;
        if (AC.state === 'suspended') await AC.resume();
        scheduleWhoops();
        setAudioNear(mode === 'seat');
      } catch (err) {
        console.warn('Cairo stadium audio failed to load', err);
      } finally {
        audioLoading = null;
      }
    })();
  }
  function scheduleWhoops() {
    if (whoopTimer) clearTimeout(whoopTimer);
    const tick = () => {
      if (!AC || muted || !audioReady || disposed) return;
      if (audioNear) fireWhoop();
      whoopTimer = setTimeout(tick, 3800 + Math.random() * 6500);
    };
    whoopTimer = setTimeout(tick, 2800);
  }
  function fireWhoop() {
    if (!AC || muted || !audioReady || !audioNear) return;
    const pool = ['yell', 'stadium', 'cheer'];
    const key = pool[(Math.random() * pool.length) | 0];
    playBuffer(key, {
      gain: 0.2 + Math.random() * 0.25,
      rate: 0.94 + Math.random() * 0.12,
      dest: cheerGain,
    });
  }
  function setCrowd(level) {
    if (!AC || !crowdMaster) return;
    const t = AC.currentTime;
    crowdMaster.gain.cancelScheduledValues(t);
    crowdMaster.gain.setValueAtTime(
      Math.max(0.0001, crowdMaster.gain.value),
      t,
    );
    crowdMaster.gain.linearRampToValueAtTime(muted ? 0.0001 : level, t + 0.9);
  }
  function cheer() {
    ensureAudio();
    const go = () => {
      if (!AC || muted || !audioReady) return;
      exciteU.value = 1.35;
      gsap.to(exciteU, { value: 1, duration: 2.4, ease: 'power2.out' });
      // Cheer bursts only in seat POV — orbit stays ambience-only
      if (!audioNear) {
        const cur = Math.max(0.0001, crowdMaster.gain.value);
        const t = AC.currentTime;
        crowdMaster.gain.cancelScheduledValues(t);
        crowdMaster.gain.setValueAtTime(cur, t);
        crowdMaster.gain.linearRampToValueAtTime(
          Math.min(0.5, cur + 0.08),
          t + 0.25,
        );
        crowdMaster.gain.linearRampToValueAtTime(cur, t + 2.2);
        return;
      }
      const t = AC.currentTime;
      playBuffer('cheerBig', {
        gain: 0.9,
        fadeIn: 0.05,
        dest: cheerGain,
      });
      playBuffer('cheer', {
        gain: 0.55,
        delay: 0.1,
        rate: 1.02,
        dest: cheerGain,
      });
      playBuffer('yell', {
        gain: 0.35,
        delay: 0.18,
        rate: 0.97,
        dest: cheerGain,
      });
      if (crowdMaster) {
        const cur = Math.max(0.0001, crowdMaster.gain.value);
        crowdMaster.gain.cancelScheduledValues(t);
        crowdMaster.gain.setValueAtTime(cur, t);
        crowdMaster.gain.linearRampToValueAtTime(
          Math.min(0.9, cur + 0.35),
          t + 0.2,
        );
        crowdMaster.gain.linearRampToValueAtTime(cur, t + 2.8);
      }
    };
    if (audioReady) go();
    else if (audioLoading) audioLoading.then(go);
  }

  /* ---------- players + ball (same match system as Misr) ---------- */
  const matchPlay = createMatchPlay(scene, {
    rng,
    field: FIELD,
    dugoutZ: FIELD.W / 2 + 4.2,
    dugoutCenters: [-18, 18],
    kits: [
      {
        // Al Ahly — deep red / white
        shirt: 0x6e0000,
        shorts: 0xf2f4f8,
        socks: 0x6e0000,
        gk: 0x1a1a1a,
      },
      {
        // Zamalek — white / black
        shirt: 0xffffff,
        shorts: 0x141414,
        socks: 0xffffff,
        gk: 0x2fbf71,
      },
    ],
    onScore: (sc) => {
      for (const paint of scoreboardPainters) paint(sc);
      cheer();
    },
  });

  /* ---------- 4 floodlights ON exterior shell + Misr-style glow ---------- */
  {
    const glowSprite = canvasTexture(128, 128, (x) => {
      const g = x.createRadialGradient(64, 64, 4, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.25, 'rgba(255,220,160,.55)');
      g.addColorStop(1, 'rgba(255,180,80,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, 128, 128);
    });
    const coneTex = canvasTexture(64, 128, (x, w, h) => {
      const g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(255,255,255,0.45)');
      g.addColorStop(0.25, 'rgba(255,230,190,0.14)');
      g.addColorStop(0.65, 'rgba(255,210,160,0.04)');
      g.addColorStop(1, 'rgba(255,180,100,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, w, h);
    });
    const coneMat = new THREE.MeshBasicMaterial({
      map: coneTex,
      transparent: true,
      opacity: 0.045,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
      toneMapped: false,
    });
    const steelTower = new THREE.MeshLambertMaterial({
      color: 0xd0d8e0,
      emissive: 0x8890a0,
      emissiveIntensity: 0.15,
    });
    const housingMat = new THREE.MeshLambertMaterial({
      color: 0x3a424c,
      emissive: 0x1a222c,
      emissiveIntensity: 0.12,
    });
    const frameMat = new THREE.MeshLambertMaterial({
      color: 0x5a6570,
      emissive: 0x2a323c,
      emissiveIntensity: 0.1,
    });
    const lampGlow = new THREE.MeshBasicMaterial({
      color: 0xfff2c8,
      toneMapped: false,
    });
    const lampLens = new THREE.MeshBasicMaterial({
      color: 0xffe8a0,
      transparent: true,
      opacity: 0.92,
      toneMapped: false,
    });
    const baseBlue = new THREE.MeshLambertMaterial({
      color: 0x1a5aaa,
      emissive: 0x0a3060,
      emissiveIntensity: 0.25,
    });
    const railMat = new THREE.MeshLambertMaterial({ color: 0xb8c0c8 });
    const haloMat = new THREE.SpriteMaterial({
      map: glowSprite,
      color: 0xffd9a0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.45,
    });
    const up = new THREE.Vector3(0, 1, 0);
    const towerH = 48;
    // Slope pitch so pads sit flush on the beige exterior face
    const slopePitch = Math.atan2(EXT.slopeH, EXT.slopeRun);
    // Mid-upper on the exterior shell (t=0 rim, t=1 ground)
    const mountT = 0.34;
    const spot = EXT.at(mountT);
    const cornerAngles = [
      Math.PI * 0.25,
      Math.PI * 0.75,
      Math.PI * 1.25,
      Math.PI * 1.75,
    ];

    cornerAngles.forEach((a) => {
      // Exact point ON the elliptical exterior surface
      const [sx, sz] = ellipsePoint(spot.rx, spot.rz, a);
      const len = Math.hypot(sx, sz) || 1;
      const ox = sx / len;
      const oz = sz / len;
      // Nest slightly into the wall so the pad reads as attached
      const nest = 2.2;
      const x = sx - ox * nest;
      const z = sz - oz * nest;
      const y = spot.y;

      const pad = new THREE.Mesh(new THREE.BoxGeometry(11, 2.8, 7), baseBlue);
      pad.position.set(x, y + 0.4, z);
      pad.rotation.order = 'YXZ';
      pad.rotation.y = -a;
      pad.rotation.x = -slopePitch;
      scene.add(pad);

      // Small ledge under the tower feet (also on the shell)
      const ledge = new THREE.Mesh(
        new THREE.BoxGeometry(8, 1.4, 5.5),
        new THREE.MeshLambertMaterial({ color: 0xb8a888 }),
      );
      ledge.position.set(x - ox * 0.4, y + 1.6, z - oz * 0.4);
      ledge.rotation.order = 'YXZ';
      ledge.rotation.y = -a;
      ledge.rotation.x = -slopePitch * 0.35;
      scene.add(ledge);

      const tower = new THREE.Group();
      for (let leg = 0; leg < 4; leg++) {
        const lx = (leg % 2 ? 1 : -1) * 1.35;
        const lz = (leg < 2 ? 1 : -1) * 1.35;
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.26, 0.4, towerH, 6),
          steelTower,
        );
        pole.position.set(lx, towerH * 0.5, lz);
        tower.add(pole);
      }
      for (let yy = 5; yy < towerH - 4; yy += 5) {
        const b1 = new THREE.Mesh(
          new THREE.BoxGeometry(2.8, 0.14, 0.14),
          steelTower,
        );
        b1.position.set(0, yy, 0);
        tower.add(b1);
        const b2 = b1.clone();
        b2.rotation.y = Math.PI / 2;
        tower.add(b2);
        const xb = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.12, 3.5),
          steelTower,
        );
        xb.position.set(0, yy + 2.2, 0);
        xb.rotation.y = Math.PI / 4;
        tower.add(xb);
      }
      const headY = towerH + 0.6;
      // Maintenance platform under the lamp bank
      const platform = new THREE.Mesh(
        new THREE.BoxGeometry(12, 0.35, 8),
        frameMat,
      );
      platform.position.set(0, headY, 0.8);
      tower.add(platform);
      [-1, 1].forEach((side) => {
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(11.5, 0.12, 0.12),
          railMat,
        );
        rail.position.set(0, headY + 1.1, 0.8 + side * 3.6);
        tower.add(rail);
        for (let p = -2; p <= 2; p++) {
          const post = new THREE.Mesh(
            new THREE.CylinderGeometry(0.06, 0.06, 1.1, 5),
            railMat,
          );
          post.position.set(p * 2.4, headY + 0.55, 0.8 + side * 3.6);
          tower.add(post);
        }
      });

      // Realistic head: housing tipped down toward the pitch
      const head = new THREE.Group();
      head.position.set(0, headY + 2.4, 1.6);
      head.rotation.x = 0.48;
      tower.add(head);

      const housing = new THREE.Mesh(
        new THREE.BoxGeometry(11.5, 4.2, 2.4),
        housingMat,
      );
      housing.position.set(0, 0, -0.9);
      head.add(housing);
      const hood = new THREE.Mesh(
        new THREE.BoxGeometry(11.8, 0.35, 3.6),
        frameMat,
      );
      hood.position.set(0, 2.0, 0.2);
      hood.rotation.x = -0.15;
      head.add(hood);
      [-1, 1].forEach((s) => {
        const cheek = new THREE.Mesh(
          new THREE.BoxGeometry(0.35, 4.0, 3.2),
          housingMat,
        );
        cheek.position.set(s * 5.7, 0, 0.1);
        head.add(cheek);
      });
      const bezel = new THREE.Mesh(
        new THREE.BoxGeometry(11.2, 3.8, 0.35),
        frameMat,
      );
      bezel.position.set(0, 0, 0.55);
      head.add(bezel);

      // 4×3 individual floodlight fixtures
      for (let col = 0; col < 4; col++) {
        for (let row = 0; row < 3; row++) {
          const lx = (col - 1.5) * 2.55;
          const ly = (row - 1) * 1.15;
          const can = new THREE.Mesh(
            new THREE.BoxGeometry(2.2, 0.95, 1.4),
            housingMat,
          );
          can.position.set(lx, ly, 0.15);
          head.add(can);
          const lens = new THREE.Mesh(
            new THREE.BoxGeometry(1.85, 0.72, 0.18),
            lampLens,
          );
          lens.position.set(lx, ly, 0.95);
          head.add(lens);
          const glow = new THREE.Mesh(
            new THREE.BoxGeometry(1.6, 0.55, 0.08),
            lampGlow,
          );
          glow.position.set(lx, ly, 1.08);
          head.add(glow);
          const halo = new THREE.Sprite(haloMat.clone());
          halo.position.set(lx, ly, 1.35);
          halo.scale.setScalar(2.8);
          head.add(halo);
        }
      }
      const bigHalo = new THREE.Sprite(haloMat.clone());
      bigHalo.position.set(0, 0, 2.2);
      bigHalo.scale.setScalar(14);
      head.add(bigHalo);

      // Mast faces the pitch
      const baseY = y + 2.2;
      tower.position.set(x - ox * 0.6, baseY, z - oz * 0.6);
      tower.rotation.y = Math.atan2(-x, -z);
      scene.add(tower);
      tower.updateMatrixWorld(true);
      const lampWorld = new THREE.Vector3(0, 0, 1.4);
      head.localToWorld(lampWorld);

      const spotL = new THREE.SpotLight(
        0xffe8c8,
        0.5,
        0,
        Math.PI / 3.4,
        0.7,
        1.3,
      );
      spotL.position.copy(lampWorld);
      spotL.target = floodTargets;
      scene.add(spotL);

      const pl = new THREE.PointLight(0xfff0d0, 0.2, 200, 2);
      pl.position.copy(lampWorld);
      scene.add(pl);

      for (let c = 0; c < 2; c++) {
        const to = new THREE.Vector3(
          (Math.random() - 0.5) * 55,
          0.2,
          (Math.random() - 0.5) * 38,
        );
        const from = lampWorld.clone();
        const lenC = from.distanceTo(to);
        const cone = new THREE.Mesh(
          new THREE.CylinderGeometry(1.2, 14, lenC, 12, 1, true),
          coneMat,
        );
        cone.position.copy(from).add(to).multiplyScalar(0.5);
        cone.quaternion.setFromUnitVectors(
          up,
          from.clone().sub(to).normalize(),
        );
        scene.add(cone);
      }
    });
  }

  /* ---------- trackside speaker poles ---------- */
  {
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * TAU;
      const [x, z] = ellipsePoint(TRACK.outRx + 1.8, TRACK.outRz + 1.5, a);
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.09, 5.2, 5),
        poleMat,
      );
      pole.position.set(x, 2.7, z);
      scene.add(pole);
    }
  }

  /* ---------- camera / seat POV (Misr-style spectator view) ---------- */
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const HOME = { theta: 1.15, phi: 0.82, radius: 280 };
  const orbit = {
    theta: HOME.theta,
    phi: HOME.phi,
    radius: HOME.radius,
    thetaT: HOME.theta,
    phiT: HOME.phi,
    radiusT: HOME.radius,
    target: new THREE.Vector3(0, 6, 0),
  };
  let lastOrbit = { ...HOME };
  let mode = 'orbit';
  let is2D = false;
  let userInteracted = false;
  const seatView = {
    eye: new THREE.Vector3(),
    yawBase: 0,
    pitchBase: 0,
    yawOff: 0,
    pitchOff: 0,
  };

  const $ = (id) => document.getElementById(id);
  const ui = {
    toast: $('toast'),
    tip: $('tip'),
    tip1: $('tip1'),
    tip2: $('tip2'),
    pLabel: $('p-label'),
    pSection: $('p-section'),
    pTier: $('p-tier'),
    pBlock: $('p-block'),
    pRow: $('p-row'),
    pSeat: $('p-seat'),
    pScore: $('p-score'),
    checkout: $('checkout'),
    ckLabel: $('checkout-label'),
    seatcard: $('seatcard'),
    pImg: $('p-img'),
    pPh: $('p-ph'),
    dock: $('dock'),
    backbar: $('backbar'),
    bkExit: $('bk-exit'),
    bkSnd: $('bk-snd'),
    sbHint: $('sb-hint'),
    d3d: $('d-3d'),
    mm: $('mm') ? $('mm').getContext('2d') : null,
    ov: $('ov') ? $('ov').getContext('2d') : null,
  };

  const applyOrbit = () => {
    const sp = Math.sin(orbit.phi);
    camera.position.set(
      orbit.target.x + orbit.radius * sp * Math.cos(orbit.theta),
      orbit.target.y + orbit.radius * Math.cos(orbit.phi),
      orbit.target.z + orbit.radius * sp * Math.sin(orbit.theta),
    );
    camera.lookAt(orbit.target);
  };
  applyOrbit();

  // debug / spectate hooks
  window.__cairoCam = {
    get: () => ({
      theta: orbit.theta,
      phi: orbit.phi,
      radius: orbit.radius,
    }),
    set: (theta, phi, radius) => {
      userInteracted = true;
      mode = 'orbit';
      orbit.theta = orbit.thetaT = theta;
      orbit.phi = orbit.phiT = phi;
      orbit.radius = orbit.radiusT = radius;
      applyOrbit();
    },
  };
  function eyeFor(i) {
    const m = seatSys.meta;
    const p = new THREE.Vector3(m.pos[i * 3], m.pos[i * 3 + 1], m.pos[i * 3 + 2]);
    const inward = new THREE.Vector3(-p.x, 0, -p.z).normalize();
    return p.addScaledVector(inward, 0.12).add(new THREE.Vector3(0, 1.18, 0));
  }
  function lookFor(i) {
    const m = seatSys.meta;
    return new THREE.Vector3(m.pos[i * 3] * 0.06, 1.2, m.pos[i * 3 + 2] * 0.06);
  }
  function seatScore(i) {
    const m = seatSys.meta;
    const y = m.pos[i * 3 + 1];
    const dist = Math.hypot(m.pos[i * 3], m.pos[i * 3 + 2]);
    let s = 92 - Math.abs(y - 12) * 1.1 - Math.max(0, dist - 100) * 0.12;
    if (m.tier[i] === 1) s -= 4;
    return Math.round(THREE.MathUtils.clamp(s, 52, 98));
  }
  function seatInfo(i) {
    const m = seatSys.meta;
    return {
      i,
      label: m.label[i],
      tier: seatSys.tierName(m.tier[i]),
      row: m.row[i],
      seat: m.seatNum[i],
      score: seatScore(i),
      avail: !!m.avail[i],
    };
  }

  let toastTimer;
  function toast(msg, ms) {
    if (!ui.toast) return;
    ui.toast.textContent = msg;
    ui.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove('show'), ms || 2600);
  }
  function showTip(x, y, info) {
    if (!ui.tip) return;
    ui.tip1.textContent =
      'Section ' + info.label + ' · Row ' + info.row + ' · Seat ' + info.seat;
    ui.tip2.textContent = info.score + '% view · click to preview';
    ui.tip2.style.color = '';
    ui.tip.style.left =
      Math.min(x, innerWidth - (ui.tip.offsetWidth || 200) - 40) + 'px';
    ui.tip.style.top = y + 'px';
    ui.tip.style.opacity = 1;
  }
  function hideTip() {
    if (ui.tip) ui.tip.style.opacity = 0;
  }
  function updatePanel(info, state) {
    if (!ui.pLabel) return;
    ui.pLabel.textContent =
      state === 'previewing' ? 'PREVIEWING SEAT' : 'SEAT PREVIEW';
    ui.pSection.textContent = 'Section ' + info.label;
    ui.pTier.textContent = info.tier;
    ui.pBlock.textContent = 'Block ' + info.label;
    ui.pRow.textContent = info.row;
    ui.pSeat.textContent = info.seat;
    ui.pScore.textContent = '★ ' + info.score + '%';
    if (ui.ckLabel)
      ui.ckLabel.textContent =
        state === 'previewing' ? 'Looking around…' : 'View from seat';
    if (ui.checkout)
      ui.checkout.classList.toggle('done', state === 'previewing');
    if (ui.seatcard) {
      ui.seatcard.classList.remove('refresh');
      void ui.seatcard.offsetWidth;
      ui.seatcard.classList.add('refresh');
    }
  }
  function captureView(i) {
    if (!ui.pImg) return;
    const eye = eyeFor(i),
      look = lookFor(i);
    const sp = camera.position.clone(),
      sq = camera.quaternion.clone(),
      sf = camera.fov;
    camera.position.copy(eye);
    camera.lookAt(look);
    camera.fov = 58;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    const oc = document.createElement('canvas');
    oc.width = 480;
    oc.height = 290;
    oc.getContext('2d').drawImage(renderer.domElement, 0, 0, oc.width, oc.height);
    ui.pImg.src = oc.toDataURL('image/jpeg', 0.74);
    ui.pImg.classList.add('ready');
    if (ui.pPh) ui.pPh.style.display = 'none';
    camera.position.copy(sp);
    camera.quaternion.copy(sq);
    camera.fov = sf;
    camera.updateProjectionMatrix();
  }

  /* GPU seat picking */
  const pickRT = new THREE.WebGLRenderTarget(1, 1);
  const pickBuf = new Uint8Array(4);
  function pickAt(cx, cy) {
    if (!seatSys) return -1;
    const dpr = renderer.getPixelRatio();
    camera.setViewOffset(
      canvas.width,
      canvas.height,
      Math.floor(cx * dpr),
      Math.floor(cy * dpr),
      1,
      1,
    );
    renderer.setRenderTarget(pickRT);
    renderer.render(seatSys.pickScene, camera);
    renderer.setRenderTarget(null);
    camera.clearViewOffset();
    renderer.readRenderTargetPixels(pickRT, 0, 0, 1, 1, pickBuf);
    const id = (pickBuf[0] << 16) | (pickBuf[1] << 8) | pickBuf[2];
    return id === 0 ? -1 : id - 1;
  }

  const tmpC = new THREE.Color();
  let hoverIdx = -1,
    selectedIdx = -1;
  function paintSeat(i, r, g, b) {
    tmpC.setRGB(r, g, b);
    seatSys.seatMesh.setColorAt(i, tmpC);
  }
  function restoreSeat(i) {
    const bc = seatSys.baseColors;
    paintSeat(i, bc[i * 3], bc[i * 3 + 1], bc[i * 3 + 2]);
  }
  function setHover(i) {
    if (i === hoverIdx) return;
    if (hoverIdx >= 0 && hoverIdx !== selectedIdx) restoreSeat(hoverIdx);
    hoverIdx = i;
    if (i >= 0 && i !== selectedIdx) paintSeat(i, 0.68, 0.94, 1);
    if (seatSys.seatMesh.instanceColor)
      seatSys.seatMesh.instanceColor.needsUpdate = true;
  }
  function applySelection(i) {
    if (selectedIdx >= 0) restoreSeat(selectedIdx);
    selectedIdx = i;
    if (i >= 0) paintSeat(i, 0.4, 0.91, 0.98);
    if (seatSys.seatMesh.instanceColor)
      seatSys.seatMesh.instanceColor.needsUpdate = true;
    drawOverviewBase();
  }

  let currentInfo = null;
  function enterSeatMode(info) {
    mode = 'seat';
    canvas.classList.add('seatmode');
    seatView.eye.copy(eyeFor(info.i));
    const d = lookFor(info.i).sub(seatView.eye);
    seatView.yawBase = Math.atan2(d.x, d.z);
    seatView.pitchBase = Math.asin(
      THREE.MathUtils.clamp(d.y / d.length(), -1, 1),
    );
    seatView.yawOff = 0;
    seatView.pitchOff = 0;
    camera.fov = 55;
    camera.updateProjectionMatrix();
    if (ui.dock) ui.dock.classList.add('hidden');
    if (ui.backbar) ui.backbar.classList.add('show');
    if (ui.sbHint) {
      ui.sbHint.classList.add('show');
      setTimeout(() => ui.sbHint.classList.remove('show'), 4200);
    }
    captureView(info.i);
    toast('Spectator view · drag to look around · Esc to exit', 3200);
    ensureAudio();
    setAudioNear(true);
    cheer();
  }
  function flyToSeat(i) {
    if (!seatSys) return;
    const info = seatInfo(i);
    currentInfo = info;
    setHover(-1);
    hideTip();
    applySelection(i);
    updatePanel(info, 'previewing');
    ensureAudio();
    setAudioNear(true);
    if (ui.pImg) ui.pImg.classList.remove('ready');
    if (ui.pPh) ui.pPh.style.display = 'grid';
    if (mode === 'orbit')
      lastOrbit = { theta: orbit.theta, phi: orbit.phi, radius: orbit.radius };
    mode = 'fly';
    const eye = eyeFor(i),
      look = lookFor(i);
    const startLook = new THREE.Vector3();
    camera.getWorldDirection(startLook).multiplyScalar(40).add(camera.position);
    const p0 = camera.position.clone();
    const outward = new THREE.Vector3(eye.x, 0, eye.z).normalize();
    const p1 = p0.clone().lerp(eye, 0.3);
    p1.y = Math.max(p0.y, eye.y) + 34;
    const p2 = eye.clone().addScaledVector(outward, -14);
    p2.y = eye.y + 16;
    const curve = new THREE.CatmullRomCurve3(
      [p0, p1, p2, eye],
      false,
      'catmullrom',
      0.35,
    );
    const st = { t: 0 },
      lp = new THREE.Vector3(),
      startFov = camera.fov;
    gsap.to(st, {
      t: 1,
      duration: REDUCED ? 0.7 : 3.2,
      ease: 'power3.inOut',
      onUpdate() {
        curve.getPoint(st.t, camera.position);
        lp.copy(startLook).lerp(
          look,
          THREE.MathUtils.smoothstep(st.t, 0.12, 0.85),
        );
        camera.lookAt(lp);
        camera.fov = THREE.MathUtils.lerp(
          startFov,
          55,
          THREE.MathUtils.smoothstep(st.t, 0.3, 1),
        );
        camera.updateProjectionMatrix();
      },
      onComplete() {
        enterSeatMode(info);
      },
    });
  }
  function exitSeatMode() {
    if (mode !== 'seat') return;
    mode = 'fly';
    canvas.classList.remove('seatmode');
    if (ui.backbar) ui.backbar.classList.remove('show');
    if (ui.sbHint) ui.sbHint.classList.remove('show');
    if (ui.dock) ui.dock.classList.remove('hidden');
    setAudioNear(false);
    orbit.theta = orbit.thetaT = lastOrbit.theta;
    orbit.phi = orbit.phiT = lastOrbit.phi;
    orbit.radius = orbit.radiusT = lastOrbit.radius;
    const sp = Math.sin(lastOrbit.phi);
    const dest = new THREE.Vector3(
      orbit.target.x + lastOrbit.radius * sp * Math.cos(lastOrbit.theta),
      orbit.target.y + lastOrbit.radius * Math.cos(lastOrbit.phi),
      orbit.target.z + lastOrbit.radius * sp * Math.sin(lastOrbit.theta),
    );
    const p0 = camera.position.clone();
    const p1 = p0.clone().lerp(dest, 0.45);
    p1.y = Math.max(p0.y, dest.y) + 26;
    const curve = new THREE.CatmullRomCurve3(
      [p0, p1, dest],
      false,
      'catmullrom',
      0.4,
    );
    const startLook = new THREE.Vector3();
    camera.getWorldDirection(startLook).multiplyScalar(40).add(camera.position);
    const st = { t: 0 },
      lp = new THREE.Vector3(),
      startFov = camera.fov;
    gsap.to(st, {
      t: 1,
      duration: REDUCED ? 0.6 : 2.2,
      ease: 'power3.inOut',
      onUpdate() {
        curve.getPoint(st.t, camera.position);
        lp.copy(startLook).lerp(
          orbit.target,
          THREE.MathUtils.smoothstep(st.t, 0.1, 0.8),
        );
        camera.lookAt(lp);
        camera.fov = THREE.MathUtils.lerp(
          startFov,
          46,
          THREE.MathUtils.smoothstep(st.t, 0, 0.7),
        );
        camera.updateProjectionMatrix();
      },
      onComplete() {
        mode = 'orbit';
      },
    });
  }

  function resolveSeatClick(idx) {
    if (idx < 0 || !seatSys) return;
    // Spectator preview works from any seat (crowd is visual only)
    flyToSeat(idx);
  }

  const pointers = new Map();
  let dragStart = null,
    dragMoved = 0,
    pinchDist = 0,
    pendingHover = null;

  on(canvas, 'pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragStart = { x: e.clientX, y: e.clientY, t: performance.now() };
    dragMoved = 0;
    if (pointers.size === 2) {
      const p = [...pointers.values()];
      pinchDist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
    }
    userInteracted = true;
    canvas.classList.add('dragging');
    ensureAudio();
    setAudioNear(mode === 'seat');
  });
  on(canvas, 'pointermove', (e) => {
    if (!pointers.has(e.pointerId)) {
      if (mode === 'orbit') pendingHover = { x: e.clientX, y: e.clientY };
      return;
    }
    const prev = pointers.get(e.pointerId);
    const dx = e.clientX - prev.x,
      dy = e.clientY - prev.y;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragMoved += Math.abs(dx) + Math.abs(dy);
    if (pointers.size === 2) {
      const p = [...pointers.values()];
      const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      if (pinchDist > 0 && mode === 'orbit') {
        orbit.radiusT = THREE.MathUtils.clamp(
          orbit.radiusT * (pinchDist / d),
          90,
          520,
        );
      }
      pinchDist = d;
      return;
    }
    if (mode === 'orbit') {
      orbit.thetaT -= dx * 0.0045;
      orbit.phiT = THREE.MathUtils.clamp(orbit.phiT - dy * 0.003, 0.16, 1.32);
      if (is2D && Math.abs(dy) > 2) {
        is2D = false;
        if (ui.d3d) ui.d3d.textContent = '3D';
      }
      hideTip();
    } else if (mode === 'seat') {
      seatView.yawOff = THREE.MathUtils.clamp(
        seatView.yawOff - dx * 0.0032,
        -1.5,
        1.5,
      );
      seatView.pitchOff = THREE.MathUtils.clamp(
        seatView.pitchOff + dy * 0.0024,
        -0.55,
        0.55,
      );
    }
  });
  function endPointer(e) {
    canvas.classList.remove('dragging');
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    pinchDist = 0;
    if (
      dragStart &&
      mode === 'orbit' &&
      dragMoved < 7 &&
      performance.now() - dragStart.t < 520
    ) {
      resolveSeatClick(pickAt(e.clientX, e.clientY));
    }
    dragStart = null;
  }
  on(canvas, 'pointerup', endPointer);
  on(canvas, 'pointercancel', endPointer);
  on(canvas, 'pointerleave', () => {
    if (mode === 'orbit') {
      setHover(-1);
      hideTip();
    }
    pendingHover = null;
  });
  on(
    canvas,
    'wheel',
    (e) => {
      e.preventDefault();
      userInteracted = true;
      if (mode === 'orbit') {
        orbit.radiusT = THREE.MathUtils.clamp(
          orbit.radiusT * (1 + e.deltaY * 0.0011),
          90,
          520,
        );
      } else if (mode === 'seat') {
        camera.fov = THREE.MathUtils.clamp(
          camera.fov + e.deltaY * 0.02,
          28,
          68,
        );
        camera.updateProjectionMatrix();
      }
    },
    { passive: false },
  );
  on(window, 'keydown', (e) => {
    if (e.key === 'Escape' && mode === 'seat') exitSeatMode();
  });

  const goHome = () => {
    userInteracted = true;
    if (mode === 'seat') {
      exitSeatMode();
      return;
    }
    Object.assign(orbit, {
      thetaT: HOME.theta,
      phiT: HOME.phi,
      radiusT: HOME.radius,
    });
    is2D = false;
    if (ui.d3d) ui.d3d.textContent = '3D';
  };
  const zoomBy = (f) => {
    userInteracted = true;
    if (mode === 'seat') {
      camera.fov = THREE.MathUtils.clamp(camera.fov * f, 28, 68);
      camera.updateProjectionMatrix();
      return;
    }
    orbit.radiusT = THREE.MathUtils.clamp(orbit.radiusT * f, 90, 520);
  };
  const bind = (id, fn) => {
    const el = document.getElementById(id);
    if (el) on(el, 'click', fn);
  };
  bind('cc-reset', goHome);
  bind('d-reset', goHome);
  bind('ov-expand', goHome);
  bind('cc-zin', () => zoomBy(0.86));
  bind('cc-zout', () => zoomBy(1.16));
  bind('d-zin', () => zoomBy(0.86));
  bind('d-zout', () => zoomBy(1.16));
  bind('d-3d', () => {
    userInteracted = true;
    if (mode === 'seat') exitSeatMode();
    is2D = !is2D;
    if (ui.d3d) ui.d3d.textContent = is2D ? '2D' : '3D';
    if (is2D) {
      orbit.phiT = 0.18;
      orbit.radiusT = 300;
    } else goHome();
  });
  bind('cc-help', () => {
    toast(
      'Click any seat for spectator view · drag to orbit · Esc exits seat view',
      3600,
    );
  });

  /* ---------- minimaps (same pattern as Misr: camera card + overview) ---------- */
  const ovBase = document.createElement('canvas');
  const RXmax = BOWL.outRx + 4;
  const RZmax = BOWL.outRz + 4;
  function fillSectionWedge(x, cx, cy, sc, a0, a1, rInX, rInZ, rOutX, rOutZ, fill) {
    x.beginPath();
    for (let k = 0; k <= 10; k++) {
      const a = a0 + ((a1 - a0) * k) / 10;
      const px = cx + rInX * sc * Math.cos(a);
      const py = cy + rInZ * sc * Math.sin(a);
      k ? x.lineTo(px, py) : x.moveTo(px, py);
    }
    for (let k = 10; k >= 0; k--) {
      const a = a0 + ((a1 - a0) * k) / 10;
      x.lineTo(cx + rOutX * sc * Math.cos(a), cy + rOutZ * sc * Math.sin(a));
    }
    x.closePath();
    x.fillStyle = fill;
    x.fill();
    x.strokeStyle = 'rgba(4,7,13,.85)';
    x.lineWidth = 1;
    x.stroke();
  }
  function drawOverviewBase() {
    if (!ui.ov || !seatSys) return;
    const cv = ui.ov.canvas;
    ovBase.width = cv.width;
    ovBase.height = cv.height;
    const x = ovBase.getContext('2d');
    const W = cv.width;
    const H = cv.height;
    const cx = W / 2;
    const cy = H / 2;
    const sc = Math.min((W - 24) / (2 * RXmax), (H - 16) / (2 * RZmax));
    x.clearRect(0, 0, W, H);
    const SECTIONS = seatSys.SECTIONS;
    const selSec = selectedIdx >= 0 ? seatSys.meta.secIdx[selectedIdx] : -1;
    for (let s = 0; s < SECTIONS; s++) {
      const a0 = (s / SECTIONS) * TAU;
      const a1 = ((s + 1) / SECTIONS) * TAU;
      const lowSel = selSec === s;
      const upSel = selSec === s + SECTIONS;
      fillSectionWedge(
        x,
        cx,
        cy,
        sc,
        a0,
        a1,
        BOWL.inRx,
        BOWL.inRz,
        BOWL.midRx,
        BOWL.midRz,
        lowSel ? 'rgba(57,196,255,.9)' : 'rgba(18,78,168,.82)',
      );
      fillSectionWedge(
        x,
        cx,
        cy,
        sc,
        a0,
        a1,
        BOWL.upInRx,
        BOWL.upInRz,
        BOWL.outRx,
        BOWL.outRz,
        upSel ? 'rgba(57,196,255,.9)' : 'rgba(12,48,110,.62)',
      );
    }
    // track
    x.beginPath();
    x.ellipse(cx, cy, TRACK.outRx * sc, TRACK.outRz * sc, 0, 0, TAU);
    x.ellipse(cx, cy, TRACK.inRx * sc, TRACK.inRz * sc, 0, 0, TAU);
    x.fillStyle = '#c45328';
    x.fill('evenodd');
    x.strokeStyle = 'rgba(255,255,255,.55)';
    x.lineWidth = 1;
    x.beginPath();
    x.ellipse(cx, cy, TRACK.outRx * sc, TRACK.outRz * sc, 0, 0, TAU);
    x.stroke();
    x.beginPath();
    x.ellipse(cx, cy, TRACK.inRx * sc, TRACK.inRz * sc, 0, 0, TAU);
    x.stroke();
    // pitch
    const pw = FIELD.L * sc;
    const ph = FIELD.W * sc;
    x.fillStyle = '#15602a';
    x.fillRect(cx - pw / 2, cy - ph / 2, pw, ph);
    x.strokeStyle = 'rgba(240,250,255,.75)';
    x.lineWidth = 1;
    x.strokeRect(cx - pw / 2 + 2, cy - ph / 2 + 2, pw - 4, ph - 4);
    x.beginPath();
    x.moveTo(cx, cy - ph / 2 + 2);
    x.lineTo(cx, cy + ph / 2 - 2);
    x.stroke();
    x.beginPath();
    x.arc(cx, cy, ph * 0.13, 0, TAU);
    x.stroke();
    ui._ovScale = sc;
  }
  function drawOverview() {
    if (!ui.ov || !seatSys) return;
    const x = ui.ov;
    const W = x.canvas.width;
    const H = x.canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const sc = ui._ovScale || 1;
    x.clearRect(0, 0, W, H);
    x.drawImage(ovBase, 0, 0);
    if (selectedIdx >= 0) {
      const m = seatSys.meta;
      const px = cx + m.pos[selectedIdx * 3] * sc;
      const py = cy + m.pos[selectedIdx * 3 + 2] * sc;
      x.beginPath();
      x.arc(px, py, 4, 0, TAU);
      x.fillStyle = '#eaffff';
      x.fill();
      x.beginPath();
      x.arc(px, py, 8, 0, TAU);
      x.strokeStyle = 'rgba(57,196,255,.9)';
      x.lineWidth = 2;
      x.stroke();
      x.font = '700 15px ' + getComputedStyle(document.body).fontFamily;
      x.fillStyle = '#dff4ff';
      x.textAlign = 'center';
      x.fillText(String(m.label[selectedIdx]), px, py - 14);
    }
  }
  function drawMiniMap() {
    if (!ui.mm) return;
    const x = ui.mm;
    const W = x.canvas.width;
    const H = x.canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const sc = Math.min((W - 30) / (2 * RXmax), (H - 24) / (2 * RZmax));
    x.clearRect(0, 0, W, H);
    // lower + upper rings
    [
      [
        (BOWL.inRx + BOWL.midRx) / 2,
        (BOWL.inRz + BOWL.midRz) / 2,
        BOWL.midRx - BOWL.inRx,
        'rgba(30,90,190,.55)',
      ],
      [
        (BOWL.upInRx + BOWL.outRx) / 2,
        (BOWL.upInRz + BOWL.outRz) / 2,
        BOWL.outRx - BOWL.upInRx,
        'rgba(20,55,140,.5)',
      ],
    ].forEach(([rx, rz, w, col]) => {
      x.beginPath();
      x.ellipse(cx, cy, rx * sc, rz * sc, 0, 0, TAU);
      x.lineWidth = Math.max(4, w * sc * 0.55);
      x.strokeStyle = col;
      x.stroke();
    });
    x.beginPath();
    x.ellipse(cx, cy, TRACK.outRx * sc, TRACK.outRz * sc, 0, 0, TAU);
    x.ellipse(cx, cy, TRACK.inRx * sc, TRACK.inRz * sc, 0, 0, TAU);
    x.fillStyle = '#c45328';
    x.fill('evenodd');
    const pw = FIELD.L * sc;
    const ph = FIELD.W * sc;
    x.fillStyle = '#187031';
    x.fillRect(cx - pw / 2, cy - ph / 2, pw, ph);
    x.strokeStyle = 'rgba(235,248,255,.8)';
    x.lineWidth = 1.5;
    x.strokeRect(cx - pw / 2 + 3, cy - ph / 2 + 3, pw - 6, ph - 6);
    x.beginPath();
    x.moveTo(cx, cy - ph / 2 + 3);
    x.lineTo(cx, cy + ph / 2 - 3);
    x.stroke();
    x.beginPath();
    x.arc(cx, cy, ph * 0.14, 0, TAU);
    x.stroke();
    if (selectedIdx >= 0 && seatSys) {
      const m = seatSys.meta;
      const px = cx + m.pos[selectedIdx * 3] * sc;
      const py = cy + m.pos[selectedIdx * 3 + 2] * sc;
      x.beginPath();
      x.arc(px, py, 4, 0, TAU);
      x.fillStyle = '#67e8f9';
      x.fill();
    }
    const camA = Math.atan2(
      camera.position.z / RZmax,
      camera.position.x / RXmax,
    );
    const camD = Math.min(
      1.25,
      Math.hypot(camera.position.x / RXmax, camera.position.z / RZmax),
    );
    const px = cx + Math.cos(camA) * camD * RXmax * sc;
    const py = cy + Math.sin(camA) * camD * RZmax * sc;
    x.beginPath();
    x.moveTo(px, py);
    x.lineTo(cx, cy);
    x.strokeStyle = 'rgba(57,196,255,.35)';
    x.lineWidth = 2;
    x.stroke();
    x.beginPath();
    x.arc(px, py, 9, 0, TAU);
    x.fillStyle = '#2f9bff';
    x.fill();
    x.beginPath();
    x.arc(px, py, 9, 0, TAU);
    x.strokeStyle = 'rgba(255,255,255,.85)';
    x.lineWidth = 2;
    x.stroke();
    x.fillStyle = '#fff';
    x.fillRect(px - 4, py - 2.5, 6, 5);
    x.beginPath();
    x.moveTo(px + 2, py);
    x.lineTo(px + 5, py - 2.5);
    x.lineTo(px + 5, py + 2.5);
    x.closePath();
    x.fill();
  }

  /* ---------- seat panel + controls ---------- */
  bind('bk-exit', exitSeatMode);
  bind('bk-snd', () => {
    muted = !muted;
    if (ui.bkSnd) ui.bkSnd.style.opacity = muted ? 0.4 : 1;
    ensureAudio();
    setAudioNear(mode === 'seat');
  });
  bind('checkout', () => {
    if (mode === 'seat') return;
    if (currentInfo) flyToSeat(currentInfo.i);
    else if (seatSys) {
      let featured = -1;
      const m = seatSys.meta;
      for (let i = 0; i < seatSys.SEAT_COUNT; i++) {
        if (
          m.tier[i] === 0 &&
          m.row[i] === 10 &&
          Math.cos(Math.atan2(m.pos[i * 3 + 2], m.pos[i * 3]) - Math.PI / 2) >
            0.7
        ) {
          featured = i;
          break;
        }
      }
      if (featured < 0) featured = Math.floor(seatSys.SEAT_COUNT * 0.35);
      currentInfo = seatInfo(featured);
      updatePanel(currentInfo, 'ready');
      flyToSeat(featured);
    }
  });

  // seed featured seat in panel (Misr-style right column)
  if (seatSys) {
    const m = seatSys.meta;
    let featured = Math.floor(seatSys.SEAT_COUNT * 0.35);
    for (let i = 0; i < seatSys.SEAT_COUNT; i++) {
      if (
        m.tier[i] === 0 &&
        m.row[i] === 12 &&
        Math.cos(Math.atan2(m.pos[i * 3 + 2], m.pos[i * 3]) - Math.PI / 2) > 0.55
      ) {
        featured = i;
        break;
      }
    }
    applySelection(featured);
    currentInfo = seatInfo(featured);
    updatePanel(currentInfo, 'ready');
    drawOverviewBase();
  }

  const teamNames = document.querySelectorAll('#match .team .name');
  if (teamNames[0] && metaInfo.teams?.home)
    teamNames[0].textContent = metaInfo.teams.home;
  if (teamNames[1] && metaInfo.teams?.away)
    teamNames[1].textContent = metaInfo.teams.away;
  const eyebrow = document.querySelector('#match .eyebrow');
  if (eyebrow && metaInfo.matchLabel) eyebrow.textContent = metaInfo.matchLabel;

  on(window, 'resize', () => {
    if (disposed) return;
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  let lastPick = 0;
  function updateHover(now) {
    if (!pendingHover || mode !== 'orbit' || now - lastPick < 40) return;
    lastPick = now;
    const { x, y } = pendingHover;
    pendingHover = null;
    const idx = pickAt(x, y);
    setHover(idx);
    if (idx >= 0) {
      showTip(x, y, seatInfo(idx));
      canvas.style.cursor = 'pointer';
    } else {
      hideTip();
      canvas.style.cursor = '';
    }
  }

  const clock = new THREE.Clock();
  let firstFrame = true;
  function animate() {
    if (disposed) return;
    rafId = requestAnimationFrame(animate);
    const dt = Math.min(0.05, clock.getDelta());
    const t = clock.elapsedTime;
    const now = performance.now();
    swayU.value = t;
    exciteU.value += (1 - exciteU.value) * Math.min(1, dt * 0.55);
    for (const a of animatedTextures) a.t.offset.x += a.speed * dt * 10;
    matchPlay.update(t, dt);

    if (mode === 'orbit') {
      if (!userInteracted && !REDUCED) orbit.thetaT += dt * 0.016;
      const k = Math.min(1, dt * 5.5);
      orbit.theta += (orbit.thetaT - orbit.theta) * k;
      orbit.phi += (orbit.phiT - orbit.phi) * k;
      orbit.radius += (orbit.radiusT - orbit.radius) * k;
      applyOrbit();
      updateHover(now);
    } else if (mode === 'seat') {
      const swayY = REDUCED
        ? 0
        : Math.sin(t * 0.9) * 0.012 + Math.sin(t * 2.3) * 0.005;
      const swayYaw = REDUCED ? 0 : Math.sin(t * 0.42) * 0.006;
      const swayPitch = REDUCED ? 0 : Math.cos(t * 0.57) * 0.004;
      camera.position.set(
        seatView.eye.x,
        seatView.eye.y + swayY,
        seatView.eye.z,
      );
      const yaw = seatView.yawBase + seatView.yawOff + swayYaw;
      const pitch = seatView.pitchBase + seatView.pitchOff + swayPitch;
      const look = new THREE.Vector3(
        seatView.eye.x + Math.sin(yaw) * Math.cos(pitch),
        seatView.eye.y + Math.sin(pitch),
        seatView.eye.z + Math.cos(yaw) * Math.cos(pitch),
      );
      camera.lookAt(look);
    }

    drawMiniMap();
    drawOverview();
    renderer.render(scene, camera);
    if (firstFrame) {
      firstFrame = false;
      if (loader) loader.classList.add('hide');
      if (currentInfo) {
        setTimeout(() => {
          try {
            captureView(currentInfo.i);
          } catch (_) {}
        }, 60);
      }
      toast(
        'Cairo International · click a seat for spectator view',
        4000,
      );
    }
  }
  animate();

  return {
    id: metaInfo.id,
    canvas,
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(rafId);
      if (whoopTimer) clearTimeout(whoopTimer);
      try {
        if (AC && AC.state !== 'closed') AC.close();
      } catch (_) {}
      AC = null;
      crowdMaster = null;
      ambGain = cheerGain = null;
      audioReady = false;
      try {
        gsap.killTweensOf('*');
      } catch (_) {}
      try {
        matchPlay.dispose();
      } catch (_) {}
      pickRT.dispose();
      disposers.forEach((fn) => {
        try {
          fn();
        } catch (_) {}
      });
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material)
            ? obj.material
            : [obj.material];
          mats.forEach((m) => {
            if (!m) return;
            if (m.map) m.map.dispose();
            m.dispose();
          });
        }
      });
      renderer.dispose();
      canvas.classList.remove('dragging', 'seatmode');
      if (ui.dock) ui.dock.classList.remove('hidden');
      if (ui.backbar) ui.backbar.classList.remove('show');
      hideTip();
      const tn = document.querySelectorAll('#match .team .name');
      if (tn[0]) tn[0].textContent = 'EGYPT';
      if (tn[1]) tn[1].textContent = 'ARGENTINA';
      const eb = document.querySelector('#match .eyebrow');
      if (eb) eb.textContent = 'LIVE DEMO';
    },
  };
}
