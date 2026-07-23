import * as THREE from 'three';
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
  seats: false,
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
  renderer.toneMappingExposure = 1.2;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd8dde4);
  scene.fog = new THREE.Fog(0xd8dde4, 420, 980);

  const camera = new THREE.PerspectiveCamera(
    46,
    innerWidth / innerHeight,
    0.4,
    1400,
  );

  scene.add(new THREE.HemisphereLight(0xeaf4ff, 0x9aaa88, 0.9));
  scene.add(new THREE.AmbientLight(0xffffff, 0.48));
  const sun = new THREE.DirectionalLight(0xfff1d8, 1.05);
  sun.position.set(140, 170, 90);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xd0e6ff, 0.32);
  fill.position.set(-90, 70, -50);
  scene.add(fill);

  const concrete = new THREE.MeshLambertMaterial({ color: 0xc5cbd4 });
  const concreteDark = new THREE.MeshLambertMaterial({ color: 0xa8b0bc });
  const stone = new THREE.MeshLambertMaterial({ color: 0xc4b89a });
  const stoneDark = new THREE.MeshLambertMaterial({ color: 0xb5a888 });
  const beige = new THREE.MeshLambertMaterial({ color: 0xc4a574 });
  const beigeDark = new THREE.MeshLambertMaterial({ color: 0xa88a58 });
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
  const steelDark = new THREE.MeshLambertMaterial({ color: 0x6a7382 });
  /* Bowl widened so seating clears the full track */
  const BOWL = {
    inRx: 90,
    inRz: 68,
    midRx: 118,
    midRz: 92,
    outRx: 152,
    outRz: 120,
    y0: 1.4,
    midY: 13.5,
    y1: 30,
  };

  /* ---------- surroundings (Genius&Gerry site layout) ---------- */
  {
    // Neutral paved ground (light grey plaza field like the reference)
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(1, 96),
      new THREE.MeshLambertMaterial({ color: 0xd4d8de }),
    );
    ground.scale.set(580, 520, 1);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.45;
    scene.add(ground);

    // Inner service apron around the bowl
    scene.add(
      ringStrip(
        BOWL.outRx + 2,
        BOWL.outRz + 2,
        -0.18,
        BOWL.outRx + 16,
        BOWL.outRz + 14,
        -0.18,
        140,
        new THREE.MeshLambertMaterial({
          color: 0xc5cad2,
          side: THREE.DoubleSide,
        }),
        1,
      ),
    );

    // Wide dark-grey perimeter ring road
    const roadMat = new THREE.MeshLambertMaterial({
      color: 0x4a515c,
      side: THREE.DoubleSide,
    });
    scene.add(
      ringStrip(
        BOWL.outRx + 16,
        BOWL.outRz + 14,
        -0.1,
        BOWL.outRx + 40,
        BOWL.outRz + 34,
        -0.1,
        160,
        roadMat,
        1,
      ),
    );
    // road edge lines
    const lineMat = new THREE.MeshBasicMaterial({
      color: 0xe4e8ee,
      side: THREE.DoubleSide,
    });
    scene.add(
      ringStrip(
        BOWL.outRx + 27.2,
        BOWL.outRz + 23.2,
        -0.05,
        BOWL.outRx + 28.4,
        BOWL.outRz + 24.2,
        -0.05,
        160,
        lineMat,
        1,
      ),
    );

    // Front circular plaza (+Z) — concentric paving + curved green beds
    const plazaZ = BOWL.outRz + 56;
    const plazaMat = new THREE.MeshLambertMaterial({ color: 0xc8ced6 });
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(56, 80), plazaMat);
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(0, -0.1, plazaZ);
    scene.add(plaza);
    for (let r = 12; r <= 50; r += 7) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(r - 0.7, r, 80),
        new THREE.MeshLambertMaterial({
          color: r % 14 === 5 ? 0xb4bac4 : 0xaeb6c0,
          side: THREE.DoubleSide,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(0, -0.05, plazaZ);
      scene.add(ring);
    }
    const lawnMat = new THREE.MeshLambertMaterial({ color: 0x34a344 });
    // curved planter beds (reference: arcs of grass in plaza)
    for (let i = 0; i < 5; i++) {
      const a0 = -0.9 + i * 0.45;
      const bed = new THREE.Mesh(
        new THREE.RingGeometry(20, 32, 40, 1, a0, 0.32),
        lawnMat,
      );
      bed.rotation.x = -Math.PI / 2;
      bed.position.set(0, 0.02, plazaZ);
      scene.add(bed);
      const lip = new THREE.Mesh(
        new THREE.RingGeometry(19.5, 20, 40, 1, a0, 0.32),
        concreteDark,
      );
      lip.rotation.x = -Math.PI / 2;
      lip.position.set(0, 0.12, plazaZ);
      scene.add(lip);
    }
    // plaza center disk
    const center = new THREE.Mesh(
      new THREE.CircleGeometry(8, 40),
      new THREE.MeshLambertMaterial({ color: 0xb8bfc8 }),
    );
    center.rotation.x = -Math.PI / 2;
    center.position.set(0, -0.02, plazaZ);
    scene.add(center);

    // Outer rectangular lawn islands + clustered trees (reference pattern)
    const bush = new THREE.MeshLambertMaterial({ color: 0x2e8a38 });
    const trunk = new THREE.MeshLambertMaterial({ color: 0x5c4028 });
    const leaf = new THREE.MeshLambertMaterial({ color: 0x1c6b2c });
    const addTree = (x, z, s = 1) => {
      const tr = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22 * s, 0.3 * s, 4.2 * s, 6),
        trunk,
      );
      tr.position.set(x, 2.1 * s, z);
      scene.add(tr);
      const cr = new THREE.Mesh(
        new THREE.SphereGeometry(1.7 * s, 8, 6),
        leaf,
      );
      cr.scale.set(1.15, 0.55, 1.15);
      cr.position.set(x, 4.6 * s, z);
      scene.add(cr);
    };

    // lawn patches around the ring road (square / rect like Genius&Gerry)
    const patchSpecs = [];
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * TAU + 0.12;
      const rr = BOWL.outRx + 48 + (i % 3) * 6;
      const rz = BOWL.outRz + 40 + (i % 3) * 5;
      const [x, z] = ellipsePoint(rr, rz, a);
      patchSpecs.push({
        x,
        z,
        a,
        w: 10 + (i % 4) * 2.5,
        d: 8 + (i % 3) * 2,
      });
    }
    // extra patches near plaza sides
    patchSpecs.push(
      { x: -42, z: plazaZ + 8, a: 0, w: 16, d: 10 },
      { x: 42, z: plazaZ + 8, a: 0, w: 16, d: 10 },
      { x: -55, z: plazaZ - 18, a: 0.2, w: 12, d: 9 },
      { x: 55, z: plazaZ - 18, a: -0.2, w: 12, d: 9 },
    );
    patchSpecs.forEach((p, i) => {
      const patch = new THREE.Mesh(
        new THREE.BoxGeometry(p.w, 0.14, p.d),
        bush,
      );
      patch.position.set(p.x, 0.02, p.z);
      patch.rotation.y = -p.a;
      scene.add(patch);
      // 2–4 trees per patch
      const n = 2 + (i % 3);
      for (let t = 0; t < n; t++) {
        const ox = (t - (n - 1) / 2) * (p.w / (n + 0.5));
        const oz = ((t % 2) - 0.5) * 2.2;
        const ca = Math.cos(-p.a),
          sa = Math.sin(-p.a);
        addTree(p.x + ca * ox - sa * oz, p.z + sa * ox + ca * oz, 0.85 + (t % 3) * 0.12);
      }
    });

    // Trees lining the outer edge of the ring road
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * TAU;
      const [x, z] = ellipsePoint(BOWL.outRx + 38, BOWL.outRz + 32, a);
      if (i % 3 !== 0) addTree(x, z, 0.75 + (i % 4) * 0.08);
    }

    // Small parking lots (4 sectors) — light grey slabs + tiny cars
    const carCols = [0xe8ecf0, 0x2a3344, 0x8b0000, 0xffffff, 0x4a5568];
    for (let sec = 0; sec < 4; sec++) {
      const a0 = (sec / 4) * TAU + 0.35;
      const lr = BOWL.outRx + 62;
      const lot = new THREE.Mesh(
        new THREE.BoxGeometry(34, 0.1, 18),
        new THREE.MeshLambertMaterial({ color: 0x9aa3ae }),
      );
      lot.position.set(lr * Math.cos(a0), -0.05, (BOWL.outRz + 52) * Math.sin(a0));
      lot.rotation.y = -a0;
      scene.add(lot);
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 5; col++) {
          const car = new THREE.Mesh(
            new THREE.BoxGeometry(2.0, 0.75, 3.6),
            new THREE.MeshLambertMaterial({
              color: carCols[(row * 5 + col + sec) % carCols.length],
            }),
          );
          const ox = (col - 2) * 5.2;
          const oz = (row - 0.5) * 6.5;
          car.position.set(
            lot.position.x + Math.cos(a0) * oz - Math.sin(a0) * ox,
            0.4,
            lot.position.z + Math.sin(a0) * oz + Math.cos(a0) * ox,
          );
          car.rotation.y = -a0;
          scene.add(car);
        }
      }
    }
  }

  /* ---------- pitch + track + goals + dugouts (Misr-quality playground) ---------- */
  {
    const px = 10; // pixels per metre
    const tex = canvasTexture(FIELD.L * px, FIELD.W * px, (x, w, h) => {
      const stripes = 14,
        sw = w / stripes;
      for (let i = 0; i < stripes; i++) {
        x.fillStyle = i % 2 ? '#1d7a34' : '#1a6d2e';
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
        emissive: 0x1c5c2a,
        emissiveIntensity: 0.24,
        emissiveMap: tex,
      }),
    );
    pitch.rotation.x = -Math.PI / 2;
    pitch.position.y = 0.06;
    pitch.receiveShadow = true;
    scene.add(pitch);

    // dark elliptical apron under pitch–track gaps
    const apron = new THREE.Mesh(
      new THREE.CircleGeometry(1, 96),
      new THREE.MeshLambertMaterial({ color: 0x101826 }),
    );
    apron.scale.set(TRACK.outRx + 0.6, TRACK.outRz + 0.6, 1);
    apron.rotation.x = -Math.PI / 2;
    apron.position.y = 0.0;
    apron.receiveShadow = true;
    scene.add(apron);

    // grass verge between rectangular pitch and track inner curb
    scene.add(
      ringStrip(
        FIELD.L / 2 + 0.15,
        FIELD.W / 2 + 0.15,
        0.035,
        TRACK.inRx,
        TRACK.inRz,
        0.035,
        160,
        new THREE.MeshLambertMaterial({
          color: 0x1a5c2e,
          side: THREE.DoubleSide,
        }),
        1,
      ),
    );

    // tartan 8-lane track
    const trackTex = canvasTexture(
      1024,
      160,
      (x, w, h) => {
        const base = x.createLinearGradient(0, 0, 0, h);
        base.addColorStop(0, '#d4622f');
        base.addColorStop(0.5, '#c45328');
        base.addColorStop(1, '#b44922');
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

    // white concrete curbs
    const curbMat = new THREE.MeshLambertMaterial({
      color: 0xe8eef8,
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
        curbMat,
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
        curbMat,
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
        concreteDark,
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

    // professional dugouts on the near touchline
    const dugoutZ = FIELD.W / 2 + 4.2;
    const dugoutCenters = [-16, 16];
    dugoutCenters.forEach((cx, di) => {
      const grp = new THREE.Group();
      const floor = new THREE.Mesh(
        new THREE.BoxGeometry(14, 0.28, 3.4),
        new THREE.MeshLambertMaterial({ color: 0x1a2233 }),
      );
      floor.position.set(cx, 0.14, dugoutZ);
      floor.receiveShadow = true;
      grp.add(floor);
      const back = new THREE.Mesh(
        new THREE.BoxGeometry(14, 2.4, 0.2),
        steelDark,
      );
      back.position.set(cx, 1.35, dugoutZ + 1.45);
      grp.add(back);
      [-1, 1].forEach((s) => {
        const side = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 2.4, 3.2),
          steelDark,
        );
        side.position.set(cx + s * 6.9, 1.35, dugoutZ);
        grp.add(side);
      });
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(14.4, 0.16, 3.8),
        new THREE.MeshLambertMaterial({ color: 0xe8eef6 }),
      );
      roof.position.set(cx, 2.65, dugoutZ + 0.1);
      roof.rotation.x = -0.12;
      grp.add(roof);
      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(13.2, 1.35, 0.06),
        new THREE.MeshLambertMaterial({
          color: 0x8ec8ff,
          transparent: true,
          opacity: 0.28,
        }),
      );
      glass.position.set(cx, 1.55, dugoutZ - 1.55);
      grp.add(glass);
      for (let i = 0; i < 5; i++) {
        const post = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 1.5, 0.08),
          steel,
        );
        post.position.set(cx - 6 + i * 3, 1.55, dugoutZ - 1.55);
        grp.add(post);
      }
      const tech = new THREE.Mesh(
        new THREE.BoxGeometry(12, 0.04, 0.08),
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
      );
      tech.position.set(cx, 0.03, dugoutZ - 2.1);
      grp.add(tech);
      // Ahly red / Zamalek white-black benches
      const padCol = di === 0 ? 0xc8102e : 0xf5f7fa;
      const restCol = di === 0 ? 0x8b0018 : 0x1a1a1a;
      for (let b = 0; b < 3; b++) {
        const pad = new THREE.Mesh(
          new THREE.BoxGeometry(4.2, 0.22, 0.55),
          new THREE.MeshLambertMaterial({ color: padCol }),
        );
        pad.position.set(cx - 4.2 + b * 4.2, 0.55, dugoutZ + 0.35);
        grp.add(pad);
        const backrest = new THREE.Mesh(
          new THREE.BoxGeometry(4.2, 0.55, 0.12),
          new THREE.MeshLambertMaterial({ color: restCol }),
        );
        backrest.position.set(cx - 4.2 + b * 4.2, 0.9, dugoutZ + 0.62);
        grp.add(backrest);
      }
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(6, 0.45, 0.08),
        new THREE.MeshBasicMaterial({
          color: padCol,
          toneMapped: false,
        }),
      );
      plate.position.set(cx, 2.35, dugoutZ - 1.7);
      grp.add(plate);
      grp.traverse((o) => {
        if (o.isMesh) o.castShadow = true;
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

  /* ---------- seating bowl: textured rings + instanced seats ---------- */
  {
    const ROWS_LOW = 16;
    const ROWS_UP = 18;
    const aisleEvery = 14;
    const seats = [];
    const bluePal = [0x163f8a, 0x1a4f9c, 0x1e5aad, 0x2456a0, 0x0f3370];
    const warmPal = [0xf0a018, 0xe88810, 0xf5c430, 0xd97810, 0xffb020];

    const seatBandTex = (warmBias) =>
      canvasTexture(
        256,
        64,
        (x, w, h) => {
          for (let y = 0; y < h; y++) {
            for (let xx = 0; xx < w; xx++) {
              const t = y / h;
              const warm =
                Math.random() <
                warmBias * (1 - t * 0.75) + (xx % 36 < 5 ? 0.12 : 0);
              const pal = warm ? warmPal : bluePal;
              const c = pal[(Math.random() * pal.length) | 0];
              x.fillStyle = "#" + c.toString(16).padStart(6, "0");
              x.fillRect(xx, y, 1, 1);
            }
          }
          x.fillStyle = "rgba(210,215,225,0.9)";
          for (let i = 0; i < 14; i++) {
            x.fillRect(((i + 0.5) / 14) * w - 1, 0, 2, h);
          }
        },
        14,
        3,
      );

    const lowMat = new THREE.MeshLambertMaterial({
      map: seatBandTex(0.78),
      side: THREE.DoubleSide,
    });
    const upMat = new THREE.MeshLambertMaterial({
      map: seatBandTex(0.16),
      side: THREE.DoubleSide,
    });
    scene.add(
      ringStrip(
        BOWL.inRx,
        BOWL.inRz,
        BOWL.y0,
        BOWL.midRx,
        BOWL.midRz,
        BOWL.midY,
        140,
        lowMat,
        14,
      ),
    );
    scene.add(
      ringStrip(
        BOWL.midRx + 1,
        BOWL.midRz + 1,
        BOWL.midY + 1.2,
        BOWL.outRx - 3,
        BOWL.outRz - 2.5,
        BOWL.y1,
        140,
        upMat,
        14,
      ),
    );

    const placeRow = (row, rowsTotal, yBase, rIn, rOut, rzIn, rzOut, tier) => {
      const t = row / Math.max(1, rowsTotal - 1);
      const rx = rIn + (rOut - rIn) * t;
      const rz = rzIn + (rzOut - rzIn) * t;
      const y = yBase + t * (tier === 0 ? 11.2 : 14.2) + 0.35;
      const nSeats = Math.floor(26 + rx * 0.78);
      for (let i = 0; i < nSeats; i++) {
        const a = (i / nSeats) * TAU;
        const sec = Math.floor((i / nSeats) * aisleEvery);
        const local = (i / nSeats) * aisleEvery - sec;
        if (local < 0.04 || local > 0.96) continue;
        const [x, z] = ellipsePoint(rx, rz, a);
        const endBias = Math.abs(Math.cos(a)) > 0.72;
        const warmSector =
          sec % 4 === 0 || (tier === 0 && endBias && sec % 2 === 0);
        const useWarm =
          tier === 0 ? warmSector && t < 0.88 : warmSector && t < 0.22;
        const pal = useWarm ? warmPal : bluePal;
        seats.push({
          x,
          y,
          z,
          a,
          color: pal[(sec + row) % pal.length],
        });
      }
    };

    for (let r = 0; r < ROWS_LOW; r++) {
      placeRow(
        r,
        ROWS_LOW,
        BOWL.y0,
        BOWL.inRx,
        BOWL.midRx,
        BOWL.inRz,
        BOWL.midRz,
        0,
      );
    }
    for (let r = 0; r < ROWS_UP; r++) {
      placeRow(
        r,
        ROWS_UP,
        BOWL.midY + 1.4,
        BOWL.midRx + 2,
        BOWL.outRx - 5,
        BOWL.midRz + 2,
        BOWL.outRz - 4,
        1,
      );
    }

    const slab = new THREE.MeshLambertMaterial({
      color: 0x6a7382,
      side: THREE.DoubleSide,
    });
    scene.add(
      ringStrip(
        BOWL.inRx - 1.2,
        BOWL.inRz - 1,
        BOWL.y0 - 0.55,
        BOWL.midRx,
        BOWL.midRz,
        BOWL.midY - 0.2,
        100,
        slab,
        1,
      ),
    );
    scene.add(
      ringStrip(
        BOWL.midRx + 1,
        BOWL.midRz + 1,
        BOWL.midY + 0.5,
        BOWL.outRx - 2,
        BOWL.outRz - 2,
        BOWL.y1 - 0.3,
        100,
        slab,
        1,
      ),
    );
    scene.add(
      ringStrip(
        BOWL.midRx - 1,
        BOWL.midRz - 1,
        BOWL.midY,
        BOWL.midRx + 4,
        BOWL.midRz + 3.2,
        BOWL.midY + 0.4,
        100,
        concrete,
        1,
      ),
    );

    const aisleMat = new THREE.MeshLambertMaterial({ color: 0xd5dae3 });
    for (let s = 0; s < aisleEvery; s++) {
      const a = (s / aisleEvery) * TAU;
      const [x0, z0] = ellipsePoint(BOWL.inRx + 1, BOWL.inRz + 1, a);
      const [x1, z1] = ellipsePoint(BOWL.outRx - 4, BOWL.outRz - 3.5, a);
      const len = Math.hypot(x1 - x0, z1 - z0);
      const stair = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.18, len),
        aisleMat,
      );
      stair.position.set((x0 + x1) * 0.5, BOWL.midY * 0.52, (z0 + z1) * 0.5);
      stair.lookAt(x1, BOWL.midY * 0.52, z1);
      stair.rotateX(-0.2);
      scene.add(stair);
    }

    const seatGeo = new THREE.BoxGeometry(0.72, 0.46, 0.72);
    seatGeo.translate(0, 0.23, 0);
    const seatMesh = new THREE.InstancedMesh(
      seatGeo,
      new THREE.MeshLambertMaterial({ color: 0xffffff }),
      seats.length,
    );
    const dm = new THREE.Object3D();
    const col = new THREE.Color();
    seats.forEach((s, i) => {
      dm.position.set(s.x, s.y, s.z);
      dm.rotation.set(0, -s.a + Math.PI, 0);
      dm.updateMatrix();
      seatMesh.setMatrixAt(i, dm.matrix);
      seatMesh.setColorAt(i, col.setHex(s.color));
    });
    seatMesh.instanceMatrix.needsUpdate = true;
    if (seatMesh.instanceColor) seatMesh.instanceColor.needsUpdate = true;
    scene.add(seatMesh);

    const tunMat = new THREE.MeshLambertMaterial({ color: 0x252a32 });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + 0.15;
      const [x, z] = ellipsePoint(BOWL.inRx - 1.5, BOWL.inRz - 1.2, a);
      const tun = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3.0, 7), tunMat);
      tun.position.set(x, 1.6, z);
      tun.rotation.y = -a;
      scene.add(tun);
    }

    if (loaderText) {
      loaderText.textContent =
        "Placing " + seats.length.toLocaleString() + " seats…";
    }
  }

  /* ---------- exterior stone shell, openings, ramps ---------- */
  {
    // Rough tan stone sloping apron (reference outer wall)
    const stoneTex = canvasTexture(256, 256, (x, w, h) => {
      x.fillStyle = "#c2b59a";
      x.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) {
        const n = 140 + ((Math.random() * 50) | 0);
        x.fillStyle = "rgba(" + n + "," + (n - 12) + "," + (n - 28) + ",0.35)";
        x.fillRect(
          Math.random() * w,
          Math.random() * h,
          2 + Math.random() * 6,
          2 + Math.random() * 4,
        );
      }
    }, 8, 2);
    const stoneMat = new THREE.MeshLambertMaterial({
      map: stoneTex,
      color: 0xcfc3a8,
      side: THREE.DoubleSide,
    });
    const stoneMat2 = new THREE.MeshLambertMaterial({
      color: 0xb9ab90,
      side: THREE.DoubleSide,
    });

    // lower slope: ground → mid
    scene.add(
      ringStrip(
        BOWL.outRx + 1,
        BOWL.outRz + 1,
        BOWL.y1 * 0.42,
        BOWL.outRx + 20,
        BOWL.outRz + 17,
        0.2,
        160,
        stoneMat,
        10,
      ),
    );
    // upper wall face
    scene.add(
      ringStrip(
        BOWL.outRx - 1.5,
        BOWL.outRz - 1.2,
        0.15,
        BOWL.outRx + 3,
        BOWL.outRz + 2.5,
        BOWL.y1 + 1.5,
        160,
        stoneMat2,
        8,
      ),
    );
    // elevated outer concourse ledge (darker grey walkway on top rim)
    scene.add(
      ringStrip(
        BOWL.outRx - 3,
        BOWL.outRz - 2.5,
        BOWL.y1 + 1.2,
        BOWL.outRx + 4,
        BOWL.outRz + 3.5,
        BOWL.y1 + 1.55,
        140,
        new THREE.MeshLambertMaterial({
          color: 0x8a919c,
          side: THREE.DoubleSide,
        }),
        2,
      ),
    );
    // rim coping / top edge
    scene.add(
      ringStrip(
        BOWL.outRx - 2,
        BOWL.outRz - 1.5,
        BOWL.y1 + 1.5,
        BOWL.outRx + 0.8,
        BOWL.outRz + 0.6,
        BOWL.y1 + 2.4,
        120,
        concrete,
        2,
      ),
    );

    // blue utility / gate boxes on the upper outer walkway
    const blueBox = new THREE.MeshLambertMaterial({ color: 0x1c5a9c });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + 0.1;
      const [x, z] = ellipsePoint(BOWL.outRx + 1.5, BOWL.outRz + 1.2, a);
      const box = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 2.4), blueBox);
      box.position.set(x, BOWL.y1 + 2.6, z);
      box.rotation.y = -a;
      scene.add(box);
    }

    // ground-level spectator tunnels / openings in the stone base
    const holeMat = new THREE.MeshLambertMaterial({ color: 0x15191f });
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU;
      const [x, z] = ellipsePoint(BOWL.outRx + 10, BOWL.outRz + 8.5, a);
      const hole = new THREE.Mesh(new THREE.BoxGeometry(5.5, 3.6, 4), holeMat);
      hole.position.set(x, 1.9, z);
      hole.rotation.y = -a;
      scene.add(hole);
      // concrete lintel above opening
      const lintel = new THREE.Mesh(
        new THREE.BoxGeometry(6.2, 0.45, 4.2),
        concreteDark,
      );
      lintel.position.set(x, 3.9, z);
      lintel.rotation.y = -a;
      scene.add(lintel);
    }

    // wide access ramps from apron up the stone slope
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + 0.2;
      const [x0, z0] = ellipsePoint(BOWL.outRx + 18, BOWL.outRz + 15, a);
      const [x1, z1] = ellipsePoint(BOWL.outRx + 4, BOWL.outRz + 3.5, a);
      const len = Math.hypot(x1 - x0, z1 - z0);
      const ramp = new THREE.Mesh(
        new THREE.BoxGeometry(11, 0.85, len),
        concreteDark,
      );
      ramp.position.set((x0 + x1) * 0.5, 5.2, (z0 + z1) * 0.5);
      ramp.lookAt(x1, 10, z1);
      ramp.rotateX(-0.28);
      scene.add(ramp);
      // side walls
      [-1, 1].forEach((side) => {
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(0.4, 1.4, len * 0.92),
          concrete,
        );
        const ox = Math.cos(a + Math.PI / 2) * side * 5.2;
        const oz = Math.sin(a + Math.PI / 2) * side * 5.2;
        wall.position.set(
          ramp.position.x + ox,
          ramp.position.y + 0.5,
          ramp.position.z + oz,
        );
        wall.rotation.copy(ramp.rotation);
        scene.add(wall);
      });
    }
  }

  /* ---------- main entrance facade (+Z) — beige vertical panels ---------- */
  {
    const facadeZ = BOWL.outRz + 18;
    const panelW = 3.1;
    const panelH = 28;
    const n = 26;
    const total = n * panelW;
    for (let i = 0; i < n; i++) {
      const px = -total / 2 + panelW * 0.5 + i * panelW;
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(panelW - 0.22, panelH, 2.4),
        i % 2 ? beige : beigeDark,
      );
      panel.position.set(px, panelH / 2, facadeZ);
      scene.add(panel);
      // dark recesses between panels
      if (i < n - 1) {
        const gap = new THREE.Mesh(
          new THREE.BoxGeometry(0.35, panelH * 0.92, 0.5),
          new THREE.MeshLambertMaterial({ color: 0x2a3544 }),
        );
        gap.position.set(px + panelW * 0.5, panelH / 2, facadeZ + 0.3);
        scene.add(gap);
      }
    }
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(18, 11, 0.35),
      new THREE.MeshLambertMaterial({
        color: 0x152838,
        transparent: true,
        opacity: 0.82,
      }),
    );
    door.position.set(0, 5.6, facadeZ + 0.95);
    scene.add(door);
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(total + 6, 0.55, 12),
      concrete,
    );
    canopy.position.set(0, panelH + 0.35, facadeZ - 1.5);
    scene.add(canopy);

    const mkSign = (text, xOff) => {
      const cv = document.createElement('canvas');
      cv.width = 1024;
      cv.height = 128;
      const x = cv.getContext('2d');
      x.fillStyle = '#111';
      x.fillRect(0, 0, 1024, 128);
      x.fillStyle = '#f2f2f2';
      x.font = '700 40px sans-serif';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText(text, 512, 64);
      const tex = new THREE.CanvasTexture(cv);
      tex.encoding = THREE.sRGBEncoding;
      const board = new THREE.Mesh(
        new THREE.PlaneGeometry(30, 3.6),
        new THREE.MeshBasicMaterial({ map: tex }),
      );
      board.position.set(xOff, panelH - 2.8, facadeZ + 0.85);
      scene.add(board);
    };
    mkSign('CAIRO INTERNATIONAL STADIUM', 0);
    // Arabic line under English on same board via second smaller plane
    {
      const cv = document.createElement('canvas');
      cv.width = 1024;
      cv.height = 96;
      const x = cv.getContext('2d');
      x.fillStyle = '#111';
      x.fillRect(0, 0, 1024, 96);
      x.fillStyle = '#f2f2f2';
      x.font = '700 44px sans-serif';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText('استاد القاهرة الدولي', 512, 48);
      const tex = new THREE.CanvasTexture(cv);
      tex.encoding = THREE.sRGBEncoding;
      const board = new THREE.Mesh(
        new THREE.PlaneGeometry(28, 2.8),
        new THREE.MeshBasicMaterial({ map: tex }),
      );
      board.position.set(0, panelH - 6.2, facadeZ + 0.85);
      scene.add(board);
    }
  }

  /* ---------- white VIP / press box on -Z ---------- */
  {
    const vip = new THREE.Mesh(new THREE.BoxGeometry(56, 11, 16), whiteBuild);
    vip.position.set(0, BOWL.y1 - 1.5, -(BOWL.outRz - 5));
    scene.add(vip);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(60, 0.7, 18), concrete);
    roof.position.set(0, BOWL.y1 + 4.2, -(BOWL.outRz - 5));
    scene.add(roof);
    const win = new THREE.MeshBasicMaterial({ color: 0x6a92b8 });
    for (let i = -5; i <= 5; i++) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(3.6, 3.4, 0.25), win);
      w.position.set(i * 4.5, BOWL.y1 - 0.5, -(BOWL.outRz - 13.2));
      scene.add(w);
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
        x.fillStyle = '#e8eef8';
        x.font = '700 28px sans-serif';
        x.textAlign = 'center';
        x.fillText(title, 256, 48);
        x.fillStyle = '#9aa8bc';
        x.font = '600 22px sans-serif';
        x.fillText(`${homeLabel}  ·  ${awayLabel}`, 256, 88);
        x.fillStyle = '#3bc4ff';
        x.font = '800 64px sans-serif';
        x.fillText(`${sc.home} — ${sc.away}`, 256, 160);
        x.fillStyle = '#f0c014';
        x.font = '600 26px sans-serif';
        x.fillText(
          sc.minute < 90 ? `LIVE · ${sc.minute}'` : 'FULL TIME',
          256,
          215,
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

  /* ---------- players + ball (same match system as Misr) ---------- */
  const matchPlay = createMatchPlay(scene, {
    rng,
    field: FIELD,
    dugoutZ: FIELD.W / 2 + 4.2,
    onScore: (sc) => {
      for (const paint of scoreboardPainters) paint(sc);
    },
  });

  /* ---------- 4 corner lattice floodlight towers ---------- */
  {
    const glow = new THREE.MeshBasicMaterial({
      color: 0xfff6e0,
      toneMapped: false,
    });
    [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ].forEach(([sx, sz]) => {
      const x = sx * (BOWL.outRx + 10);
      const z = sz * (BOWL.outRz + 8);
      const tower = new THREE.Group();
      for (let leg = 0; leg < 4; leg++) {
        const lx = (leg % 2 ? 1 : -1) * 1.6;
        const lz = (leg < 2 ? 1 : -1) * 1.6;
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.35, 0.55, 72, 6),
          steel,
        );
        pole.position.set(lx, 36, lz);
        tower.add(pole);
      }
      for (let y = 8; y < 68; y += 5) {
        const b1 = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.18, 0.18), steel);
        b1.position.set(0, y, 0);
        tower.add(b1);
        const b2 = b1.clone();
        b2.rotation.y = Math.PI / 2;
        tower.add(b2);
        const xb = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, 0.14, 4.2),
          steel,
        );
        xb.position.set(0, y + 2.2, 0);
        xb.rotation.y = Math.PI / 4;
        tower.add(xb);
      }
      const bank = new THREE.Mesh(
        new THREE.BoxGeometry(12, 4.2, 14),
        new THREE.MeshLambertMaterial({ color: 0x9aa3b0 }),
      );
      bank.position.set(0, 74, 0);
      tower.add(bank);
      for (let u = -1; u <= 1; u++) {
        for (let v = -1; v <= 1; v++) {
          const lamp = new THREE.Mesh(
            new THREE.BoxGeometry(2.6, 0.45, 2.6),
            glow,
          );
          lamp.position.set(u * 3.2, 72.2, v * 3.6);
          tower.add(lamp);
        }
      }
      tower.position.set(x, 0, z);
      tower.rotation.y = Math.atan2(-x, -z);
      scene.add(tower);

      const hut = new THREE.Mesh(
        new THREE.BoxGeometry(6, 2.8, 4.5),
        new THREE.MeshLambertMaterial({ color: 0x1c5a9c }),
      );
      hut.position.set(x * 0.9, 1.4, z * 0.9);
      scene.add(hut);

      const pl = new THREE.PointLight(0xfff0d0, 0.35, 260, 2);
      pl.position.set(x, 70, z);
      scene.add(pl);
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

  /* ---------- camera / controls ---------- */
  // Elevated view framing the wider Olympic bowl + full track
  const HOME = { theta: 1.15, phi: 0.78, radius: 260 };
  const orbit = {
    theta: HOME.theta,
    phi: HOME.phi,
    radius: HOME.radius,
    thetaT: HOME.theta,
    phiT: HOME.phi,
    radiusT: HOME.radius,
  };
  const applyOrbit = () => {
    const sp = Math.sin(orbit.phi);
    camera.position.set(
      orbit.radius * sp * Math.cos(orbit.theta),
      orbit.radius * Math.cos(orbit.phi) + 8,
      orbit.radius * sp * Math.sin(orbit.theta),
    );
    camera.lookAt(0, 2, 0);
  };
  applyOrbit();

  let userInteracted = false;
  let is2D = false;
  const pointers = new Map();
  let pinchDist = 0;

  on(canvas, 'pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const p = [...pointers.values()];
      pinchDist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
    }
    userInteracted = true;
    canvas.classList.add('dragging');
  });
  on(canvas, 'pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    const dx = e.clientX - prev.x,
      dy = e.clientY - prev.y;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const p = [...pointers.values()];
      const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      if (pinchDist > 0) {
        orbit.radiusT = THREE.MathUtils.clamp(
          orbit.radiusT * (pinchDist / d),
          90,
          520,
        );
      }
      pinchDist = d;
      return;
    }
    orbit.thetaT -= dx * 0.0045;
    orbit.phiT = THREE.MathUtils.clamp(orbit.phiT - dy * 0.003, 0.16, 1.32);
  });
  const endP = (e) => {
    canvas.classList.remove('dragging');
    pointers.delete(e.pointerId);
    pinchDist = 0;
  };
  on(canvas, 'pointerup', endP);
  on(canvas, 'pointercancel', endP);
  on(
    canvas,
    'wheel',
    (e) => {
      e.preventDefault();
      userInteracted = true;
      orbit.radiusT = THREE.MathUtils.clamp(
        orbit.radiusT * (1 + e.deltaY * 0.0011),
        90,
        520,
      );
    },
    { passive: false },
  );

  const goHome = () => {
    userInteracted = true;
    Object.assign(orbit, {
      thetaT: HOME.theta,
      phiT: HOME.phi,
      radiusT: HOME.radius,
    });
    is2D = false;
    const d3 = document.getElementById('d-3d');
    if (d3) d3.textContent = '3D';
  };
  const zoomBy = (f) => {
    userInteracted = true;
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
    is2D = !is2D;
    const d3 = document.getElementById('d-3d');
    if (d3) d3.textContent = is2D ? '2D' : '3D';
    if (is2D) {
      orbit.phiT = 0.18;
      orbit.radiusT = 300;
    } else goHome();
  });
  bind('cc-help', () => {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent =
      'Cairo Derby · drag to orbit · scroll to zoom · players on pitch';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  });

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

  const clock = new THREE.Clock();
  let firstFrame = true;
  function animate() {
    if (disposed) return;
    rafId = requestAnimationFrame(animate);
    const dt = Math.min(0.05, clock.getDelta());
    const t = clock.elapsedTime;
    for (const a of animatedTextures) a.t.offset.x += a.speed * dt * 10;
    matchPlay.update(t, dt);
    // idle auto-orbit like Misr until the user takes over
    if (!userInteracted) orbit.thetaT += dt * 0.016;
    const k = Math.min(1, dt * 5.5);
    orbit.theta += (orbit.thetaT - orbit.theta) * k;
    orbit.phi += (orbit.phiT - orbit.phi) * k;
    orbit.radius += (orbit.radiusT - orbit.radius) * k;
    applyOrbit();
    renderer.render(scene, camera);
    if (firstFrame) {
      firstFrame = false;
      if (loader) loader.classList.add('hide');
      const toast = document.getElementById('toast');
      if (toast) {
        toast.textContent =
          'Cairo Derby · Ahly vs Zamalek · players on the pitch';
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3600);
      }
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
      try {
        matchPlay.dispose();
      } catch (_) {}
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
      canvas.classList.remove('dragging');
      const tn = document.querySelectorAll('#match .team .name');
      if (tn[0]) tn[0].textContent = 'EGYPT';
      if (tn[1]) tn[1].textContent = 'ARGENTINA';
      const eb = document.querySelector('#match .eyebrow');
      if (eb) eb.textContent = 'LIVE DEMO';
    },
  };
}
