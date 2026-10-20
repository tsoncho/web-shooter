import * as THREE from "three";
import { PHASE, TEAM, WEAPONS } from "shared/constants.js";
import { NetClient } from "./net.js";
import { createDepotMap } from "./map.js";
import { EntityManager } from "./entities.js";
import { ViewModel } from "./viewmodel.js";
import { GameAudio } from "./audio.js";
import { Hud } from "./hud.js";
import { createPost } from "./post.js";

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.net = new NetClient();
    this.hud = new Hud();
    this.clock = new THREE.Clock();
    this.seq = 0;
    this.keys = new Set();
    this.look = { yaw: 0, pitch: 0 };
    this.locked = false;
    this.fireHeld = false;
    this.ads = false;
    this.snap = null;
    this.me = null;
    this.prevHp = 100;
    this.footT = 0;
    this.recoilPunch = 0;
    this.baseFov = 75;
    this.team = TEAM.ATTACKERS;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.baseFov, innerWidth / innerHeight, 0.05, 160);
    this.yawObject = new THREE.Object3D();
    this.pitchObject = new THREE.Object3D();
    this.pitchObject.add(this.camera);
    this.yawObject.add(this.pitchObject);
    this.scene.add(this.yawObject);

    this.view = new ViewModel(this.camera);
    this.audio = new GameAudio(this.camera);
    this.entities = new EntityManager(this.scene);
    this.post = null;

    this.#bindUi();
    this.#bindInput();
    window.addEventListener("resize", () => this.#resize());
  }

  #lock() {
    this.canvas.requestPointerLock();
  }

  async init() {
    await createDepotMap(this.scene, this.renderer);
    this.post = createPost(this.renderer, this.scene, this.camera);
    await Promise.all([this.view.load(), this.entities.load()]);
    this.#tick();
  }

  #bindUi() {
    let selectedTeam = TEAM.ATTACKERS;
    document.querySelectorAll(".team-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".team-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        selectedTeam = Number(btn.dataset.team);
      });
    });
    document.getElementById("join-btn").addEventListener("click", async () => {
      const name = document.getElementById("name-input").value.trim() || "Operative";
      const room = document.getElementById("room-input").value.trim().toUpperCase();
      this.team = selectedTeam;
      this.hud.setError("");
      try {
        await this.audio.init();
      } catch {
        /* ignore */
      }
      this.net.onJoined = () => {
        this.hud.showGame();
        this.hud.banner(`ROOM ${this.net.room}`, 3);
        this.#lock();
      };
      this.net.onError = (e) => this.hud.setError(e.message || "Join failed");
      this.net.onSnapshot = (snap) => this.#onSnap(snap);
      this.net.join({ name, room, team: selectedTeam });
    });

    document.querySelectorAll("#buy-menu [data-buy]").forEach((btn) => {
      btn.addEventListener("click", () => this.net.buy(btn.dataset.buy));
    });
  }

  #bindInput() {
    window.addEventListener("keydown", (e) => {
      this.keys.add(e.code);
      if (e.code === "KeyB") {
        if (this.snap?.phase === PHASE.BUY) this.hud.toggleBuy();
      }
      if (e.code === "Tab") {
        e.preventDefault();
        this.hud.toggleScore(true);
      }
    });
    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
      if (e.code === "Tab") this.hud.toggleScore(false);
    });
    this.canvas.addEventListener("mousedown", (e) => {
      if (!this.locked) {
        this.#lock();
        return;
      }
      if (e.button === 0) this.fireHeld = true;
      if (e.button === 2) this.ads = true;
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.fireHeld = false;
      if (e.button === 2) this.ads = false;
    });
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === this.canvas;
    });
    document.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      const sens = 0.0022;
      this.look.yaw -= e.movementX * sens;
      this.look.pitch -= e.movementY * sens;
      this.look.pitch = Math.max(-1.4, Math.min(1.4, this.look.pitch));
    });
  }

  #onSnap(snap) {
    if (snap.partial) {
      for (const ev of snap.events || []) this.#handleEvent(ev, this.snap);
      return;
    }
    const prev = this.snap;
    this.snap = snap;
    this.me = snap.players.find((p) => p.id === this.net.id) || null;

    if (this.me) {
      if (this.me.health < this.prevHp) this.hud.flashDamage();
      this.prevHp = this.me.health;
      this.view.setWeapon(this.me.weapon);
      const obj = this.yawObject;
      if (!this.locked || !this.me.alive) {
        obj.position.set(this.me.x, this.me.y, this.me.z);
        this.look.yaw = this.me.yaw;
        this.look.pitch = this.me.pitch;
      } else {
        obj.position.x = THREE.MathUtils.lerp(obj.position.x, this.me.x, 0.35);
        obj.position.z = THREE.MathUtils.lerp(obj.position.z, this.me.z, 0.35);
        obj.position.y = this.me.y;
      }
    }

    this.entities.sync(snap.players, this.net.id, snap.bomb);
    for (const ev of snap.events || []) this.#handleEvent(ev, prev);
  }

  #handleEvent(ev, prev) {
    if (!ev) return;
    if (ev.type === "shot") {
      this.entities.addTracer(ev);
      const pos = new THREE.Vector3(ev.ox, ev.oy, ev.oz);
      this.audio.shoot(ev.weapon, pos);
      if (ev.shooterId === this.net.id) {
        this.view.punch();
        this.recoilPunch += WEAPONS[ev.weapon]?.recoil || 0.02;
        if (ev.hit) {
          this.hud.flashHit();
          this.audio.play(ev.head ? "headshot" : "hit", { volume: 0.35 });
        }
      }
    }
    if (ev.type === "kill") {
      const names = Object.fromEntries((this.snap?.players || prev?.players || []).map((p) => [p.id, p.name]));
      this.hud.pushKill(names[ev.killer] || "?", names[ev.victim] || "?", ev.head);
    }
    if (ev.type === "phase") {
      this.audio.play("round", { volume: 0.3 });
      if (ev.phase === PHASE.BUY) this.hud.banner("BUY TIME", 2);
      if (ev.phase === PHASE.LIVE) {
        this.hud.banner("ROUND LIVE", 1.5);
        this.hud.toggleBuy(false);
      }
    }
    if (ev.type === "round_end") {
      const w = ev.winner === TEAM.ATTACKERS ? "ATTACKERS WIN" : "DEFENDERS WIN";
      this.hud.banner(`${w} · ${ev.reason}`, 4);
    }
    if (ev.type === "plant") this.audio.play("plant", { volume: 0.45 });
    if (ev.type === "defuse") this.audio.play("defuse", { volume: 0.45 });
    if (ev.type === "explode") this.audio.play("explode", { volume: 0.55 });
    if (ev.type === "match_end") {
      const w = ev.winner === TEAM.ATTACKERS ? "ATTACKERS" : "DEFENDERS";
      this.hud.banner(`MATCH OVER · ${w}`, 6);
    }
  }

  #sendInput() {
    if (!this.net.socket) return;
    const ax =
      (this.keys.has("KeyD") || this.keys.has("ArrowRight") ? 1 : 0) -
      (this.keys.has("KeyA") || this.keys.has("ArrowLeft") ? 1 : 0);
    const az =
      (this.keys.has("KeyW") || this.keys.has("ArrowUp") ? 1 : 0) -
      (this.keys.has("KeyS") || this.keys.has("ArrowDown") ? 1 : 0);
    this.seq += 1;
    this.net.sendInput({
      seq: this.seq,
      ax,
      az,
      yaw: this.look.yaw,
      pitch: this.look.pitch - this.recoilPunch * 0.35,
      jump: this.keys.has("Space"),
      fire: this.fireHeld && this.locked,
      reload: this.keys.has("KeyR"),
      ads: this.ads,
      sprint: this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"),
      plant: this.keys.has("KeyE"),
      defuse: this.keys.has("KeyE"),
    });
  }

  #predictLocal(dt) {
    this.yawObject.rotation.y = this.look.yaw;
    this.pitchObject.rotation.x = this.look.pitch - this.recoilPunch * 0.35;
    this.recoilPunch = Math.max(0, this.recoilPunch - dt * 1.8);

    const targetFov = this.ads ? 55 : this.baseFov;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 1 - Math.pow(0.001, dt));
    this.camera.updateProjectionMatrix();

    if (!this.locked || !this.me?.alive) return;

    const speed = 6.2 * (this.ads ? 0.72 : 1);
    const ax =
      (this.keys.has("KeyD") ? 1 : 0) - (this.keys.has("KeyA") ? 1 : 0);
    const az =
      (this.keys.has("KeyW") ? 1 : 0) - (this.keys.has("KeyS") ? 1 : 0);
    if (ax || az) {
      const syn = Math.sin(this.look.yaw);
      const cos = Math.cos(this.look.yaw);
      let mx = cos * ax + syn * az;
      let mz = -syn * ax + cos * az;
      const len = Math.hypot(mx, mz) || 1;
      mx /= len;
      mz /= len;
      this.yawObject.position.x += mx * speed * dt;
      this.yawObject.position.z += mz * speed * dt;
      this.footT -= dt;
      if (this.footT <= 0) {
        this.audio.play("footstep", { volume: 0.15, rate: 0.9 + Math.random() * 0.2 });
        this.footT = this.keys.has("ShiftLeft") ? 0.28 : 0.38;
      }
    }
  }

  #resize() {
    const w = innerWidth;
    const h = innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.post?.setSize(w, h);
  }

  #tick = () => {
    requestAnimationFrame(this.#tick);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.#sendInput();
    this.#predictLocal(dt);
    this.view.update(dt, this.ads);
    this.entities.update(dt);
    this.hud.update(dt, this.snap, this.me);
    if (this.post) this.post.render();
    else this.renderer.render(this.scene, this.camera);
  };
}
