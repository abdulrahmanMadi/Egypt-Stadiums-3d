import fs from "fs";

const p = "src/app/stadium/stadium.engine.js";
let s = fs.readFileSync(p, "utf8");
const start = s.indexOf(
  "      /* ---------- roof + masts + cables (Misr Stadium / Admin Capital style) ---------- */",
);
const end = s.indexOf(
  "      /* ---------- volumetric floodlight cones ---------- */",
);
if (start < 0 || end < 0) throw new Error("markers not found " + start + " " + end);

const replacement = `      /* ---------- roof + exterior (Misr Stadium night aerial style) ---------- */
      const glowSprite = (() => {
        const t = canvasTexture(128, 128, (x) => {
          const g = x.createRadialGradient(64, 64, 4, 64, 64, 64);
          g.addColorStop(0, "rgba(255,255,255,1)");
          g.addColorStop(0.25, "rgba(200,230,255,.55)");
          g.addColorStop(1, "rgba(80,160,255,0)");
          x.fillStyle = g;
          x.fillRect(0, 0, 128, 128);
        });
        return t;
      })();
      {
        const SEG = 160;
        const MASTS = 40;
        // saddle: high behind goals (±X), lower on sidelines (±Z)
        const roofY = (a, base, amp) => base + Math.cos(2 * a) * amp;
        const darkRoof = new THREE.MeshLambertMaterial({
          map: roofTex,
          color: 0x2a303a,
          side: THREE.DoubleSide,
        });
        const whiteLit = new THREE.MeshBasicMaterial({
          color: 0xf2f6ff,
          toneMapped: false,
        });
        const whiteSteel = new THREE.MeshLambertMaterial({
          color: 0xeef2f8,
          emissive: 0x8899aa,
          emissiveIntensity: 0.25,
        });
        const cableMat = new THREE.MeshBasicMaterial({ color: 0xd8e0ea });
        const plazaMat = new THREE.MeshLambertMaterial({ color: 0xc5cad3 });

        // dark undulating roof membrane
        {
          const pos = [],
            uv = [],
            idx = [];
          for (let i = 0; i <= SEG; i++) {
            const a = (i / SEG) * TAU,
              c = Math.cos(a),
              s = Math.sin(a);
            const yIn = roofY(a, ROOF.inY, 4.5);
            const yOut = roofY(a, ROOF.outY, 6.5);
            pos.push(
              ROOF.inRx * c,
              yIn,
              ROOF.inRz * s,
              ROOF.outRx * c,
              yOut,
              ROOF.outRz * s,
            );
            uv.push((i / SEG) * 36, 0, (i / SEG) * 36, 1);
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
          scene.add(new THREE.Mesh(g, darkRoof));
        }

        // radial diamond cables on roof surface
        for (let i = 0; i < MASTS; i++) {
          const a0 = (i / MASTS) * TAU,
            a1 = ((i + 0.5) / MASTS) * TAU;
          const c0 = Math.cos(a0),
            s0 = Math.sin(a0),
            c1 = Math.cos(a1),
            s1 = Math.sin(a1);
          const pIn = new THREE.Vector3(
            ROOF.inRx * c0,
            roofY(a0, ROOF.inY, 4.5),
            ROOF.inRz * s0,
          );
          const pOut = new THREE.Vector3(
            ROOF.outRx * c0,
            roofY(a0, ROOF.outY, 6.5),
            ROOF.outRz * s0,
          );
          const pMid = new THREE.Vector3(
            ((ROOF.inRx + ROOF.outRx) / 2) * c1,
            roofY(a1, (ROOF.inY + ROOF.outY) / 2, 5.5),
            ((ROOF.inRz + ROOF.outRz) / 2) * s1,
          );
          [
            [pIn, pMid],
            [pMid, pOut],
          ].forEach(([a, b]) => {
            const len = a.distanceTo(b);
            const cable = new THREE.Mesh(
              new THREE.CylinderGeometry(0.07, 0.07, len, 4),
              cableMat,
            );
            cable.position.copy(a).add(b).multiplyScalar(0.5);
            cable.quaternion.setFromUnitVectors(
              new THREE.Vector3(0, 1, 0),
              b.clone().sub(a).normalize(),
            );
            scene.add(cable);
          });
        }

        // glowing white masts with V-lattice between neighbors
        const mastTips = [];
        for (let i = 0; i < MASTS; i++) {
          const a = (i / MASTS) * TAU,
            c = Math.cos(a),
            s = Math.sin(a);
          const mx = (ROOF.outRx + 6) * c,
            mz = (ROOF.outRz + 6) * s;
          const mast = new THREE.Mesh(
            new THREE.CylinderGeometry(0.48, 0.72, ROOF.mastH, 8),
            whiteSteel,
          );
          mast.position.set(mx, ROOF.mastH / 2, mz);
          scene.add(mast);
          const tip = new THREE.Vector3(mx, ROOF.mastH - 0.5, mz);
          mastTips.push(tip);
          const sp = new THREE.Sprite(
            new THREE.SpriteMaterial({
              map: glowSprite,
              color: 0xffffff,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
              transparent: true,
              opacity: 0.75,
            }),
          );
          sp.position.copy(tip);
          sp.scale.setScalar(7);
          scene.add(sp);
          const toIn = new THREE.Vector3(
            ROOF.inRx * c,
            roofY(a, ROOF.inY, 4.5),
            ROOF.inRz * s,
          );
          const toOut = new THREE.Vector3(
            ROOF.outRx * c,
            roofY(a, ROOF.outY, 6.5),
            ROOF.outRz * s,
          );
          [toIn, toOut].forEach((to) => {
            const len = tip.distanceTo(to);
            const cable = new THREE.Mesh(
              new THREE.CylinderGeometry(0.05, 0.05, len, 4),
              whiteLit,
            );
            cable.position.copy(tip).add(to).multiplyScalar(0.5);
            cable.quaternion.setFromUnitVectors(
              new THREE.Vector3(0, 1, 0),
              to.clone().sub(tip).normalize(),
            );
            scene.add(cable);
          });
        }
        for (let i = 0; i < MASTS; i++) {
          const a = mastTips[i],
            b = mastTips[(i + 1) % MASTS];
          const mid = a.clone().lerp(b, 0.5);
          mid.y *= 0.55;
          [
            [a, mid],
            [b, mid],
          ].forEach(([p0, q]) => {
            const len = p0.distanceTo(q);
            const stay = new THREE.Mesh(
              new THREE.CylinderGeometry(0.08, 0.08, len, 4),
              whiteLit,
            );
            stay.position.copy(p0).add(q).multiplyScalar(0.5);
            stay.quaternion.setFromUnitVectors(
              new THREE.Vector3(0, 1, 0),
              q.clone().sub(p0).normalize(),
            );
            scene.add(stay);
          });
        }

        // white sloping outer shell (flares toward ground)
        {
          const shell = new THREE.Mesh(
            new THREE.CylinderGeometry(
              ROOF.outRx + 2,
              ROOF.outRx + 14,
              ROOF.outY * 0.72,
              96,
              1,
              true,
            ),
            new THREE.MeshLambertMaterial({
              color: 0xe8ecf2,
              side: THREE.DoubleSide,
            }),
          );
          shell.scale.z = (ROOF.outRz + 14) / (ROOF.outRx + 14);
          shell.position.y = (ROOF.outY * 0.72) / 2;
          scene.add(shell);
        }
        // bright cyan LED ring under roofline
        scene.add(
          ringStrip(
            ROOF.outRx + 1.2,
            ROOF.outRz + 1.2,
            ROOF.outY - 3.2,
            ROOF.outRx + 1.2,
            ROOF.outRz + 1.2,
            ROOF.outY - 1.4,
            120,
            new THREE.MeshBasicMaterial({
              color: 0x19b7ff,
              toneMapped: false,
              side: THREE.DoubleSide,
            }),
            40,
          ),
        );
        // plaza podium
        const plaza = new THREE.Mesh(new THREE.CircleGeometry(1, 96), plazaMat);
        plaza.scale.set(ROOF.outRx + 55, ROOF.outRz + 48, 1);
        plaza.rotation.x = -Math.PI / 2;
        plaza.position.y = -0.08;
        plaza.receiveShadow = true;
        scene.add(plaza);
        for (let i = 0; i < 48; i++) {
          const a = (i / 48) * TAU;
          const rib = new THREE.Mesh(
            new THREE.BoxGeometry(1.2, 0.12, ROOF.outRx + 40),
            new THREE.MeshLambertMaterial({ color: 0xb0b6c0 }),
          );
          rib.position.set(0, -0.02, 0);
          rib.rotation.y = a;
          scene.add(rib);
        }

        // inner floodlight lip
        scene.add(
          ringStrip(
            ROOF.inRx + 0.25,
            ROOF.inRz + 0.25,
            ROOF.inY - 0.9,
            ROOF.inRx + 0.25,
            ROOF.inRz + 0.25,
            ROOF.inY - 0.15,
            SEG,
            new THREE.MeshBasicMaterial({
              color: 0xfff0d0,
              toneMapped: false,
              side: THREE.DoubleSide,
            }),
            50,
          ),
        );
        const smat = new THREE.SpriteMaterial({
          map: glowSprite,
          color: 0xffffff,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true,
          opacity: 0.9,
        });
        for (let i = 0; i < 72; i++) {
          const a = (i / 72) * TAU;
          const sp = new THREE.Sprite(smat);
          sp.position.set(
            ROOF.inRx * Math.cos(a),
            roofY(a, ROOF.inY, 4.5) - 0.4,
            ROOF.inRz * Math.sin(a),
          );
          sp.scale.setScalar(4.5);
          scene.add(sp);
        }
      }

`;

s = s.slice(0, start) + replacement + s.slice(end);
fs.writeFileSync(p, s);
console.log("ok", replacement.length);
