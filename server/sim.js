import {
  ECONOMY,
  MAP,
  MATCH,
  TEAM,
  TICK_DT,
  WEAPON,
  WEAPONS,
} from "../shared/constants.js";

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function len2(x, z) {
  return Math.hypot(x, z);
}

export function createPlayer(id, name, team, isBot = false) {
  return {
    id,
    name: name.slice(0, 16) || "Operative",
    team,
    isBot,
    x: 0,
    y: MATCH.eyeHeight,
    z: 0,
    yaw: 0,
    pitch: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    health: 100,
    armor: 0,
    money: ECONOMY.startMoney,
    weapon: WEAPON.PISTOL,
    mag: WEAPONS.pistol.magSize,
    reserve: WEAPONS.pistol.reserve,
    alive: true,
    grounded: true,
    ads: false,
    reloading: false,
    reloadT: 0,
    fireCd: 0,
    plantT: 0,
    defuseT: 0,
    hasKit: false,
    hasBomb: false,
    lossStreak: 0,
    kills: 0,
    deaths: 0,
    input: emptyInput(),
    seq: 0,
    spawnLock: 0,
  };
}

export function emptyInput() {
  return {
    seq: 0,
    ax: 0,
    az: 0,
    yaw: 0,
    pitch: 0,
    jump: false,
    fire: false,
    reload: false,
    ads: false,
    sprint: false,
    plant: false,
    defuse: false,
    wantWeapon: null,
  };
}

export function spawnPlayer(p, round) {
  const list =
    p.team === TEAM.ATTACKERS ? MAP.attackerSpawns : MAP.defenderSpawns;
  const slot = list[Math.abs(hashId(p.id)) % list.length];
  p.x = slot.x + (Math.random() - 0.5) * 1.2;
  p.z = slot.z + (Math.random() - 0.5) * 1.2;
  p.y = MATCH.eyeHeight;
  p.yaw = slot.yaw;
  p.pitch = 0;
  p.vx = p.vy = p.vz = 0;
  p.health = 100;
  p.alive = true;
  p.reloading = false;
  p.reloadT = 0;
  p.fireCd = 0;
  p.plantT = 0;
  p.defuseT = 0;
  p.grounded = true;
  refillWeapon(p);
  if (p.team === TEAM.ATTACKERS && round?.bombCarrierId === p.id) {
    p.hasBomb = true;
  }
}

function hashId(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return h;
}

export function refillWeapon(p) {
  const w = WEAPONS[p.weapon] || WEAPONS.pistol;
  p.mag = w.magSize;
  p.reserve = w.reserve;
}

export function buyItem(p, item, phaseBuy) {
  if (!phaseBuy || !p.alive) return { ok: false, reason: "not_buy_phase" };
  if (item === "armor") {
    if (p.armor >= ECONOMY.armorValue) return { ok: false, reason: "owned" };
    if (p.money < ECONOMY.armorPrice) return { ok: false, reason: "money" };
    p.money -= ECONOMY.armorPrice;
    p.armor = ECONOMY.armorValue;
    return { ok: true };
  }
  if (item === "kit") {
    if (p.team !== TEAM.DEFENDERS) return { ok: false, reason: "team" };
    if (p.hasKit) return { ok: false, reason: "owned" };
    if (p.money < ECONOMY.kitPrice) return { ok: false, reason: "money" };
    p.money -= ECONOMY.kitPrice;
    p.hasKit = true;
    return { ok: true };
  }
  const w = WEAPONS[item];
  if (!w) return { ok: false, reason: "unknown" };
  if (p.weapon === item && p.mag > 0) return { ok: false, reason: "owned" };
  if (p.money < w.price) return { ok: false, reason: "money" };
  p.money -= w.price;
  p.weapon = item;
  refillWeapon(p);
  return { ok: true };
}

function resolveColliders(p) {
  const r = MATCH.playerRadius;
  for (const c of MAP.colliders) {
    const dx = p.x - c.x;
    const dz = p.z - c.z;
    const ox = Math.abs(dx) - (c.halfX + r);
    const oz = Math.abs(dz) - (c.halfZ + r);
    if (ox < 0 && oz < 0) {
      if (ox > oz) p.x += Math.sign(dx || 1) * -ox;
      else p.z += Math.sign(dz || 1) * -oz;
    }
  }
  const h = MAP.half - 0.8;
  p.x = clamp(p.x, -h, h);
  p.z = clamp(p.z, -h, h);
}

