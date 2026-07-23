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