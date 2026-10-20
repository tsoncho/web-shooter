import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export class ViewModel {
  constructor(camera) {
    this.camera = camera;
    this.root = new THREE.Group();
    this.root.position.set(0.28, -0.28, -0.5);
    camera.add(this.root);
    this.kick = 0;
    this.adsBlend = 0;
    this.weapon = "pistol";
    this.meshes = {};
    this.muzzle = new THREE.PointLight(0xffe0a0, 0, 6, 2);
    this.muzzle.position.set(0, 0.05, -0.75);
    this.root.add(this.muzzle);
  }

  async load() {
    const loader = new GLTFLoader();
    for (const id of ["pistol", "smg", "rifle"]) {
      try {
        const gltf = await loader.loadAsync(`/assets/models/${id}.glb`);
        const scene = gltf.scene;
        scene.visible = false;
        scene.scale.setScalar(id === "pistol" ? 0.85 : 1);
        scene.position.set(0, 0, 0);
        scene.rotation.y = Math.PI;
        this.root.add(scene);
        this.meshes[id] = scene;
      } catch {
        this.meshes[id] = this.#procedural(id);
        this.root.add(this.meshes[id]);
      }
    }
    this.setWeapon("pistol");
  }

  #procedural(id) {
    const g = new THREE.Group();
    g.visible = false;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(
        id === "pistol" ? 0.1 : 0.12,
        0.14,
        id === "rifle" ? 0.7 : id === "smg" ? 0.55 : 0.35
      ),
      new THREE.MeshStandardMaterial({
        color: 0x1a2228,
        metalness: 0.75,
        roughness: 0.35,
      })
    );
    g.add(body);
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.03, id === "rifle" ? 0.45 : 0.28, 10),
      new THREE.MeshStandardMaterial({
        color: 0x2c3840,
        metalness: 0.85,
        roughness: 0.25,
      })
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0.02, 0.02, id === "rifle" ? -0.5 : -0.35);
    g.add(barrel);
    const accent = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.025, 0.16),
      new THREE.MeshStandardMaterial({
        color: 0xc8f542,
        emissive: 0xc8f542,
        emissiveIntensity: 0.55,
      })
    );
    accent.position.set(0, 0.1, -0.05);
    g.add(accent);
    return g;
  }

  setWeapon(id) {
    this.weapon = id;
    for (const [k, m] of Object.entries(this.meshes)) m.visible = k === id;
  }

  punch() {
    this.kick = 1;
    this.muzzle.intensity = 2.4;
    this.muzzle.userData.life = 0.05;
  }

  update(dt, ads) {
    this.kick = Math.max(0, this.kick - dt * 9);
    this.adsBlend = THREE.MathUtils.lerp(this.adsBlend, ads ? 1 : 0, 1 - Math.pow(0.001, dt));
    const hip = new THREE.Vector3(0.28, -0.28, -0.5);
    const aim = new THREE.Vector3(0.0, -0.18, -0.35);
    this.root.position.lerpVectors(hip, aim, this.adsBlend);
    this.root.position.z += this.kick * 0.05;
    this.root.rotation.x = -this.kick * 0.1;
    if (this.muzzle.userData.life > 0) {
      this.muzzle.userData.life -= dt;
      this.muzzle.intensity *= 0.55;
      if (this.muzzle.userData.life <= 0) this.muzzle.intensity = 0;
    }
  }
}
