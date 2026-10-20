import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";

export function createPost(renderer, scene, camera) {
  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const ssao = new SSAOPass(scene, camera, size.x, size.y);
  ssao.kernelRadius = 6;
  ssao.minDistance = 0.002;
  ssao.maxDistance = 0.1;
  ssao.output = SSAOPass.OUTPUT.Default;
  composer.addPass(ssao);

  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.18, 0.5, 0.92);
  composer.addPass(bloom);

  const smaa = new SMAAPass(size.x * renderer.getPixelRatio(), size.y * renderer.getPixelRatio());
  composer.addPass(smaa);
  composer.addPass(new OutputPass());

  return {
    composer,
    setSize(w, h) {
      composer.setSize(w, h);
      ssao.setSize(w, h);
      bloom.setSize(w, h);
    },
    render() {
      composer.render();
    },
  };
}
