import * as THREE from "three";
import { TEAM } from "shared/constants.js";

export class EntityManager {
  constructor(scene) {
    this.scene = scene;
    this.meshes = new Map();
    this.bombMesh = null;
    this.tracers = [];
    this.deaths = new Map();
  }

  async load() {
    this.bombMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.25, 0.35),
      new THREE.MeshStandardMaterial({
        color: 0x222222,
        emissive: 0xff2200,
        emissiveIntensity: 0.6,
        metalness: 0.7,
        roughness: 0.35,
      })
    );
    this.bombMesh.visible = false;
    this.scene.add(this.bombMesh);
  }

  #makeProxy(team) {
    const g = new THREE.Group();
    const isAtk = team === TEAM.ATTACKERS;
    const suit = new THREE.MeshStandardMaterial({
      color: isAtk ? 0x6a4a28 : 0x2a4a62,
      roughness: 0.55,
      metalness: 0.28,
    });
    const vest = new THREE.MeshStandardMaterial({
      color: isAtk ? 0x3a2a18 : 0x1a2a38,
      roughness: 0.65,
      metalness: 0.2,
    });
    const skin = new THREE.MeshStandardMaterial({ color: 0xc4a882, roughness: 0.75 });
    const accent = new THREE.MeshStandardMaterial({
      color: isAtk ? 0xe8a23a : 0x4db3ff,
      emissive: isAtk ? 0xe8a23a : 0x4db3ff,
      emissiveIntensity: 0.35,
    });

    const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.8, 10), suit);
    legs.position.y = 0.4;
    legs.castShadow = true;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.65, 0.3), vest);
    torso.position.y = 1.1;
    torso.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 14), skin);
    head.position.y = 1.62;
    head.castShadow = true;
    const helm = new THREE.Mesh(
      new THREE.SphereGeometry(0.19, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      suit
    );
    helm.position.y = 1.66;
    const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.32, 4, 8), suit);
    armL.position.set(-0.36, 1.1, 0.05);
    const armR = armL.clone();
    armR.position.x = 0.36;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.05, 0.32), accent);
    stripe.position.set(0, 1.28, 0);
    const gun = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.08, 0.55),
      new THREE.MeshStandardMaterial({ color: 0x151a1e, metalness: 0.8, roughness: 0.3 })
    );
    gun.position.set(0.26, 1.05, -0.35);
    gun.name = "gun";

    g.add(legs, torso, head, helm, armL, armR, stripe, gun);
    return g;
  }

  playDeath(id) {
    const entry = this.meshes.get(id);
    if (!entry || this.deaths.has(id)) return;
    const mesh = entry.mesh;
    mesh.visible = true;
    this.deaths.set(id, {
      mesh,
      t: 0,
      yaw: mesh.rotation.y,
      x: mesh.position.x,
      z: mesh.position.z,
      fallDir: Math.random() > 0.5 ? 1 : -1,
    });
  }

  sync(players, localId, bomb) {
    const seen = new Set();
    for (const p of players) {
      seen.add(p.id);
      let entry = this.meshes.get(p.id);
      if (!entry) {
        const mesh = this.#makeProxy(p.team);
        this.scene.add(mesh);
        entry = {
          mesh,
          team: p.team,
          tx: p.x,
          tz: p.z,
          tyaw: p.yaw,
          vx: 0,
          vz: 0,
        };
        mesh.position.set(p.x, 0, p.z);
        mesh.rotation.y = p.yaw;
        this.meshes.set(p.id, entry);
      }

      const dying = this.deaths.has(p.id);
      const hide = p.id === localId || (!p.alive && !dying);
      entry.mesh.visible = !hide;

      if (p.alive) {
        this.deaths.delete(p.id);
        entry.mesh.rotation.x = 0;
        entry.mesh.rotation.z = 0;
        entry.tx = p.x;
        entry.tz = p.z;
        entry.tyaw = p.yaw;
        entry.vx = p.vx || 0;
        entry.vz = p.vz || 0;
      } else if (!dying && p.id !== localId) {
        entry.mesh.visible = false;
      }
    }
    for (const [id, entry] of this.meshes) {
      if (!seen.has(id)) {
        this.scene.remove(entry.mesh);
        this.meshes.delete(id);
        this.deaths.delete(id);
      }
    }

    if (bomb && (bomb.planted || bomb.loose)) {
      this.bombMesh.visible = true;
      this.bombMesh.position.set(bomb.x, 0.2, bomb.z);
      this.bombMesh.material.emissiveIntensity = bomb.planted
        ? 0.4 + Math.sin(performance.now() * 0.02) * 0.4
        : 0.3;
    } else {
      this.bombMesh.visible = false;
    }
  }

  addTracer(shot) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(shot.ox, shot.oy, shot.oz),
      new THREE.Vector3(shot.tx, shot.ty, shot.tz),
    ]);
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({
        color: 0xffe0a0,
        transparent: true,
        opacity: 0.9,
      })
    );
    line.userData.life = 0.08;
    this.scene.add(line);
    this.tracers.push(line);
  }

  update(dt) {
    for (const [id, entry] of this.meshes) {
      if (!entry.mesh.visible || this.deaths.has(id)) continue;
      const k = 1 - Math.pow(0.0008, dt);
      entry.mesh.position.x = THREE.MathUtils.lerp(entry.mesh.position.x, entry.tx, k);
      entry.mesh.position.z = THREE.MathUtils.lerp(entry.mesh.position.z, entry.tz, k);
      let dyaw = entry.tyaw - entry.mesh.rotation.y;
      while (dyaw > Math.PI) dyaw -= Math.PI * 2;
      while (dyaw < -Math.PI) dyaw += Math.PI * 2;
      entry.mesh.rotation.y += dyaw * k;
      const spd = Math.hypot(entry.vx, entry.vz);
      if (spd > 1) {
        entry.mesh.position.y = Math.sin(performance.now() * 0.014 * spd) * 0.03;
      } else {
        entry.mesh.position.y = THREE.MathUtils.lerp(entry.mesh.position.y, 0, k);
      }
    }

    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.userData.life -= dt;
      t.material.opacity = Math.max(0, t.userData.life * 10);
      if (t.userData.life <= 0) {
        this.scene.remove(t);
        t.geometry.dispose();
        t.material.dispose();
        this.tracers.splice(i, 1);
      }
    }

    for (const [id, d] of this.deaths) {
      d.t += dt;
      const ease = Math.min(1, d.t / 0.55);
      const k = 1 - Math.pow(1 - ease, 3);
      d.mesh.visible = true;
      d.mesh.position.set(d.x, k * 0.15, d.z);
      d.mesh.rotation.y = d.yaw;
      d.mesh.rotation.x = k * (Math.PI / 2) * 0.92;
      d.mesh.rotation.z = k * 0.4 * d.fallDir;
      if (d.t > 1.6) {
        d.mesh.visible = false;
        d.mesh.rotation.x = 0;
        d.mesh.rotation.z = 0;
        this.deaths.delete(id);
      }
    }
  }
}
