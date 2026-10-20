import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { TEAM } from "shared/constants.js";

export class EntityManager {
  constructor(scene) {
    this.scene = scene;
    this.meshes = new Map();
    this.template = null;
    this.bombMesh = null;
    this.loader = new GLTFLoader();
    this.tracers = [];
  }

  async load() {
    try {
      const gltf = await this.loader.loadAsync("/assets/models/operator.glb");
      this.template = gltf.scene;
      const box = new THREE.Box3().setFromObject(this.template);
      const size = new THREE.Vector3();
      box.getSize(size);
      if (size.y > 0.01) {
        const scale = 1.75 / size.y;
        this.template.scale.setScalar(scale);
        this.template.position.y = -box.min.y * scale;
      }
      this.template.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
    } catch {
      this.template = null;
    }
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
    if (this.template) {
      const root = this.template.clone(true);
      root.scale.setScalar(1);
      const color = team === TEAM.ATTACKERS ? 0xe8a23a : 0x4db3ff;
      root.traverse((o) => {
        if (o.isMesh && o.material) {
          o.material = o.material.clone();
          if (o.material.emissive) {
            o.material.emissive = new THREE.Color(color);
            o.material.emissiveIntensity = 0.15;
          }
        }
      });
      return root;
    }
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.4, 0.95, 4, 8),
      new THREE.MeshStandardMaterial({
        color: team === TEAM.ATTACKERS ? 0x8a5a28 : 0x2a5a7a,
        roughness: 0.55,
        metalness: 0.25,
      })
    );
    body.position.y = 1.0;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xd2b48c, roughness: 0.7 })
    );
    head.position.y = 1.72;
    g.add(head);
    return g;
  }

  sync(players, localId, bomb) {
    const seen = new Set();
    for (const p of players) {
      seen.add(p.id);
      let entry = this.meshes.get(p.id);
      if (!entry) {
        const mesh = this.#makeProxy(p.team);
        this.scene.add(mesh);
        entry = { mesh, team: p.team };
        this.meshes.set(p.id, entry);
      }
      const hide = p.id === localId || !p.alive;
      entry.mesh.visible = !hide;
      if (!hide) {
        entry.mesh.position.set(p.x, 0, p.z);
        entry.mesh.rotation.y = p.yaw;
      }
    }
    for (const [id, entry] of this.meshes) {
      if (!seen.has(id)) {
        this.scene.remove(entry.mesh);
        this.meshes.delete(id);
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
        opacity: 0.85,
      })
    );
    line.userData.life = 0.07;
    this.scene.add(line);
    this.tracers.push(line);
  }

  update(dt) {
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
  }
}
