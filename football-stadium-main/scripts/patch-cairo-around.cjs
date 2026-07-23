const fs = require("fs");
const p = "src/app/stadium/stadiums/cairo.engine.js";
let s = fs.readFileSync(p, "utf8");

const start = s.indexOf("  /* ---------- surroundings ---------- */");
const end = s.indexOf("  /* ---------- pitch ---------- */");
if (start < 0 || end < 0) throw new Error("surround markers " + start + " " + end);

const surroundings = `  /* ---------- surroundings (Genius&Gerry site layout) ---------- */
  {
    // Neutral paved ground (light grey plaza field like the reference)
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(1, 96),
      new THREE.MeshLambertMaterial({ color: 0xd4d8de }),
    );
    ground.scale.set(520, 460, 1);
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
      color: 0x6e7580,
      side: THREE.DoubleSide,
    });
    scene.add(
      ringStrip(
        BOWL.outRx + 18,
        BOWL.outRz + 16,
        -0.12,
        BOWL.outRx + 36,
        BOWL.outRz + 30,
        -0.12,
        160,
        roadMat,
        1,
      ),
    );
    // road edge lines
    const lineMat = new THREE.MeshBasicMaterial({
      color: 0xcfd4db,
      side: THREE.DoubleSide,
    });
    scene.add(
      ringStrip(
        BOWL.outRx + 26.2,
        BOWL.outRz + 22.2,
        -0.08,
        BOWL.outRx + 27.2,
        BOWL.outRz + 23.0,
        -0.08,
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
    const lawnMat = new THREE.MeshLambertMaterial({ color: 0x3f9a48 });
    // curved planter beds (reference: arcs of grass in plaza)
    for (let i = 0; i < 5; i++) {
      const a0 = -0.85 + i * 0.42;
      const bed = new THREE.Mesh(
        new THREE.RingGeometry(22, 30, 32, 1, a0, 0.28),
        lawnMat,
      );
      bed.rotation.x = -Math.PI / 2;
      bed.position.set(0, -0.02, plazaZ);
      scene.add(bed);
      // raised edge
      const lip = new THREE.Mesh(
        new THREE.RingGeometry(21.6, 22, 32, 1, a0, 0.28),
        concreteDark,
      );
      lip.rotation.x = -Math.PI / 2;
      lip.position.set(0, 0.05, plazaZ);
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

`;

s = s.slice(0, start) + surroundings + s.slice(end);

// Replace exterior stone shell block
const eStart = s.indexOf("  /* ---------- exterior stone shell");
const eEnd = s.indexOf("  /* ---------- main entrance facade");
if (eStart < 0 || eEnd < 0) throw new Error("exterior markers " + eStart + " " + eEnd);

const exterior = `  /* ---------- exterior stone shell, openings, ramps ---------- */
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

`;

s = s.slice(0, eStart) + exterior + s.slice(eEnd);

// Soft reference-like background (pale grey-blue)
s = s.replace(
  "scene.background = new THREE.Color(0xa8c4e0);\n  scene.fog = new THREE.Fog(0xa8c4e0, 380, 900);",
  "scene.background = new THREE.Color(0xd8dde4);\n  scene.fog = new THREE.Fog(0xd8dde4, 420, 980);",
);

fs.writeFileSync(p, s);
console.log("patched surroundings + exterior", s.length);
