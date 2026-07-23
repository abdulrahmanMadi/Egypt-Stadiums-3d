import * as THREE from 'three';
import gsap from 'gsap';

/** Misr Stadium (New Administrative Capital) — procedural Three.js experience */
export const stadiumMeta = {
  id: 'misr',
  name: 'Misr Stadium',
  shortName: 'Misr',
  location: 'New Administrative Capital',
  subtitle: 'Stadium View',
  loaderText: 'Loading Misr Stadium…',
};

/**
 * @param {{ meta?: typeof stadiumMeta } | undefined} opts
 * @returns {{ id: string, dispose: () => void }}
 */
export function createStadium(opts = {}) {
  const metaInfo = { ...stadiumMeta, ...(opts.meta || {}) };
  const REDUCED = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
  const disposers = [];
  let disposed = false;
  let rafId = 0;
  const crowdMeshes = [];
  const on = (target, type, fn, options) => {
    if (!target) return;
    target.addEventListener(type, fn, options);
    disposers.push(() => target.removeEventListener(type, fn, options));
  };
      const TAU = Math.PI * 2;

      /* ---------- deterministic rng ---------- */
      function mulberry32(a) {
        return function () {
          a |= 0;
          a = (a + 0x6d2b79f5) | 0;
          let t = Math.imul(a ^ (a >>> 15), 1 | a);
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      }
      const rng = mulberry32(20260717);

      /* ---------- renderer / scene / camera ---------- */
      const loaderEl = document.getElementById("loader");
      const loaderTextEl = document.getElementById("loader-text");
      if (loaderEl) loaderEl.classList.remove("hide");
      if (loaderTextEl) loaderTextEl.textContent = metaInfo.loaderText || ("Loading " + metaInfo.name + "…");
      const canvas = document.getElementById("c");
      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        powerPreference: "high-performance",
        logarithmicDepthBuffer: true,
      });
      renderer.shadowMap.enabled = false;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
      renderer.setSize(innerWidth, innerHeight);
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x04060c);
      scene.fog = new THREE.FogExp2(0x05070d, 0.0016);

      const camera = new THREE.PerspectiveCamera(
        50,
        innerWidth / innerHeight,
        0.3,
        1400,
      );

      /* ---------- lights ---------- */
      const hemi = new THREE.HemisphereLight(0x35507e, 0x05070d, 0.55);
      const ambient = new THREE.AmbientLight(0x27314a, 0.35);
      scene.add(hemi, ambient);
      const floodTargets = new THREE.Object3D();
      floodTargets.position.set(0, 0, 0);
      scene.add(floodTargets);
      [
        [95, 58, 75],
        [-95, 58, 75],
        [95, 58, -75],
        [-95, 58, -75],
      ].forEach((p) => {
        const s = new THREE.SpotLight(
          0xdfeaff,
          0.85,
          0,
          Math.PI / 3.1,
          0.55,
          1.2,
        );
        s.position.set(p[0], p[1], p[2]);
        s.target = floodTargets;
        scene.add(s);
      });
      const fieldGlow = new THREE.PointLight(0xbcd8ff, 0.35, 160, 2);
      fieldGlow.position.set(0, 22, 0);
      scene.add(fieldGlow);
      const sun = new THREE.DirectionalLight(0xdfe9ff, 0.3);
      sun.position.set(70, 90, 45);
      sun.castShadow = false;
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.left = -110;
      sun.shadow.camera.right = 110;
      sun.shadow.camera.top = 90;
      sun.shadow.camera.bottom = -90;
      sun.shadow.camera.near = 30;
      sun.shadow.camera.far = 320;
      sun.shadow.bias = -0.0005;
      scene.add(sun);

      const rainPositions = new Float32Array(1800 * 3);
      for (let i = 0; i < 1800; i++) {
        rainPositions[i * 3] = (rng() - 0.5) * 260;
        rainPositions[i * 3 + 1] = rng() * 120 + 5;
        rainPositions[i * 3 + 2] = (rng() - 0.5) * 220;
      }
      const rainGeometry = new THREE.BufferGeometry();
      rainGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(rainPositions, 3),
      );
      const rain = new THREE.Points(
        rainGeometry,
        new THREE.PointsMaterial({
          color: 0xb9dcff,
          size: 0.18,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
        }),
      );
      rain.visible = false;
      scene.add(rain);

      /* ---------- geometry helpers ---------- */
      function ringStrip(rx1, rz1, y1, rx2, rz2, y2, seg, mat, repU) {
        const pos = [],
          uv = [],
          idx = [];
        repU = repU || 10;
        for (let i = 0; i <= seg; i++) {
          const a = (i / seg) * TAU,
            c = Math.cos(a),
            s = Math.sin(a);
          pos.push(rx1 * c, y1, rz1 * s, rx2 * c, y2, rz2 * s);
          uv.push((i / seg) * repU, 0, (i / seg) * repU, 1);
        }
        for (let i = 0; i < seg; i++) {
          const k = i * 2;
          idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
        g.setIndex(idx);
        g.computeVertexNormals();
        const m = new THREE.Mesh(g, mat);
        m.matrixAutoUpdate = false;
        return m;
      }
      function mergeBoxes(parts) {
        // parts: array of BufferGeometry (already transformed)
        let pos = [],
          norm = [];
        for (const g of parts) {
          const gg = g.index ? g.toNonIndexed() : g;
          pos.push(...gg.attributes.position.array);
          norm.push(...gg.attributes.normal.array);
        }
        const out = new THREE.BufferGeometry();
        out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        out.setAttribute("normal", new THREE.Float32BufferAttribute(norm, 3));
        return out;
      }
      function canvasTexture(w, h, draw, repX, repY) {
        const cv = document.createElement("canvas");
        cv.width = w;
        cv.height = h;
        draw(cv.getContext("2d"), w, h);
        const t = new THREE.CanvasTexture(cv);
        t.anisotropy = renderer.capabilities.getMaxAnisotropy();
        if (repX || repY) {
          t.wrapS = t.wrapT = THREE.RepeatWrapping;
          t.repeat.set(repX || 1, repY || 1);
        }
        return t;
      }

      /* ---------- materials ---------- */
      const mkConcreteTex = (base, spot) => {
        const t = canvasTexture(256, 256, (x, w, h) => {
          x.fillStyle = base;
          x.fillRect(0, 0, w, h);
          x.globalAlpha = 0.15;
          for (let i = 0; i < 2200; i++) {
            x.fillStyle = Math.random() > 0.5 ? "#05080f" : spot;
            x.fillRect(Math.random() * w, Math.random() * h, 2, 2);
          }
          x.globalAlpha = 0.35;
          x.strokeStyle = "rgba(5,8,15,.85)";
          x.lineWidth = 2;
          for (let i = 1; i < 4; i++) {
            x.beginPath();
            x.moveTo(0, i * 64);
            x.lineTo(w, i * 64);
            x.stroke();
            x.beginPath();
            x.moveTo(i * 64, 0);
            x.lineTo(i * 64, h);
            x.stroke();
          }
          x.globalAlpha = 1;
        });
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        return t;
      };
      const cTex = mkConcreteTex("#1b2233", "#2e3b58");
      const cdTex = mkConcreteTex("#121826", "#232e46");
      const roofTex = (() => {
        const t = canvasTexture(512, 256, (x, w, h) => {
          // white PTFE membrane panels
          x.fillStyle = "#f4f7fb";
          x.fillRect(0, 0, w, h);
          const g = x.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, "rgba(255,255,255,0.55)");
          g.addColorStop(0.55, "rgba(230,238,248,0.2)");
          g.addColorStop(1, "rgba(200,214,230,0.35)");
          x.fillStyle = g;
          x.fillRect(0, 0, w, h);
          x.strokeStyle = "rgba(150,168,190,0.55)";
          x.lineWidth = 1.2;
          const cell = 26;
          for (let y = -cell; y < h + cell; y += cell) {
            for (let xx = -cell; xx < w + cell; xx += cell) {
              x.beginPath();
              x.moveTo(xx, y + cell / 2);
              x.lineTo(xx + cell / 2, y);
              x.lineTo(xx + cell, y + cell / 2);
              x.lineTo(xx + cell / 2, y + cell);
              x.closePath();
              x.stroke();
            }
          }
          x.strokeStyle = "rgba(170,185,205,0.35)";
          x.lineWidth = 2;
          for (let i = 0; i < 18; i++) {
            const px = (i / 18) * w;
            x.beginPath();
            x.moveTo(px, 0);
            x.lineTo(px, h);
            x.stroke();
          }
        });
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.encoding = THREE.sRGBEncoding;
        return t;
      })();
      const MAT = {
        concrete: new THREE.MeshLambertMaterial({
          map: cTex,
          side: THREE.DoubleSide,
        }),
        concreteDark: new THREE.MeshLambertMaterial({
          map: cdTex,
          side: THREE.DoubleSide,
        }),
        steel: new THREE.MeshLambertMaterial({
          color: 0x28324c,
          side: THREE.DoubleSide,
        }),
        steelDark: new THREE.MeshLambertMaterial({ color: 0x1a2236 }),
        rail: new THREE.MeshPhongMaterial({
          color: 0x44557e,
          shininess: 70,
          specular: 0x5a6a90,
          side: THREE.DoubleSide,
        }),
        roofTop: new THREE.MeshLambertMaterial({
          map: roofTex,
          side: THREE.DoubleSide,
        }),
        facade: new THREE.MeshLambertMaterial({
          map: (() => {
            const t = canvasTexture(512, 128, (x, w, h) => {
              x.fillStyle = "#0c1220";
              x.fillRect(0, 0, w, h);
              for (let r = 0; r < 3; r++)
                for (let k = 0; k < 20; k++) {
                  const lit = Math.random() < 0.4;
                  x.fillStyle = lit
                    ? "rgba(" +
                      (Math.random() < 0.5 ? "255,196,120" : "150,200,255") +
                      "," +
                      (0.18 + Math.random() * 0.5).toFixed(2) +
                      ")"
                    : "#101a2e";
                  x.fillRect(k * 25 + 5, r * 40 + 10, 16, 22);
                }
            });
            t.wrapS = t.wrapT = THREE.RepeatWrapping;
            t.repeat.set(14, 3);
            return t;
          })(),
          side: THREE.DoubleSide,
        }),
      };

      /* ---------- ground + plaza ---------- */
      {
        const gt = canvasTexture(512, 512, (x) => {
          const g = x.createRadialGradient(256, 256, 40, 256, 256, 256);
          g.addColorStop(0, "#0b101c");
          g.addColorStop(0.55, "#080c15");
          g.addColorStop(1, "#04060b");
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
        // cyan rim light around the facade base, like the reference
        const rim = ringStrip(
          126,
          106,
          0.1,
          132,
          112,
          0.1,
          128,
          new THREE.MeshBasicMaterial({
            color: 0x1466c8,
            transparent: true,
            opacity: 0.5,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        );
        scene.add(rim);
      }

      /* ---------- stars ---------- */
      {
        const n = 500,
          p = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
          const a = rng() * TAU,
            e = rng() * Math.PI * 0.42 + 0.06,
            r = 560;
          p[i * 3] = r * Math.cos(e) * Math.cos(a);
          p[i * 3 + 1] = r * Math.sin(e) + 20;
          p[i * 3 + 2] = r * Math.cos(e) * Math.sin(a);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(p, 3));
        scene.add(
          new THREE.Points(
            g,
            new THREE.PointsMaterial({
              color: 0x8fa8d8,
              size: 1.4,
              sizeAttenuation: false,
              transparent: true,
              opacity: 0.7,
            }),
          ),
        );
      }

      /* ---------- sky dome (city glow on the horizon) ---------- */
      {
        const skyTex = canvasTexture(32, 256, (x, w, h) => {
          const g = x.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, "#020409");
          g.addColorStop(0.5, "#060d1c");
          g.addColorStop(0.78, "#0c1a32");
          g.addColorStop(0.92, "#1a2c4c");
          g.addColorStop(1, "#31435e");
          x.fillStyle = g;
          x.fillRect(0, 0, w, h);
        });
        const dome = new THREE.Mesh(
          new THREE.SphereGeometry(780, 24, 16, 0, TAU, 0, Math.PI / 1.85),
          new THREE.MeshBasicMaterial({
            map: skyTex,
            side: THREE.BackSide,
            fog: false,
          }),
        );
        dome.position.y = -30;
        scene.add(dome);
      }

      /* ---------- pitch ---------- */
      const FIELD = { L: 105, W: 68 };
      /* Oval track — fully outside the pitch, aspect ≈ 1.322 (matches bowl) */
      const TRACK = {
        inRx: 74.5,
        inRz: 56.4,
        outRx: 85.5,
        outRz: 64.7,
      };
      /* Posts centered on the painted goal line (near pitch mesh edge) */
      const GOAL_LINE = FIELD.L / 2 - 0.35;
      {
        const px = 10; // pixels per metre
        const tex = canvasTexture(FIELD.L * px, FIELD.W * px, (x, w, h) => {
          // mown stripes
          const stripes = 14,
            sw = w / stripes;
          for (let i = 0; i < stripes; i++) {
            x.fillStyle = i % 2 ? "#1d7a34" : "#1a6d2e";
            x.fillRect(i * sw, 0, sw + 1, h);
          }
          // grain noise
          x.globalAlpha = 0.05;
          for (let i = 0; i < 2600; i++) {
            x.fillStyle = Math.random() > 0.5 ? "#0c3b18" : "#2f9b47";
            x.fillRect(Math.random() * w, Math.random() * h, 2, 2);
          }
          x.globalAlpha = 1;
          // worn turf: centre circle only (keep penalty boxes clean)
          x.globalAlpha = 0.22;
          x.fillStyle = "#5d6b33";
          x.beginPath();
          x.ellipse(w / 2, h / 2, 7.5 * px, 7 * px, 0, 0, TAU);
          x.fill();
          x.globalAlpha = 1;
          // vignette (floodlight falloff)
          const vg = x.createRadialGradient(
            w / 2,
            h / 2,
            h * 0.3,
            w / 2,
            h / 2,
            w * 0.62,
          );
          vg.addColorStop(0, "rgba(255,255,255,0.05)");
          vg.addColorStop(1, "rgba(0,0,20,0.32)");
          x.fillStyle = vg;
          x.fillRect(0, 0, w, h);
          // lines — tiny inset so the goal line sits at the pitch edge
          x.strokeStyle = "rgba(245,250,255,.95)";
          x.lineWidth = 2.4;
          const M = 0.35 * px; // ~35 cm visual line inset
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
          x.fillStyle = "#f5faff";
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
            x.fillStyle = "#f5faff";
            x.fill();
            // Penalty arc (D) — ONLY the segment outside the 18-yard box
            // (drawing with canvas arc direction previously made a full ring)
            const r = 9.15 * px;
            const boxEdge = bx + s * d1;
            x.beginPath();
            let pen = false;
            for (let i = 0; i <= 72; i++) {
              const ang = (i / 72) * TAU;
              const px_ = spotX + Math.cos(ang) * r;
              const py_ = cy + Math.sin(ang) * r;
              const outside =
                s > 0 ? px_ >= boxEdge - 0.75 : px_ <= boxEdge + 0.75;
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

        /* Oval running track — same ellipse proportions as the lower stand bowl,
           seated just inside the first-tier walkway. */
        {
          // dark elliptical apron under the infield (shows in pitch–track gaps)
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
          const vergeMat = new THREE.MeshLambertMaterial({
            color: 0x1a5c2e,
            side: THREE.DoubleSide,
          });
          scene.add(
            ringStrip(
              FIELD.L / 2 + 0.15,
              FIELD.W / 2 + 0.15,
              0.035,
              TRACK.inRx,
              TRACK.inRz,
              0.035,
              160,
              vergeMat,
              1,
            ),
          );

          // tartan lane texture (V = inner→outer across 8 lanes)
          const trackTex = canvasTexture(1024, 160, (x, w, h) => {
            const base = x.createLinearGradient(0, 0, 0, h);
            base.addColorStop(0, "#d4622f");
            base.addColorStop(0.5, "#c45328");
            base.addColorStop(1, "#b44922");
            x.fillStyle = base;
            x.fillRect(0, 0, w, h);
            // subtle rubber grain
            x.globalAlpha = 0.08;
            for (let i = 0; i < 1800; i++) {
              x.fillStyle = Math.random() > 0.5 ? "#6a2410" : "#f0a070";
              x.fillRect(Math.random() * w, Math.random() * h, 2, 2);
            }
            x.globalAlpha = 1;
            const lanes = 8;
            for (let i = 0; i <= lanes; i++) {
              const y = (i / lanes) * (h - 1);
              x.strokeStyle =
                i === 0 || i === lanes
                  ? "rgba(255,255,255,0.95)"
                  : "rgba(255,248,240,0.78)";
              x.lineWidth = i === 0 || i === lanes ? 3.2 : 1.6;
              x.beginPath();
              x.moveTo(0, y);
              x.lineTo(w, y);
              x.stroke();
            }
            // lane numbers / dash marks along the circuit
            x.fillStyle = "rgba(255,255,255,0.55)";
            x.font = "700 18px sans-serif";
            for (let i = 1; i <= lanes; i++) {
              const y = ((i - 0.55) / lanes) * h;
              for (let k = 0; k < 6; k++) {
                x.fillText(String(i), 40 + k * (w / 6), y);
              }
            }
          }, 18, 1);
          trackTex.encoding = THREE.sRGBEncoding;
          const trackMat = new THREE.MeshStandardMaterial({
            map: trackTex,
            roughness: 0.94,
            metalness: 0,
            side: THREE.DoubleSide,
          });
          const track = ringStrip(
            TRACK.inRx,
            TRACK.inRz,
            0.045,
            TRACK.outRx,
            TRACK.outRz,
            0.045,
            192,
            trackMat,
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
        }

        // goals + nets — posts sit on the painted goal line
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
          // back panel
          for (let i = 0; i <= 16; i++) {
            const z = -halfW + (i / 16) * halfW * 2;
            line([backX, 0.03, z], [backX, H, z]);
          }
          for (let j = 0; j <= 10; j++) {
            const y = (j / 10) * H;
            line([backX, y, -halfW], [backX, y, halfW]);
          }
          // roof
          for (let i = 0; i <= 16; i++) {
            const z = -halfW + (i / 16) * halfW * 2;
            line([gx, H, z], [backX, H, z]);
          }
          for (let k = 1; k <= 6; k++) {
            const x = gx + dir * depth * (k / 7);
            line([x, H, -halfW], [x, H, halfW]);
          }
          // sides
          [-halfW, halfW].forEach((z) => {
            for (let j = 0; j <= 10; j++) {
              const y = (j / 10) * H;
              line([gx, y, z], [backX, y, z]);
            }
            for (let k = 1; k <= 6; k++) {
              const x = gx + dir * depth * (k / 7);
              line([x, 0.03, z], [x, H, z]);
            }
          });
          const geo = new THREE.BufferGeometry();
          geo.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(pos, 3),
          );
          return new THREE.LineSegments(geo, netMat);
        }
        [-1, 1].forEach((s) => {
          const gx = s * GOAL_LINE,
            grp = new THREE.Group();
          const post = (x, z) => {
            const m = new THREE.Mesh(
              new THREE.CylinderGeometry(0.07, 0.07, 2.44, 6),
              gmat,
            );
            m.position.set(x, 1.22, z);
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
          // side base stays (optional short ground tubes into net)
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

        // professional dugouts (home + away) on the near touchline
        const dugoutZ = FIELD.W / 2 + 4.2;
        const dugoutCenters = [-16, 16];
        const dugoutMeta = [];
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
            MAT.steelDark,
          );
          back.position.set(cx, 1.35, dugoutZ + 1.45);
          grp.add(back);
          [-1, 1].forEach((s) => {
            const side = new THREE.Mesh(
              new THREE.BoxGeometry(0.18, 2.4, 3.2),
              MAT.steelDark,
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
              MAT.steel,
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
          for (let b = 0; b < 3; b++) {
            const pad = new THREE.Mesh(
              new THREE.BoxGeometry(4.2, 0.22, 0.55),
              new THREE.MeshLambertMaterial({
                color: di === 0 ? 0x8b0000 : 0x74acdf,
              }),
            );
            pad.position.set(cx - 4.2 + b * 4.2, 0.55, dugoutZ + 0.35);
            grp.add(pad);
            const backrest = new THREE.Mesh(
              new THREE.BoxGeometry(4.2, 0.55, 0.12),
              new THREE.MeshLambertMaterial({
                color: di === 0 ? 0x5c0000 : 0x5a8eb8,
              }),
            );
            backrest.position.set(cx - 4.2 + b * 4.2, 0.9, dugoutZ + 0.62);
            grp.add(backrest);
          }
          const plate = new THREE.Mesh(
            new THREE.BoxGeometry(6, 0.45, 0.08),
            new THREE.MeshBasicMaterial({
              color: di === 0 ? 0x8b0000 : 0x74acdf,
              toneMapped: false,
            }),
          );
          plate.position.set(cx, 2.35, dugoutZ - 1.7);
          grp.add(plate);
          grp.traverse((o) => {
            if (o.isMesh) o.castShadow = true;
          });
          scene.add(grp);
          dugoutMeta.push({ cx, z: dugoutZ, team: di });
        });
      }

      /* ---------- LED perimeter ad boards ---------- */
      const animatedTextures = [];
      {
        const adTex = canvasTexture(
          2048,
          64,
          (x, w, h) => {
            x.fillStyle = "#04101f";
            x.fillRect(0, 0, w, h);
            x.font = "700 40px " + getComputedStyle(document.body).fontFamily;
            x.textBaseline = "middle";
            const words = [
              "STADIVIEW",
              "EGYPT × ARGENTINA",
              "MISR STADIUM",
              "NEW ADMINISTRATIVE CAPITAL",
            ];
            let cx = 30;
            for (let i = 0; i < 8; i++) {
              const t = words[i % words.length];
              x.fillStyle = i % 2 ? "#2f9bff" : "#9fd3ff";
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
          const face = new THREE.Mesh(
            new THREE.PlaneGeometry(wd, 1.15),
            faceMat,
          );
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
        // hug the pitch touchlines (not the track) — leave dugout gaps on +Z
        const edge = 1.15;
        const zNear = FIELD.W / 2 + edge;
        const zFar = -(FIELD.W / 2 + edge);
        // goal-line boards sit behind the nets
        const xEast = GOAL_LINE + 2.35;
        const xWest = -(GOAL_LINE + 2.35);
        // far touchline (continuous)
        mk(FIELD.L + 1.6, 0, zFar, 0);
        // near touchline split around dugouts at x = ±16
        mk(22, -40, zNear, Math.PI);
        mk(10, 0, zNear, Math.PI);
        mk(22, 40, zNear, Math.PI);
        // behind each goal (clear of the net bag)
        mk(FIELD.W + 1.6, xEast, 0, -Math.PI / 2);
        mk(FIELD.W + 1.6, xWest, 0, Math.PI / 2);
      }

      /* ---------- players + ball (articulated, possession-based match) ---------- */
      const players = [];
      let ball;
      const swayU = { value: 0 },
        exciteU = { value: 1 };
      const score = { home: 0, away: 0, minute: 0 };
      {
        const skinMats = ["#c98d63", "#8d5a3b", "#eac1a4", "#a5714b"].map(
          (c) => new THREE.MeshLambertMaterial({ color: c }),
        );
        const hairMats = ["#171310", "#2b1c10", "#4a3520", "#0d0d0d"].map(
          (c) => new THREE.MeshLambertMaterial({ color: c }),
        );
        const bootMat = new THREE.MeshLambertMaterial({ color: 0x101014 });
        const kits = [
          {
            // Egypt — deep blood red / white
            shirt: new THREE.MeshLambertMaterial({
              color: 0x8b0000,
              emissive: 0x5c0000,
              emissiveIntensity: 0.16,
            }),
            shorts: new THREE.MeshLambertMaterial({ color: 0xf2f4f8 }),
            socks: new THREE.MeshLambertMaterial({
              color: 0x8b0000,
              emissive: 0x5c0000,
              emissiveIntensity: 0.1,
            }),
            gk: new THREE.MeshLambertMaterial({
              color: 0x1a1a1a,
              emissive: 0x222222,
              emissiveIntensity: 0.1,
            }),
          },
          {
            // Argentina — light blue / white
            shirt: new THREE.MeshLambertMaterial({
              color: 0x74acdf,
              emissive: 0x74acdf,
              emissiveIntensity: 0.12,
            }),
            shorts: new THREE.MeshLambertMaterial({ color: 0xf2f4f8 }),
            socks: new THREE.MeshLambertMaterial({
              color: 0x74acdf,
              emissive: 0x74acdf,
              emissiveIntensity: 0.08,
            }),
            gk: new THREE.MeshLambertMaterial({
              color: 0x2fbf71,
              emissive: 0x2fbf71,
              emissiveIntensity: 0.12,
            }),
          },
          {
            // referee
            shirt: new THREE.MeshLambertMaterial({
              color: 0xf2e341,
              emissive: 0xf2e341,
              emissiveIntensity: 0.1,
            }),
            shorts: new THREE.MeshLambertMaterial({ color: 0x141414 }),
            socks: new THREE.MeshLambertMaterial({ color: 0x141414 }),
          },
        ];
        function mkPlayer(kit, gk, opts) {
          opts = opts || {};
          const seated = !!opts.seated;
          const coach = !!opts.coach;
          const g = new THREE.Group();
          const skin = skinMats[(rng() * skinMats.length) | 0];
          const shirtM = coach
            ? new THREE.MeshLambertMaterial({ color: 0x1a1f2a })
            : gk && kit.gk
              ? kit.gk
              : kit.shirt;
          const shortsM = coach
            ? new THREE.MeshLambertMaterial({ color: 0x11141c })
            : kit.shorts;
          const sockM = coach
            ? new THREE.MeshLambertMaterial({ color: 0x1a1f2a })
            : gk && kit.gk
              ? kit.gk
              : kit.socks || kit.shirt;
          const legGeo = new THREE.CylinderGeometry(
            0.09,
            0.065,
            seated ? 0.55 : 0.92,
            8,
          );
          legGeo.translate(0, seated ? -0.28 : -0.46, 0);
          const sockGeo = new THREE.CylinderGeometry(
            0.088,
            0.072,
            seated ? 0.32 : 0.5,
            8,
          );
          sockGeo.translate(0, seated ? -0.42 : -0.7, 0);
          const bootGeo = new THREE.BoxGeometry(0.12, 0.09, 0.26);
          const legL = new THREE.Group(),
            legR = new THREE.Group();
          legL.position.set(-0.12, seated ? 0.62 : 0.95, seated ? 0.12 : 0);
          legR.position.set(0.12, seated ? 0.62 : 0.95, seated ? 0.12 : 0);
          if (seated) {
            legL.rotation.x = 1.35;
            legR.rotation.x = 1.35;
          }
          const lm = new THREE.Mesh(legGeo, skin),
            rm = new THREE.Mesh(legGeo, skin);
          const sl = new THREE.Mesh(sockGeo, sockM),
            sr = new THREE.Mesh(sockGeo, sockM);
          const bl = new THREE.Mesh(bootGeo, bootMat);
          bl.position.set(0, seated ? -0.52 : -0.92, seated ? 0.18 : 0.06);
          const br = new THREE.Mesh(bootGeo, bootMat);
          br.position.set(0, seated ? -0.52 : -0.92, seated ? 0.18 : 0.06);
          legL.add(lm);
          legL.add(sl);
          legL.add(bl);
          legR.add(rm);
          legR.add(sr);
          legR.add(br);
          const shorts = new THREE.Mesh(
            new THREE.CylinderGeometry(0.22, 0.19, 0.32, 8),
            shortsM,
          );
          shorts.position.y = seated ? 0.72 : 1.02;
          const torso = new THREE.Mesh(
            new THREE.CylinderGeometry(
              coach ? 0.27 : 0.24,
              coach ? 0.21 : 0.185,
              coach ? 0.72 : 0.62,
              8,
            ),
            shirtM,
          );
          torso.position.y = seated ? 1.12 : 1.42;
          // collar / neck
          const neck = new THREE.Mesh(
            new THREE.CylinderGeometry(0.07, 0.08, 0.12, 6),
            skin,
          );
          neck.position.y = seated ? 1.42 : 1.74;
          const collar = new THREE.Mesh(
            new THREE.TorusGeometry(0.11, 0.025, 5, 10),
            shirtM,
          );
          collar.position.y = seated ? 1.38 : 1.7;
          collar.rotation.x = Math.PI / 2;
          const armGeo = new THREE.CylinderGeometry(0.058, 0.045, 0.64, 6);
          armGeo.translate(0, -0.32, 0);
          const handGeo = new THREE.SphereGeometry(0.055, 6, 5);
          const armL = new THREE.Group(),
            armR = new THREE.Group();
          armL.position.set(-0.28, seated ? 1.32 : 1.64, 0);
          armR.position.set(0.28, seated ? 1.32 : 1.64, 0);
          if (seated) {
            armL.rotation.x = -0.55;
            armR.rotation.x = -0.4;
          } else if (coach) {
            armL.rotation.x = -0.85;
            armR.rotation.x = -0.25;
            armR.rotation.z = -0.35;
          }
          const armMeshL = new THREE.Mesh(armGeo, shirtM);
          const armMeshR = new THREE.Mesh(armGeo, shirtM);
          const handL = new THREE.Mesh(handGeo, skin);
          handL.position.y = -0.64;
          const handR = new THREE.Mesh(handGeo, skin);
          handR.position.y = -0.64;
          armL.add(armMeshL);
          armL.add(handL);
          armR.add(armMeshR);
          armR.add(handR);
          const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.145, 10, 8),
            skin,
          );
          head.position.y = seated ? 1.56 : 1.88;
          const hair = new THREE.Mesh(
            new THREE.SphereGeometry(0.15, 10, 6, 0, TAU, 0, Math.PI / 2.05),
            hairMats[(rng() * hairMats.length) | 0],
          );
          hair.position.y = seated ? 1.58 : 1.9;
          // ear hints
          const earL = new THREE.Mesh(
            new THREE.SphereGeometry(0.035, 5, 4),
            skin,
          );
          earL.position.set(-0.14, seated ? 1.56 : 1.88, 0);
          const earR = earL.clone();
          earR.position.x = 0.14;
          g.add(legL);
          g.add(legR);
          g.add(shorts);
          g.add(torso);
          g.add(neck);
          g.add(collar);
          g.add(armL);
          g.add(armR);
          g.add(head);
          g.add(hair);
          g.add(earL);
          g.add(earR);
          // coach clipboard
          if (coach) {
            const board = new THREE.Mesh(
              new THREE.BoxGeometry(0.28, 0.02, 0.36),
              new THREE.MeshLambertMaterial({ color: 0xf2e8d5 }),
            );
            board.position.set(0.22, 1.35, 0.28);
            board.rotation.x = -0.9;
            g.add(board);
          }
          g.traverse((o) => {
            if (o.isMesh) o.castShadow = true;
          });
          scene.add(g);
          return { g, legL, legR, armL, armR, seated, coach };
        }
        for (let team = 0; team < 2; team++) {
          for (let i = 0; i < 11; i++) {
            const gk = i === 0;
            const dir = team ? -1 : 1;
            let role = "gk",
              homeQ = -49.5,
              hz = 0,
              zoneMinQ = -50,
              zoneMaxQ = -43,
              shapeShift = 0;
            if (i >= 1 && i <= 4) {
              role = "defender";
              homeQ = -27;
              hz = [-25, -8, 8, 25][i - 1];
              zoneMinQ = -43;
              zoneMaxQ = 12;
              shapeShift = 0.7;
            } else if (i >= 5 && i <= 7) {
              role = "midfielder";
              homeQ = -3;
              hz = [-20, 0, 20][i - 5];
              zoneMinQ = -32;
              zoneMaxQ = 36;
              shapeShift = 0.65;
            } else if (i >= 8) {
              role = "forward";
              homeQ = 24;
              hz = [-18, 0, 18][i - 8];
              zoneMinQ = -6;
              zoneMaxQ = 47;
              shapeShift = 0.42;
            }
            const hx = homeQ * dir;
            const p = mkPlayer(kits[team], gk);
            players.push(
              Object.assign(p, {
                home: new THREE.Vector3(hx, 0, hz),
                role,
                homeQ,
                zoneMinQ,
                zoneMaxQ,
                shapeShift,
                team,
                gk,
                ph: rng() * TAU,
                sp: 0.85 + rng() * 0.35,
                amp: 0,
              }),
            );
            p.g.position.set(hx, 0, hz);
          }
        }
        const rf = mkPlayer(kits[2], false);
        players.push(
          Object.assign(rf, {
            home: new THREE.Vector3(0, 0, 10),
            team: 2,
            gk: false,
            ph: rng() * TAU,
            sp: 1,
            amp: 0,
          }),
        );
        rf.g.position.set(0, 0, 10);

        // bench: substitutes seated + head coaches standing in technical area
        const dugoutCenters = [-16, 16];
        const dugoutZ = FIELD.W / 2 + 4.2;
        dugoutCenters.forEach((cx, di) => {
          // 7 substitutes on the bench
          for (let s = 0; s < 7; s++) {
            const sub = mkPlayer(kits[di], false, { seated: true });
            const x = cx - 5.4 + s * 1.55;
            const z = dugoutZ + 0.25;
            sub.g.position.set(x, 0.42, z);
            sub.g.rotation.y = Math.PI; // face the pitch
            players.push(
              Object.assign(sub, {
                home: new THREE.Vector3(x, 0.42, z),
                team: di,
                gk: false,
                bench: true,
                ph: rng() * TAU,
                sp: 0.6 + rng() * 0.3,
                amp: 0,
              }),
            );
          }
          // head coach standing at technical area edge
          const coach = mkPlayer(kits[di], false, { coach: true });
          const cox = cx + (di === 0 ? 3.2 : -3.2);
          const coz = dugoutZ - 1.85;
          coach.g.position.set(cox, 0, coz);
          coach.g.rotation.y = Math.PI + (rng() - 0.5) * 0.25;
          players.push(
            Object.assign(coach, {
              home: new THREE.Vector3(cox, 0, coz),
              team: di,
              gk: false,
              bench: true,
              coach: true,
              ph: rng() * TAU,
              sp: 0.5,
              amp: 0,
            }),
          );
          // assistant coach
          const asst = mkPlayer(kits[di], false, { coach: true });
          const ax = cx + (di === 0 ? 4.6 : -4.6);
          asst.g.position.set(ax, 0, dugoutZ - 1.55);
          asst.g.rotation.y = Math.PI + 0.15;
          asst.g.scale.setScalar(0.96);
          players.push(
            Object.assign(asst, {
              home: new THREE.Vector3(ax, 0, dugoutZ - 1.55),
              team: di,
              gk: false,
              bench: true,
              coach: true,
              ph: rng() * TAU,
              sp: 0.45,
              amp: 0,
            }),
          );
        });

        ball = new THREE.Mesh(
          new THREE.SphereGeometry(0.16, 10, 8),
          new THREE.MeshStandardMaterial({
            color: 0xf5f8ff,
            roughness: 0.4,
            emissive: 0xdfe6ff,
            emissiveIntensity: 0.14,
          }),
        );
        ball.castShadow = true;
        ball.position.set(0, 0.16, 0);
        scene.add(ball);
      }
      /* possession state machine: hold -> pass/shot -> hold ... */
      const match = {
        phase: "hold",
        holder: 5,
        receiver: 6,
        t: 0,
        dur: 1.2,
        from: new THREE.Vector3(),
        to: new THREE.Vector3(),
        arc: 0.6,
        shot: false,
        passCount: 0,
        turnover: false,
        celebrate: 0,
        scoredBy: 0,
      };
      function teamOf(i) {
        return players[i].team;
      }
      function startPass(shot) {
        const h = players[match.holder],
          team = h.team,
          dir = team ? -1 : 1;
        match.from.copy(ball.position);
        if (shot) {
          match.to.set(dir * 53.4, 0, (rng() - 0.5) * 6.4);
          match.shot = true;
          match.arc = 0.8 + rng() * 1.5;
        } else {
          let best = -1,
            bestV = -1e9;
          for (let k = 0; k < 4; k++) {
            const cand = team * 11 + 1 + ((rng() * 10) | 0);
            if (cand === match.holder) continue;
            const c = players[cand];
            // Build through defenders and midfielders before finding a forward.
            if (match.passCount < 3 && c.role === "forward") continue;
            const v =
              c.g.position.x * dir +
              rng() * 22 -
              Math.abs(c.g.position.z) * 0.1;
            if (v > bestV) {
              bestV = v;
              best = cand;
            }
          }
          if (best < 0) {
            const base = team * 11;
            best = base + 1 + ((rng() * 7) | 0);
            if (best === match.holder)
              best = base + 1 + ((best - base) % 7);
          }
          match.receiver = best;
          const r = players[best];
          match.to.set(
            THREE.MathUtils.clamp(
              r.g.position.x + dir * (3 + rng() * 5),
              -50,
              50,
            ),
            0,
            THREE.MathUtils.clamp(r.g.position.z + (rng() - 0.5) * 4, -31, 31),
          );
          match.shot = false;
          match.arc = rng() < 0.28 ? 2.2 + rng() * 1.6 : 0.3 + rng() * 0.5;

          // After eight completed passes, the nearest opponent steps into the
          // passing lane; the existing pass speed and ball physics stay intact.
          match.turnover = false;
          if (match.passCount >= 8) {
            const passDelta = match.to.clone().sub(match.from);
            const passLenSq = Math.max(0.001, passDelta.lengthSq());
            const opponentBase = team === 0 ? 11 : 0;
            const lanePoint = new THREE.Vector3();
            let interceptor = -1;
            let nearestLane = Infinity;
            for (let i = opponentBase; i < opponentBase + 11; i++) {
              const candidate = players[i];
              if (candidate.gk) continue;
              const rel = candidate.g.position.clone().sub(match.from);
              const u = THREE.MathUtils.clamp(
                rel.dot(passDelta) / passLenSq,
                0.28,
                0.82,
              );
              lanePoint.copy(match.from).addScaledVector(passDelta, u);
              const laneDistance =
                candidate.g.position.distanceToSquared(lanePoint);
              if (laneDistance < nearestLane) {
                nearestLane = laneDistance;
                interceptor = i;
                match.to.copy(lanePoint);
              }
            }
            if (interceptor >= 0) {
              match.receiver = interceptor;
              match.turnover = true;
              match.arc = 0.25 + rng() * 0.35;
            }
          }
        }
        const dist = match.from.distanceTo(match.to);
        match.dur = THREE.MathUtils.clamp(
          dist / (match.shot ? 26 : 17),
          0.35,
          2.4,
        );
        match.t = 0;
        match.phase = "fly";
      }
      function startTackleTurnover() {
        const h = players[match.holder];
        const opponentBase = h.team === 0 ? 11 : 0;
        let interceptor = -1;
        let nearest = Infinity;
        for (let i = opponentBase; i < opponentBase + 11; i++) {
          const candidate = players[i];
          if (candidate.gk) continue;
          const distance = candidate.g.position.distanceToSquared(h.g.position);
          if (distance < nearest) {
            nearest = distance;
            interceptor = i;
          }
        }
        if (interceptor < 0) {
          startPass(false);
          return;
        }
        match.from.copy(ball.position);
        match.receiver = interceptor;
        match.to.copy(players[interceptor].g.position);
        match.to.x = THREE.MathUtils.clamp(match.to.x, -50, 50);
        match.to.z = THREE.MathUtils.clamp(match.to.z, -31, 31);
        match.shot = false;
        match.turnover = true;
        match.arc = 0.18 + rng() * 0.22;
        const dist = match.from.distanceTo(match.to);
        match.dur = THREE.MathUtils.clamp(dist / 17, 0.25, 1.2);
        match.t = 0;
        match.phase = "fly";
      }
      function onBallArrive() {
        if (match.shot) {
          const scoringTeam = teamOf(match.holder);
          if (rng() < 0.6) {
            // goal
            if (scoringTeam === 0) score.home++;
            else score.away++;
            match.scoredBy = scoringTeam;
            match.celebrate = 2.6;
            exciteU.value = 2.4;
            drawScoreboard();
            cheer();
            ball.position.set(0, 0.16, 0);
            match.holder = (scoringTeam ? 0 : 11) + 5;
          } else {
            // wide goal kick
            match.holder = scoringTeam ? 0 : 11;
            ball.position.copy(players[match.holder].g.position);
            ball.position.y = 0.16;
          }
          match.phase = "hold";
          match.t = 0;
          match.dur = 1.4;
          return;
        }
        const previousTeam = teamOf(match.holder);
        match.holder = match.receiver;
        if (match.turnover || teamOf(match.holder) !== previousTeam) {
          match.passCount = 0;
          match.turnover = false;
        } else {
          match.passCount++;
        }
        match.phase = "hold";
        match.t = 0;
        match.dur = 0.5 + rng() * 1.3;
      }

      /* ---------- tier definitions ---------- */
      const TIERS = [
        {
          name: "Lower Tier",
          first: 101,
          sections: 32,
          rows: 18,
          rx: 89,
          rz: 67.3,
          y: 1.4,
          dr: 0.85,
          dy: 0.48,
          palette: "misr",
        },
        {
          name: "Club Tier",
          first: 201,
          sections: 24,
          rows: 12,
          rx: 108,
          rz: 81.7,
          y: 15.2,
          dr: 0.8,
          dy: 0.6,
          palette: "misr",
        },
        {
          name: "Upper Tier",
          first: 301,
          sections: 32,
          rows: 16,
          rx: 121,
          rz: 91.5,
          y: 27.6,
          dr: 0.82,
          dy: 0.72,
          palette: "misr",
        },
      ];
      TIERS.forEach((t) => {
        t.rxTop = t.rx + t.rows * t.dr;
        t.rzTop = t.rz + t.rows * t.dr;
        t.yTop = t.y + t.rows * t.dy;
      });
      const ROOF = {
        inRx: 118,
        inRz: 88,
        inY: 50,
        outRx: 168,
        outRz: 128,
        outY: 62,
        mastH: 96,
      };

      /* ---------- bowl concrete, walls, walkways, rails ---------- */
      /* Every junction shares edges with no interpenetrating bands (the old build
   sliced the tier-1 walkway through the tier-0 back wall, which flickered). */
      {
        const SEG = 160;
        // slab rake runs parallel to the seat line, 3 cm beneath seat origins
        TIERS.forEach((t) => {
          t.yIn = t.y - (1.2 / t.dr) * t.dy - 0.03;
          t.yOut = t.yTop + (1.0 / t.dr) * t.dy - 0.03;
        });
        // terrace step shading (one step per row via texture repeat)
        const stepTex = canvasTexture(64, 64, (x, w, h) => {
          const g = x.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, "#242e42");
          g.addColorStop(0.8, "#1a2130");
          g.addColorStop(0.85, "#0b101a");
          g.addColorStop(1, "#151c2a");
          x.fillStyle = g;
          x.fillRect(0, 0, w, h);
          x.globalAlpha = 0.1;
          for (let i = 0; i < 130; i++) {
            x.fillStyle = Math.random() > 0.5 ? "#000" : "#3a4a66";
            x.fillRect(Math.random() * w, Math.random() * h, 2, 1);
          }
        });
        stepTex.wrapS = stepTex.wrapT = THREE.RepeatWrapping;
        // lit concourse glass between tiers
        const glassTex = canvasTexture(
          1024,
          64,
          (x, w, h) => {
            x.fillStyle = "#070c17";
            x.fillRect(0, 0, w, h);
            for (let i = 0; i < 64; i++) {
              const lit = Math.random() < 0.6;
              x.fillStyle = lit
                ? "rgba(255,205,130," +
                  (0.25 + Math.random() * 0.55).toFixed(2) +
                  ")"
                : "#0d1526";
              x.fillRect(i * 16 + 2, 8, 12, h - 16);
              if (lit && Math.random() < 0.35) {
                x.fillStyle = "rgba(20,26,40,.9)";
                x.fillRect(i * 16 + 5, 20, 4, h - 28);
              } // silhouettes
            }
          },
          10,
          1,
        );
        const glassMat = new THREE.MeshBasicMaterial({
          map: glassTex,
          side: THREE.DoubleSide,
        });

        TIERS.forEach((t, i) => {
          const slabTex = stepTex.clone();
          slabTex.needsUpdate = true;
          slabTex.repeat.set(110, t.rows);
          const slabMat = new THREE.MeshLambertMaterial({
            map: slabTex,
            side: THREE.DoubleSide,
          });
          scene.add(
            ringStrip(
              t.rx - 1.2,
              t.rz - 1.2,
              t.yIn,
              t.rxTop + 1,
              t.rzTop + 1,
              t.yOut,
              SEG,
              slabMat,
              1,
            ),
          );
          // front fascia
          if (i === 0) {
            scene.add(
              ringStrip(
                t.rx - 1.2,
                t.rz - 1.2,
                0.05,
                t.rx - 1.2,
                t.rz - 1.2,
                t.yIn,
                SEG,
                MAT.concreteDark,
                60,
              ),
            );
          } else {
            scene.add(
              ringStrip(
                t.rx - 1.2,
                t.rz - 1.2,
                t.yIn - 1.0,
                t.rx - 1.2,
                t.rz - 1.2,
                t.yIn,
                SEG,
                MAT.concreteDark,
                60,
              ),
            );
          }
          // front rail
          scene.add(
            ringStrip(
              t.rx - 1.15,
              t.rz - 1.15,
              t.yIn - 0.02,
              t.rx - 1.15,
              t.rz - 1.15,
              t.yIn + 0.85,
              SEG,
              MAT.rail,
              80,
            ),
          );
          // walkway inner radius meets the previous tier's back wall exactly
          const wInX = i === 0 ? t.rx - 3.4 : TIERS[i - 1].rxTop + 1;
          const wInZ = i === 0 ? t.rz - 3.4 : TIERS[i - 1].rzTop + 1;
          scene.add(
            ringStrip(
              wInX,
              wInZ,
              t.yIn,
              t.rx - 1.2,
              t.rz - 1.2,
              t.yIn,
              SEG,
              MAT.concreteDark,
              40,
            ),
          );
          // back wall (short parapet mid-bowl, tall at the very top)
          const wallH = i === 2 ? 2.6 : 1.2;
          scene.add(
            ringStrip(
              t.rxTop + 1,
              t.rzTop + 1,
              t.yOut,
              t.rxTop + 1,
              t.rzTop + 1,
              t.yOut + wallH,
              SEG,
              MAT.concrete,
              60,
            ),
          );
          // concourse glass from wall top up to the next tier's fascia, plus a soffit closing the slot
          if (i < 2) {
            const nt = TIERS[i + 1];
            scene.add(
              ringStrip(
                t.rxTop + 1,
                t.rzTop + 1,
                t.yOut + wallH,
                t.rxTop + 1,
                t.rzTop + 1,
                nt.yIn - 1.0,
                SEG,
                glassMat,
                10,
              ),
            );
            scene.add(
              ringStrip(
                t.rxTop + 1,
                t.rzTop + 1,
                nt.yIn - 1.0,
                nt.rx - 1.2,
                nt.rz - 1.2,
                nt.yIn - 1.0,
                SEG,
                MAT.concreteDark,
                40,
              ),
            );
          }
        });
      }

      /* ---------- LED ribbon on tier 1 balcony ---------- */
      {
        const ribTex = canvasTexture(
          2048,
          48,
          (x, w, h) => {
            const g = x.createLinearGradient(0, 0, w, 0);
            g.addColorStop(0, "#04203f");
            g.addColorStop(0.5, "#062a52");
            g.addColorStop(1, "#04203f");
            x.fillStyle = g;
            x.fillRect(0, 0, w, h);
            x.font = "700 30px " + getComputedStyle(document.body).fontFamily;
            x.textBaseline = "middle";
            let cx = 40;
            const words = [
              "EGYPT VS ARGENTINA",
              "INTERNATIONAL FRIENDLY",
              "MISR STADIUM · NAC",
              "KICK OFF 8.30 PM",
            ];
            for (let i = 0; i < 8; i++) {
              const t = words[i % words.length];
              x.fillStyle = i % 2 ? "#39c4ff" : "#dff0ff";
              x.fillText(t, cx, h / 2 + 1);
              cx += x.measureText(t).width + 130;
            }
          },
          3,
          1,
        );
        ribTex.encoding = THREE.sRGBEncoding;
        animatedTextures.push({ t: ribTex, speed: -0.012 });
        const t1 = TIERS[1];
        scene.add(
          ringStrip(
            t1.rx - 1.05,
            t1.rz - 1.05,
            t1.yIn - 0.92,
            t1.rx - 1.05,
            t1.rz - 1.05,
            t1.yIn - 0.06,
            160,
            new THREE.MeshBasicMaterial({
              map: ribTex,
              toneMapped: false,
              side: THREE.DoubleSide,
            }),
            3,
          ),
        );
      }

      /* ---------- roof + masts + cables (Misr Stadium / Admin Capital style) ---------- */
      const glowSprite = (() => {
        const t = canvasTexture(128, 128, (x) => {
          const g = x.createRadialGradient(64, 64, 4, 64, 64, 64);
          g.addColorStop(0, "rgba(255,255,255,1)");
          g.addColorStop(0.25, "rgba(255,220,160,.55)");
          g.addColorStop(1, "rgba(255,180,80,0)");
          x.fillStyle = g;
          x.fillRect(0, 0, 128, 128);
        });
        return t;
      })();
      {
        const SEG = 192;
        const RINGS = 14;
        const MASTS = 32; // Misr Stadium: 32 exterior masts
        // Flat level membrane — smooth elliptical plan, linear height from inner to outer ring
        const roofY = (a, t) => ROOF.inY + (ROOF.outY - ROOF.inY) * t;
        const roofXZ = (a, t) => {
          const c = Math.cos(a),
            s = Math.sin(a);
          const rx = ROOF.inRx + (ROOF.outRx - ROOF.inRx) * t;
          const rz = ROOF.inRz + (ROOF.outRz - ROOF.inRz) * t;
          return [rx * c, rz * s];
        };
        const membrane = new THREE.MeshLambertMaterial({
          map: roofTex,
          color: 0xffffff,
          side: THREE.DoubleSide,
          emissive: 0xd0dcec,
          emissiveIntensity: 0.22,
          transparent: true,
          opacity: 0.96,
        });
        const whiteSteel = new THREE.MeshLambertMaterial({
          color: 0xf5f8fc,
          emissive: 0xaab8cc,
          emissiveIntensity: 0.22,
          side: THREE.DoubleSide,
        });
        const cableMat = new THREE.MeshBasicMaterial({ color: 0xe8eef6 });
        const trussMat = new THREE.MeshLambertMaterial({
          color: 0xb0bac8,
          side: THREE.DoubleSide,
        });
        const soffitWhite = new THREE.MeshLambertMaterial({
          color: 0xffffff,
          emissive: 0xe8f0fa,
          emissiveIntensity: 0.35,
          side: THREE.BackSide,
        });

        // flat PTFE membrane (smooth oval opening, level surface)
        {
          const pos = [],
            uv = [],
            idx = [];
          for (let r = 0; r <= RINGS; r++) {
            const t = r / RINGS;
            for (let i = 0; i <= SEG; i++) {
              const a = (i / SEG) * TAU;
              const [x, z] = roofXZ(a, t);
              pos.push(x, roofY(a, t), z);
              uv.push((i / SEG) * 48, t * 5);
            }
          }
          const stride = SEG + 1;
          for (let r = 0; r < RINGS; r++) {
            for (let i = 0; i < SEG; i++) {
              const a = r * stride + i;
              const b = a + stride;
              idx.push(a, a + 1, b, b, a + 1, b + 1);
            }
          }
          const g = new THREE.BufferGeometry();
          g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
          g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
          g.setIndex(idx);
          g.computeVertexNormals();
          scene.add(new THREE.Mesh(g, membrane));
          // bright underside (looking up from seats)
          const under = new THREE.Mesh(g.clone(), soffitWhite);
          under.scale.set(0.998, 0.998, 0.998);
          under.position.y = -0.25;
          scene.add(under);
        }
        // outer eaves / fascia lip
        scene.add(
          ringStrip(
            ROOF.outRx - 0.4,
            ROOF.outRz - 0.4,
            ROOF.outY + 0.2,
            ROOF.outRx + 4.5,
            ROOF.outRz + 4.0,
            ROOF.outY + 1.8,
            SEG,
            whiteSteel,
            24,
          ),
        );

        // radial triangular truss ribs (Misr-style space frame)
        for (let i = 0; i < MASTS; i++) {
          const a = (i / MASTS) * TAU;
          const [ix, iz] = roofXZ(a, 0);
          const [ox, oz] = roofXZ(a, 1);
          const yIn = roofY(a, 0);
          const yOut = roofY(a, 1);
          const p1 = new THREE.Vector3(ix, yIn - 0.4, iz);
          const p2 = new THREE.Vector3(ox, yOut - 0.6, oz);
          const len = p1.distanceTo(p2);
          // top chord
          const top = new THREE.Mesh(
            new THREE.BoxGeometry(0.28, 0.42, len),
            trussMat,
          );
          top.position.copy(p1).add(p2).multiplyScalar(0.5);
          top.lookAt(p2);
          scene.add(top);
          // bottom chord (deeper)
          const bot = new THREE.Mesh(
            new THREE.BoxGeometry(0.22, 0.28, len),
            trussMat,
          );
          const p1b = p1.clone();
          p1b.y -= 2.4;
          const p2b = p2.clone();
          p2b.y -= 2.8;
          bot.position.copy(p1b).add(p2b).multiplyScalar(0.5);
          bot.lookAt(p2b);
          scene.add(bot);
          // web braces along the rib
          for (let k = 1; k <= 5; k++) {
            const u = k / 6;
            const mid = p1.clone().lerp(p2, u);
            const brace = new THREE.Mesh(
              new THREE.BoxGeometry(0.14, 2.6, 0.14),
              trussMat,
            );
            brace.position.copy(mid);
            brace.position.y -= 1.4;
            scene.add(brace);
          }
        }

        // thick white inner compression ring (smooth ellipse)
        {
          const pos = [],
            uv = [],
            idx = [];
          for (let i = 0; i <= SEG; i++) {
            const a = (i / SEG) * TAU;
            const [ix, iz] = roofXZ(a, 0);
            const y = roofY(a, 0);
            pos.push(ix, y - 2.8, iz, ix, y + 0.35, iz);
            uv.push((i / SEG) * 50, 0, (i / SEG) * 50, 1);
          }
          for (let i = 0; i < SEG; i++) {
            const k = i * 2;
            idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
          }
          const g = new THREE.BufferGeometry();
          g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
          g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
          g.setIndex(idx);
          g.computeVertexNormals();
          scene.add(new THREE.Mesh(g, whiteSteel));
          // secondary ring beam slightly outward
          for (let i = 0; i < SEG; i++) {
            const a0 = (i / SEG) * TAU;
            const a1 = ((i + 1) / SEG) * TAU;
            const [x0, z0] = roofXZ(a0, 0.06);
            const [x1, z1] = roofXZ(a1, 0.06);
            const y0 = roofY(a0, 0.06) - 1.2;
            const y1 = roofY(a1, 0.06) - 1.2;
            const p0 = new THREE.Vector3(x0, y0, z0);
            const p1 = new THREE.Vector3(x1, y1, z1);
            const len = p0.distanceTo(p1);
            const beam = new THREE.Mesh(
              new THREE.BoxGeometry(0.35, 0.55, len),
              trussMat,
            );
            beam.position.copy(p0).add(p1).multiplyScalar(0.5);
            beam.lookAt(p1);
            scene.add(beam);
          }
        }

        // 32 tall white masts + tension cables to inner ring
        for (let i = 0; i < MASTS; i++) {
          const a = (i / MASTS) * TAU,
            c = Math.cos(a),
            s = Math.sin(a);
          const mx = (ROOF.outRx + 5.5) * c,
            mz = (ROOF.outRz + 5.5) * s;
          const mast = new THREE.Mesh(
            new THREE.CylinderGeometry(0.5, 0.8, ROOF.mastH, 8),
            whiteSteel,
          );
          mast.position.set(mx, ROOF.mastH / 2, mz);
          scene.add(mast);
          // mast tip cap
          const cap = new THREE.Mesh(
            new THREE.SphereGeometry(0.75, 8, 6),
            whiteSteel,
          );
          cap.position.set(mx, ROOF.mastH, mz);
          scene.add(cap);
          const tip = new THREE.Vector3(mx, ROOF.mastH - 0.8, mz);
          const [ix, iz] = roofXZ(a, 0);
          const [mxz, mzz] = roofXZ(a, 0.45);
          const [ox, oz] = roofXZ(a, 0.92);
          const targets = [
            new THREE.Vector3(ix, roofY(a, 0) - 0.2, iz),
            new THREE.Vector3(mxz, roofY(a, 0.45), mzz),
            new THREE.Vector3(ox, roofY(a, 0.92), oz),
          ];
          // neighboring bay stays (cables fan like the real stadium)
          const aL = a - TAU / MASTS;
          const aR = a + TAU / MASTS;
          const [lx, lz] = roofXZ(aL, 0.15);
          const [rx, rz] = roofXZ(aR, 0.15);
          targets.push(
            new THREE.Vector3(lx, roofY(aL, 0.15), lz),
            new THREE.Vector3(rx, roofY(aR, 0.15), rz),
          );
          targets.forEach((to) => {
            const len = tip.distanceTo(to);
            const cable = new THREE.Mesh(
              new THREE.CylinderGeometry(0.055, 0.055, len, 4),
              cableMat,
            );
            cable.position.copy(tip).add(to).multiplyScalar(0.5);
            cable.quaternion.setFromUnitVectors(
              new THREE.Vector3(0, 1, 0),
              to.clone().sub(tip).normalize(),
            );
            scene.add(cable);
          });
        }

        // facade wall + support columns
        const wall = new THREE.Mesh(
          new THREE.CylinderGeometry(
            ROOF.outRx - 1,
            ROOF.outRx - 1,
            ROOF.outY - 2,
            96,
            1,
            true,
          ),
          MAT.facade,
        );
        wall.scale.z = (ROOF.outRz - 1) / (ROOF.outRx - 1);
        wall.position.y = (ROOF.outY - 2) / 2;
        scene.add(wall);
        for (let i = 0; i < 48; i++) {
          const a = (i / 48) * TAU;
          const col = new THREE.Mesh(
            new THREE.CylinderGeometry(0.55, 0.7, ROOF.outY, 8),
            MAT.steelDark,
          );
          col.position.set(
            (ROOF.outRx + 0.6) * Math.cos(a),
            ROOF.outY / 2,
            (ROOF.outRz + 0.6) * Math.sin(a),
          );
          scene.add(col);
        }

        // ——— stadium envelope / cladding (closes wall→roof gap) ———
        {
          const ENV_SEG = 128;
          // Misr / Nefertiti cool-blue–turquoise vertical cladding
          const facadeTex = canvasTexture(1024, 512, (x, w, h) => {
            x.fillStyle = "#7eb8d8";
            x.fillRect(0, 0, w, h);
            for (let i = 0; i < 96; i++) {
              const t = i % 4;
              x.fillStyle =
                t === 0
                  ? "#6aa8cc"
                  : t === 1
                    ? "#8fc4e0"
                    : t === 2
                      ? "#5a98bc"
                      : "#a0d0e8";
              x.fillRect(i * (w / 96), 0, w / 96 - 1, h);
            }
            // lit window band
            x.fillStyle = "#071422";
            x.fillRect(0, h * 0.42, w, h * 0.2);
            for (let i = 0; i < 90; i++) {
              const lit = Math.random() < 0.5;
              x.fillStyle = lit
                ? "rgba(255,205,130," +
                  (0.4 + Math.random() * 0.45).toFixed(2) +
                  ")"
                : "rgba(30,60,95,0.55)";
              x.fillRect(i * (w / 90) + 2, h * 0.44, w / 90 - 4, h * 0.16);
            }
            // upper vent slots
            x.fillStyle = "rgba(20,50,80,0.35)";
            for (let i = 0; i < 48; i++) {
              x.fillRect(i * (w / 48) + 3, h * 0.12, w / 48 - 6, h * 0.08);
            }
          }, 10, 1);
          facadeTex.encoding = THREE.sRGBEncoding;
          const cladMat = new THREE.MeshLambertMaterial({
            map: facadeTex,
            side: THREE.DoubleSide,
          });
          const upperCladMat = new THREE.MeshLambertMaterial({
            color: 0x6eb0d0,
            side: THREE.DoubleSide,
          });
          const fasciaMat = new THREE.MeshLambertMaterial({
            color: 0xe8eef6,
            side: THREE.DoubleSide,
          });
          const soffitMat = new THREE.MeshLambertMaterial({
            color: 0xeef4fa,
            side: THREE.DoubleSide,
            emissive: 0x8899aa,
            emissiveIntensity: 0.12,
          });
          const soffitLit = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            toneMapped: false,
            side: THREE.DoubleSide,
          });

          // lower bowl cladding: wide base → mid (full height continuity)
          scene.add(
            ringStrip(
              ROOF.outRx + 18,
              ROOF.outRz + 16,
              0.05,
              ROOF.outRx + 5,
              ROOF.outRz + 4.5,
              ROOF.outY * 0.52,
              ENV_SEG,
              cladMat,
              12,
            ),
          );
          // mid envelope — fills former open gap up toward eaves
          scene.add(
            ringStrip(
              ROOF.outRx + 5,
              ROOF.outRz + 4.5,
              ROOF.outY * 0.52,
              ROOF.outRx + 2.4,
              ROOF.outRz + 2.2,
              ROOF.outY - 1.2,
              ENV_SEG,
              upperCladMat,
              8,
            ),
          );
          // eaves fascia: thick dark ring locking cladding to roof edge
          scene.add(
            ringStrip(
              ROOF.outRx + 0.2,
              ROOF.outRz + 0.2,
              ROOF.outY - 1.8,
              ROOF.outRx + 3.6,
              ROOF.outRz + 3.2,
              ROOF.outY + 1.4,
              ENV_SEG,
              fasciaMat,
              4,
            ),
          );
          // outer roof-edge cap (silhouette completion)
          scene.add(
            ringStrip(
              ROOF.outRx + 3.2,
              ROOF.outRz + 2.8,
              ROOF.outY + 0.6,
              ROOF.outRx + 3.2,
              ROOF.outRz + 2.8,
              ROOF.outY + 2.8,
              ENV_SEG,
              fasciaMat,
              2,
            ),
          );

          // vertical cladding fins between masts (outer skin ribs)
          const finMat = new THREE.MeshLambertMaterial({ color: 0x8ec6e4 });
          for (let i = 0; i < MASTS; i++) {
            const a = (i / MASTS) * TAU,
              c = Math.cos(a),
              s = Math.sin(a);
            const rx = ROOF.outRx + 7.2,
              rz = ROOF.outRz + 6.2;
            const finH = ROOF.outY + 4;
            const fin = new THREE.Mesh(
              new THREE.BoxGeometry(0.55, finH, 2.4),
              finMat,
            );
            fin.position.set(rx * c, finH / 2, rz * s);
            fin.rotation.y = -a;
            scene.add(fin);
          }

          // perforated upper collar behind masts (semi-solid skin)
          const meshTex = canvasTexture(256, 128, (x, w, h) => {
            x.fillStyle = "#8aa8c4";
            x.fillRect(0, 0, w, h);
            x.fillStyle = "rgba(15,30,50,0.55)";
            for (let u = 0; u < 32; u++) {
              for (let v = 0; v < 10; v++) {
                x.fillRect(u * (w / 32) + 2, v * (h / 10) + 2, w / 32 - 4, h / 10 - 4);
              }
            }
          }, 16, 2);
          meshTex.encoding = THREE.sRGBEncoding;
          scene.add(
            ringStrip(
              ROOF.outRx + 6.5,
              ROOF.outRz + 5.5,
              ROOF.outY * 0.45,
              ROOF.outRx + 6.5,
              ROOF.outRz + 5.5,
              ROOF.outY + 0.5,
              ENV_SEG,
              new THREE.MeshLambertMaterial({
                map: meshTex,
                transparent: true,
                opacity: 0.72,
                side: THREE.DoubleSide,
              }),
              16,
            ),
          );

          // interior soffit ribbons under canopy (light-blue envelope bands)
          const soffitBands = [
            [0.12, 0.22, soffitMat],
            [0.28, 0.36, soffitLit],
            [0.42, 0.52, soffitMat],
            [0.58, 0.66, soffitLit],
            [0.72, 0.82, soffitMat],
            [0.88, 0.96, soffitLit],
          ];
          soffitBands.forEach(([t0, t1, mat]) => {
            const r0x = ROOF.inRx + (ROOF.outRx - ROOF.inRx) * t0;
            const r0z = ROOF.inRz + (ROOF.outRz - ROOF.inRz) * t0;
            const r1x = ROOF.inRx + (ROOF.outRx - ROOF.inRx) * t1;
            const r1z = ROOF.inRz + (ROOF.outRz - ROOF.inRz) * t1;
            const y0 = roofY(0, t0) - 1.6;
            const y1 = roofY(0, t1) - 1.6;
            scene.add(ringStrip(r0x, r0z, y0, r1x, r1z, y1, ENV_SEG, mat, 20));
          });

          // inner bowl cladding (backs of upper stands, closes silhouette from inside)
          scene.add(
            ringStrip(
              ROOF.outRx - 1.2,
              ROOF.outRz - 1.0,
              18,
              ROOF.outRx - 0.4,
              ROOF.outRz - 0.3,
              ROOF.outY - 2,
              ENV_SEG,
              new THREE.MeshLambertMaterial({
                color: 0xb8c8da,
                side: THREE.DoubleSide,
              }),
              6,
            ),
          );
        }
        // cyan LED rings on exterior envelope
        scene.add(
          ringStrip(
            ROOF.outRx + 4.0,
            ROOF.outRz + 3.5,
            ROOF.outY - 3.0,
            ROOF.outRx + 4.0,
            ROOF.outRz + 3.5,
            ROOF.outY - 1.2,
            120,
            new THREE.MeshBasicMaterial({
              color: 0x19b7ff,
              toneMapped: false,
              side: THREE.DoubleSide,
            }),
            40,
          ),
        );
        scene.add(
          ringStrip(
            ROOF.outRx + 5.2,
            ROOF.outRz + 4.6,
            ROOF.outY * 0.52,
            ROOF.outRx + 5.2,
            ROOF.outRz + 4.6,
            ROOF.outY * 0.52 + 1.1,
            120,
            new THREE.MeshBasicMaterial({
              color: 0x66d4ff,
              toneMapped: false,
              side: THREE.DoubleSide,
            }),
            40,
          ),
        );

        // warm floodlight ring on smooth inner lip
        scene.add(
          ringStrip(
            ROOF.inRx + 0.2,
            ROOF.inRz + 0.2,
            ROOF.inY - 1.0,
            ROOF.inRx + 0.2,
            ROOF.inRz + 0.2,
            ROOF.inY - 0.25,
            SEG,
            new THREE.MeshBasicMaterial({
              color: 0xffe0a8,
              toneMapped: false,
              side: THREE.DoubleSide,
            }),
            60,
          ),
        );
        const smat = new THREE.SpriteMaterial({
          map: glowSprite,
          color: 0xffd9a0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true,
          opacity: 0.85,
        });
        for (let i = 0; i < MASTS * 2; i++) {
          const a = (i / (MASTS * 2)) * TAU;
          const [ix, iz] = roofXZ(a, 0);
          const sp = new THREE.Sprite(smat);
          sp.position.set(ix, roofY(a, 0) - 0.9, iz);
          sp.scale.setScalar(3.2 + (i % 3) * 0.6);
          scene.add(sp);
        }

        /* ---------- exterior surroundings (plaza / road / landscape) ---------- */
        {
          const portalMat = new THREE.MeshLambertMaterial({ color: 0xf4f7fb });
          const portalGlow = new THREE.MeshBasicMaterial({
            color: 0xffe2b0,
            toneMapped: false,
          });
          const glassDoor = new THREE.MeshLambertMaterial({
            color: 0x6eb6ff,
            transparent: true,
            opacity: 0.45,
          });
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * TAU + Math.PI / 4;
            const c = Math.cos(a),
              s = Math.sin(a);
            const ex = (ROOF.outRx + 20) * c,
              ez = (ROOF.outRz + 20) * s;
            const arch = new THREE.Mesh(
              new THREE.BoxGeometry(28, 16, 14),
              portalMat,
            );
            arch.position.set(ex, 8, ez);
            arch.rotation.y = -a;
            scene.add(arch);
            const opening = new THREE.Mesh(
              new THREE.BoxGeometry(16, 11, 0.35),
              portalGlow,
            );
            opening.position.set(ex + c * 7.2, 6, ez + s * 7.2);
            opening.rotation.y = -a;
            scene.add(opening);
            for (let d = -1; d <= 1; d += 2) {
              const door = new THREE.Mesh(
                new THREE.BoxGeometry(4.5, 8, 0.2),
                glassDoor,
              );
              door.position.set(
                ex + c * 7.4 + -s * d * 5,
                4.2,
                ez + s * 7.4 + c * d * 5,
              );
              door.rotation.y = -a;
              scene.add(door);
            }
            const canopy = new THREE.Mesh(
              new THREE.BoxGeometry(32, 0.55, 16),
              whiteSteel,
            );
            canopy.position.set(ex + c * 4, 16.2, ez + s * 4);
            canopy.rotation.y = -a;
            scene.add(canopy);
            for (let step = 0; step < 6; step++) {
              const st = new THREE.Mesh(
                new THREE.BoxGeometry(18 - step * 0.4, 0.35, 2.2),
                new THREE.MeshLambertMaterial({ color: 0xd0d5de }),
              );
              st.position.set(
                ex + c * (12 + step * 2.1),
                0.2 + step * 0.35,
                ez + s * (12 + step * 2.1),
              );
              st.rotation.y = -a;
              scene.add(st);
            }
            const walk = new THREE.Mesh(
              new THREE.BoxGeometry(12, 0.12, 28),
              new THREE.MeshLambertMaterial({ color: 0xb8c0cc }),
            );
            walk.position.set(ex + c * 28, 0.02, ez + s * 28);
            walk.rotation.y = -a;
            scene.add(walk);
          }

          {
            const nameCv = document.createElement("canvas");
            nameCv.width = 1024;
            nameCv.height = 128;
            const nx = nameCv.getContext("2d");
            nx.fillStyle = "#0a1524";
            nx.fillRect(0, 0, 1024, 128);
            nx.fillStyle = "#19b7ff";
            nx.font = "800 64px sans-serif";
            nx.textAlign = "center";
            nx.textBaseline = "middle";
            nx.fillText("MISR STADIUM  ·  استاد مصر", 512, 64);
            const nameTex = new THREE.CanvasTexture(nameCv);
            nameTex.encoding = THREE.sRGBEncoding;
            const nameMat = new THREE.MeshBasicMaterial({
              map: nameTex,
              toneMapped: false,
            });
            for (let i = 0; i < 4; i++) {
              const a = (i / 4) * TAU;
              const c = Math.cos(a),
                s = Math.sin(a);
              const board = new THREE.Mesh(
                new THREE.PlaneGeometry(36, 4.5),
                nameMat,
              );
              board.position.set(
                (ROOF.outRx + 16.2) * c,
                28,
                (ROOF.outRz + 16.2) * s,
              );
              board.rotation.y = -a + Math.PI;
              scene.add(board);
            }
          }

          const plaza = new THREE.Mesh(
            new THREE.CircleGeometry(1, 96),
            new THREE.MeshLambertMaterial({ color: 0xc8ced8 }),
          );
          plaza.scale.set(ROOF.outRx + 70, ROOF.outRz + 58, 1);
          plaza.rotation.x = -Math.PI / 2;
          plaza.position.y = -0.08;
          plaza.receiveShadow = true;
          scene.add(plaza);
          scene.add(
            ringStrip(
              ROOF.outRx + 14,
              ROOF.outRz + 12,
              0.35,
              ROOF.outRx + 28,
              ROOF.outRz + 24,
              0.35,
              96,
              new THREE.MeshLambertMaterial({
                color: 0xd5dae3,
                side: THREE.DoubleSide,
              }),
              1,
            ),
          );
          const grassMat = new THREE.MeshLambertMaterial({
            color: 0x2d6b3a,
            side: THREE.DoubleSide,
          });
          scene.add(
            ringStrip(
              ROOF.outRx + 30,
              ROOF.outRz + 26,
              0.02,
              ROOF.outRx + 40,
              ROOF.outRz + 34,
              0.02,
              96,
              grassMat,
              1,
            ),
          );
          scene.add(
            ringStrip(
              ROOF.outRx + 60,
              ROOF.outRz + 52,
              0.02,
              ROOF.outRx + 72,
              ROOF.outRz + 62,
              0.02,
              96,
              grassMat,
              1,
            ),
          );
          const trunkMat = new THREE.MeshLambertMaterial({ color: 0x4a3020 });
          const leafMat = new THREE.MeshLambertMaterial({ color: 0x1f6b35 });
          for (let i = 0; i < 56; i++) {
            const a = (i / 56) * TAU + 0.05;
            const tr = ROOF.outRx + 35 + (i % 3) * 4;
            const tz = ROOF.outRz + 30 + (i % 3) * 3.5;
            const x = tr * Math.cos(a),
              z = tz * Math.sin(a);
            const trunk = new THREE.Mesh(
              new THREE.CylinderGeometry(0.25, 0.35, 3.2, 5),
              trunkMat,
            );
            trunk.position.set(x, 1.6, z);
            scene.add(trunk);
            const crown = new THREE.Mesh(
              new THREE.SphereGeometry(2.1 + (i % 3) * 0.35, 7, 5),
              leafMat,
            );
            crown.position.set(x, 4.4, z);
            scene.add(crown);
          }
          scene.add(
            ringStrip(
              ROOF.outRx + 42,
              ROOF.outRz + 36,
              -0.04,
              ROOF.outRx + 58,
              ROOF.outRz + 50,
              -0.04,
              120,
              new THREE.MeshLambertMaterial({
                color: 0x2a3038,
                side: THREE.DoubleSide,
              }),
              1,
            ),
          );
          scene.add(
            ringStrip(
              ROOF.outRx + 49.5,
              ROOF.outRz + 42.5,
              -0.02,
              ROOF.outRx + 50.5,
              ROOF.outRz + 43.5,
              -0.02,
              120,
              new THREE.MeshBasicMaterial({
                color: 0xf0e6a8,
                toneMapped: false,
                side: THREE.DoubleSide,
              }),
              1,
            ),
          );
          const carColors = [0xdfe4ea, 0x2a3344, 0x8b0000, 0x74acdf, 0xe8c53a];
          for (let sec = 0; sec < 4; sec++) {
            const a0 = (sec / 4) * TAU + 0.2;
            const lot = new THREE.Mesh(
              new THREE.BoxGeometry(38, 0.1, 22),
              new THREE.MeshLambertMaterial({ color: 0x333a44 }),
            );
            const lr = ROOF.outRx + 78;
            lot.position.set(
              lr * Math.cos(a0),
              0.0,
              (ROOF.outRz + 68) * Math.sin(a0),
            );
            lot.rotation.y = -a0;
            scene.add(lot);
            for (let row = 0; row < 3; row++) {
              for (let col = 0; col < 6; col++) {
                const car = new THREE.Mesh(
                  new THREE.BoxGeometry(2.2, 0.9, 4.2),
                  new THREE.MeshLambertMaterial({
                    color: carColors[(row * 6 + col) % carColors.length],
                  }),
                );
                const ox = (col - 2.5) * 5.2;
                const oz = (row - 1) * 6.5;
                car.position.set(
                  lot.position.x + Math.cos(a0) * oz - Math.sin(a0) * ox,
                  0.5,
                  lot.position.z + Math.sin(a0) * oz + Math.cos(a0) * ox,
                );
                car.rotation.y = -a0;
                scene.add(car);
              }
            }
          }
          for (let i = 0; i < 64; i++) {
            const a = (i / 64) * TAU;
            const rib = new THREE.Mesh(
              new THREE.BoxGeometry(1.0, 0.1, ROOF.outRx + 38),
              new THREE.MeshLambertMaterial({ color: 0xb8bec8 }),
            );
            rib.position.set(0, -0.02, 0);
            rib.rotation.y = a;
            scene.add(rib);
          }
          const lampMat = new THREE.MeshLambertMaterial({ color: 0x8a93a3 });
          const lampGlow = new THREE.MeshBasicMaterial({
            color: 0xffd19a,
            toneMapped: false,
          });
          for (let i = 0; i < 48; i++) {
            const a = (i / 48) * TAU;
            const lx = (ROOF.outRx + 34) * Math.cos(a),
              lz = (ROOF.outRz + 30) * Math.sin(a);
            const pole = new THREE.Mesh(
              new THREE.CylinderGeometry(0.18, 0.25, 8, 6),
              lampMat,
            );
            pole.position.set(lx, 4, lz);
            scene.add(pole);
            const bulb = new THREE.Mesh(
              new THREE.SphereGeometry(0.55, 8, 6),
              lampGlow,
            );
            bulb.position.set(lx, 8.2, lz);
            scene.add(bulb);
            const halo = new THREE.Sprite(
              new THREE.SpriteMaterial({
                map: glowSprite,
                color: 0xffcc88,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                transparent: true,
                opacity: 0.55,
              }),
            );
            halo.position.set(lx, 8.2, lz);
            halo.scale.setScalar(5);
            scene.add(halo);
          }
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * TAU + 0.12;
            const kx = (ROOF.outRx + 32) * Math.cos(a),
              kz = (ROOF.outRz + 28) * Math.sin(a);
            const kiosk = new THREE.Mesh(
              new THREE.BoxGeometry(6, 3.2, 4),
              new THREE.MeshLambertMaterial({ color: 0xeef2f8 }),
            );
            kiosk.position.set(kx, 1.6, kz);
            kiosk.rotation.y = -a;
            scene.add(kiosk);
            const roofK = new THREE.Mesh(
              new THREE.BoxGeometry(7, 0.25, 5),
              whiteSteel,
            );
            roofK.position.set(kx, 3.35, kz);
            roofK.rotation.y = -a;
            scene.add(roofK);
          }
        }
      }

      /* ---------- volumetric floodlight cones ---------- */
      {
        const coneTex = canvasTexture(64, 128, (x, w, h) => {
          const g = x.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, "rgba(255,255,255,0.85)");
          g.addColorStop(0.3, "rgba(215,232,255,0.32)");
          g.addColorStop(1, "rgba(170,205,255,0)");
          x.fillStyle = g;
          x.fillRect(0, 0, w, h);
        });
        const cmat = new THREE.MeshBasicMaterial({
          map: coneTex,
          transparent: true,
          opacity: 0.12,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
          fog: false,
          toneMapped: false,
        });
        const up = new THREE.Vector3(0, 1, 0);
        for (let i = 0; i < 10; i++) {
          const a = ((i + 0.5) / 10) * TAU;
          const from = new THREE.Vector3(
            (ROOF.inRx + 0.3) * Math.cos(a),
            ROOF.inY - 0.9,
            (ROOF.inRz + 0.3) * Math.sin(a),
          );
          const to = new THREE.Vector3(
            (rng() - 0.5) * 74,
            0.1,
            (rng() - 0.5) * 48,
          );
          const dir = to.clone().sub(from),
            len = dir.length();
          const cone = new THREE.Mesh(
            new THREE.CylinderGeometry(0.7, 9.5, len, 10, 1, true),
            cmat,
          );
          cone.position.copy(from).add(to).multiplyScalar(0.5);
          cone.quaternion.setFromUnitVectors(
            up,
            from.clone().sub(to).normalize(),
          );
          scene.add(cone);
        }
      }

      /* ---------- scoreboards (live score + match clock) ---------- */
      let drawScoreboard = () => {};
      {
        const cv = document.createElement("canvas");
        cv.width = 1024;
        cv.height = 512;
        const ctx = cv.getContext("2d");
        const sbTex = new THREE.CanvasTexture(cv);
        sbTex.encoding = THREE.sRGBEncoding;
        sbTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        const f = getComputedStyle(document.body).fontFamily;
        drawScoreboard = () => {
          const w = cv.width,
            h = cv.height,
            x = ctx;
          x.fillStyle = "#050b16";
          x.fillRect(0, 0, w, h);
          x.strokeStyle = "rgba(57,196,255,.5)";
          x.lineWidth = 8;
          x.strokeRect(8, 8, w - 16, h - 16);
          x.textAlign = "center";
          x.fillStyle = "#dff0ff";
          x.font = "800 130px " + f;
          x.fillText(
            "EGY  " + score.home + " · " + score.away + "  ARG",
            w / 2,
            215,
          );
          x.fillStyle = "#39c4ff";
          x.font = "700 60px " + f;
          x.fillText(
            score.minute < 90
              ? "LIVE \u00b7 " + score.minute + "'"
              : "FULL TIME",
            w / 2,
            335,
          );
          x.fillStyle = "#5b6a85";
          x.font = "600 44px " + f;
          x.fillText("INTERNATIONAL FRIENDLY", w / 2, 425);
          sbTex.needsUpdate = true;
        };
        drawScoreboard();
        const mat = new THREE.MeshBasicMaterial({
          map: sbTex,
          toneMapped: false,
        });
        [-1, 1].forEach((s) => {
          const b = new THREE.Mesh(new THREE.PlaneGeometry(20, 10), mat);
          b.position.set(s * 117.5, 38, 0);
          b.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
          scene.add(b);
          const frame = new THREE.Mesh(
            new THREE.BoxGeometry(0.8, 11, 21),
            MAT.steelDark,
          );
          frame.position.set(s * 118.1, 38, 0);
          scene.add(frame);
          const hang = new THREE.Mesh(
            new THREE.CylinderGeometry(0.18, 0.18, 1.6, 6),
            MAT.steel,
          );
          hang.position.set(s * 117.8, 44.2, 0);
          scene.add(hang);
        });
      }

      /* ============================================================
   SEATS every seat generated mathematically with one InstancedMesh
   ============================================================ */
      const SEAT_SPACING = 0.58,
        AISLE = 1.5;

      /* section palettes — Misr Stadium cyan-blue seats */
      function sectionBaseColor(tier, k) {
        const c = new THREE.Color(0x14a8d8);
        // subtle block variation like the real mosaic blues
        c.offsetHSL(
          ((k % 8) - 3.5) * 0.006,
          ((k % 3) - 1) * 0.04,
          ((k % 5) - 2) * 0.035,
        );
        return c;
      }

      /* arc-length table for an ellipse */
      function arcTable(rx, rz) {
        const N = 1200,
          s = new Float32Array(N + 1),
          a = new Float32Array(N + 1);
        let L = 0,
          px = rx,
          pz = 0;
        for (let i = 1; i <= N; i++) {
          const ang = (i / N) * TAU,
            x = rx * Math.cos(ang),
            z = rz * Math.sin(ang);
          L += Math.hypot(x - px, z - pz);
          px = x;
          pz = z;
          s[i] = L;
          a[i] = ang;
        }
        return { L, s, a, N };
      }
      function thetaAt(tb, dist) {
        let lo = 0,
          hi = tb.N;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (tb.s[mid] < dist) lo = mid + 1;
          else hi = mid;
        }
        const i = Math.max(1, lo),
          f = (dist - tb.s[i - 1]) / Math.max(1e-6, tb.s[i] - tb.s[i - 1]);
        return tb.a[i - 1] + f * (tb.a[i] - tb.a[i - 1]);
      }

      /* seat geometry — pan, backrest, armrests, pedestal */
      const seatGeo = (() => {
        const pan = new THREE.BoxGeometry(0.48, 0.055, 0.44);
        pan.translate(0, 0.42, 0.04);
        const cushion = new THREE.BoxGeometry(0.44, 0.04, 0.38);
        cushion.translate(0, 0.46, 0.05);
        const back = new THREE.BoxGeometry(0.48, 0.52, 0.065);
        back.rotateX(-0.14);
        back.translate(0, 0.68, -0.22);
        const backLip = new THREE.BoxGeometry(0.48, 0.06, 0.08);
        backLip.translate(0, 0.92, -0.2);
        const armL = new THREE.BoxGeometry(0.06, 0.22, 0.36);
        armL.translate(-0.27, 0.55, 0.02);
        const armR = new THREE.BoxGeometry(0.06, 0.22, 0.36);
        armR.translate(0.27, 0.55, 0.02);
        const ped = new THREE.BoxGeometry(0.32, 0.38, 0.26);
        ped.translate(0, 0.19, 0.02);
        const base = new THREE.BoxGeometry(0.36, 0.05, 0.32);
        base.translate(0, 0.025, 0.02);
        return mergeBoxes([
          pan,
          cushion,
          back,
          backLip,
          armL,
          armR,
          ped,
          base,
        ]);
      })();
      const seatMat = new THREE.MeshPhongMaterial({
        shininess: 48,
        specular: 0x3a4558,
      }); // plastic sheen

      /* first pass counts seats and records layout */
      const layout = []; // per tier: rows -> table + per-section seat counts
      let SEAT_COUNT = 0;
      TIERS.forEach((tier, ti) => {
        const rows = [];
        for (let r = 0; r < tier.rows; r++) {
          const rx = tier.rx + r * tier.dr,
            rz = tier.rz + r * tier.dr,
            y = tier.y + r * tier.dy;
          const tb = arcTable(rx, rz);
          const secLen = tb.L / tier.sections,
            usable = secLen - AISLE;
          const n = Math.floor(usable / SEAT_SPACING);
          rows.push({ rx, rz, y, tb, secLen, n, dr: tier.dr });
          SEAT_COUNT += n * tier.sections;
        }
        layout.push(rows);
      });

      /* allocate */
      const seatMesh = new THREE.InstancedMesh(seatGeo, seatMat, SEAT_COUNT);
      seatMesh.frustumCulled = false;
      const pickGeo = new THREE.BoxGeometry(0.56, 1.05, 0.5);
      pickGeo.translate(0, 0.52, 0);
      const pickColAttr = new THREE.InstancedBufferAttribute(
        new Float32Array(SEAT_COUNT * 3),
        3,
      );
      pickGeo.setAttribute("pickColor", pickColAttr);
      const pickMesh = new THREE.InstancedMesh(
        pickGeo,
        new THREE.ShaderMaterial({
          vertexShader:
            "attribute vec3 pickColor; varying vec3 vP;\n" +
            "void main(){ vP=pickColor; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position,1.0); }",
          fragmentShader:
            "varying vec3 vP; void main(){ gl_FragColor=vec4(vP,1.0); }",
        }),
        SEAT_COUNT,
      );
      pickMesh.frustumCulled = false;

      const meta = {
        pos: new Float32Array(SEAT_COUNT * 3),
        yaw: new Float32Array(SEAT_COUNT),
        row: new Uint8Array(SEAT_COUNT),
        seatNum: new Uint16Array(SEAT_COUNT),
        secIdx: new Uint16Array(SEAT_COUNT), // index into sections[]
        rowStart: new Uint32Array(SEAT_COUNT),
        rowCount: new Uint16Array(SEAT_COUNT),
        avail: new Uint8Array(SEAT_COUNT),
      };
      const baseColors = new Float32Array(SEAT_COUNT * 3);
      const sections = []; // {label, tier:tierIndex, start, count, angle}

      /* fill */
      {
        const dummy = new THREE.Object3D(),
          col = new THREE.Color(),
          jitter = new THREE.Color();
        let idx = 0;
        TIERS.forEach((tier, ti) => {
          const rows = layout[ti];
          for (let k = 0; k < tier.sections; k++) {
            const label = tier.first + k;
            const secRec = {
              label,
              tier: ti,
              start: idx,
              count: 0,
              angle: 0,
              a0: 0,
              a1: 0,
            };
            const base = sectionBaseColor(tier, k);
            for (let r = 0; r < tier.rows; r++) {
              const R = rows[r];
              const s0 =
                k * R.secLen +
                AISLE / 2 +
                (R.secLen - AISLE - R.n * SEAT_SPACING) / 2;
              const rowStart = idx,
                rowCount = R.n;
              for (let q = 0; q < R.n; q++) {
                const th = thetaAt(R.tb, s0 + (q + 0.5) * SEAT_SPACING);
                const x = R.rx * Math.cos(th),
                  z = R.rz * Math.sin(th);
                const yaw = Math.atan2(-x, -z);
                dummy.position.set(x, R.y, z);
                dummy.rotation.set(0, yaw, 0);
                dummy.updateMatrix();
                seatMesh.setMatrixAt(idx, dummy.matrix);
                pickMesh.setMatrixAt(idx, dummy.matrix);
                // colour: section base + per-seat jitter (reads as a crowd from distance)
                const rr = rng();
                const unavailable =
                  rr < 0.45 &&
                  !(label === 125 && r + 1 === 12 && Math.abs(q + 1 - 18) <= 2);
                jitter
                  .copy(base)
                  .offsetHSL(
                    (rng() - 0.5) * 0.02,
                    (rng() - 0.5) * 0.08,
                    (rng() - 0.5) * 0.16,
                  );
                if (unavailable) jitter.multiplyScalar(0.82);
                seatMesh.setColorAt(idx, jitter);
                baseColors[idx * 3] = jitter.r;
                baseColors[idx * 3 + 1] = jitter.g;
                baseColors[idx * 3 + 2] = jitter.b;
                const id = idx + 1;
                pickColAttr.setXYZ(
                  idx,
                  ((id >> 16) & 255) / 255,
                  ((id >> 8) & 255) / 255,
                  (id & 255) / 255,
                );
                meta.pos[idx * 3] = x;
                meta.pos[idx * 3 + 1] = R.y;
                meta.pos[idx * 3 + 2] = z;
                meta.yaw[idx] = yaw;
                meta.row[idx] = r + 1;
                meta.seatNum[idx] = q + 1;
                meta.secIdx[idx] = sections.length;
                meta.rowStart[idx] = rowStart;
                meta.rowCount[idx] = rowCount;
                meta.avail[idx] = unavailable ? 0 : 1;
                idx++;
              }
              secRec.count += R.n;
              if (r === 0) {
                secRec.angle = thetaAt(R.tb, (k + 0.5) * R.secLen);
                secRec.a0 = thetaAt(R.tb, k * R.secLen);
                secRec.a1 =
                  k + 1 === tier.sections
                    ? TAU
                    : thetaAt(R.tb, (k + 1) * R.secLen);
              }
            }
            sections.push(secRec);
          }
        });
        seatMesh.instanceMatrix.needsUpdate = true;
        pickMesh.instanceMatrix.needsUpdate = true;
        if (seatMesh.instanceColor) seatMesh.instanceColor.needsUpdate = true;
      }
      scene.add(seatMesh);

      /* ---------- yellow aisle stairs (Misr Stadium style) ---------- */
      {
        let aisleCount = 0;
        TIERS.forEach((tier, ti) => {
          aisleCount += tier.sections * tier.rows;
        });
        const aisleGeo = new THREE.BoxGeometry(1.15, 0.14, 0.78);
        aisleGeo.translate(0, 0.07, 0);
        const aisleMat = new THREE.MeshLambertMaterial({ color: 0xf0c014 });
        const aisleMesh = new THREE.InstancedMesh(aisleGeo, aisleMat, aisleCount);
        aisleMesh.frustumCulled = false;
        const dm = new THREE.Object3D();
        let ai = 0;
        TIERS.forEach((tier, ti) => {
          const rows = layout[ti];
          for (let k = 0; k < tier.sections; k++) {
            for (let r = 0; r < tier.rows; r++) {
              const R = rows[r];
              const th = thetaAt(R.tb, k * R.secLen + AISLE * 0.42);
              const x = R.rx * Math.cos(th),
                z = R.rz * Math.sin(th);
              const yaw = Math.atan2(-x, -z);
              const depth = Math.max(0.55, (R.dr || tier.dr) * 0.92);
              dm.position.set(x, R.y + 0.02, z);
              dm.rotation.set(0, yaw, 0);
              dm.scale.set(1, 1, depth / 0.78);
              dm.updateMatrix();
              aisleMesh.setMatrixAt(ai++, dm.matrix);
            }
          }
        });
        aisleMesh.instanceMatrix.needsUpdate = true;
        scene.add(aisleMesh);
      }

      /* ---------- seated crowd — detailed fans, halves in team colours ---------- */
      {
        // Full capacity with randomized instance order. Reducing the rendered
        // count now thins supporters evenly instead of removing whole rows.
        const occ = Array.from({ length: SEAT_COUNT }, (_, i) => i);
        for (let i = occ.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          [occ[i], occ[j]] = [occ[j], occ[i]];
        }
        const N = occ.length;
        // body parts (more silhouette detail when zoomed)
        const shirtGeo = (() => {
          const torso = new THREE.BoxGeometry(0.38, 0.48, 0.24);
          torso.translate(0, 0.78, -0.04);
          const chest = new THREE.BoxGeometry(0.34, 0.18, 0.26);
          chest.translate(0, 0.92, -0.02);
          return mergeBoxes([torso, chest]);
        })();
        const armsGeo = (() => {
          const L = new THREE.BoxGeometry(0.12, 0.36, 0.14);
          L.translate(-0.28, 0.72, 0.02);
          const R = new THREE.BoxGeometry(0.12, 0.36, 0.14);
          R.translate(0.28, 0.72, 0.02);
          const hands = new THREE.BoxGeometry(0.5, 0.1, 0.12);
          hands.translate(0, 0.52, 0.08);
          return mergeBoxes([L, R, hands]);
        })();
        const legsGeo = (() => {
          const shorts = new THREE.BoxGeometry(0.36, 0.2, 0.3);
          shorts.translate(0, 0.52, 0.06);
          const thighL = new THREE.BoxGeometry(0.14, 0.28, 0.28);
          thighL.translate(-0.1, 0.38, 0.14);
          const thighR = new THREE.BoxGeometry(0.14, 0.28, 0.28);
          thighR.translate(0.1, 0.38, 0.14);
          return mergeBoxes([shorts, thighL, thighR]);
        })();
        const headGeo = new THREE.SphereGeometry(0.128, 8, 6);
        headGeo.translate(0, 1.14, -0.02);
        const hairGeo = new THREE.SphereGeometry(
          0.132,
          8,
          5,
          0,
          TAU,
          0,
          Math.PI / 2.05,
        );
        hairGeo.translate(0, 1.16, -0.02);
        const scarfGeo = (() => {
          const band = new THREE.BoxGeometry(0.42, 0.08, 0.18);
          band.translate(0, 1.0, 0.08);
          const hangL = new THREE.BoxGeometry(0.1, 0.32, 0.08);
          hangL.translate(-0.2, 0.82, 0.12);
          const hangR = new THREE.BoxGeometry(0.1, 0.32, 0.08);
          hangR.translate(0.2, 0.82, 0.12);
          return mergeBoxes([band, hangL, hangR]);
        })();

        const shirtMat = new THREE.MeshLambertMaterial();
        const armsMat = new THREE.MeshLambertMaterial();
        const legsMat = new THREE.MeshLambertMaterial();
        const headMat = new THREE.MeshLambertMaterial();
        const hairMat = new THREE.MeshLambertMaterial();
        const scarfMat = new THREE.MeshLambertMaterial();
        function swayify(mat, amp) {
          mat.onBeforeCompile = (sh) => {
            sh.uniforms.uTime = swayU;
            sh.uniforms.uExcite = exciteU;
            sh.vertexShader =
              "uniform float uTime; uniform float uExcite;\n" +
              sh.vertexShader.replace(
                "#include <begin_vertex>",
                [
                  "#include <begin_vertex>",
                  "float swPh = instanceMatrix[3].x*1.7 + instanceMatrix[3].z*2.3;",
                  "float swW = smoothstep(0.35,1.15,position.y)*uExcite;",
                  "transformed.x += sin(uTime*1.7+swPh)*" + amp + "*swW;",
                  "transformed.z += cos(uTime*1.25+swPh)*" + amp + "*0.6*swW;",
                ].join("\n"),
              );
          };
        }
        swayify(shirtMat, "0.028");
        swayify(armsMat, "0.04");
        swayify(legsMat, "0.012");
        swayify(headMat, "0.05");
        swayify(hairMat, "0.05");
        swayify(scarfMat, "0.055");

        const shirts = new THREE.InstancedMesh(shirtGeo, shirtMat, N);
        const arms = new THREE.InstancedMesh(armsGeo, armsMat, N);
        const legs = new THREE.InstancedMesh(legsGeo, legsMat, N);
        const heads = new THREE.InstancedMesh(headGeo, headMat, N);
        const hairs = new THREE.InstancedMesh(hairGeo, hairMat, N);
        const scarves = new THREE.InstancedMesh(scarfGeo, scarfMat, N);
        [shirts, arms, legs, heads, hairs, scarves].forEach((m) => {
          m.frustumCulled = false;
        });

        // Egypt (−X) / Argentina (+X) halves — with small mix of neutrals
        const egyShirts = ["#8b0000", "#9c1010", "#6e0000", "#a81818", "#7a0808"];
        const argShirts = ["#74acdf", "#5a9fd4", "#8ec0e8", "#ffffff", "#69a8d8"];
        const egyAccent = ["#ffffff", "#f0e6d8", "#8b0000"];
        const argAccent = ["#ffffff", "#74acdf", "#f5f7fa"];
        const skinTones = [
          "#8d5a3b",
          "#c98d63",
          "#eac1a4",
          "#6b4226",
          "#a5714b",
          "#e2ac86",
          "#5c3a24",
          "#d4a574",
        ];
        const hairTones = [
          "#171310",
          "#2b1c10",
          "#4a3520",
          "#0d0d0d",
          "#6b4a2e",
          "#1a120c",
        ];
        const shortsTones = ["#f2f4f8", "#e8ecf2", "#1a1a1a", "#dfe6ee"];

        const dm = new THREE.Object3D(),
          cc = new THREE.Color(),
          dmHide = new THREE.Object3D();
        dmHide.scale.set(0, 0, 0);
        dmHide.updateMatrix();

        occ.forEach((si, k) => {
          const px = meta.pos[si * 3],
            py = meta.pos[si * 3 + 1],
            pz = meta.pos[si * 3 + 2];
          // stadium halves: Egypt toward −X goal, Argentina toward +X
          let egySide = px < 0;
          if (rng() < 0.07) egySide = !egySide; // small away pocket
          const shirtsPal = egySide ? egyShirts : argShirts;
          const accentPal = egySide ? egyAccent : argAccent;

          dm.position.set(px, py, pz);
          dm.rotation.set(0, meta.yaw[si] + (rng() - 0.5) * 0.35, 0);
          const sc = 0.9 + rng() * 0.18;
          dm.scale.setScalar(sc);
          // lean / posture variety
          dm.rotation.x = (rng() - 0.5) * 0.08;
          dm.updateMatrix();

          shirts.setMatrixAt(k, dm.matrix);
          arms.setMatrixAt(k, dm.matrix);
          legs.setMatrixAt(k, dm.matrix);
          heads.setMatrixAt(k, dm.matrix);
          hairs.setMatrixAt(k, dm.matrix);

          // shirt colour
          cc.set(shirtsPal[(rng() * shirtsPal.length) | 0]).offsetHSL(
            0,
            (rng() - 0.5) * 0.06,
            (rng() - 0.5) * 0.08,
          );
          shirts.setColorAt(k, cc);
          // arms: mostly kit, sometimes bare skin sleeves
          if (rng() < 0.22) {
            cc.set(skinTones[(rng() * skinTones.length) | 0]);
          }
          arms.setColorAt(k, cc);
          // shorts
          cc.set(shortsTones[(rng() * shortsTones.length) | 0]).offsetHSL(
            0,
            0,
            (rng() - 0.5) * 0.05,
          );
          legs.setColorAt(k, cc);
          // skin + hair
          cc.set(skinTones[(rng() * skinTones.length) | 0]).offsetHSL(
            0,
            0,
            (rng() - 0.5) * 0.07,
          );
          heads.setColorAt(k, cc);
          cc.set(hairTones[(rng() * hairTones.length) | 0]);
          hairs.setColorAt(k, cc);

          // scarves ~28% of fans in team colours
          if (rng() < 0.28) {
            scarves.setMatrixAt(k, dm.matrix);
            cc.set(accentPal[(rng() * accentPal.length) | 0]);
            scarves.setColorAt(k, cc);
          } else {
            scarves.setMatrixAt(k, dmHide.matrix);
            scarves.setColorAt(k, cc.set("#000000"));
          }
        });

        [shirts, arms, legs, heads, hairs, scarves].forEach((m) => {
          m.instanceMatrix.needsUpdate = true;
          if (m.instanceColor) m.instanceColor.needsUpdate = true;
          scene.add(m);
          crowdMeshes.push(m);
        });
        document.getElementById("loader-text").textContent =
          "Seating " + N.toLocaleString() + " fans…";
      }
      const pickScene = new THREE.Scene();
      pickScene.background = new THREE.Color(0x000000);
      pickScene.add(pickMesh);
      const selGlow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowSprite,
          color: 0x39c4ff,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      selGlow.scale.setScalar(2.4);
      scene.add(selGlow);
      document.getElementById("loader-text").textContent =
        "Placing " + SEAT_COUNT.toLocaleString() + " seats…";

      /* ---------- per-seat derived data ---------- */
      function seatScore(i) {
        const x = meta.pos[i * 3],
          y = meta.pos[i * 3 + 1],
          z = meta.pos[i * 3 + 2];
        const d = Math.hypot(x, z);
        const dn = THREE.MathUtils.clamp((d - 52) / 70, 0, 1) * 30; // distance to pitch
        const mid = (Math.abs(x) / Math.hypot(x, z)) * 12; // halfway-line alignment
        const hp = (Math.abs(y - 12) / 25) * 10; // elevation sweet spot
        return Math.round(THREE.MathUtils.clamp(99 - dn - mid - hp, 45, 99));
      }
      function seatPrice(i, score) {
        const t = sections[meta.secIdx[i]].tier;
        const f = [
          (s) => 60 + s * 1.16,
          (s) => 70 + s * 1.3,
          (s) => 24 + s * 0.75,
        ][t];
        return Math.round(f(score));
      }
      function scoreLabel(s) {
        return s >= 90
          ? "Excellent view"
          : s >= 80
            ? "Great view"
            : s >= 70
              ? "Good view"
              : s >= 58
                ? "Fair view"
                : "Restricted view";
      }
      function seatInfo(i) {
        const sec = sections[meta.secIdx[i]],
          score = seatScore(i);
        return {
          i,
          sec,
          label: sec.label,
          tier: TIERS[sec.tier].name,
          row: meta.row[i],
          seat: meta.seatNum[i],
          score,
          price: seatPrice(i, score),
          avail: !!meta.avail[i],
          pos: new THREE.Vector3(
            meta.pos[i * 3],
            meta.pos[i * 3 + 1],
            meta.pos[i * 3 + 2],
          ),
        };
      }

      /* featured seat Section 125 · Row 12 · Seat 18 */
      let featuredIdx = -1;
      {
        const sec = sections.find((s) => s.label === 125);
        if (sec) {
          for (let i = sec.start; i < sec.start + sec.count; i++) {
            if (meta.row[i] === 12 && meta.seatNum[i] === 18) {
              featuredIdx = i;
              break;
            }
          }
          if (featuredIdx < 0)
            featuredIdx = sec.start + Math.floor(sec.count / 2);
        } else featuredIdx = Math.floor(SEAT_COUNT / 2);
      }

      /* ---------- GPU picking ---------- */
      const pickRT = new THREE.WebGLRenderTarget(1, 1);
      const pickBuf = new Uint8Array(4);
      function pickAt(cx, cy) {
        // CSS px
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
        renderer.render(pickScene, camera);
        renderer.setRenderTarget(null);
        camera.clearViewOffset();
        renderer.readRenderTargetPixels(pickRT, 0, 0, 1, 1, pickBuf);
        const id = (pickBuf[0] << 16) | (pickBuf[1] << 8) | pickBuf[2];
        return id === 0 ? -1 : id - 1;
      }

      /* ---------- seat colour state (hover / section / selection) ---------- */
      const tmpC = new THREE.Color();
      function paintSeat(i, r, g, b) {
        tmpC.setRGB(r, g, b);
        seatMesh.setColorAt(i, tmpC);
      }
      function restoreSeat(i) {
        paintSeat(
          i,
          baseColors[i * 3],
          baseColors[i * 3 + 1],
          baseColors[i * 3 + 2],
        );
      }
      function tintRange(start, count, mul) {
        for (let i = start; i < start + count; i++)
          paintSeat(
            i,
            Math.min(1, baseColors[i * 3] * mul),
            Math.min(1, baseColors[i * 3 + 1] * mul),
            Math.min(1, baseColors[i * 3 + 2] * mul),
          );
      }
      let hoverIdx = -1,
        hoverSec = -1,
        selectedIdx = -1;
      const SEL = new THREE.Color(0x67e8f9),
        HOV = new THREE.Color(0xaef0ff);
      function applySelection(i) {
        if (selectedIdx >= 0) {
          const old = sections[meta.secIdx[selectedIdx]];
          tintRange(old.start, old.count, 1); // restore whole old section
        }
        selectedIdx = i;
        if (i >= 0) {
          selGlow.position.set(
            meta.pos[i * 3],
            meta.pos[i * 3 + 1] + 0.95,
            meta.pos[i * 3 + 2],
          );
          // neighbours in the same row glow faintly
          const rs = meta.rowStart[i],
            rc = meta.rowCount[i];
          for (
            let n = Math.max(rs, i - 2);
            n <= Math.min(rs + rc - 1, i + 2);
            n++
          )
            tintRange(n, 1, 1.35);
          seatMesh.setColorAt(i, SEL);
        }
        seatMesh.instanceColor.needsUpdate = true;
        drawOverviewBase();
      }
      function setHover(i) {
        if (i === hoverIdx) return;
        // restore previous hover seat (unless selected)
        if (hoverIdx >= 0 && hoverIdx !== selectedIdx) restoreSeat(hoverIdx);
        const newSec = i >= 0 ? meta.secIdx[i] : -1;
        if (newSec !== hoverSec) {
          if (hoverSec >= 0) {
            const s = sections[hoverSec];
            tintRange(s.start, s.count, 1);
            if (selectedIdx >= 0 && meta.secIdx[selectedIdx] === hoverSec)
              seatMesh.setColorAt(selectedIdx, SEL);
          }
          if (newSec >= 0) {
            const s = sections[newSec];
            tintRange(s.start, s.count, 1.18);
          }
          hoverSec = newSec;
        }
        hoverIdx = i;
        if (i >= 0 && i !== selectedIdx) seatMesh.setColorAt(i, HOV);
        if (selectedIdx >= 0) seatMesh.setColorAt(selectedIdx, SEL);
        seatMesh.instanceColor.needsUpdate = true;
      }

      /* ============================================================
   CONTROLS · INTERACTION · CAMERA · UI
   ============================================================ */
      const $ = (id) => document.getElementById(id);
      const ui = {
        tip: $("tip"),
        tip1: $("tip1"),
        tip2: $("tip2"),
        toast: $("toast"),
        pLabel: $("p-label"),
        pSection: $("p-section"),
        pTier: $("p-tier"),
        pBlock: $("p-block"),
        pRow: $("p-row"),
        pSeat: $("p-seat"),
        pImg: $("p-img"),
        pPh: $("p-ph"),
        pScore: $("p-score"),
        checkout: $("checkout"),
        backbar: $("backbar"),
        bkExit: $("bk-exit"),
        bkSnd: $("bk-snd"),
        sbHint: $("sb-hint"),
        dock: $("dock"),
        ckLabel: $("checkout-label"),
        seatcard: $("seatcard"),
        mm: $("mm").getContext("2d"),
        ov: $("ov").getContext("2d"),
        d3d: $("d-3d"),
      };

      let mode = "orbit",
        is2D = false,
        userInteracted = false,
        muted = false;
      const HOME = { theta: 2.35, phi: 1.04, radius: 340 };
      const orbit = {
        theta: HOME.theta,
        phi: HOME.phi,
        radius: HOME.radius,
        thetaT: HOME.theta,
        phiT: HOME.phi,
        radiusT: HOME.radius,
        target: new THREE.Vector3(0, 9, 0),
      };
      let lastOrbit = { ...HOME };
      const seatView = {
        eye: new THREE.Vector3(),
        yawBase: 0,
        pitchBase: 0,
        yawOff: 0,
        pitchOff: 0,
      };

      function applyOrbit() {
        const sp = Math.sin(orbit.phi);
        camera.position.set(
          orbit.target.x + orbit.radius * sp * Math.cos(orbit.theta),
          orbit.target.y + orbit.radius * Math.cos(orbit.phi),
          orbit.target.z + orbit.radius * sp * Math.sin(orbit.theta),
        );
        camera.lookAt(orbit.target);
      }
      function eyeFor(i) {
        const p = new THREE.Vector3(
          meta.pos[i * 3],
          meta.pos[i * 3 + 1],
          meta.pos[i * 3 + 2],
        );
        const inward = new THREE.Vector3(-p.x, 0, -p.z).normalize();
        return p
          .addScaledVector(inward, 0.12)
          .add(new THREE.Vector3(0, 1.18, 0));
      }
      function lookFor(i) {
        return new THREE.Vector3(
          meta.pos[i * 3] * 0.06,
          1.2,
          meta.pos[i * 3 + 2] * 0.06,
        );
      }

      /* ---------- toast / tooltip ---------- */
      let toastTimer;
      function toast(msg, ms) {
        ui.toast.textContent = msg;
        ui.toast.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(
          () => ui.toast.classList.remove("show"),
          ms || 2600,
        );
      }
      function showTip(x, y, info) {
        ui.tip1.textContent =
          "Section " +
          info.label +
          " · Row " +
          info.row +
          " · Seat " +
          info.seat;
        ui.tip2.textContent = info.avail
          ? info.score + "% view · click to preview"
          : "Unavailable";
        ui.tip2.style.color = info.avail ? "" : "#8a9bb0";
        ui.tip.style.left =
          Math.min(x, innerWidth - ui.tip.offsetWidth - 40) + "px";
        ui.tip.style.top = y + "px";
        ui.tip.style.opacity = 1;
      }
      function hideTip() {
        ui.tip.style.opacity = 0;
      }

      /* ---------- seat panel (view-only, no booking) ---------- */
      function updatePanel(info, state) {
        ui.pLabel.textContent =
          state === "previewing" ? "PREVIEWING SEAT" : "SEAT PREVIEW";
        ui.pSection.textContent = "Section " + info.label;
        ui.pTier.textContent = info.tier;
        ui.pBlock.textContent = "Block " + info.label;
        ui.pRow.textContent = info.row;
        ui.pSeat.textContent = info.seat;
        ui.pScore.textContent = "★ " + info.score + "%";
        ui.ckLabel.textContent =
          state === "previewing" ? "Looking around…" : "View from seat";
        ui.checkout.classList.toggle("done", state === "previewing");
        ui.seatcard.classList.remove("refresh");
        void ui.seatcard.offsetWidth;
        ui.seatcard.classList.add("refresh");
      }

      /* ---------- POV thumbnail capture ---------- */
      function captureView(i) {
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
        const oc = document.createElement("canvas");
        oc.width = 480;
        oc.height = 290;
        oc.getContext("2d").drawImage(
          renderer.domElement,
          0,
          0,
          oc.width,
          oc.height,
        );
        const url = oc.toDataURL("image/jpeg", 0.74);
        camera.position.copy(sp);
        camera.quaternion.copy(sq);
        camera.fov = sf;
        camera.updateProjectionMatrix();
        ui.pImg.src = url;
        ui.pImg.classList.add("ready");
        ui.pPh.style.display = "none";
      }

      /* ---------- stadium crowd audio (Mixkit recorded samples) ---------- */
      let AC = null,
        crowdMaster = null,
        whoopTimer = null,
        audioReady = false,
        audioLoading = null;
      const SFX = {
        ambience: "/sounds/crowd-ambience.mp3",
        cheer: "/sounds/crowd-cheer.mp3",
        cheerBig: "/sounds/crowd-cheer-big.mp3",
        yell: "/sounds/crowd-yell.mp3",
        stadium: "/sounds/crowd-stadium.mp3",
        chant: "/sounds/crowd-chant.mp3",
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
      function ensureAudio() {
        if (AC && audioReady) {
          if (AC.state === "suspended") AC.resume();
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

            await Promise.all([
              loadBuffer("ambience", SFX.ambience),
              loadBuffer("cheer", SFX.cheer),
              loadBuffer("cheerBig", SFX.cheerBig),
              loadBuffer("yell", SFX.yell),
              loadBuffer("stadium", SFX.stadium),
              loadBuffer("chant", SFX.chant),
            ]);
            if (disposed || !AC || AC.state === "closed") return;

            const bed = AC.createGain();
            bed.gain.value = 1;
            bed.connect(crowdMaster);
            playBuffer("ambience", {
              loop: true,
              gain: 0.95,
              fadeIn: 1.4,
              dest: bed,
            });
            playBuffer("chant", {
              loop: true,
              gain: 0.2,
              fadeIn: 2.8,
              rate: 0.98,
              dest: bed,
            });

            audioReady = true;
            if (AC.state === "suspended") await AC.resume();
            scheduleWhoops();
            setCrowd(mode === "seat" ? 0.55 : 0.34);
          } catch (err) {
            console.warn("Stadium audio failed to load", err);
          } finally {
            audioLoading = null;
          }
        })();
      }
      function scheduleWhoops() {
        if (whoopTimer) clearTimeout(whoopTimer);
        const tick = () => {
          if (!AC || muted || !audioReady || disposed) return;
          fireWhoop();
          whoopTimer = setTimeout(tick, 3800 + Math.random() * 6500);
        };
        whoopTimer = setTimeout(tick, 2800);
      }
      function fireWhoop() {
        if (!AC || muted || !audioReady) return;
        const pool = ["yell", "stadium", "cheer"];
        const key = pool[(Math.random() * pool.length) | 0];
        playBuffer(key, {
          gain: 0.2 + Math.random() * 0.25,
          rate: 0.94 + Math.random() * 0.12,
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
        crowdMaster.gain.linearRampToValueAtTime(
          muted ? 0.0001 : level,
          t + 0.9,
        );
      }
      function cheer() {
        ensureAudio();
        const go = () => {
          if (!AC || muted || !audioReady) return;
          const t = AC.currentTime;
          playBuffer("cheerBig", { gain: 0.9, fadeIn: 0.05 });
          playBuffer("cheer", { gain: 0.55, delay: 0.1, rate: 1.02 });
          playBuffer("yell", { gain: 0.35, delay: 0.18, rate: 0.97 });
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

      /* ---------- camera flight ---------- */
      let currentInfo = null;
      function flyToSeat(i) {
        const info = seatInfo(i);
        currentInfo = info;
        setHover(-1);
        hideTip();
        applySelection(i);
        updatePanel(info, "previewing");
        ui.pImg.classList.remove("ready");
        ui.pPh.style.display = "grid";
        if (mode === "orbit")
          lastOrbit = {
            theta: orbit.theta,
            phi: orbit.phi,
            radius: orbit.radius,
          };
        mode = "fly";
        const eye = eyeFor(i),
          look = lookFor(i);
        const startLook = new THREE.Vector3();
        camera
          .getWorldDirection(startLook)
          .multiplyScalar(40)
          .add(camera.position);
        const p0 = camera.position.clone();
        const outward = new THREE.Vector3(eye.x, 0, eye.z).normalize();
        const p1 = p0.clone().lerp(eye, 0.3);
        p1.y = Math.max(p0.y, eye.y) + 34;
        const p2 = eye.clone().addScaledVector(outward, -14);
        p2.y = eye.y + 16;
        const curve = new THREE.CatmullRomCurve3(
          [p0, p1, p2, eye],
          false,
          "catmullrom",
          0.35,
        );
        const st = { t: 0 },
          lp = new THREE.Vector3(),
          startFov = camera.fov;
        gsap.to(st, {
          t: 1,
          duration: REDUCED ? 0.7 : 3.4,
          ease: "power3.inOut",
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
        ensureAudio();
        setCrowd(0.34);
      }
      function enterSeatMode(info) {
        mode = "seat";
        canvas.classList.add("seatmode");
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
        if (ui.dock) ui.dock.classList.add("hidden");
        ui.backbar.classList.add("show");
        ui.sbHint.classList.add("show");
        setTimeout(() => ui.sbHint.classList.remove("show"), 4200);
        ensureAudio();
        setCrowd(0.55);
        cheer();
        captureView(info.i);
      }
      function exitSeatMode() {
        if (mode !== "seat") return;
        mode = "fly";
        canvas.classList.remove("seatmode");
        ui.backbar.classList.remove("show");
        ui.sbHint.classList.remove("show");
        if (ui.dock) ui.dock.classList.remove("hidden");
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
          "catmullrom",
          0.4,
        );
        const startLook = new THREE.Vector3();
        camera
          .getWorldDirection(startLook)
          .multiplyScalar(40)
          .add(camera.position);
        const st = { t: 0 },
          lp = new THREE.Vector3(),
          startFov = camera.fov;
        gsap.to(st, {
          t: 1,
          duration: REDUCED ? 0.6 : 2.2,
          ease: "power3.inOut",
          onUpdate() {
            curve.getPoint(st.t, camera.position);
            lp.copy(startLook).lerp(
              orbit.target,
              THREE.MathUtils.smoothstep(st.t, 0.1, 0.8),
            );
            camera.lookAt(lp);
            camera.fov = THREE.MathUtils.lerp(
              startFov,
              50,
              THREE.MathUtils.smoothstep(st.t, 0, 0.7),
            );
            camera.updateProjectionMatrix();
          },
          onComplete() {
            mode = "orbit";
          },
        });
        setCrowd(0.34);
      }

      /* ---------- pointer input ---------- */
      const pointers = new Map();
      let dragStart = null,
        dragMoved = 0,
        pinchDist = 0,
        pendingHover = null,
        lastPick = 0;
      on(canvas, "pointerdown", (e) => {
        canvas.setPointerCapture(e.pointerId);
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        dragStart = { x: e.clientX, y: e.clientY, t: performance.now() };
        dragMoved = 0;
        if (pointers.size === 2) {
          const p = [...pointers.values()];
          pinchDist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        }
        userInteracted = true;
        canvas.classList.add("dragging");
        ensureAudio();
        if (mode === "orbit") setCrowd(0.34);
        else if (mode === "seat") setCrowd(0.55);
      });
      on(canvas, "pointermove", (e) => {
        if (!pointers.has(e.pointerId)) {
          if (mode === "orbit") pendingHover = { x: e.clientX, y: e.clientY };
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
          if (pinchDist > 0 && mode === "orbit")
            orbit.radiusT = THREE.MathUtils.clamp(
              orbit.radiusT * (pinchDist / d),
              60,
              420,
            );
          pinchDist = d;
          return;
        }
        if (mode === "orbit") {
          orbit.thetaT -= dx * 0.0045;
          orbit.phiT = THREE.MathUtils.clamp(
            orbit.phiT - dy * 0.003,
            0.14,
            1.46,
          );
          if (is2D && Math.abs(dy) > 2) {
            is2D = false;
            if (ui.d3d) ui.d3d.textContent = "3D";
          }
          hideTip();
        } else if (mode === "seat") {
          // Unrestricted horizontal look for a complete 360° spectator view.
          seatView.yawOff -= dx * 0.0032;
          seatView.pitchOff = THREE.MathUtils.clamp(
            seatView.pitchOff + dy * 0.0024,
            -0.55,
            0.55,
          );
        }
      });
      function endPointer(e) {
        canvas.classList.remove("dragging");
        if (!pointers.has(e.pointerId)) return;
        pointers.delete(e.pointerId);
        pinchDist = 0;
        if (
          dragStart &&
          mode === "orbit" &&
          dragMoved < 7 &&
          performance.now() - dragStart.t < 520
        ) {
          const idx = pickAt(e.clientX, e.clientY);
          if (idx >= 0) {
            if (meta.avail[idx]) flyToSeat(idx);
            else {
              // reroute to the nearest free seat in the same row
              const rs = meta.rowStart[idx],
                re = rs + meta.rowCount[idx] - 1;
              let found = -1;
              for (let d = 1; d < meta.rowCount[idx]; d++) {
                if (idx - d >= rs && meta.avail[idx - d]) {
                  found = idx - d;
                  break;
                }
                if (idx + d <= re && meta.avail[idx + d]) {
                  found = idx + d;
                  break;
                }
              }
              if (found >= 0) {
                toast(
                  "That seat is taken. Showing the nearest free one in the row",
                );
                flyToSeat(found);
              } else toast("That row is sold out. Try another one");
            }
          }
        }
        dragStart = null;
      }
      on(canvas, "pointerup", endPointer);
      on(canvas, "pointercancel", endPointer);
      on(canvas, "pointerleave", () => {
        if (mode === "orbit") {
          setHover(-1);
          hideTip();
        }
        pendingHover = null;
      });
      on(canvas, 
        "wheel",
        (e) => {
          e.preventDefault();
          userInteracted = true;
          if (mode === "orbit") {
            orbit.radiusT = THREE.MathUtils.clamp(
              orbit.radiusT * (1 + e.deltaY * 0.0011),
              60,
              420,
            );
          } else if (mode === "seat") {
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

      /* ---------- keyboard ---------- */
      on(window, "keydown", (e) => {
        let handled = false;
        if (e.key === "Escape" && mode === "seat") {
          exitSeatMode();
          handled = true;
        }
        if (e.key === "Enter" && mode === "orbit" && selectedIdx >= 0) {
          flyToSeat(selectedIdx);
          handled = true;
        }
        if (mode === "orbit" && (e.key === "[" || e.key === "]")) {
          const direction = e.key === "]" ? 1 : -1;
          const next =
            (Math.max(0, selectedIdx) + direction + SEAT_COUNT) % SEAT_COUNT;
          currentInfo = seatInfo(next);
          applySelection(next);
          updatePanel(currentInfo, "ready");
          handled = true;
        }
        if (mode === "orbit" && !handled) {
          userInteracted = true;
          if (e.key === "ArrowLeft") orbit.thetaT += 0.12;
          else if (e.key === "ArrowRight") orbit.thetaT -= 0.12;
          else if (e.key === "ArrowUp")
            orbit.phiT = Math.max(0.14, orbit.phiT - 0.08);
          else if (e.key === "ArrowDown")
            orbit.phiT = Math.min(1.46, orbit.phiT + 0.08);
          else if (e.key === "+" || e.key === "=")
            orbit.radiusT = Math.max(60, orbit.radiusT - 16);
          else if (e.key === "-")
            orbit.radiusT = Math.min(420, orbit.radiusT + 16);
          else return;
          handled = true;
        }
        if (handled) e.preventDefault();
      });

      /* ---------- buttons ---------- */
      on(ui.bkExit, "click", exitSeatMode);
      on(ui.bkSnd, "click", () => {
        muted = !muted;
        ui.bkSnd.style.opacity = muted ? 0.4 : 1;
        if (AC) setCrowd(mode === "seat" ? 0.55 : 0.34);
      });
      on($("checkout"), "click", () => {
        if (mode === "seat") {
          toast("Drag to look around · Esc to return", 2800);
          return;
        }
        if (selectedIdx >= 0 && mode === "orbit") {
          toast("Flying to seat view…");
          flyToSeat(selectedIdx);
        }
      });
      function goHome() {
        if (mode === "seat") {
          exitSeatMode();
          return;
        }
        if (mode !== "orbit") return;
        userInteracted = true;
        gsap.to(orbit, {
          thetaT: HOME.theta,
          phiT: HOME.phi,
          radiusT: HOME.radius,
          duration: REDUCED ? 0.1 : 1.2,
          ease: "power2.inOut",
        });
        is2D = false;
        if (ui.d3d) ui.d3d.textContent = "3D";
      }
      on($("cc-reset"), "click", goHome);
      on($("d-reset"), "click", goHome);
      on($("ov-expand"), "click", goHome);
      const zoomBy = (f) => {
        if (mode === "orbit") {
          userInteracted = true;
          orbit.radiusT = THREE.MathUtils.clamp(orbit.radiusT * f, 60, 420);
        }
      };
      on($("cc-zin"), "click", () => zoomBy(0.86));
      on($("cc-zout"), "click", () => zoomBy(1.16));
      on($("d-zin"), "click", () => zoomBy(0.86));
      on($("d-zout"), "click", () => zoomBy(1.16));
      on($("cc-help"), "click", () =>
        toast(
          "Drag to rotate · Scroll to zoom · Click any seat to preview its view",
          3600,
        ),
      );
      on($("d-vr"), "click", () =>
        toast("VR mode needs a WebXR headset. It is not in this build"),
      );
      on(ui.d3d, "click", () => {
        if (mode !== "orbit" || !ui.d3d) return;
        userInteracted = true;
        is2D = !is2D;
        ui.d3d.textContent = is2D ? "2D" : "3D";
        if (is2D)
          gsap.to(orbit, {
            phiT: 0.15,
            radiusT: 300,
            duration: REDUCED ? 0.1 : 1.1,
            ease: "power2.inOut",
          });
        else
          gsap.to(orbit, {
            phiT: HOME.phi,
            radiusT: HOME.radius,
            duration: REDUCED ? 0.1 : 1.1,
            ease: "power2.inOut",
          });
      });

      /* ---------- minimaps ---------- */
      const ovBase = document.createElement("canvas");
      const RXmax = TIERS[2].rxTop + 3,
        RZmax = TIERS[2].rzTop + 3;
      function drawOverviewBase() {
        const cv = ui.ov.canvas;
        ovBase.width = cv.width;
        ovBase.height = cv.height;
        const x = ovBase.getContext("2d"),
          W = cv.width,
          H = cv.height,
          cx = W / 2,
          cy = H / 2;
        const sc = Math.min((W - 24) / (2 * RXmax), (H - 16) / (2 * RZmax));
        x.clearRect(0, 0, W, H);
        const selSec = selectedIdx >= 0 ? meta.secIdx[selectedIdx] : -1;
        sections.forEach((s, si) => {
          const t = TIERS[s.tier];
          const a0 = s.a0,
            a1 = s.a1;
          const r0x = t.rx * sc,
            r0z = t.rz * sc,
            r1x = t.rxTop * sc,
            r1z = t.rzTop * sc;
          x.beginPath();
          for (let k = 0; k <= 8; k++) {
            const a = a0 + ((a1 - a0) * k) / 8;
            const px = cx + r0x * Math.cos(a),
              py = cy + r0z * Math.sin(a);
            k ? x.lineTo(px, py) : x.moveTo(px, py);
          }
          for (let k = 8; k >= 0; k--) {
            const a = a0 + ((a1 - a0) * k) / 8;
            x.lineTo(cx + r1x * Math.cos(a), cy + r1z * Math.sin(a));
          }
          x.closePath();
          if (si === selSec) {
            x.fillStyle = "rgba(57,196,255,.9)";
          } else {
            const c = sectionBaseColor(t, s.label - t.first);
            x.fillStyle =
              "rgba(" +
              ((c.r * 255) | 0) +
              "," +
              ((c.g * 255) | 0) +
              "," +
              ((c.b * 255) | 0) +
              "," +
              (s.tier === 0 ? 0.85 : 0.55) +
              ")";
          }
          x.fill();
          x.strokeStyle = "rgba(4,7,13,.9)";
          x.lineWidth = 1;
          x.stroke();
        });
        // pitch
        const pw = FIELD.L * sc,
          ph = FIELD.W * sc;
        // oval track (matches stand ellipse)
        x.beginPath();
        x.ellipse(cx, cy, TRACK.outRx * sc, TRACK.outRz * sc, 0, 0, TAU);
        x.ellipse(cx, cy, TRACK.inRx * sc, TRACK.inRz * sc, 0, 0, TAU);
        x.fillStyle = "#c45328";
        x.fill("evenodd");
        x.strokeStyle = "rgba(255,255,255,.55)";
        x.lineWidth = 1;
        x.beginPath();
        x.ellipse(cx, cy, TRACK.outRx * sc, TRACK.outRz * sc, 0, 0, TAU);
        x.stroke();
        x.beginPath();
        x.ellipse(cx, cy, TRACK.inRx * sc, TRACK.inRz * sc, 0, 0, TAU);
        x.stroke();
        x.fillStyle = "#15602a";
        x.fillRect(cx - pw / 2, cy - ph / 2, pw, ph);
        x.strokeStyle = "rgba(240,250,255,.75)";
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
        const x = ui.ov,
          W = x.canvas.width,
          H = x.canvas.height,
          cx = W / 2,
          cy = H / 2,
          sc = ui._ovScale;
        x.clearRect(0, 0, W, H);
        x.drawImage(ovBase, 0, 0);
        if (selectedIdx >= 0) {
          const px = cx + meta.pos[selectedIdx * 3] * sc,
            py = cy + meta.pos[selectedIdx * 3 + 2] * sc;
          x.beginPath();
          x.arc(px, py, 4, 0, TAU);
          x.fillStyle = "#eaffff";
          x.fill();
          x.beginPath();
          x.arc(px, py, 8, 0, TAU);
          x.strokeStyle = "rgba(57,196,255,.9)";
          x.lineWidth = 2;
          x.stroke();
          const s = sections[meta.secIdx[selectedIdx]];
          x.font = "700 15px " + getComputedStyle(document.body).fontFamily;
          x.fillStyle = "#dff4ff";
          x.textAlign = "center";
          x.fillText(s.label, px, py - 14);
        }
      }
      function drawMiniMap() {
        const x = ui.mm,
          W = x.canvas.width,
          H = x.canvas.height,
          cx = W / 2,
          cy = H / 2;
        const sc = Math.min((W - 30) / (2 * RXmax), (H - 24) / (2 * RZmax));
        x.clearRect(0, 0, W, H);
        // tier rings
        TIERS.forEach((t, i) => {
          x.beginPath();
          x.ellipse(
            cx,
            cy,
            ((t.rx + t.rxTop) / 2) * sc,
            ((t.rz + t.rzTop) / 2) * sc,
            0,
            0,
            TAU,
          );
          x.lineWidth = (t.rxTop - t.rx) * sc;
          x.strokeStyle = [
            "rgba(90,80,190,.55)",
            "rgba(60,100,190,.5)",
            "rgba(45,60,130,.5)",
          ][i];
          x.stroke();
        });
        const pw = FIELD.L * sc,
          ph = FIELD.W * sc;
        x.beginPath();
        x.ellipse(cx, cy, TRACK.outRx * sc, TRACK.outRz * sc, 0, 0, TAU);
        x.ellipse(cx, cy, TRACK.inRx * sc, TRACK.inRz * sc, 0, 0, TAU);
        x.fillStyle = "#c45328";
        x.fill("evenodd");
        x.fillStyle = "#187031";
        x.fillRect(cx - pw / 2, cy - ph / 2, pw, ph);
        x.strokeStyle = "rgba(235,248,255,.8)";
        x.lineWidth = 1.5;
        x.strokeRect(cx - pw / 2 + 3, cy - ph / 2 + 3, pw - 6, ph - 6);
        x.beginPath();
        x.moveTo(cx, cy - ph / 2 + 3);
        x.lineTo(cx, cy + ph / 2 - 3);
        x.stroke();
        x.beginPath();
        x.arc(cx, cy, ph * 0.14, 0, TAU);
        x.stroke();
        // selected seat
        if (selectedIdx >= 0) {
          const px = cx + meta.pos[selectedIdx * 3] * sc,
            py = cy + meta.pos[selectedIdx * 3 + 2] * sc;
          x.beginPath();
          x.arc(px, py, 4, 0, TAU);
          x.fillStyle = "#67e8f9";
          x.fill();
        }
        // camera indicator
        const camA = Math.atan2(
          camera.position.z / RZmax,
          camera.position.x / RXmax,
        );
        const camD = Math.min(
          1.25,
          Math.hypot(camera.position.x / RXmax, camera.position.z / RZmax),
        );
        const px = cx + Math.cos(camA) * camD * RXmax * sc,
          py = cy + Math.sin(camA) * camD * RZmax * sc;
        x.beginPath();
        x.moveTo(px, py);
        x.lineTo(cx, cy);
        x.strokeStyle = "rgba(57,196,255,.35)";
        x.lineWidth = 2;
        x.stroke();
        x.beginPath();
        x.arc(px, py, 9, 0, TAU);
        x.fillStyle = "#2f9bff";
        x.fill();
        x.beginPath();
        x.arc(px, py, 9, 0, TAU);
        x.strokeStyle = "rgba(255,255,255,.85)";
        x.lineWidth = 2;
        x.stroke();
        // tiny camera glyph
        x.fillStyle = "#fff";
        x.fillRect(px - 4, py - 2.5, 6, 5);
        x.beginPath();
        x.moveTo(px + 2, py);
        x.lineTo(px + 5, py - 2.5);
        x.lineTo(px + 5, py + 2.5);
        x.closePath();
        x.fill();
      }

      /* ---------- hover picking (throttled) ---------- */
      function updateHover(now) {
        if (mode !== "orbit" || pointers.size > 0) {
          return;
        }
        if (!pendingHover || now - lastPick < 60) return;
        lastPick = now;
        const { x, y } = pendingHover;
        pendingHover = null;
        const idx = pickAt(x, y);
        setHover(idx);
        if (idx >= 0) {
          showTip(x, y, seatInfo(idx));
          canvas.style.cursor = "pointer";
        } else {
          hideTip();
          canvas.style.cursor = "";
        }
      }

      /* ---------- match simulation ---------- */
      const V3 = new THREE.Vector3();
      const FWD = new THREE.Vector3();
      let lastMinDraw = -1;
      function updateMatch(t, dt) {
        swayU.value = t;
        exciteU.value += (1 - exciteU.value) * Math.min(1, dt * 0.55);
        match.celebrate = Math.max(0, match.celebrate - dt);
        score.minute = Math.min(90, Math.floor(t / 2.2));
        if ((t | 0) % 5 === 0 && (t | 0) !== lastMinDraw) {
          lastMinDraw = t | 0;
          drawScoreboard();
        }
        match.t += dt;
        const bp = ball.position;
        if (match.phase === "hold") {
          const h = players[match.holder];
          FWD.set(Math.sin(h.g.rotation.y), 0, Math.cos(h.g.rotation.y));
          V3.copy(h.g.position).addScaledVector(FWD, 0.42);
          V3.y = 0.16 + Math.abs(Math.sin(t * 6.5)) * 0.05;
          bp.lerp(V3, Math.min(1, dt * 8));
          if (match.t >= match.dur) {
            const dir = h.team ? -1 : 1;
            const attackQ = h.g.position.x * dir;
            if (h.role === "forward" && attackQ > 32) {
              // An isolated forward in the box is tackled instead of making
              // an unrealistic backwards pass.
              startTackleTurnover();
            } else {
              // Pass-only exhibition: keep the existing passing AI, no shots.
              startPass(false);
            }
          }
        } else {
          const k = Math.min(1, match.t / match.dur);
          bp.lerpVectors(match.from, match.to, k);
          bp.y = 0.16 + Math.sin(Math.PI * k) * match.arc;
          ball.rotation.x -= dt * 13;
          if (k >= 1) onBallArrive();
        }
        // nearest defending outfielder presses the ball
        let presser = -1,
          nd = 1e9;
        const holderTeam = teamOf(match.holder);
        const defBase = (holderTeam === 0 ? 1 : 0) * 11;
        for (let i = defBase; i < defBase + 11; i++) {
          if (players[i].gk) continue;
          const d = players[i].g.position.distanceToSquared(bp);
          if (d < nd) {
            nd = d;
            presser = i;
          }
        }
        for (let i = 0; i < players.length; i++) {
          const p = players[i];
          // dugout staff stay put (idle sway only)
          if (p.bench) {
            if (p.coach) {
              p.armR.rotation.z = -0.35 + Math.sin(t * 1.4 + p.ph) * 0.08;
              p.g.rotation.y =
                Math.PI + Math.sin(t * 0.55 + p.ph) * 0.12;
            } else if (p.seated) {
              p.armL.rotation.x = -0.55 + Math.sin(t * 0.9 + p.ph) * 0.06;
              p.armR.rotation.x = -0.4 + Math.cos(t * 0.85 + p.ph) * 0.05;
            }
            continue;
          }
          let tx,
            tz,
            run = 0.85;
          if (p.team === 2) {
            // referee shadows play from behind
            tx = THREE.MathUtils.clamp(bp.x * 0.72, -46, 46);
            tz = THREE.MathUtils.clamp(bp.z + 9, -28, 28);
            run = 0.8;
          } else if (i === match.holder && match.phase === "hold") {
            const dir = p.team ? -1 : 1;
            tx = THREE.MathUtils.clamp(p.g.position.x + dir * 3, -49, 49);
            tz = p.g.position.z;
            run = 0.72;
          } else if (
            match.phase === "fly" &&
            !match.shot &&
            i === match.receiver
          ) {
            tx = match.to.x;
            tz = match.to.z;
            run = 1.55; // run onto the pass
          } else if (p.gk) {
            tx = p.home.x;
            tz = THREE.MathUtils.clamp(bp.z * 0.32, -3.4, 3.4);
            run = 0.7;
          } else if (i === presser) {
            tx = bp.x;
            tz = bp.z;
            run = 1.5;
          } else {
            // Role-based formation in attack-relative coordinates. Position
            // zones overlap midfield, so no player is trapped in a team half.
            const dir = p.team ? -1 : 1;
            const ballQ = bp.x * dir;
            const targetQ = THREE.MathUtils.clamp(
              p.homeQ + ballQ * p.shapeShift,
              p.zoneMinQ,
              p.zoneMaxQ,
            );
            tx = THREE.MathUtils.clamp(
              targetQ * dir + Math.sin(t * p.sp * 0.5 + p.ph) * 2.4,
              -49,
              49,
            );
            tz =
              THREE.MathUtils.clamp(p.home.z + bp.z * 0.22, -31, 31) +
              Math.cos(t * p.sp * 0.42 + p.ph) * 2.0;
          }
          const dx = tx - p.g.position.x,
            dz = tz - p.g.position.z;
          const dist = Math.hypot(dx, dz);
          const step = Math.min(dist, run * 4.8 * dt);
          if (dist > 0.03) {
            p.g.position.x += (dx / dist) * step;
            p.g.position.z += (dz / dist) * step;
            const ty = Math.atan2(dx, dz);
            let dyaw = ty - p.g.rotation.y;
            dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
            p.g.rotation.y += dyaw * Math.min(1, dt * 6);
          }
          // limbs: swing scales with real speed; arms up while celebrating
          const speed = step / Math.max(dt, 1e-4);
          p.amp +=
            (THREE.MathUtils.clamp(speed / 6, 0.05, 1) - p.amp) *
            Math.min(1, dt * 5);
          const sw = Math.sin(t * 10.5 * p.sp + p.ph) * p.amp * 0.72;
          p.legL.rotation.x = sw;
          p.legR.rotation.x = -sw;
          if (match.celebrate > 0 && p.team === match.scoredBy) {
            p.armL.rotation.x = -2.7 + Math.sin(t * 9 + p.ph) * 0.2;
            p.armR.rotation.x = -2.7 + Math.cos(t * 9 + p.ph) * 0.2;
            p.g.position.y = Math.abs(Math.sin(t * 7 + p.ph)) * 0.16;
          } else {
            p.armL.rotation.x = -sw * 0.8;
            p.armR.rotation.x = sw * 0.8;
            p.g.position.y =
              Math.abs(Math.sin(t * 10.5 * p.sp + p.ph)) * 0.045 * p.amp;
          }
        }
      }

      /* ---------- resize / adaptive quality ---------- */
      on(window, "resize", () => {
        if (disposed) return;
        camera.aspect = innerWidth / innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(innerWidth, innerHeight);
      });
      const qualityPresets = {
        low: { dpr: 0.75, crowd: 0.4, ui: 220, shadows: false, rain: 500 },
        medium: { dpr: 1, crowd: 0.65, ui: 150, shadows: false, rain: 900 },
        high: { dpr: 1.25, crowd: 0.85, ui: 100, shadows: false, rain: 1400 },
        ultra: { dpr: 1.5, crowd: 1, ui: 80, shadows: true, rain: 1800 },
      };
      let requestedCrowdRatio = 0.8;
      let qualityMode = "auto";
      let qualityScale = 1;
      let uiDrawInterval = 100;
      let fpsAcc = 0,
        fpsN = 0,
        fpsCheck = 0;

      function applyCrowdDensity() {
        const effectiveRatio =
          requestedCrowdRatio >= 0.999
            ? 1
            : requestedCrowdRatio * qualityScale;
        crowdMeshes.forEach((mesh) => {
          mesh.count = Math.round(
            mesh.instanceMatrix.count * effectiveRatio,
          );
        });
      }

      function applyQuality(mode) {
        qualityMode = mode;
        if (mode === "auto") {
          qualityScale = 1;
          uiDrawInterval = 100;
          renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
          renderer.shadowMap.enabled = false;
          sun.castShadow = false;
          rainGeometry.setDrawRange(0, 1200);
        } else {
          const preset = qualityPresets[mode] || qualityPresets.high;
          qualityScale = preset.crowd;
          uiDrawInterval = preset.ui;
          renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.dpr));
          renderer.shadowMap.enabled = preset.shadows;
          sun.castShadow = preset.shadows;
          rainGeometry.setDrawRange(0, preset.rain);
        }
        renderer.setSize(innerWidth, innerHeight);
        applyCrowdDensity();
      }

      function adaptQuality(dt, now) {
        if (qualityMode !== "auto") return;
        fpsAcc += dt;
        fpsN++;
        if (now - fpsCheck < 2500) return;
        fpsCheck = now;
        const fps = fpsN / Math.max(1e-4, fpsAcc);
        fpsAcc = 0;
        fpsN = 0;
        const pr = renderer.getPixelRatio();
        if (fps < 38) {
          qualityScale = Math.max(0.4, qualityScale - 0.12);
          renderer.setPixelRatio(Math.max(0.7, pr - 0.2));
          renderer.shadowMap.enabled = false;
          sun.castShadow = false;
        } else if (fps > 55) {
          qualityScale = Math.min(1, qualityScale + 0.08);
          renderer.setPixelRatio(
            Math.min(1.5, window.devicePixelRatio, pr + 0.1),
          );
          const allowShadows = fps > 58 && qualityScale > 0.9;
          renderer.shadowMap.enabled = allowShadows;
          sun.castShadow = allowShadows;
        }
        applyCrowdDensity();
      }

      function applyEnvironment(next) {
        const night = next.timeOfDay === "night";
        const weather = next.weather || "clear";
        scene.background.set(
          night ? 0x02050c : weather === "fog" ? 0x788694 : 0x39709c,
        );
        scene.fog.color.set(
          night ? 0x05070d : weather === "fog" ? 0x7b8790 : 0x426b88,
        );
        scene.fog.density = weather === "fog" ? 0.0048 : night ? 0.0018 : 0.0012;
        hemi.intensity = night ? 0.48 : 0.78;
        ambient.intensity = night ? 0.3 : 0.5;
        sun.intensity = night ? 0.2 : weather === "fog" ? 0.38 : 0.82;
        fieldGlow.intensity = night ? 0.55 : 0.2;
        rain.visible = weather === "rain";
      }

      /* ---------- main loop ---------- */
      const clock = new THREE.Clock();
      let firstFrame = true;
      let lastUiDraw = 0;
      function animate() {
        if (disposed) return;
        rafId = requestAnimationFrame(animate);
        const dt = Math.min(0.05, clock.getDelta()),
          t = clock.elapsedTime,
          now = performance.now();
        // scrolling LED textures
        for (const a of animatedTextures) a.t.offset.x += a.speed * dt * 10;
        updateMatch(t, dt);
        if (rain.visible) {
          const positions = rainGeometry.attributes.position.array;
          for (let i = 1; i < positions.length; i += 3) {
            positions[i] -= dt * 42;
            if (positions[i] < 0) positions[i] = 120;
          }
          rainGeometry.attributes.position.needsUpdate = true;
        }
        if (mode === "orbit") {
          if (!userInteracted && !REDUCED) orbit.thetaT += dt * 0.016;
          const k = REDUCED ? 1 : Math.min(1, dt * 5.5);
          orbit.theta += (orbit.thetaT - orbit.theta) * k;
          orbit.phi += (orbit.phiT - orbit.phi) * k;
          orbit.radius += (orbit.radiusT - orbit.radius) * k;
          applyOrbit();
          updateHover(now);
        } else if (mode === "seat") {
          const swayY = REDUCED
            ? 0
            : Math.sin(t * 0.9) * 0.012 + Math.sin(t * 2.3) * 0.005; // breathing
          const swayYaw = REDUCED ? 0 : Math.sin(t * 0.42) * 0.006; // idle head sway
          const swayPitch = REDUCED ? 0 : Math.cos(t * 0.57) * 0.004;
          camera.position.set(
            seatView.eye.x,
            seatView.eye.y + swayY,
            seatView.eye.z,
          );
          const yaw = seatView.yawBase + seatView.yawOff + swayYaw;
          const pitch = THREE.MathUtils.clamp(
            seatView.pitchBase + seatView.pitchOff + swayPitch,
            -1.2,
            1.2,
          );
          V3.set(
            Math.sin(yaw) * Math.cos(pitch),
            Math.sin(pitch),
            Math.cos(yaw) * Math.cos(pitch),
          ).add(camera.position);
          camera.lookAt(V3);
        }
        if (selectedIdx >= 0 && mode !== "seat") {
          selGlow.material.opacity = 0.28 + 0.16 * Math.sin(t * 2.6);
          const gs = 2.3 + 0.35 * Math.sin(t * 2.6);
          selGlow.scale.set(gs, gs, 1);
        } else selGlow.material.opacity = 0;
        if (now - lastUiDraw >= uiDrawInterval) {
          lastUiDraw = now;
          drawMiniMap();
          drawOverview();
        }
        adaptQuality(dt, now);
        renderer.render(scene, camera);
        if (firstFrame) {
          firstFrame = false;
          document.getElementById("loader")?.classList.add("hide");
          toast("Click any seat to see the match from it", 3800);
        }
      }

      /* ---------- boot ---------- */
      applySelection(featuredIdx);
      currentInfo = seatInfo(featuredIdx);
      updatePanel(currentInfo, "suggested");
      drawOverviewBase();
      applyOrbit();
      animate();

      return {
        id: metaInfo.id,
        canvas,
        setCrowdCapacity(percent) {
          requestedCrowdRatio = THREE.MathUtils.clamp(
            Number(percent) / 100,
            0,
            1,
          );
          applyCrowdDensity();
        },
        setQualityMode(mode) {
          applyQuality(mode);
        },
        setEnvironment(next) {
          applyEnvironment(next);
        },
        openSeat(key, options = {}) {
          const section = Number(key.section);
          const row = Number(key.row);
          const seat = Number(key.seat);
          const sec = sections.find((item) => item.label === section);
          if (!sec) return false;
          for (let i = sec.start; i < sec.start + sec.count; i++) {
            if (meta.row[i] === row && meta.seatNum[i] === seat) {
              currentInfo = seatInfo(i);
              applySelection(i);
              updatePanel(currentInfo, options.fly ? "previewing" : "ready");
              if (options.fly) flyToSeat(i);
              return true;
            }
          }
          return false;
        },
        getCurrentSeat() {
          return currentInfo
            ? {
                section: currentInfo.label,
                row: currentInfo.row,
                seat: currentInfo.seat,
              }
            : null;
        },
        dispose() {
          if (disposed) return;
          disposed = true;
          cancelAnimationFrame(rafId);
          if (whoopTimer) clearTimeout(whoopTimer);
          if (toastTimer) clearTimeout(toastTimer);
          try {
            gsap.killTweensOf("*");
          } catch (_) {}
          disposers.slice().forEach((fn) => {
            try {
              fn();
            } catch (_) {}
          });
          disposers.length = 0;
          try {
            if (typeof AC !== "undefined" && AC && AC.state !== "closed") {
              AC.close();
            }
          } catch (_) {}
          AC = null;
          crowdMaster = null;
          audioReady = false;
          audioLoading = null;
          Object.keys(buffers).forEach((key) => delete buffers[key]);
          try {
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
          } catch (_) {}
          try {
            pickRT.dispose();
          } catch (_) {}
          try {
            pickScene.traverse((obj) => {
              if (obj.geometry) obj.geometry.dispose();
              if (obj.material) {
                const mats = Array.isArray(obj.material)
                  ? obj.material
                  : [obj.material];
                mats.forEach((m) => m?.dispose());
              }
            });
            pickScene.clear();
          } catch (_) {}
          try {
            renderer.dispose();
            renderer.forceContextLoss();
          } catch (_) {}
          canvas.classList.remove("dragging", "seatmode");
        },
      };
}
