import * as THREE from 'three';
import gsap from 'gsap';

/** Stadium engine — procedural Three.js experience */
export function initStadium() {
const REDUCED = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const TAU = Math.PI * 2;

      /* ---------- support modal ---------- */
      const supportModal = document.getElementById("support-modal");
      const supportTrigger = document.getElementById("support-trigger");
      const supportClose = document.getElementById("support-close");
      const supportLater = document.getElementById("support-later");
      let supportReturnFocus = null;

      function openSupportModal() {
        supportReturnFocus = document.activeElement;
        supportModal.classList.add("show");
        supportModal.setAttribute("aria-hidden", "false");
        supportClose.focus();
      }

      function closeSupportModal() {
        supportModal.classList.remove("show");
        supportModal.setAttribute("aria-hidden", "true");
        if (supportReturnFocus) supportReturnFocus.focus();
      }

      supportTrigger.addEventListener("click", openSupportModal);
      supportClose.addEventListener("click", closeSupportModal);
      supportLater.addEventListener("click", closeSupportModal);
      supportModal.addEventListener("click", (event) => {
        if (event.target === supportModal) closeSupportModal();
      });
      supportModal.addEventListener("keydown", (event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          closeSupportModal();
          return;
        }
        if (event.key !== "Tab") return;
        const focusable = [...supportModal.querySelectorAll("a, button")];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      });

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
      const canvas = document.getElementById("c");
      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        powerPreference: "high-performance",
        logarithmicDepthBuffer: true,
      });
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
      scene.add(new THREE.HemisphereLight(0x35507e, 0x05070d, 0.55));
      scene.add(new THREE.AmbientLight(0x27314a, 0.35));
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
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.left = -110;
      sun.shadow.camera.right = 110;
      sun.shadow.camera.top = 90;
      sun.shadow.camera.bottom = -90;
      sun.shadow.camera.near = 30;
      sun.shadow.camera.far = 320;
      sun.shadow.bias = -0.0005;
      scene.add(sun);

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
        const t = canvasTexture(256, 64, (x, w, h) => {
          x.fillStyle = "#0d1322";
          x.fillRect(0, 0, w, h);
          x.globalAlpha = 0.55;
          x.strokeStyle = "#070b14";
          x.lineWidth = 2;
          for (let i = 0; i < 8; i++) {
            x.beginPath();
            x.moveTo(i * 32, 0);
            x.lineTo(i * 32, h);
            x.stroke();
          }
          x.globalAlpha = 0.12;
          for (let i = 0; i < 450; i++) {
            x.fillStyle = Math.random() > 0.5 ? "#000" : "#26324e";
            x.fillRect(Math.random() * w, Math.random() * h, 2, 2);
          }
          x.globalAlpha = 1;
        });
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
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
          // worn turf: goalmouths, centre circle, penalty spots see the most boots
          x.globalAlpha = 0.3;
          x.fillStyle = "#5d6b33";
          x.beginPath();
          x.ellipse(2 * px + 4 * px, h / 2, 7 * px, 11 * px, 0, 0, TAU);
          x.fill();
          x.beginPath();
          x.ellipse(w - 2 * px - 4 * px, h / 2, 7 * px, 11 * px, 0, 0, TAU);
          x.fill();
          x.beginPath();
          x.ellipse(w / 2, h / 2, 7.5 * px, 7 * px, 0, 0, TAU);
          x.fill();
          x.globalAlpha = 0.14;
          x.fillStyle = "#6b7a3c";
          x.beginPath();
          x.ellipse(2 * px + 12 * px, h / 2, 10 * px, 16 * px, 0, 0, TAU);
          x.fill();
          x.beginPath();
          x.ellipse(w - 2 * px - 12 * px, h / 2, 10 * px, 16 * px, 0, 0, TAU);
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
          // lines
          x.strokeStyle = "rgba(245,250,255,.9)";
          x.lineWidth = 2.2;
          const M = 2 * px;
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
              w1 = 40.3 * px,
              d2 = 5.5 * px,
              w2 = 18.3 * px,
              s = side < 0 ? 1 : -1;
            x.strokeRect(Math.min(bx, bx + s * d1), h / 2 - w1 / 2, d1, w1);
            x.strokeRect(Math.min(bx, bx + s * d2), h / 2 - w2 / 2, d2, w2);
            x.beginPath();
            x.arc(bx + s * 11 * px, h / 2, 3, 0, TAU);
            x.fill();
            x.beginPath();
            x.arc(
              bx + s * 11 * px,
              h / 2,
              9.15 * px,
              s < 0 ? -0.94 : Math.PI - 0.94,
              s < 0 ? 0.94 : Math.PI + 0.94,
              false,
            );
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

        // goals
        const gmat = new THREE.MeshBasicMaterial({ color: 0xf2f6ff });
        [-1, 1].forEach((s) => {
          const gx = (s * FIELD.L) / 2,
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
          scene.add(grp);
        });

        // dugouts on the grass verge (inside the track)
        [-1, 1].forEach((s) => {
          const d = new THREE.Mesh(
            new THREE.BoxGeometry(9, 1.7, 2.2),
            MAT.steelDark,
          );
          d.position.set(s * 12, 0.85, (FIELD.W / 2 + TRACK.inRz) * 0.5);
          scene.add(d);
          const glass = new THREE.Mesh(
            new THREE.BoxGeometry(9, 1.1, 0.06),
            new THREE.MeshLambertMaterial({
              color: 0x77aaff,
              transparent: true,
              opacity: 0.22,
            }),
          );
          glass.position.set(
            s * 12,
            1.0,
            (FIELD.W / 2 + TRACK.inRz) * 0.5 - 1.08,
          );
          scene.add(glass);
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
              "EXPERIENCE EVERY SEAT",
              "MATCHDAY LIVE",
              "ARGENTINA × SPAIN",
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
        const mat = new THREE.MeshBasicMaterial({
          map: adTex,
          toneMapped: false,
        });
        const mk = (wd, x, z, rotY) => {
          const m = new THREE.Mesh(new THREE.PlaneGeometry(wd, 1.0), mat);
          m.position.set(x, 0.55, z);
          m.rotation.y = rotY;
          scene.add(m);
        };
        // boards sit on the inner track curb
        mk(FIELD.L + 14, 0, TRACK.inRz - 0.6, Math.PI);
        mk(FIELD.L + 14, 0, -(TRACK.inRz - 0.6), 0);
        mk(FIELD.W + 14, TRACK.inRx - 0.6, 0, -Math.PI / 2);
        mk(FIELD.W + 14, -(TRACK.inRx - 0.6), 0, Math.PI / 2);
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
            shirt: new THREE.MeshLambertMaterial({
              color: 0x9fd8ff,
              emissive: 0x9fd8ff,
              emissiveIntensity: 0.12,
            }),
            shorts: new THREE.MeshLambertMaterial({ color: 0xf2f4f8 }),
            gk: new THREE.MeshLambertMaterial({
              color: 0x2fbf71,
              emissive: 0x2fbf71,
              emissiveIntensity: 0.12,
            }),
          },
          {
            shirt: new THREE.MeshLambertMaterial({
              color: 0xd92626,
              emissive: 0xd92626,
              emissiveIntensity: 0.12,
            }),
            shorts: new THREE.MeshLambertMaterial({ color: 0x232360 }),
            gk: new THREE.MeshLambertMaterial({
              color: 0xe8c53a,
              emissive: 0xe8c53a,
              emissiveIntensity: 0.12,
            }),
          },
          {
            shirt: new THREE.MeshLambertMaterial({
              color: 0xf2e341,
              emissive: 0xf2e341,
              emissiveIntensity: 0.1,
            }),
            shorts: new THREE.MeshLambertMaterial({ color: 0x141414 }),
          },
        ];
        function mkPlayer(kit, gk) {
          const g = new THREE.Group();
          const skin = skinMats[(rng() * skinMats.length) | 0];
          const shirtM = gk && kit.gk ? kit.gk : kit.shirt;
          const legGeo = new THREE.CylinderGeometry(0.085, 0.06, 0.9, 6);
          legGeo.translate(0, -0.45, 0);
          const bootGeo = new THREE.BoxGeometry(0.11, 0.08, 0.24);
          const legL = new THREE.Group(),
            legR = new THREE.Group();
          legL.position.set(-0.11, 0.95, 0);
          legR.position.set(0.11, 0.95, 0);
          const lm = new THREE.Mesh(legGeo, skin),
            rm = new THREE.Mesh(legGeo, skin);
          const bl = new THREE.Mesh(bootGeo, bootMat);
          bl.position.set(0, -0.9, 0.05);
          const br = new THREE.Mesh(bootGeo, bootMat);
          br.position.set(0, -0.9, 0.05);
          legL.add(lm);
          legL.add(bl);
          legR.add(rm);
          legR.add(br);
          const shorts = new THREE.Mesh(
            new THREE.CylinderGeometry(0.21, 0.185, 0.3, 7),
            kit.shorts,
          );
          shorts.position.y = 1.02;
          const torso = new THREE.Mesh(
            new THREE.CylinderGeometry(0.235, 0.18, 0.6, 7),
            shirtM,
          );
          torso.position.y = 1.42;
          const armGeo = new THREE.CylinderGeometry(0.055, 0.042, 0.62, 5);
          armGeo.translate(0, -0.31, 0);
          const armL = new THREE.Group(),
            armR = new THREE.Group();
          armL.position.set(-0.27, 1.62, 0);
          armR.position.set(0.27, 1.62, 0);
          armL.add(new THREE.Mesh(armGeo, shirtM));
          armR.add(new THREE.Mesh(armGeo, shirtM));
          const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.14, 8, 6),
            skin,
          );
          head.position.y = 1.85;
          const hair = new THREE.Mesh(
            new THREE.SphereGeometry(0.146, 8, 4, 0, TAU, 0, Math.PI / 2.1),
            hairMats[(rng() * hairMats.length) | 0],
          );
          hair.position.y = 1.87;
          g.add(legL);
          g.add(legR);
          g.add(shorts);
          g.add(torso);
          g.add(armL);
          g.add(armR);
          g.add(head);
          g.add(hair);
          g.traverse((o) => {
            if (o.isMesh) o.castShadow = true;
          });
          scene.add(g);
          return { g, legL, legR, armL, armR };
        }
        for (let team = 0; team < 2; team++) {
          for (let i = 0; i < 11; i++) {
            const gk = i === 0;
            const col = gk ? 0 : 1 + Math.floor((i - 1) / 3.4),
              rowIn = gk ? 1.5 : (i - 1) % 4;
            const side = team ? 1 : -1;
            const hx = gk ? side * 49.5 : side * (8 + col * 11);
            const hz = THREE.MathUtils.clamp((rowIn - 1.5) * 14, -30, 30);
            const p = mkPlayer(kits[team], gk);
            players.push(
              Object.assign(p, {
                home: new THREE.Vector3(hx, 0, hz),
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
            const v =
              c.g.position.x * dir +
              rng() * 22 -
              Math.abs(c.g.position.z) * 0.1;
            if (v > bestV) {
              bestV = v;
              best = cand;
            }
          }
          if (best < 0) best = team * 11 + 1 + ((rng() * 10) | 0);
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
        match.holder = match.receiver;
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
          palette: "rainbow",
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
          palette: "steel",
        },
        {
          name: "Upper Tier",
          first: 301,
          sections: 32,
          rows: 16,
          rx: 121,
          rz: 91.5,
          y: 27.6,
          dr: 0.8,
          dy: 0.7,
          palette: "night",
        },
      ];
      TIERS.forEach((t) => {
        t.rxTop = t.rx + t.rows * t.dr;
        t.rzTop = t.rz + t.rows * t.dr;
        t.yTop = t.y + t.rows * t.dy;
      });
      const ROOF = {
        inRx: 119,
        inRz: 90,
        inY: 44,
        outRx: 152,
        outRz: 115,
        outY: 48,
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
          // raked slab under the seats
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
              "ARGENTINA VS SPAIN",
              "INTERNATIONAL FRIENDLY",
              "METROPOLITANO · MADRID",
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

      /* ---------- roof + trusses + floodlights + facade ---------- */
      const glowSprite = (() => {
        // shared additive glow sprite texture
        const t = canvasTexture(128, 128, (x) => {
          const g = x.createRadialGradient(64, 64, 4, 64, 64, 64);
          g.addColorStop(0, "rgba(255,255,255,1)");
          g.addColorStop(0.25, "rgba(200,225,255,.55)");
          g.addColorStop(1, "rgba(120,180,255,0)");
          x.fillStyle = g;
          x.fillRect(0, 0, 128, 128);
        });
        return t;
      })();
      {
        const SEG = 140;
        scene.add(
          ringStrip(
            ROOF.inRx,
            ROOF.inRz,
            ROOF.inY,
            ROOF.outRx,
            ROOF.outRz,
            ROOF.outY,
            SEG,
            MAT.roofTop,
            50,
          ),
        );
        // inner compression ring
        scene.add(
          ringStrip(
            ROOF.inRx,
            ROOF.inRz,
            ROOF.inY - 1.4,
            ROOF.inRx,
            ROOF.inRz,
            ROOF.inY,
            SEG,
            MAT.steel,
            60,
          ),
        );
        // radial trusses (top chords)
        for (let i = 0; i < 44; i++) {
          const a = (i / 44) * TAU,
            c = Math.cos(a),
            s = Math.sin(a);
          const p1 = new THREE.Vector3(
            ROOF.inRx * c,
            ROOF.inY - 0.7,
            ROOF.inRz * s,
          );
          const p2 = new THREE.Vector3(
            ROOF.outRx * c,
            ROOF.outY - 0.7,
            ROOF.outRz * s,
          );
          const len = p1.distanceTo(p2);
          const truss = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 1.1, len),
            MAT.steel,
          );
          truss.position.copy(p1).add(p2).multiplyScalar(0.5);
          truss.lookAt(p2);
          scene.add(truss);
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
        // facade edge light band
        scene.add(
          ringStrip(
            ROOF.outRx + 0.4,
            ROOF.outRz + 0.4,
            ROOF.outY - 0.4,
            ROOF.outRx + 0.4,
            ROOF.outRz + 0.4,
            ROOF.outY + 0.4,
            SEG,
            new THREE.MeshBasicMaterial({
              color: 0x1f6fd8,
              toneMapped: false,
              side: THREE.DoubleSide,
            }),
            40,
          ),
        );

        // floodlight strip along inner roof lip + glow sprites
        scene.add(
          ringStrip(
            ROOF.inRx + 0.3,
            ROOF.inRz + 0.3,
            ROOF.inY - 1.1,
            ROOF.inRx + 0.3,
            ROOF.inRz + 0.3,
            ROOF.inY - 0.4,
            SEG,
            new THREE.MeshBasicMaterial({
              color: 0xe8f2ff,
              toneMapped: false,
              side: THREE.DoubleSide,
            }),
            60,
          ),
        );
        const smat = new THREE.SpriteMaterial({
          map: glowSprite,
          color: 0xcfe4ff,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true,
          opacity: 0.9,
        });
        for (let i = 0; i < 56; i++) {
          const a = (i / 56) * TAU;
          const sp = new THREE.Sprite(smat);
          sp.position.set(
            (ROOF.inRx + 0.3) * Math.cos(a),
            ROOF.inY - 0.75,
            (ROOF.inRz + 0.3) * Math.sin(a),
          );
          sp.scale.setScalar(4.2 + (i % 3) * 0.8);
          scene.add(sp);
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
            "ARG  " + score.home + " · " + score.away + "  ESP",
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

      /* section palettes */
      const RAINBOW = [
        "#5b21b6",
        "#6d28d9",
        "#7c3aed",
        "#4f46e5",
        "#4338ca",
        "#2563eb",
        "#0284c7",
        "#0ea5e9",
        "#0d9488",
        "#10b981",
        "#22c55e",
        "#65a30d",
        "#a3b60b",
        "#eab308",
        "#f59e0b",
        "#f97316",
        "#ea580c",
        "#dc2626",
        "#b91c1c",
        "#be185d",
        "#9d174d",
        "#7e22ce",
        "#6d28d9",
        "#5b21b6",
        "#4f46e5",
        "#4338ca",
        "#2563eb",
        "#0284c7",
        "#0ea5e9",
        "#10b981",
        "#22c55e",
        "#eab308",
      ];
      function sectionBaseColor(tier, k) {
        if (tier.palette === "rainbow")
          return new THREE.Color(RAINBOW[k % RAINBOW.length]);
        if (tier.palette === "steel") {
          const c = new THREE.Color(0x2e4a78);
          c.offsetHSL(((k % 5) - 2) * 0.012, 0, ((k % 3) - 1) * 0.03);
          return c;
        }
        const c = new THREE.Color(0x27306a);
        c.offsetHSL(((k % 7) - 3) * 0.01, 0, ((k % 4) - 1.5) * 0.02);
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

      /* seat geometry (pan + backrest + pedestal) */
      const seatGeo = (() => {
        const pan = new THREE.BoxGeometry(0.46, 0.06, 0.42);
        pan.translate(0, 0.42, 0.03);
        const back = new THREE.BoxGeometry(0.46, 0.48, 0.07);
        back.rotateX(-0.13);
        back.translate(0, 0.66, -0.21);
        const ped = new THREE.BoxGeometry(0.34, 0.4, 0.28);
        ped.translate(0, 0.2, 0.02);
        return mergeBoxes([pan, back, ped]);
      })();
      const seatMat = new THREE.MeshPhongMaterial({
        shininess: 38,
        specular: 0x2c333f,
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
          rows.push({ rx, rz, y, tb, secLen, n });
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

      /* ---------- seated crowd with a person on every sold seat ---------- */
      {
        const occ = [];
        for (let i = 0; i < SEAT_COUNT; i++) if (!meta.avail[i]) occ.push(i);
        const torsoGeo = (() => {
          const body = new THREE.BoxGeometry(0.42, 0.52, 0.26);
          body.translate(0, 0.73, -0.05);
          const lap = new THREE.BoxGeometry(0.4, 0.13, 0.34);
          lap.translate(0, 0.5, 0.1);
          const arms = new THREE.BoxGeometry(0.54, 0.28, 0.2);
          arms.translate(0, 0.6, -0.03);
          return mergeBoxes([body, lap, arms]);
        })();
        const headGeo = new THREE.SphereGeometry(0.135, 7, 5);
        headGeo.translate(0, 1.1, -0.05);
        const torsoMat = new THREE.MeshLambertMaterial(),
          headMat = new THREE.MeshLambertMaterial();
        function swayify(mat, amp) {
          // gentle idle sway, amplified briefly on goals
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
        swayify(torsoMat, "0.03");
        swayify(headMat, "0.05");
        const torso = new THREE.InstancedMesh(torsoGeo, torsoMat, occ.length);
        const heads = new THREE.InstancedMesh(headGeo, headMat, occ.length);
        torso.frustumCulled = false;
        heads.frustumCulled = false;
        const dm = new THREE.Object3D(),
          cc = new THREE.Color();
        const cloth = [
          "#10182b",
          "#141414",
          "#e7e4da",
          "#75809a",
          "#a92322",
          "#6fb1e4",
          "#d9b02f",
          "#274e13",
          "#5b2a86",
        ];
        const skinTones = [
          "#8d5a3b",
          "#c98d63",
          "#eac1a4",
          "#6b4226",
          "#a5714b",
          "#e2ac86",
        ];
        occ.forEach((si, k) => {
          dm.position.set(
            meta.pos[si * 3],
            meta.pos[si * 3 + 1],
            meta.pos[si * 3 + 2],
          );
          dm.rotation.set(0, meta.yaw[si] + (rng() - 0.5) * 0.3, 0);
          const sc = 0.92 + rng() * 0.14;
          dm.scale.set(sc, sc, sc);
          dm.updateMatrix();
          torso.setMatrixAt(k, dm.matrix);
          heads.setMatrixAt(k, dm.matrix);
          const sec = sections[meta.secIdx[si]],
            tr = TIERS[sec.tier];
          if (rng() < 0.35)
            cc.copy(sectionBaseColor(tr, sec.label - tr.first)).offsetHSL(
              0,
              (rng() - 0.5) * 0.1,
              (rng() - 0.5) * 0.15,
            );
          else
            cc.set(cloth[(rng() * cloth.length) | 0]).offsetHSL(
              0,
              0,
              (rng() - 0.5) * 0.1,
            );
          torso.setColorAt(k, cc);
          cc.set(skinTones[(rng() * skinTones.length) | 0]).offsetHSL(
            0,
            0,
            (rng() - 0.5) * 0.06,
          );
          heads.setColorAt(k, cc);
        });
        torso.instanceMatrix.needsUpdate = true;
        heads.instanceMatrix.needsUpdate = true;
        if (torso.instanceColor) torso.instanceColor.needsUpdate = true;
        if (heads.instanceColor) heads.instanceColor.needsUpdate = true;
        scene.add(torso);
        scene.add(heads);
        document.getElementById("loader-text").textContent =
          "Seating " + occ.length.toLocaleString() + " fans…";
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
        pPrice: $("p-price"),
        pImg: $("p-img"),
        pPh: $("p-ph"),
        pScore: $("p-score"),
        checkout: $("checkout"),
        benefits: document.querySelectorAll("#benefits .btxt"),
        backbar: $("backbar"),
        bkExit: $("bk-exit"),
        bkSnd: $("bk-snd"),
        sbHint: $("sb-hint"),
        dock: $("dock"),
        ckLabel: $("checkout-label"),
        seatcard: $("seatcard"),
        mm: $("mm").getContext("2d"),
        ov: $("ov").getContext("2d"),
        fav: $("fav"),
        d3d: $("d-3d"),
      };

      let mode = "orbit",
        is2D = false,
        userInteracted = false,
        confirmed = false,
        muted = false;
      const HOME = { theta: 2.35, phi: 1.04, radius: 300 };
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
          ? "€" + info.price + " · " + info.score + "% view"
          : "Unavailable";
        ui.tip2.style.color = info.avail ? "" : "#8a8478";
        ui.tip.style.left =
          Math.min(x, innerWidth - ui.tip.offsetWidth - 40) + "px";
        ui.tip.style.top = y + "px";
        ui.tip.style.opacity = 1;
      }
      function hideTip() {
        ui.tip.style.opacity = 0;
      }

      /* ---------- seat panel ---------- */
      const TIER_BENEFITS = [
        ["Padded seat", "Great view", "Food & drink voucher"],
        ["Lounge access", "Halftime table service", "Padded club seat"],
        ["Full pitch view", "Budget friendly", "Fast concourse access"],
      ];
      function updatePanel(info, state) {
        ui.pLabel.textContent =
          state === "confirmed"
            ? "SEAT CONFIRMED"
            : state === "previewing"
              ? "PREVIEWING SEAT"
              : "SUGGESTED SEAT";
        ui.pSection.textContent = "Section " + info.label;
        ui.pTier.textContent = info.tier;
        ui.pBlock.textContent = "Block " + info.label;
        ui.pRow.textContent = info.row;
        ui.pSeat.textContent = info.seat;
        ui.pPrice.innerHTML =
          "€" + info.price + ' <span class="unit">/seat</span>';
        ui.pScore.textContent = "★ " + info.score + "% view";
        const b = TIER_BENEFITS[info.sec.tier];
        ui.benefits.forEach((el, k) => (el.textContent = b[k]));
        ui.checkout.classList.toggle("done", state === "confirmed");
        ui.ckLabel.textContent =
          state === "confirmed" ? "Seat secured ✓" : "Grab seat";
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

      /* ---------- crowd audio (synthesised, no assets) ---------- */
      let AC = null,
        crowdGain = null;
      function ensureAudio() {
        if (AC) return;
        try {
          AC = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
          return;
        }
        const buf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        const src = AC.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const bp = AC.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 720;
        bp.Q.value = 0.5;
        crowdGain = AC.createGain();
        crowdGain.gain.value = 0;
        const lfo = AC.createOscillator();
        lfo.frequency.value = 0.11;
        const lg = AC.createGain();
        lg.gain.value = 0.012;
        lfo.connect(lg);
        lg.connect(crowdGain.gain);
        lfo.start();
        src.connect(bp);
        bp.connect(crowdGain);
        crowdGain.connect(AC.destination);
        src.start();
      }
      function setCrowd(level) {
        if (!AC) return;
        crowdGain.gain.cancelScheduledValues(AC.currentTime);
        crowdGain.gain.linearRampToValueAtTime(
          muted ? 0.0001 : level,
          AC.currentTime + 1.4,
        );
      }
      function cheer() {
        if (!AC || muted) return;
        const buf = AC.createBuffer(
          1,
          (AC.sampleRate * 1.6) | 0,
          AC.sampleRate,
        );
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        const s = AC.createBufferSource();
        s.buffer = buf;
        const f = AC.createBiquadFilter();
        f.type = "bandpass";
        f.frequency.value = 1350;
        f.Q.value = 0.7;
        const g = AC.createGain();
        const t = AC.currentTime;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.16, t + 0.25);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.55);
        s.connect(f);
        f.connect(g);
        g.connect(AC.destination);
        s.start();
      }

      /* ---------- camera flight ---------- */
      let currentInfo = null;
      function flyToSeat(i) {
        const info = seatInfo(i);
        currentInfo = info;
        confirmed = false;
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
        setCrowd(0.02);
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
        ui.dock.classList.add("hidden");
        ui.backbar.classList.add("show");
        ui.sbHint.classList.add("show");
        setTimeout(() => ui.sbHint.classList.remove("show"), 4200);
        setCrowd(0.075);
        cheer();
        captureView(info.i);
      }
      function exitSeatMode() {
        if (mode !== "seat") return;
        mode = "fly";
        canvas.classList.remove("seatmode");
        ui.backbar.classList.remove("show");
        ui.sbHint.classList.remove("show");
        ui.dock.classList.remove("hidden");
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
        setCrowd(0.02);
      }

      /* ---------- pointer input ---------- */
      const pointers = new Map();
      let dragStart = null,
        dragMoved = 0,
        pinchDist = 0,
        pendingHover = null,
        lastPick = 0;
      canvas.addEventListener("pointerdown", (e) => {
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
      });
      canvas.addEventListener("pointermove", (e) => {
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
            ui.d3d.textContent = "3D";
          }
          hideTip();
        } else if (mode === "seat") {
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
      canvas.addEventListener("pointerup", endPointer);
      canvas.addEventListener("pointercancel", endPointer);
      canvas.addEventListener("pointerleave", () => {
        if (mode === "orbit") {
          setHover(-1);
          hideTip();
        }
        pendingHover = null;
      });
      canvas.addEventListener(
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
      addEventListener("keydown", (e) => {
        if (e.key === "Escape" && mode === "seat") exitSeatMode();
        if (e.key === "Enter" && mode === "seat" && !confirmed) grabSeat();
        if (mode === "orbit") {
          userInteracted = true;
          if (e.key === "ArrowLeft") orbit.thetaT += 0.12;
          if (e.key === "ArrowRight") orbit.thetaT -= 0.12;
          if (e.key === "ArrowUp")
            orbit.phiT = Math.max(0.14, orbit.phiT - 0.08);
          if (e.key === "ArrowDown")
            orbit.phiT = Math.min(1.46, orbit.phiT + 0.08);
          if (e.key === "+" || e.key === "=")
            orbit.radiusT = Math.max(60, orbit.radiusT - 16);
          if (e.key === "-") orbit.radiusT = Math.min(420, orbit.radiusT + 16);
        }
      });

      /* ---------- buttons ---------- */
      function grabSeat() {
        if (!currentInfo || confirmed) return;
        confirmed = true;
        updatePanel(currentInfo, "confirmed");
        cheer();
        toast(
          "Section " +
            currentInfo.label +
            " · Row " +
            currentInfo.row +
            " · Seat " +
            currentInfo.seat +
            " is yours",
        );
      }
      ui.bkExit.addEventListener("click", exitSeatMode);
      ui.bkSnd.addEventListener("click", () => {
        muted = !muted;
        ui.bkSnd.style.opacity = muted ? 0.4 : 1;
        if (AC) setCrowd(mode === "seat" ? 0.075 : 0.02);
      });
      $("checkout").addEventListener("click", () => {
        if (confirmed) {
          toast("Seat secured. Checkout isn’t wired in this demo", 3000);
          return;
        }
        if (mode === "seat") {
          grabSeat();
          return;
        }
        if (selectedIdx >= 0 && mode === "orbit") {
          toast("Taking you there first. Grab it once you like the view");
          flyToSeat(selectedIdx);
        }
      });
      ui.fav.addEventListener("click", () => ui.fav.classList.toggle("on"));
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
        ui.d3d.textContent = "3D";
      }
      $("cc-reset").addEventListener("click", goHome);
      $("d-reset").addEventListener("click", goHome);
      $("ov-expand").addEventListener("click", goHome);
      const zoomBy = (f) => {
        if (mode === "orbit") {
          userInteracted = true;
          orbit.radiusT = THREE.MathUtils.clamp(orbit.radiusT * f, 60, 420);
        }
      };
      $("cc-zin").addEventListener("click", () => zoomBy(0.86));
      $("cc-zout").addEventListener("click", () => zoomBy(1.16));
      $("d-zin").addEventListener("click", () => zoomBy(0.86));
      $("d-zout").addEventListener("click", () => zoomBy(1.16));
      $("cc-help").addEventListener("click", () =>
        toast(
          "Drag to rotate · Scroll to zoom · Click any seat to preview its view",
          3600,
        ),
      );
      $("d-vr").addEventListener("click", () =>
        toast("VR mode needs a WebXR headset. It is not in this build"),
      );
      ui.d3d.addEventListener("click", () => {
        if (mode !== "orbit") return;
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
            startPass(h.g.position.x * dir > 22 && rng() < 0.42);
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
            // formation slides with the ball
            tx =
              THREE.MathUtils.clamp(p.home.x + bp.x * 0.3, -49, 49) +
              Math.sin(t * p.sp * 0.5 + p.ph) * 2.4;
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
      addEventListener("resize", () => {
        camera.aspect = innerWidth / innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(innerWidth, innerHeight);
      });
      let fpsAcc = 0,
        fpsN = 0,
        fpsCheck = 0;
      function adaptQuality(dt, now) {
        fpsAcc += dt;
        fpsN++;
        if (now - fpsCheck < 2500) return;
        fpsCheck = now;
        const fps = fpsN / Math.max(1e-4, fpsAcc);
        fpsAcc = 0;
        fpsN = 0;
        const pr = renderer.getPixelRatio();
        if (fps < 40 && pr > 0.75)
          renderer.setPixelRatio(Math.max(0.75, pr - 0.25));
        else if (fps > 75 && pr < Math.min(2, window.devicePixelRatio))
          renderer.setPixelRatio(
            Math.min(2, window.devicePixelRatio, pr + 0.25),
          );
      }

      /* ---------- main loop ---------- */
      const clock = new THREE.Clock();
      let firstFrame = true;
      function animate() {
        requestAnimationFrame(animate);
        const dt = Math.min(0.05, clock.getDelta()),
          t = clock.elapsedTime,
          now = performance.now();
        // scrolling LED textures
        for (const a of animatedTextures) a.t.offset.x += a.speed * dt * 10;
        updateMatch(t, dt);
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
        drawMiniMap();
        drawOverview();
        adaptQuality(dt, now);
        renderer.render(scene, camera);
        if (firstFrame) {
          firstFrame = false;
          setTimeout(() => {
            captureView(featuredIdx);
            document.getElementById("loader").classList.add("hide");
            toast("Click any seat to see the match from it", 3800);
          }, 60);
        }
      }

      /* ---------- boot ---------- */
      applySelection(featuredIdx);
      currentInfo = seatInfo(featuredIdx);
      updatePanel(currentInfo, "suggested");
      drawOverviewBase();
      applyOrbit();
      animate();
}
