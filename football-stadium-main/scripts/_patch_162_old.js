        // grand entrance portals (4 axes)
        const portalMat = new THREE.MeshLambertMaterial({ color: 0xf4f7fb });
        const portalGlow = new THREE.MeshBasicMaterial({
          color: 0xffe2b0,
          toneMapped: false,
        });
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * TAU + Math.PI / 4;
          const c = Math.cos(a),
            s = Math.sin(a);
          const ex = (ROOF.outRx + 18) * c,
            ez = (ROOF.outRz + 18) * s;
          const arch = new THREE.Mesh(
            new THREE.BoxGeometry(22, 14, 8),
            portalMat,
          );
          arch.position.set(ex, 7, ez);
          arch.rotation.y = -a;
          scene.add(arch);
          const opening = new THREE.Mesh(
            new THREE.BoxGeometry(14, 10, 0.4),
            portalGlow,
          );
          opening.position.set(ex + c * 4.2, 5.5, ez + s * 4.2);
          opening.rotation.y = -a;
          scene.add(opening);
          // canopy over entrance
          const canopy = new THREE.Mesh(
            new THREE.BoxGeometry(26, 0.6, 12),
            whiteSteel,
          );
          canopy.position.set(ex + c * 2, 14.2, ez + s * 2);
          canopy.rotation.y = -a;
          scene.add(canopy);
        }

        // plaza podium + outer ring road + landscaping lights
        const plaza = new THREE.Mesh(new THREE.CircleGeometry(1, 96), plazaMat);
        plaza.scale.set(ROOF.outRx + 70, ROOF.outRz + 58, 1);
        plaza.rotation.x = -Math.PI / 2;
        plaza.position.y = -0.08;
        plaza.receiveShadow = true;
        scene.add(plaza);
        // asphalt ring road
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
        // road lane markings
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
        // street lamp posts around plaza
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
        // distant ground plane (dark night surroundings)
        const ground = new THREE.Mesh(
          new THREE.CircleGeometry(1, 64),
          new THREE.MeshLambertMaterial({ color: 0x0a1018 }),
        );
        ground.scale.set(420, 360, 1);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.2;
        scene.add(ground);