import * as THREE from "three";

/** First-person gun — barrel always points camera forward (-Z). */
export class ViewModel {
  constructor(camera) {
    this.camera = camera;
    this.root = new THREE.Group();
    this.root.position.set(0.22, -0.22, -0.42);
    camera.add(this.root);
    this.kick = 0;
    this.adsBlend = 0;
    this.weapon = "pistol";
    this.meshes = {};
    this.muzzle = new THREE.PointLight(0xffe0a0, 0, 5, 2);
    this.muzzle.position.set(0.02, 0.04, -0.55);
    this.root.add(this.muzzle);
  }

  async load() {
    for (const id of ["pistol", "smg", "rifle"]) {
      this.meshes[id] = this.#build(id);
      this.root.add(this.meshes[id]);
    }
    this.setWeapon("pistol");
  }

  #build(id) {
    const length = id === "rifle" ? 0.55 : id === "smg" ? 0.42 : 0.28;
    const accent =
      id === "rifle" ? 0xe8a23a : id === "smg" ? 0x4db3ff : 0xc8f542;
    const g = new THREE.Group();
    g.visible = false;

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.1, length),
      new THREE.MeshStandardMaterial({
        color: 0x1a2228,
        metalness: 0.78,
        roughness: 0.32,
      })
    );
    // Center body so barrel tip sits at -Z
    body.position.z = -length * 0.35;
    g.add(body);

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.022, length * 0.55, 10),
      new THREE.MeshStandardMaterial({
        color: 0x2c3840,
        metalness: 0.88,
        roughness: 0.22,
      })
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0.01, 0.015, -length * 0.75);
    g.add(barrel);

    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.12, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x111518, roughness: 0.82 })
    );
    grip.position.set(0, -0.1, -0.02);
    g.add(grip);

    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.016, 0.12),
      new THREE.MeshStandardMaterial({
        color: accent,
        emissive: accent,
        emissiveIntensity: 0.5,
      })
    );
    rail.position.set(0, 0.065, -0.08);
    g.add(rail);

    if (id !== "pistol") {
      const stock = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.06, 0.14),
        new THREE.MeshStandardMaterial({ color: 0x171c20, metalness: 0.5, roughness: 0.5 })
      );
      stock.position.set(0, 0.01, 0.12);
      g.add(stock);
    }

    return g;
  }

  setWeapon(id) {
    this.weapon = id;
    for (const [k, m] of Object.entries(this.meshes)) m.visible = k === id;
    const len = id === "rifle" ? 0.55 : id === "smg" ? 0.42 : 0.28;
    this.muzzle.position.z = -len * 0.95;
  }

  punch() {
    this.kick = 1;
    this.muzzle.intensity = 2.2;
    this.muzzle.userData.life = 0.05;
  }

  update(dt, ads) {
    this.kick = Math.max(0, this.kick - dt * 9);
    this.adsBlend = THREE.MathUtils.lerp(
      this.adsBlend,
      ads ? 1 : 0,
      1 - Math.pow(0.001, dt)
    );
    const hip = new THREE.Vector3(0.22, -0.22, -0.42);
    const aim = new THREE.Vector3(0.0, -0.16, -0.32);
    this.root.position.lerpVectors(hip, aim, this.adsBlend);
    this.root.position.z += this.kick * 0.04;
    this.root.rotation.x = -this.kick * 0.08;
    if (this.muzzle.userData.life > 0) {
      this.muzzle.userData.life -= dt;
      this.muzzle.intensity *= 0.55;
      if (this.muzzle.userData.life <= 0) this.muzzle.intensity = 0;
    }
  }
}
