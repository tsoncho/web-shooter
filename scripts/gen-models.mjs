import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

if (typeof globalThis.FileReader === "undefined") {
  globalThis.FileReader = class FileReader {
    result = null;
    onloadend = null;
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((ab) => {
        this.result = ab;
        this.onloadend?.();
      });
    }
  };
}

const outDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "client",
  "assets",
  "models"
);
fs.mkdirSync(outDir, { recursive: true });

function exportGlb(name, build) {
  return new Promise((resolve, reject) => {
    const scene = new THREE.Scene();
    build(scene);
    const exporter = new GLTFExporter();
    exporter.parse(
      scene,
      (result) => {
        fs.writeFileSync(path.join(outDir, `${name}.glb`), Buffer.from(result));
        console.log("wrote", name, result.byteLength);
        resolve();
      },
      reject,
      { binary: true }
    );
  });
}

await exportGlb("operator", (scene) => {
  const gear = new THREE.MeshStandardMaterial({
    color: 0x2f3a42,
    roughness: 0.55,
    metalness: 0.35,
  });
  const vest = new THREE.MeshStandardMaterial({
    color: 0x1c242a,
    roughness: 0.65,
    metalness: 0.25,
  });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc4a882, roughness: 0.78 });
  const accent = new THREE.MeshStandardMaterial({
    color: 0xc8f542,
    emissive: 0xc8f542,
    emissiveIntensity: 0.35,
  });

  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.85, 10), gear);
  legs.position.y = 0.45;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.32), vest);
  torso.position.y = 1.15;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), skin);
  head.position.y = 1.68;
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), gear);
  helm.position.y = 1.72;
  const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.35, 4, 8), gear);
  armL.position.set(-0.38, 1.15, 0.05);
  const armR = armL.clone();
  armR.position.x = 0.38;
  const rifle = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.09, 0.65),
    new THREE.MeshStandardMaterial({ color: 0x151a1e, metalness: 0.8, roughness: 0.3 })
  );
  rifle.position.set(0.28, 1.1, 0.35);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.04, 0.34), accent);
  stripe.position.set(0, 1.35, 0);

  scene.add(legs, torso, head, helm, armL, armR, rifle, stripe);
});

function gun(name, length, color) {
  return exportGlb(name, (scene) => {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.11, length),
      new THREE.MeshStandardMaterial({ color: 0x1a2228, metalness: 0.78, roughness: 0.3 })
    );
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.026, length * 0.5, 12),
      new THREE.MeshStandardMaterial({ color: 0x2c3840, metalness: 0.88, roughness: 0.22 })
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0.012, 0.012, -length * 0.52);
    const accent = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.018, 0.12),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.55,
        roughness: 0.4,
      })
    );
    accent.position.set(0, 0.07, -0.02);
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.14, 0.09),
      new THREE.MeshStandardMaterial({ color: 0x111518, roughness: 0.82 })
    );
    grip.position.set(0, -0.11, 0.06);
    const stock =
      name === "pistol"
        ? null
        : new THREE.Mesh(
            new THREE.BoxGeometry(0.05, 0.07, 0.18),
            new THREE.MeshStandardMaterial({ color: 0x171c20, metalness: 0.5, roughness: 0.5 })
          );
    if (stock) stock.position.set(0, 0.02, length * 0.35);
    scene.add(body, barrel, accent, grip);
    if (stock) scene.add(stock);
  });
}

await gun("pistol", 0.3, 0xc8f542);
await gun("smg", 0.48, 0x4db3ff);
await gun("rifle", 0.7, 0xe8a23a);
console.log("models ready");
