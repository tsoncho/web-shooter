import * as THREE from "three";

/** Sample-based SFX with procedural fallbacks. */
export class GameAudio {
  constructor(camera) {
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);
    this.ctx = null;
    this.buffers = new Map();
    this.ready = false;
  }

  async init() {
    this.ctx = this.listener.context;
    if (this.ctx.state === "suspended") await this.ctx.resume();
    const files = {
      shoot_pistol: "/assets/sfx/shoot_pistol.wav",
      shoot_smg: "/assets/sfx/shoot_smg.wav",
      shoot_rifle: "/assets/sfx/shoot_rifle.wav",
      hit: "/assets/sfx/hit.wav",
      headshot: "/assets/sfx/headshot.wav",
      reload: "/assets/sfx/reload.wav",
      footstep: "/assets/sfx/footstep.wav",
      plant: "/assets/sfx/plant.wav",
      defuse: "/assets/sfx/defuse.wav",
      explode: "/assets/sfx/explode.wav",
      round: "/assets/sfx/round.wav",
    };
    await Promise.all(
      Object.entries(files).map(async ([key, url]) => {
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error("missing");
          const arr = await res.arrayBuffer();
          const buf = await this.ctx.decodeAudioData(arr.slice(0));
          this.buffers.set(key, buf);
        } catch {
          this.buffers.set(key, this.#synth(key));
        }
      })
    );
    this.ready = true;
  }

  #synth(kind) {
    const sr = this.ctx.sampleRate;
    const dur = kind.includes("explode") ? 0.7 : kind.includes("shoot") ? 0.12 : 0.18;
    const n = Math.floor(sr * dur);
    const buf = this.ctx.createBuffer(1, n, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const env = Math.exp(-t * (kind === "explode" ? 4 : 18));
      if (kind.startsWith("shoot")) {
        d[i] =
          (Math.sin(2 * Math.PI * (180 + t * 900) * t) * 0.4 +
            (Math.random() * 2 - 1) * 0.35) *
          env;
      } else if (kind === "footstep") {
        d[i] = (Math.random() * 2 - 1) * env * 0.25 * Math.sin(t * 40);
      } else if (kind === "hit" || kind === "headshot") {
        d[i] = Math.sin(2 * Math.PI * (900 - t * 1200) * t) * env * 0.5;
      } else {
        d[i] = (Math.random() * 2 - 1) * env * 0.4;
      }
    }
    return buf;
  }

  play(name, { volume = 0.35, rate = 1, position = null } = {}) {
    if (!this.ready) return;
    const buffer = this.buffers.get(name);
    if (!buffer) return;
    if (position) {
      const sound = new THREE.PositionalAudio(this.listener);
      sound.setBuffer(buffer);
      sound.setRefDistance(6);
      sound.setVolume(volume);
      sound.setPlaybackRate(rate);
      const obj = new THREE.Object3D();
      obj.position.copy(position);
      obj.add(sound);
      // orphan briefly
      sound.play();
      setTimeout(() => {
        sound.disconnect();
      }, (buffer.duration / rate) * 1000 + 50);
      return;
    }
    const sound = new THREE.Audio(this.listener);
    sound.setBuffer(buffer);
    sound.setVolume(volume);
    sound.setPlaybackRate(rate);
    sound.play();
  }

  shoot(weapon, pos) {
    const key =
      weapon === "rifle"
        ? "shoot_rifle"
        : weapon === "smg"
          ? "shoot_smg"
          : "shoot_pistol";
    this.play(key, { volume: 0.4, position: pos });
  }
}
