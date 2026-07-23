import * as THREE from 'three';

/**
 * NEW STADIUM STARTER
 * -------------------
 * Duplicate this file (or copy from misr.engine.js) and build your venue here.
 * Then register it in `../registry.js`.
 *
 * Contract every stadium module must export:
 *   - stadiumMeta  { id, name, location, ... }
 *   - createStadium(opts) -> { id, dispose() }
 */

export const stadiumMeta = {
  id: 'custom',
  name: 'New Stadium',
  shortName: 'New',
  location: 'Your venue',
  subtitle: 'Draft · edit me',
  loaderText: 'Loading New Stadium…',
  draft: true,
};

/**
 * Minimal orbiting placeholder so stadium switching works while you build.
 * @param {{ meta?: typeof stadiumMeta }} [opts]
 */
export function createStadium(opts = {}) {
  const metaInfo = { ...stadiumMeta, ...(opts.meta || {}) };
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
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x06080f);
  scene.fog = new THREE.FogExp2(0x06080f, 0.0022);

  const camera = new THREE.PerspectiveCamera(
    50,
    innerWidth / innerHeight,
    0.3,
    900,
  );

  scene.add(new THREE.HemisphereLight(0x6a88b8, 0x0a0c14, 0.7));
  scene.add(new THREE.AmbientLight(0x334466, 0.35));
  const key = new THREE.DirectionalLight(0xe8f0ff, 0.55);
  key.position.set(40, 70, 30);
  scene.add(key);

  // pitch
  const pitch = new THREE.Mesh(
    new THREE.PlaneGeometry(105, 68),
    new THREE.MeshLambertMaterial({ color: 0x1f7a3a }),
  );
  pitch.rotation.x = -Math.PI / 2;
  pitch.position.y = 0.02;
  scene.add(pitch);

  // simple bowl rings (placeholder stands)
  const bowlMat = new THREE.MeshLambertMaterial({
    color: 0x2a3348,
    side: THREE.DoubleSide,
  });
  const seatMat = new THREE.MeshLambertMaterial({ color: 0x2f6fad });
  for (let i = 0; i < 4; i++) {
    const r = 58 + i * 10;
    const y = 3 + i * 4.2;
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r + 6, 3.2, 64, 1, true),
      i % 2 ? seatMat : bowlMat,
    );
    ring.position.y = y;
    ring.scale.z = 0.78;
    scene.add(ring);
  }

  // flat white roof ring
  const roof = new THREE.Mesh(
    new THREE.TorusGeometry(95, 7, 8, 72),
    new THREE.MeshLambertMaterial({
      color: 0xf2f6fb,
      emissive: 0xa8b8cc,
      emissiveIntensity: 0.2,
    }),
  );
  roof.rotation.x = Math.PI / 2;
  roof.position.y = 28;
  roof.scale.set(1, 0.78, 1);
  scene.add(roof);

  // ground
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(220, 64),
    new THREE.MeshLambertMaterial({ color: 0x10141c }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.2;
  scene.add(ground);

  // center marker text card in 3D-ish via sprite canvas
  {
    const cv = document.createElement('canvas');
    cv.width = 512;
    cv.height = 128;
    const x = cv.getContext('2d');
    x.fillStyle = '#0b1220';
    x.fillRect(0, 0, 512, 128);
    x.fillStyle = '#19b7ff';
    x.font = '700 36px sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(metaInfo.name, 256, 48);
    x.fillStyle = '#9eb0c8';
    x.font = '600 22px sans-serif';
    x.fillText('Build me in custom.engine.js', 256, 90);
    const tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    const spr = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true }),
    );
    spr.position.set(0, 18, 0);
    spr.scale.set(48, 12, 1);
    scene.add(spr);
  }

  const orbit = { theta: 0.55, phi: 0.72, radius: 180 };
  const applyOrbit = () => {
    const sp = Math.sin(orbit.phi);
    camera.position.set(
      orbit.radius * sp * Math.cos(orbit.theta),
      orbit.radius * Math.cos(orbit.phi) + 8,
      orbit.radius * sp * Math.sin(orbit.theta),
    );
    camera.lookAt(0, 8, 0);
  };
  applyOrbit();

  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  on(canvas, 'pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  on(canvas, 'pointermove', (e) => {
    if (!dragging) return;
    orbit.theta -= (e.clientX - lastX) * 0.005;
    orbit.phi = Math.min(
      1.4,
      Math.max(0.2, orbit.phi - (e.clientY - lastY) * 0.004),
    );
    lastX = e.clientX;
    lastY = e.clientY;
  });
  on(canvas, 'pointerup', () => {
    dragging = false;
  });
  on(
    canvas,
    'wheel',
    (e) => {
      e.preventDefault();
      orbit.radius = Math.min(
        320,
        Math.max(80, orbit.radius * (1 + e.deltaY * 0.0012)),
      );
    },
    { passive: false },
  );
  on(window, 'resize', () => {
    if (disposed) return;
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  function animate() {
    if (disposed) return;
    rafId = requestAnimationFrame(animate);
    orbit.theta += 0.0012;
    applyOrbit();
    renderer.render(scene, camera);
  }
  animate();

  setTimeout(() => {
    if (disposed) return;
    if (loader) loader.classList.add('hide');
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent =
        'Draft stadium — edit src/app/stadium/stadiums/custom.engine.js';
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 4200);
    }
  }, 400);

  return {
    id: metaInfo.id,
    canvas,
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(rafId);
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
            if (m?.map) m.map.dispose();
            m?.dispose?.();
          });
        }
      });
      renderer.dispose();
    },
  };
}