export function integratePlayer(p, dt) {
  if (!p.alive) return;
  if (p.spawnLock > 0) p.spawnLock -= dt;

  const inp = p.input;
  p.yaw = inp.yaw;
  p.pitch = clamp(inp.pitch, -1.4, 1.4);
  p.ads = !!inp.ads && !p.reloading;

  if (p.reloading) {
    p.reloadT -= dt;
    if (p.reloadT <= 0) {
      const w = WEAPONS[p.weapon];
      const need = w.magSize - p.mag;
      const take = Math.min(need, p.reserve);
      p.mag += take;
      p.reserve -= take;
      p.reloading = false;
    }
  }

  if (inp.reload && !p.reloading && p.mag < WEAPONS[p.weapon].magSize && p.reserve > 0) {
    p.reloading = true;
    p.reloadT = p.weapon === WEAPON.PISTOL ? 1.4 : 2.1;
  }

  if (inp.wantWeapon && WEAPONS[inp.wantWeapon] && inp.wantWeapon !== p.weapon) {
    // quick switch only to owned default pistol always; guns bought already set
  }

  const grounded = p.y <= MATCH.eyeHeight + 0.001;
  p.grounded = grounded;
  if (grounded) {
    p.y = MATCH.eyeHeight;
    p.vy = Math.max(0, p.vy);
  } else {
    p.vy -= MATCH.gravity * dt;
  }

  const syn = Math.sin(p.yaw);
  const cos = Math.cos(p.yaw);
  const ax = clamp(inp.ax, -1, 1);
  const az = clamp(inp.az, -1, 1);
  let mx = cos * ax + syn * az;
  let mz = -syn * ax + cos * az;
  const ml = len2(mx, mz);
  if (ml > 1) {
    mx /= ml;
    mz /= ml;
  }
  const speed =
    MATCH.moveSpeed * (inp.sprint && !p.ads ? MATCH.sprintMult : 1) * (p.ads ? 0.72 : 1);
  p.vx = mx * speed;
  p.vz = mz * speed;

  if (inp.jump && grounded) p.vy = MATCH.jumpVel;

  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.z += p.vz * dt;
  if (p.y < MATCH.eyeHeight) {
    p.y = MATCH.eyeHeight;
    p.vy = 0;
    p.grounded = true;
  }
  resolveColliders(p);

  if (p.fireCd > 0) p.fireCd -= dt;
}

export function tryFire(p, players) {
  if (!p.alive || p.reloading || p.fireCd > 0 || p.spawnLock > 0) return null;
  if (!p.input.fire) return null;
  const w = WEAPONS[p.weapon];
  if (p.mag <= 0) return null;

  p.mag -= 1;
  p.fireCd = 60 / w.rpm;

  const moving = len2(p.vx, p.vz) > 0.4;
  let spread = p.ads ? w.adsSpread : w.spread;
  if (moving) spread += w.moveSpread;
  spread += w.recoil * (Math.random() * 0.6);

  const yaw = p.yaw + (Math.random() - 0.5) * spread * 2;
  const pitch = p.pitch + (Math.random() - 0.5) * spread * 2;
  const dir = {
    x: Math.sin(yaw) * Math.cos(pitch),
    y: Math.sin(pitch),
    z: Math.cos(yaw) * Math.cos(pitch),
  };
  const origin = { x: p.x, y: p.y, z: p.z };

  let best = null;
  let bestT = w.range;
  for (const t of players) {
    if (t.id === p.id || !t.alive || t.team === p.team) continue;
    const hit = rayCapsule(origin, dir, t, MATCH.playerRadius, MATCH.eyeHeight);
    if (hit && hit.t < bestT) {
      bestT = hit.t;
      best = { target: t, ...hit };
    }
  }

  // world block rough
  const wallT = rayWorld(origin, dir, w.range);
  if (wallT != null && wallT < bestT) {
    return {
      shooterId: p.id,
      hit: false,
      ox: origin.x,
      oy: origin.y,
      oz: origin.z,
      dx: dir.x,
      dy: dir.y,
      dz: dir.z,
      tx: origin.x + dir.x * wallT,
      ty: origin.y + dir.y * wallT,
      tz: origin.z + dir.z * wallT,
      weapon: p.weapon,
    };
  }

  if (!best) {
    return {
      shooterId: p.id,
      hit: false,
      ox: origin.x,
      oy: origin.y,
      oz: origin.z,
      dx: dir.x,
      dy: dir.y,
      dz: dir.z,
      tx: origin.x + dir.x * w.range,
      ty: origin.y + dir.y * w.range,
      tz: origin.z + dir.z * w.range,
      weapon: p.weapon,
    };
  }

  let dmg = w.damage;
  if (best.head) dmg = Math.round(w.damage * w.headMult);
  applyDamage(best.target, dmg);
  return {
    shooterId: p.id,
    hit: true,
    head: !!best.head,
    targetId: best.target.id,
    damage: dmg,
    killed: !best.target.alive,
    ox: origin.x,
    oy: origin.y,
    oz: origin.z,
    dx: dir.x,
    dy: dir.y,
    dz: dir.z,
    tx: best.px,
    ty: best.py,
    tz: best.pz,
    weapon: p.weapon,
  };
}

