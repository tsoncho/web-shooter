import * as THREE from "three";
import { MAP } from "shared/constants.js";

export async function createDepotMap(scene, renderer) {
  const root = new THREE.Group();
  root.name = "depot";

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x2a3238,
    roughness: 0.92,
    metalness: 0.08,
  });
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x3a454d,
    roughness: 0.86,
    metalness: 0.15,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xc8f542,
    emissive: 0x6a8218,
    emissiveIntensity: 0.55,
    roughness: 0.4,
    metalness: 0.2,
  });
  const siteMat = new THREE.MeshStandardMaterial({
    color: 0x4a3020,
    emissive: 0xe8a23a,
    emissiveIntensity: 0.2,
    roughness: 0.9,
    metalness: 0.05,
  });

  await applyTextures(floorMat, wallMat, renderer);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP.half * 2, MAP.half * 2),
    floorMat
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);

  const grid = new THREE.GridHelper(MAP.half * 2, 36, 0x4a5a64, 0x243038);
  grid.position.y = 0.02;
  root.add(grid);

  const wallH = 5.5;
  const walls = [
    [0, -MAP.half, MAP.half * 2, 1],
    [0, MAP.half, MAP.half * 2, 1],
    [-MAP.half, 0, 1, MAP.half * 2],
    [MAP.half, 0, 1, MAP.half * 2],
  ];
  for (const [x, z, w, d] of walls) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), wallMat);
    m.position.set(x, wallH / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
  }

  for (const c of MAP.colliders) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(c.halfX * 2, 3.2, c.halfZ * 2),
      wallMat
    );
    m.position.set(c.x, 1.6, c.z);
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(c.halfX * 2 + 0.05, 0.12, c.halfZ * 2 + 0.05),
      accentMat
    );
    trim.position.set(c.x, 3.25, c.z);
    root.add(trim);
  }

  const site = new THREE.Mesh(
    new THREE.CylinderGeometry(MAP.bombsite.half, MAP.bombsite.half, 0.08, 32),
    siteMat
  );
  site.position.set(MAP.bombsite.x, 0.05, MAP.bombsite.z);
  root.add(site);

  const siteRing = new THREE.Mesh(
    new THREE.RingGeometry(MAP.bombsite.half - 0.15, MAP.bombsite.half, 48),
    new THREE.MeshBasicMaterial({
      color: 0xe8a23a,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
    })
  );
  siteRing.rotation.x = -Math.PI / 2;
  siteRing.position.set(MAP.bombsite.x, 0.1, MAP.bombsite.z);
  root.add(siteRing);

  // spawn pads
  for (const s of MAP.attackerSpawns) {
    root.add(pad(s.x, s.z, 0xe8a23a));
  }
  for (const s of MAP.defenderSpawns) {
    root.add(pad(s.x, s.z, 0x4db3ff));
  }

  const hemi = new THREE.HemisphereLight(0xb7c8d4, 0x1a1510, 0.55);
  root.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2dd, 1.35);
  sun.position.set(18, 30, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -40;
  sun.shadow.camera.far = 80;
  root.add(sun);

  const fill = new THREE.PointLight(0x4db3ff, 0.35, 50, 2);
  fill.position.set(10, 6, 10);
  root.add(fill);
  const warm = new THREE.PointLight(0xe8a23a, 0.4, 40, 2);
  warm.position.set(MAP.bombsite.x, 4, MAP.bombsite.z);
  root.add(warm);

  await loadEnv(scene, renderer);
  scene.add(root);
  scene.fog = new THREE.Fog(0x0a1014, 28, 75);
  scene.background = new THREE.Color(0x0a1014);
  return root;
}

function pad(x, z, color) {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(0.7, 20),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.35,
      roughness: 0.6,
    })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.04, z);
  return m;
}

async function applyTextures(floorMat, wallMat, renderer) {
  const loader = new THREE.TextureLoader();
  const tryLoad = (url) =>
    new Promise((resolve) => {
      loader.load(
        url,
        (t) => resolve(t),
        undefined,
        () => resolve(null)
      );
    });

  const floorMap = await tryLoad("/assets/textures/floor_diff.jpg");
  const wallMap = await tryLoad("/assets/textures/wall_diff.jpg");
  if (floorMap) {
    floorMap.wrapS = floorMap.wrapT = THREE.RepeatWrapping;
    floorMap.repeat.set(18, 18);
    floorMap.colorSpace = THREE.SRGBColorSpace;
    floorMap.anisotropy = renderer.capabilities.getMaxAnisotropy();
    floorMat.map = floorMap;
    floorMat.needsUpdate = true;
  }
  if (wallMap) {
    wallMap.wrapS = wallMap.wrapT = THREE.RepeatWrapping;
    wallMap.repeat.set(4, 2);
    wallMap.colorSpace = THREE.SRGBColorSpace;
    wallMat.map = wallMap;
    wallMat.needsUpdate = true;
  }
}

async function loadEnv(scene, renderer) {
  try {
    const { RGBELoader } = await import("three/addons/loaders/RGBELoader.js");
    const hdr = await new Promise((resolve, reject) => {
      new RGBELoader().load(
        "/assets/hdr/env.hdr",
        resolve,
        undefined,
        reject
      );
    });
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = hdr;
    // keep solid background for readability; env only for PBR reflections
  } catch {
    // procedural env fallback
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.add(new THREE.HemisphereLight(0xbfd0dc, 0x2a2018, 1));
    scene.environment = pmrem.fromScene(envScene, 0.04).texture;
    pmrem.dispose();
  }
}
