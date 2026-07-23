      {
        const SEG = 180;
        const RINGS = 12;
        const MASTS = 40;
        // saddle + fabric sag: high at eaves, soft droop mid-span, ring-beam at inner edge
        const roofY = (a, t) => {
          const base = ROOF.inY + (ROOF.outY - ROOF.inY) * t;
          const saddle = Math.cos(2 * a) * (3.2 + 5.5 * t);
          const sag = Math.sin(Math.PI * t) * -4.2;
          const bay = Math.cos(MASTS * a) * 0.22 * t;
          return base + saddle + sag + bay;
        };
        const roofXZ = (a, t) => {
          const c = Math.cos(a),
            s = Math.sin(a);
          return [
            (ROOF.inRx + (ROOF.outRx - ROOF.inRx) * t) * c,
            (ROOF.inRz + (ROOF.outRz - ROOF.inRz) * t) * s,
          ];
        };
        const whiteRoof = new THREE.MeshLambertMaterial({
          map: roofTex,
          color: 0xffffff,
          side: THREE.DoubleSide,
          emissive: 0xb8c8dc,
          emissiveIntensity: 0.12,
        });
        const whiteLit = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          toneMapped: false,
        });
        const whiteSteel = new THREE.MeshLambertMaterial({
          color: 0xf5f8fc,
          emissive: 0xaab8cc,
          emissiveIntensity: 0.28,
        });
        const cableMat = new THREE.MeshBasicMaterial({ color: 0xe8eef6 });
        // white undulating multi-ring membrane
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
              uv.push((i / SEG) * 40, t * 4);
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
          scene.add(new THREE.Mesh(g, whiteRoof));
        }
        // bright white outer eaves lip
        scene.add(
          ringStrip(
            ROOF.outRx - 0.4,
            ROOF.outRz - 0.4,
            ROOF.outY + 0.2,
            ROOF.outRx + 4.5,
            ROOF.outRz + 4.0,
            ROOF.outY + 1.6,
            SEG,
            whiteSteel,
            24,
          ),
        );
        // inner ring beam (white)
        scene.add(
          ringStrip(
            ROOF.inRx - 1.2,
            ROOF.inRz - 1.0,
            ROOF.inY - 1.4,
            ROOF.inRx + 1.6,
            ROOF.inRz + 1.4,
            ROOF.inY + 0.6,
            SEG,
            whiteSteel,
            20,
          ),
        );

        // radial tension ribs on membrane
        for (let i = 0; i < MASTS; i++) {
          const a0 = (i / MASTS) * TAU,
            a1 = ((i + 0.5) / MASTS) * TAU;
          const pts = [0, 0.35, 0.7, 1].map((t) => {
            const a = t < 0.5 ? a0 : a1;
            const [x, z] = roofXZ(a, t);
            return new THREE.Vector3(x, roofY(a, t) + 0.15, z);
          });
          for (let k = 0; k < pts.length - 1; k++) {
            const a = pts[k],
              b = pts[k + 1];
            const len = a.distanceTo(b);
            const cable = new THREE.Mesh(
              new THREE.CylinderGeometry(0.08, 0.08, len, 4),
              cableMat,
            );
            cable.position.copy(a).add(b).multiplyScalar(0.5);
            cable.quaternion.setFromUnitVectors(
              new THREE.Vector3(0, 1, 0),
              b.clone().sub(a).normalize(),
            );
            scene.add(cable);
          }
        }

        // glowing white masts with V-lattice between neighbors
        const mastTips = [];
        for (let i = 0; i < MASTS; i++) {
          const a = (i / MASTS) * TAU,
            c = Math.cos(a),
            s = Math.sin(a);
          const mx = (ROOF.outRx + 7) * c,
            mz = (ROOF.outRz + 7) * s;
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
          const [ix, iz] = roofXZ(a, 0);
          const [ox, oz] = roofXZ(a, 1);
          const toIn = new THREE.Vector3(ix, roofY(a, 0), iz);
          const toOut = new THREE.Vector3(ox, roofY(a, 1), oz);
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