function applyDamage(t, dmg) {
  let remaining = dmg;
  if (t.armor > 0) {
    const absorbed = Math.min(t.armor, Math.floor(remaining * 0.5));
    t.armor -= absorbed;
    remaining -= absorbed;
  }
  t.health -= remaining;
  if (t.health <= 0) {
    t.health = 0;
    t.alive = false;
    t.deaths += 1;
    t.hasBomb = false;
  }
}

function rayCapsule(o, d, t, radius, height) {
  // body cylinder approx + head sphere
  const bodyY0 = 0.2;
  const bodyY1 = height - 0.25;
  let best = null;

  // head
  const hx = t.x;
  const hy = t.y + 0.12;
  const hz = t.z;
  const head = raySphere(o, d, hx, hy, hz, 0.22);
  if (head) best = { t: head, head: true, px: o.x + d.x * head, py: o.y + d.y * head, pz: o.z + d.z * head };

  // body: ray vs vertical capsule simplified as thick ray distance to segment
  for (let s = 0; s <= 8; s++) {
    const yy = bodyY0 + ((bodyY1 - bodyY0) * s) / 8;
    const tt = raySphere(o, d, t.x, yy, t.z, radius);
    if (tt != null && (!best || tt < best.t)) {
      best = {
        t: tt,
        head: false,
        px: o.x + d.x * tt,
        py: o.y + d.y * tt,
        pz: o.z + d.z * tt,
      };
    }
  }
  return best;
}

function raySphere(o, d, cx, cy, cz, r) {
  const ox = o.x - cx;
  const oy = o.y - cy;
  const oz = o.z - cz;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const c = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : null;
}

function rayWorld(o, d, maxT) {
  let best = null;
  for (const c of MAP.colliders) {
    const t = rayAabb(
      o,
      d,
      c.x - c.halfX,
      0,
      c.z - c.halfZ,
      c.x + c.halfX,
      3.4,
      c.z + c.halfZ
    );
    if (t != null && t > 0.05 && t < maxT && (best == null || t < best)) best = t;
  }
  // walls
  const walls = [
    [-MAP.half, 0, -MAP.half, MAP.half, 6, -MAP.half + 0.6],
    [-MAP.half, 0, MAP.half - 0.6, MAP.half, 6, MAP.half],
    [-MAP.half, 0, -MAP.half, -MAP.half + 0.6, 6, MAP.half],
    [MAP.half - 0.6, 0, -MAP.half, MAP.half, 6, MAP.half],
  ];
  for (const w of walls) {
    const t = rayAabb(o, d, w[0], w[1], w[2], w[3], w[4], w[5]);
    if (t != null && t > 0.05 && t < maxT && (best == null || t < best)) best = t;
  }
  return best;
}

