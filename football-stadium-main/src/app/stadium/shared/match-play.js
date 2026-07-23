import * as THREE from 'three';

const TAU = Math.PI * 2;

/**
 * Procedural match: articulated players + ball + possession AI.
 * Used by Cairo (and can be shared by other stadiums).
 *
 * @param {THREE.Scene} scene
 * @param {{
 *   rng?: () => number,
 *   field?: { L: number, W: number },
 *   dugoutZ?: number,
 *   kits?: Array<{ shirt: number|THREE.Material, shorts: number|THREE.Material, socks?: number|THREE.Material, gk?: number|THREE.Material }>,
 *   onScore?: (score: { home: number, away: number, minute: number }) => void,
 * }} [opts]
 */
export function createMatchPlay(scene, opts = {}) {
  const rng = opts.rng || Math.random;
  const FIELD = opts.field || { L: 105, W: 68 };
  const dugoutZ = opts.dugoutZ ?? FIELD.W / 2 + 4.2;
  const onScore = opts.onScore || (() => {});

  const players = [];
  let ball;
  const score = { home: 0, away: 0, minute: 0 };

  const skinMats = ['#c98d63', '#8d5a3b', '#eac1a4', '#a5714b'].map(
    (c) => new THREE.MeshLambertMaterial({ color: c }),
  );
  const hairMats = ['#171310', '#2b1c10', '#4a3520', '#0d0d0d'].map(
    (c) => new THREE.MeshLambertMaterial({ color: c }),
  );
  const bootMat = new THREE.MeshLambertMaterial({ color: 0x101014 });

  function matFrom(c, extra = {}) {
    if (c && c.isMaterial) return c;
    return new THREE.MeshLambertMaterial({ color: c, ...extra });
  }

  const defaultKits = [
    {
      // Al Ahly — deep red / white
      shirt: matFrom(0x6e0000, { emissive: 0x4a0000, emissiveIntensity: 0.12 }),
      shorts: matFrom(0xf2f4f8),
      socks: matFrom(0x6e0000, { emissive: 0x4a0000, emissiveIntensity: 0.08 }),
      gk: matFrom(0x1a1a1a, { emissive: 0x222222, emissiveIntensity: 0.1 }),
    },
    {
      // Zamalek — white / black
      shirt: matFrom(0xffffff, { emissive: 0xd8dce4, emissiveIntensity: 0.06 }),
      shorts: matFrom(0x141414),
      socks: matFrom(0xffffff),
      gk: matFrom(0x2fbf71, { emissive: 0x2fbf71, emissiveIntensity: 0.12 }),
    },
    {
      // referee
      shirt: matFrom(0xf2e341, { emissive: 0xf2e341, emissiveIntensity: 0.1 }),
      shorts: matFrom(0x141414),
      socks: matFrom(0x141414),
    },
  ];

  const kits = opts.kits
    ? opts.kits.map((k, i) => {
        if (!k) return defaultKits[i];
        return {
          shirt: matFrom(k.shirt),
          shorts: matFrom(k.shorts),
          socks: matFrom(k.socks ?? k.shirt),
          gk: k.gk ? matFrom(k.gk) : defaultKits[i]?.gk,
        };
      })
    : defaultKits;
  while (kits.length < 3) kits.push(defaultKits[kits.length]);

  function mkPlayer(kit, gk, popts) {
    popts = popts || {};
    const seated = !!popts.seated;
    const coach = !!popts.coach;
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
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.145, 10, 8), skin);
    head.position.y = seated ? 1.56 : 1.88;
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 10, 6, 0, TAU, 0, Math.PI / 2.05),
      hairMats[(rng() * hairMats.length) | 0],
    );
    hair.position.y = seated ? 1.58 : 1.9;
    const earL = new THREE.Mesh(new THREE.SphereGeometry(0.035, 5, 4), skin);
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
      let role = 'gk',
        homeQ = -49.5,
        hz = 0,
        zoneMinQ = -50,
        zoneMaxQ = -43,
        shapeShift = 0;
      if (i >= 1 && i <= 4) {
        role = 'defender';
        homeQ = -27;
        hz = [-25, -8, 8, 25][i - 1];
        zoneMinQ = -43;
        zoneMaxQ = 12;
        shapeShift = 0.7;
      } else if (i >= 5 && i <= 7) {
        role = 'midfielder';
        homeQ = -3;
        hz = [-20, 0, 20][i - 5];
        zoneMinQ = -32;
        zoneMaxQ = 36;
        shapeShift = 0.65;
      } else if (i >= 8) {
        role = 'forward';
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

  const dugoutCenters = opts.dugoutCenters || [-18, 18];
  dugoutCenters.forEach((cx, di) => {
    for (let s = 0; s < 7; s++) {
      const sub = mkPlayer(kits[di], false, { seated: true });
      const x = cx - 5.4 + s * 1.55;
      const z = dugoutZ + 0.25;
      sub.g.position.set(x, 0.42, z);
      sub.g.rotation.y = Math.PI;
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

  const match = {
    phase: 'hold',
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
        // Build through defenders and midfielders before looking for a forward.
        if (match.passCount < 3 && c.role === 'forward') continue;
        const v =
          c.g.position.x * dir + rng() * 22 - Math.abs(c.g.position.z) * 0.1;
        if (v > bestV) {
          bestV = v;
          best = cand;
        }
      }
      if (best < 0) {
        const base = team * 11;
        best = base + 1 + ((rng() * 7) | 0);
        if (best === match.holder) best = base + 1 + ((best - base) % 7);
      }
      match.receiver = best;
      const r = players[best];
      match.to.set(
        THREE.MathUtils.clamp(r.g.position.x + dir * (3 + rng() * 5), -50, 50),
        0,
        THREE.MathUtils.clamp(r.g.position.z + (rng() - 0.5) * 4, -31, 31),
      );
      match.shot = false;
      match.arc = rng() < 0.28 ? 2.2 + rng() * 1.6 : 0.3 + rng() * 0.5;

      // After eight completed passes, the closest opponent steps into the
      // passing lane. The ball still follows the normal pass physics.
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
          const laneDistance = candidate.g.position.distanceToSquared(lanePoint);
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
    match.dur = THREE.MathUtils.clamp(dist / (match.shot ? 26 : 17), 0.35, 2.4);
    match.t = 0;
    match.phase = 'fly';
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
    match.phase = 'fly';
  }

  function onBallArrive() {
    if (match.shot) {
      const scoringTeam = teamOf(match.holder);
      if (rng() < 0.6) {
        if (scoringTeam === 0) score.home++;
        else score.away++;
        match.scoredBy = scoringTeam;
        match.celebrate = 2.6;
        onScore(score);
        ball.position.set(0, 0.16, 0);
        match.holder = (scoringTeam ? 0 : 11) + 5;
      } else {
        match.holder = scoringTeam ? 0 : 11;
        ball.position.copy(players[match.holder].g.position);
        ball.position.y = 0.16;
      }
      match.phase = 'hold';
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
    match.phase = 'hold';
    match.t = 0;
    match.dur = 0.5 + rng() * 1.3;
  }

  const V3 = new THREE.Vector3();
  const FWD = new THREE.Vector3();
  let lastMinDraw = -1;

  function update(t, dt) {
    match.celebrate = Math.max(0, match.celebrate - dt);
    score.minute = Math.min(90, Math.floor(t / 2.2));
    if ((t | 0) % 5 === 0 && (t | 0) !== lastMinDraw) {
      lastMinDraw = t | 0;
      onScore(score);
    }
    match.t += dt;
    const bp = ball.position;
    if (match.phase === 'hold') {
      const h = players[match.holder];
      FWD.set(Math.sin(h.g.rotation.y), 0, Math.cos(h.g.rotation.y));
      V3.copy(h.g.position).addScaledVector(FWD, 0.42);
      V3.y = 0.16 + Math.abs(Math.sin(t * 6.5)) * 0.05;
      bp.lerp(V3, Math.min(1, dt * 8));
      if (match.t >= match.dur) {
        const dir = h.team ? -1 : 1;
        const attackQ = h.g.position.x * dir;
        if (h.role === 'forward' && attackQ > 32) {
          // A forward isolated in the opponent box is closed down and tackled,
          // rather than unrealistically recycling the ball backwards.
          startTackleTurnover();
        } else {
          // Pass-only exhibition: retain the existing passing AI, without shots.
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
      if (p.bench) {
        if (p.coach) {
          p.armR.rotation.z = -0.35 + Math.sin(t * 1.4 + p.ph) * 0.08;
          p.g.rotation.y = Math.PI + Math.sin(t * 0.55 + p.ph) * 0.12;
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
        tx = THREE.MathUtils.clamp(bp.x * 0.72, -46, 46);
        tz = THREE.MathUtils.clamp(bp.z + 9, -28, 28);
        run = 0.8;
      } else if (i === match.holder && match.phase === 'hold') {
        const dir = p.team ? -1 : 1;
        tx = THREE.MathUtils.clamp(p.g.position.x + dir * 3, -49, 49);
        tz = p.g.position.z;
        run = 0.72;
      } else if (match.phase === 'fly' && !match.shot && i === match.receiver) {
        tx = match.to.x;
        tz = match.to.z;
        run = 1.55;
      } else if (p.gk) {
        tx = p.home.x;
        tz = THREE.MathUtils.clamp(bp.z * 0.32, -3.4, 3.4);
        run = 0.7;
      } else if (i === presser) {
        tx = bp.x;
        tz = bp.z;
        run = 1.5;
      } else {
        // Role-based formation in attack-relative coordinates. These zones
        // deliberately overlap the halfway line; no team-half clamp exists.
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
      const speed = step / Math.max(dt, 1e-4);
      p.amp +=
        (THREE.MathUtils.clamp(speed / 6, 0.05, 1) - p.amp) * Math.min(1, dt * 5);
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

  function dispose() {
    for (const p of players) {
      scene.remove(p.g);
      p.g.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose?.());
          else o.material.dispose?.();
        }
      });
    }
    players.length = 0;
    if (ball) {
      scene.remove(ball);
      ball.geometry?.dispose();
      ball.material?.dispose();
      ball = null;
    }
  }

  onScore(score);

  return { update, dispose, score, players, ball, match };
}
