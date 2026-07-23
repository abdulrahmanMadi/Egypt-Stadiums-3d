const fs = require("fs");
const p = "src/app/stadium/stadiums/cairo.engine.js";
let s = fs.readFileSync(p, "utf8");
const start = s.indexOf("  /* ---------- seating bowl:");
const end = s.indexOf("  /* ---------- exterior stone shell");
if (start < 0 || end < 0) throw new Error("markers " + start + " " + end);

const replacement = `  /* ---------- seating bowl: textured rings + instanced seats ---------- */
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

`;

s = s.slice(0, start) + replacement + s.slice(end);
fs.writeFileSync(p, s);
console.log("ok", s.length);