function rayAabb(o, d, minX, minY, minZ, maxX, maxY, maxZ) {
  let tmin = 0;
  let tmax = Infinity;
  for (const [axis, minV, maxV] of [
    ["x", minX, maxX],
    ["y", minY, maxY],
    ["z", minZ, maxZ],
  ]) {
    const ro = o[axis];
    const rd = d[axis];
    if (Math.abs(rd) < 1e-8) {
      if (ro < minV || ro > maxV) return null;
      continue;
    }
    let t1 = (minV - ro) / rd;
    let t2 = (maxV - ro) / rd;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return tmin >= 0 ? tmin : tmax >= 0 ? tmax : null;
}

export function inBombsite(x, z) {
  const b = MAP.bombsite;
  return Math.abs(x - b.x) <= b.half && Math.abs(z - b.z) <= b.half;
}

export function updateBombInteract(players, bomb, dt) {
  const events = [];
  if (!bomb.planted) {
    for (const p of players) {
      if (!p.alive || !p.hasBomb || p.team !== TEAM.ATTACKERS) {
        p.plantT = 0;
        continue;
      }
      if (p.input.plant && inBombsite(p.x, p.z) && len2(p.vx, p.vz) < 0.3) {
        p.plantT += dt;
        if (p.plantT >= MATCH.plantTime) {
          bomb.planted = true;
          bomb.x = p.x;
          bomb.z = p.z;
          bomb.fuse = MATCH.bombFuse;
          bomb.planterId = p.id;
          p.hasBomb = false;
          p.plantT = 0;
          events.push({ type: "plant", x: bomb.x, z: bomb.z, by: p.id });
        }
      } else p.plantT = 0;
    }
  } else if (!bomb.defused && bomb.fuse > 0) {
    bomb.fuse -= dt;
    for (const p of players) {
      if (!p.alive || p.team !== TEAM.DEFENDERS) {
        p.defuseT = 0;
        continue;
      }
      const dist = len2(p.x - bomb.x, p.z - bomb.z);
      const need = p.hasKit ? MATCH.defuseTimeKit : MATCH.defuseTime;
      if (p.input.defuse && dist < 1.4 && len2(p.vx, p.vz) < 0.3) {
        p.defuseT += dt;
        if (p.defuseT >= need) {
          bomb.defused = true;
          p.defuseT = 0;
          events.push({ type: "defuse", by: p.id });
        }
      } else p.defuseT = 0;
    }
    if (bomb.fuse <= 0 && !bomb.defused) {
      events.push({ type: "explode", x: bomb.x, z: bomb.z });
    }
  }
  return events;
}

export function serializePlayer(p, selfId) {
  return {
    id: p.id,
    name: p.name,
    team: p.team,
    isBot: p.isBot,
    x: +p.x.toFixed(3),
    y: +p.y.toFixed(3),
    z: +p.z.toFixed(3),
    yaw: +p.yaw.toFixed(4),
    pitch: +p.pitch.toFixed(4),
    health: p.health,
    armor: p.armor,
    money: p.money,
    weapon: p.weapon,
    mag: p.mag,
    reserve: p.reserve,
    alive: p.alive,
    ads: p.ads,
    reloading: p.reloading,
    hasBomb: p.hasBomb,
    hasKit: p.hasKit,
    plantT: +p.plantT.toFixed(2),
    defuseT: +p.defuseT.toFixed(2),
    kills: p.kills,
    deaths: p.deaths,
    grounded: p.grounded,
    seq: p.seq,
    self: p.id === selfId,
  };
}

export function botBrain(p, players, bomb, phase) {
  if (!p.isBot || !p.alive) return;
  const enemies = players.filter((o) => o.alive && o.team !== p.team);
  let tx = p.x;
  let tz = p.z;
  if (p.team === TEAM.ATTACKERS) {
    if (p.hasBomb && !bomb.planted) {
      tx = MAP.bombsite.x;
      tz = MAP.bombsite.z;
    } else if (bomb.planted && !bomb.defused) {
      // hold site
      tx = bomb.x + Math.sin(Date.now() / 800 + hashId(p.id)) * 4;
      tz = bomb.z + Math.cos(Date.now() / 800 + hashId(p.id)) * 4;
    } else if (enemies[0]) {
      tx = enemies[0].x;
      tz = enemies[0].z;
    } else {
      tx = MAP.bombsite.x;
      tz = MAP.bombsite.z;
    }
  } else {
    if (bomb.planted && !bomb.defused) {
      tx = bomb.x;
      tz = bomb.z;
    } else if (enemies[0]) {
      tx = enemies[0].x;
      tz = enemies[0].z;
    } else {
      tx = MAP.bombsite.x + 4;
      tz = MAP.bombsite.z + 4;
    }
  }

  const dx = tx - p.x;
  const dz = tz - p.z;
  const dist = len2(dx, dz) || 1;
  const desiredYaw = Math.atan2(dx, dz);
  let yawErr = desiredYaw - p.yaw;
  while (yawErr > Math.PI) yawErr -= Math.PI * 2;
  while (yawErr < -Math.PI) yawErr += Math.PI * 2;
  p.input.yaw = p.yaw + clamp(yawErr, -0.12, 0.12);
  p.input.pitch = 0;
  // move in local space toward target
  const syn = Math.sin(p.input.yaw);
  const cos = Math.cos(p.input.yaw);
  const worldAx = dx / dist;
  const worldAz = dz / dist;
  p.input.ax = clamp(worldAx * cos + worldAz * syn, -1, 1);
  p.input.az = clamp(-worldAx * syn + worldAz * cos, -1, 1);
  p.input.sprint = dist > 8;
  p.input.jump = false;
  p.input.reload = p.mag === 0;
  p.input.ads = dist < 18;

  let nearest = null;
  let nd = 40;
  for (const e of enemies) {
    const d = len2(e.x - p.x, e.z - p.z);
    if (d < nd) {
      nd = d;
      nearest = e;
    }
  }
  p.input.fire = false;
  if (nearest && nd < 28) {
    const aimYaw = Math.atan2(nearest.x - p.x, nearest.z - p.z);
    p.input.yaw = aimYaw;
    p.input.pitch = Math.atan2(nearest.y - p.y, nd) * 0.85;
    p.input.fire = Math.random() < (phase === "live" ? 0.55 : 0.2);
  }

  p.input.plant =
    p.hasBomb && !bomb.planted && inBombsite(p.x, p.z) && dist < 2.5;
  p.input.defuse =
    bomb.planted &&
    !bomb.defused &&
    p.team === TEAM.DEFENDERS &&
    len2(p.x - bomb.x, p.z - bomb.z) < 1.3;
}

export { TICK_DT };
