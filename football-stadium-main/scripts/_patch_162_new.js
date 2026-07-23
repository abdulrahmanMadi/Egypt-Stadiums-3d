        // grand entrance portals (4 axes) — full approach plazas
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
          // main hall volume
          const arch = new THREE.Mesh(
            new THREE.BoxGeometry(28, 16, 14),
            portalMat,
          );
          arch.position.set(ex, 8, ez);
          arch.rotation.y = -a;
          scene.add(arch);
          // lit lobby opening
          const opening = new THREE.Mesh(
            new THREE.BoxGeometry(16, 11, 0.35),
            portalGlow,
          );
          opening.position.set(ex + c * 7.2, 6, ez + s * 7.2);
          opening.rotation.y = -a;
          scene.add(opening);
          // glass doors
          for (let d = -1; d <= 1; d += 2) {
            const door = new THREE.Mesh(
              new THREE.BoxGeometry(4.5, 8, 0.2),
              glassDoor,
            );
            door.position.set(
              ex + c * 7.4 + (-s) * d * 5,
              4.2,
              ez + s * 7.4 + c * d * 5,
            );
            door.rotation.y = -a;
            scene.add(door);
          }
          // canopy
          const canopy = new THREE.Mesh(
            new THREE.BoxGeometry(32, 0.55, 16),
            whiteSteel,
          );
          canopy.position.set(ex + c * 4, 16.2, ez + s * 4);
          canopy.rotation.y = -a;
          scene.add(canopy);
          // approach ramp / stairs
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
          // pedestrian walkway from road to entrance
          const walk = new THREE.Mesh(
            new THREE.BoxGeometry(12, 0.12, 28),
            new THREE.MeshLambertMaterial({ color: 0xb8c0cc }),
          );
          walk.position.set(ex + c * 28, 0.02, ez + s * 28);
          walk.rotation.y = -a;
          scene.add(walk);
        }

        // exterior stadium name boards
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

        // multi-level plaza podium
        const plaza = new THREE.Mesh(
          new THREE.CircleGeometry(1, 96),
          new THREE.MeshLambertMaterial({ color: 0xc8ced8 }),
        );
        plaza.scale.set(ROOF.outRx + 70, ROOF.outRz + 58, 1);
        plaza.rotation.x = -Math.PI / 2;
        plaza.position.y = -0.08;
        plaza.receiveShadow = true;
        scene.add(plaza);
        // raised inner podium ring
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
        // landscaping green belts
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
        // trees around plaza
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
        // parking lots (4 sectors) with cars
        const carColors = [0xdfe4ea, 0x2a3344, 0x8b0000, 0x74acdf, 0xe8c53a];
        for (let sec = 0; sec < 4; sec++) {
          const a0 = (sec / 4) * TAU + 0.2;
          const lot = new THREE.Mesh(
            new THREE.BoxGeometry(38, 0.1, 22),
            new THREE.MeshLambertMaterial({ color: 0x333a44 }),
          );
          const lr = ROOF.outRx + 78;
          lot.position.set(lr * Math.cos(a0), 0.0, (ROOF.outRz + 68) * Math.sin(a0));
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
        // plaza radial ribs
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
        // ticket / service kiosks around ring
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
        // distant ground plane (dark night surroundings)
        const ground = new THREE.Mesh(
          new THREE.CircleGeometry(1, 64),
          new THREE.MeshLambertMaterial({ color: 0x0a1018 }),
        );
        ground.scale.set(480, 400, 1);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.25;
        scene.add(ground);